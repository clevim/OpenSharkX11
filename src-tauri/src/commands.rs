use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tracing::{info, warn};

use crate::{
    driver::{AttackShark, AttackSharkBle, ConnMode, DriverVariant},
    protocols::{
        dpi::{DpiConfig, LedMode},
        user_prefs::UserPrefsConfig,
        polling_rate::{PollingRate, PollingRateConfig},
        macros::MacrosConfig,
        custom_macro::CustomMacroConfig,
    },
    state::{AppState, ManagedState, battery_override, save_state, save_profiles},
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const SAFE_DELAY_MS: u64 = 300;
const BTN_ORDER: [&str; 8] = ["left","right","middle","forward","backward","dpi","scrollUp","scrollDown"];

fn build_dpi_cfg(s: &AppState) -> DpiConfig {
    
    DpiConfig {
        dpi_values:    s.dpi.values,
        // AppState é 0-based (igual ao React e ao evento mouse:dpi_stage);
        // o report 0x04 quer 1-6.
        active_stage:  s.dpi.active_stage + 1,
        angle_snap:    s.dpi.angle_snap,
        ripple_control: s.dpi.ripple_control,
        stage_colors:  s.lighting.stage_colors.clone(),
        led_mode:      LedMode::Off,
    }
}

fn build_user_prefs_cfg(s: &AppState, battery: i32) -> UserPrefsConfig {
    
    if let Some(ov) = battery_override(battery) {
        UserPrefsConfig {
            light_mode:      ov.mode,
            rgb:             ov.rgb,
            led_speed:       ov.led_speed,
            sleep_time:      0.5,
            deep_sleep_time: 10,
            key_response:    s.performance.key_response,
        }
    } else {
        UserPrefsConfig {
            light_mode:      crate::protocols::user_prefs::LightMode::from_u8(s.lighting.mode),
            rgb:             s.lighting.global_color.clone(),
            led_speed:       s.lighting.led_speed,
            sleep_time:      0.5,
            deep_sleep_time: 10,
            key_response:    s.performance.key_response,
        }
    }
}

fn build_macros_cfg(s: &AppState) -> MacrosConfig {
    
    let default_keys = BTN_ORDER;
    let mut entries = MacrosConfig::default();
    for (i, key) in default_keys.iter().enumerate() {
        if let Some(binding) = s.buttons.get(*key) {
            entries.buttons[i] = binding.to_macro_entry();
        }
    }
    entries
}

async fn apply_lighting_only(driver: &DriverVariant, s: &AppState, battery: i32) -> Result<(), String> {
    let dpi_cfg    = build_dpi_cfg(s);
    let prefs_cfg  = build_user_prefs_cfg(s, battery);
    match driver {
        DriverVariant::Usb(d) => {
            d.set_dpi(&dpi_cfg)?;
            tokio::time::sleep(std::time::Duration::from_millis(SAFE_DELAY_MS)).await;
            d.set_user_prefs(&prefs_cfg)?;
        }
        DriverVariant::Ble(d) => {
            d.set_dpi(&dpi_cfg).await?;
            d.set_user_prefs(&prefs_cfg).await?;
        }
    }
    Ok(())
}

async fn apply_all(driver: &DriverVariant, s: &AppState, battery: i32) -> Result<(), String> {
    apply_lighting_only(driver, s, battery).await?;

    let polling_cfg = PollingRateConfig { rate: PollingRate::from_hz(s.polling_rate) };
    let macros_cfg  = build_macros_cfg(s);
    let cm          = &s.custom_macro;

    match driver {
        DriverVariant::Usb(d) => {
            d.set_polling_rate(&polling_cfg)?;
            d.set_macros(&macros_cfg)?;
            if cm.enabled && !cm.events.is_empty() {
                let cfg = CustomMacroConfig {
                    enabled:       true,
                    target_button: cm.target_button,
                    mode:          cm.mode,
                    repeat:        cm.repeat,
                    events:        cm.events.clone(),
                };
                d.set_custom_macro(&cfg)?;
            }
        }
        DriverVariant::Ble(d) => {
            d.set_macros(&macros_cfg).await?;
        }
    }
    Ok(())
}

// ── Connect / Disconnect ──────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct ConnectResult {
    pub ok:    bool,
    pub mode:  Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn connect(
    mode: Option<String>,
    managed: State<'_, ManagedState>,
    app: AppHandle,
) -> Result<ConnectResult, String> {
    // Close existing driver
    {
        let mut guard = managed.driver.lock().await;
        if let Some(d) = guard.take() {
            match d {
                DriverVariant::Usb(mut d) => d.close(),
                DriverVariant::Ble(mut d) => d.close().await,
            }
        }
    }
    *managed.battery.lock().unwrap() = -1;
    *managed.conn_mode.lock().unwrap() = None;

    let preferred = mode.as_deref();

    // Try BLE explicitly
    if preferred == Some("bluetooth") {
        return try_ble(&managed, app).await;
    }

    // Try USB
    let try_wired_first = preferred == Some("wired");
    let (wireless_found, wired_found) = crate::driver::attack_shark::detect_usb_devices();
    let mut usb_err = String::new();

    if wireless_found || wired_found {
        let order: &[ConnMode] = if try_wired_first {
            &[ConnMode::Wired, ConnMode::Wireless]
        } else {
            &[ConnMode::Wireless, ConnMode::Wired]
        };
        for &conn_mode in order {
            if conn_mode == ConnMode::Wireless && !wireless_found { continue; }
            if conn_mode == ConnMode::Wired    && !wired_found    { continue; }

            match AttackShark::open(conn_mode, app.clone()) {
                Ok(driver) => {
                    let state = managed.app_state.lock().await.clone();
                    let bat   = driver.get_battery();
                    *managed.battery.lock().unwrap()   = bat;
                    *managed.conn_mode.lock().unwrap() = Some(conn_mode);

                    crate::tray::update_tray(&app, true, bat, conn_mode);
                    let mode_name = match conn_mode {
                        ConnMode::Wireless => "wireless",
                        ConnMode::Wired    => "wired",
                        _                  => "wireless",
                    };
                    info!("[connect] connected via {mode_name}");

                    let d = DriverVariant::Usb(driver);
                    let _ = apply_all(&d, &state, bat).await;
                    *managed.driver.lock().await = Some(d);

                    start_battery_poll(managed.inner(), app.clone());

                    return Ok(ConnectResult { ok: true, mode: Some(mode_name.into()), error: None });
                }
                Err(e) => {
                    usb_err = e;
                    warn!("[connect] USB {conn_mode:?} failed: {usb_err}");
                }
            }
        }
    }

    // BLE fallback
    let ble_result = try_ble(&managed, app).await;
    if ble_result.as_ref().map(|r| r.ok).unwrap_or(false) {
        return ble_result;
    }
    let ble_err = ble_result.ok().and_then(|r| r.error).unwrap_or_default();
    let final_err = if !usb_err.is_empty() { usb_err } else { ble_err };
    Ok(ConnectResult { ok: false, mode: None, error: Some(final_err) })
}

async fn try_ble(managed: &ManagedState, app: AppHandle) -> Result<ConnectResult, String> {
    match AttackSharkBle::open(app.clone()).await {
        Ok(ble) => {
            let state = managed.app_state.lock().await.clone();
            let bat   = ble.get_battery().await;
            *managed.battery.lock().unwrap()   = bat;
            *managed.conn_mode.lock().unwrap() = Some(ConnMode::Bluetooth);

            crate::tray::update_tray(&app, true, bat, ConnMode::Bluetooth);
            info!("[connect] connected via Bluetooth");

            let d = DriverVariant::Ble(ble);
            let _ = apply_all(&d, &state, bat).await;
            *managed.driver.lock().await = Some(d);

            start_battery_poll(managed, app);

            Ok(ConnectResult { ok: true, mode: Some("bluetooth".into()), error: None })
        }
        Err(e) => {
            warn!("[connect] BLE failed: {e}");
            Ok(ConnectResult { ok: false, mode: None, error: Some(e) })
        }
    }
}

fn start_battery_poll(managed: &ManagedState, app: AppHandle) {
    let driver   = Arc::clone(&managed.driver);
    let battery  = Arc::clone(&managed.battery);
    let conn_mode= Arc::clone(&managed.conn_mode);
    use std::sync::Arc;

    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(5 * 60));
        interval.tick().await; // skip first immediate tick
        loop {
            interval.tick().await;
            let bat = {
                let guard = driver.lock().await;
                match guard.as_ref() {
                    None => break,
                    Some(DriverVariant::Usb(d)) => d.get_battery(),
                    Some(DriverVariant::Ble(d)) => d.get_battery().await,
                }
            };
            if bat >= 0 {
                let prev = *battery.lock().unwrap();
                if bat != prev {
                    *battery.lock().unwrap() = bat;
                    let _ = app.emit("mouse:battery", bat);
                    if let Some(cm) = *conn_mode.lock().unwrap() {
                        crate::tray::update_tray(&app, true, bat, cm);
                    }
                }
            }
        }
    });
}

#[tauri::command]
pub async fn disconnect(managed: State<'_, ManagedState>, app: AppHandle) -> Result<(), String> {
    let mut guard = managed.driver.lock().await;
    if let Some(d) = guard.take() {
        match d {
            DriverVariant::Usb(mut d) => d.close(),
            DriverVariant::Ble(mut d) => d.close().await,
        }
    }
    *managed.battery.lock().unwrap()   = -1;
    *managed.conn_mode.lock().unwrap() = None;
    crate::tray::update_tray(&app, false, -1, ConnMode::Wireless);
    Ok(())
}

#[tauri::command]
pub async fn battery(managed: State<'_, ManagedState>) -> Result<Option<i32>, String> {
    let bat = *managed.battery.lock().unwrap();
    if bat >= 0 { return Ok(Some(bat)); }
    let guard = managed.driver.lock().await;
    Ok(match guard.as_ref() {
        None => None,
        Some(DriverVariant::Usb(d)) => {
            let b = d.get_battery();
            if b >= 0 { Some(b) } else { None }
        }
        Some(DriverVariant::Ble(d)) => {
            let b = d.get_battery().await;
            if b >= 0 { Some(b) } else { None }
        }
    })
}

// ── Config ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_config(managed: State<'_, ManagedState>) -> Result<AppState, String> {
    Ok(managed.app_state.lock().await.clone())
}

#[tauri::command]
pub async fn apply_config(
    patch: serde_json::Value,
    managed: State<'_, ManagedState>,
) -> Result<AppState, String> {
    let guard = managed.driver.lock().await;
    let driver = guard.as_ref().ok_or("Mouse não conectado")?;

    let mut state = managed.app_state.lock().await;
    merge_patch(&mut state, &patch);

    info!(
        "[apply] lighting mode={:#04x} led_speed={} global_color={:?} | buttons={:?}",
        state.lighting.mode, state.lighting.led_speed, state.lighting.global_color,
        state.buttons.iter().map(|(k, v)| (k.as_str(), v.kind.as_str(), v.template.clone())).collect::<Vec<_>>()
    );

    let bat = *managed.battery.lock().unwrap();
    let _lock = managed.queue.lock().await;
    match apply_all(driver, &state, bat).await {
        Ok(()) => info!("[apply] all commands sent OK"),
        Err(e) => { warn!("[apply] FAILED: {e}"); return Err(e); }
    }

    save_state(&managed.state_file, &state);
    Ok(state.clone())
}

#[tauri::command]
pub async fn reset_config(
    managed: State<'_, ManagedState>,
    _app: AppHandle,
) -> Result<AppState, String> {
    let guard = managed.driver.lock().await;
    let driver = guard.as_ref().ok_or("Mouse não conectado")?;

    match driver {
        DriverVariant::Usb(d) => d.reset()?,
        DriverVariant::Ble(_) => {} // no-op on BLE
    }

    let default = AppState::default();
    *managed.app_state.lock().await = default.clone();
    save_state(&managed.state_file, &default);
    Ok(default)
}

// ── Profiles ──────────────────────────────────────────────────────────────────

const RESERVED: [&str; 3] = ["__proto__", "constructor", "prototype"];

fn validate_name(name: &str) -> Result<String, String> {
    let n = name.trim().to_string();
    if n.is_empty() || n.len() > 64 || RESERVED.contains(&n.as_str()) {
        return Err("Nome de perfil inválido".into());
    }
    Ok(n)
}

#[tauri::command]
pub async fn profiles_list(managed: State<'_, ManagedState>) -> Result<Vec<String>, String> {
    Ok(managed.profiles.lock().await.keys().cloned().collect())
}

#[tauri::command]
pub async fn profiles_save(
    name: String,
    cfg:  Option<AppState>,
    managed: State<'_, ManagedState>,
) -> Result<Vec<String>, String> {
    let n = validate_name(&name)?;
    let to_save = match cfg {
        Some(c) => c,
        None    => managed.app_state.lock().await.clone(),
    };
    let mut profiles = managed.profiles.lock().await;
    profiles.insert(n, to_save);
    save_profiles(&managed.profiles_file, &profiles);
    Ok(profiles.keys().cloned().collect())
}

#[tauri::command]
pub async fn profiles_load(
    name: String,
    managed: State<'_, ManagedState>,
) -> Result<Option<AppState>, String> {
    let n = validate_name(&name)?;
    Ok(managed.profiles.lock().await.get(&n).cloned())
}

#[tauri::command]
pub async fn profiles_delete(
    name: String,
    managed: State<'_, ManagedState>,
) -> Result<Vec<String>, String> {
    let n = validate_name(&name)?;
    let mut profiles = managed.profiles.lock().await;
    profiles.remove(&n);
    save_profiles(&managed.profiles_file, &profiles);
    Ok(profiles.keys().cloned().collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocols::{ConnectionMode, dpi::build_dpi};

    #[test]
    fn active_stage_is_one_based_on_the_wire() {
        let mut s = AppState::default();
        s.dpi.active_stage = 0; // primeiro estágio na UI
        assert_eq!(build_dpi(&build_dpi_cfg(&s), ConnectionMode::Wireless)[24], 1);
        s.dpi.active_stage = 5; // sexto
        assert_eq!(build_dpi(&build_dpi_cfg(&s), ConnectionMode::Wireless)[24], 6);
    }
}

// ── JSON patch helper ─────────────────────────────────────────────────────────

fn merge_patch(state: &mut AppState, patch: &serde_json::Value) {
    // Serialize current state, merge patch fields, deserialize back.
    // Simple field-level merge — not a full RFC 7396 patch.
    let Ok(mut current) = serde_json::to_value(&*state) else { return };
    if let (Some(obj), Some(patch_obj)) = (current.as_object_mut(), patch.as_object()) {
        for (k, v) in patch_obj {
            obj.insert(k.clone(), v.clone());
        }
    }
    if let Ok(merged) = serde_json::from_value(current) {
        *state = merged;
    }
    // Validate polling rate
    let valid = [125u32, 250, 500, 1000];
    if !valid.contains(&state.polling_rate) { state.polling_rate = 1000; }
    // Validate DPI
    for v in &mut state.dpi.values {
        *v = (*v).clamp(50, 22000);
    }
    state.dpi.active_stage = state.dpi.active_stage.clamp(0, 5);
    state.performance.key_response = state.performance.key_response.clamp(4, 50);
    // Hard-coded power values (only confirmed functional)
    state.power.sleep_time      = 0.5;
    state.power.deep_sleep_time = 10;
}

