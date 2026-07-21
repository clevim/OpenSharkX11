use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    sync::{Arc, Mutex},
};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex as TokioMutex;
use tracing::warn;

use crate::protocols::{
    user_prefs::LightMode,
    macros::MacroEntry,
    custom_macro::{MacroEvent, MacroMode},
    dpi::RgbColor,
};
use crate::driver::{ConnMode, DriverVariant};

// ── AppState ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DpiState {
    pub values:        [u32; 6],
    pub active_stage:  u8,
    pub angle_snap:    bool,
    pub ripple_control: bool,
}

impl Default for DpiState {
    fn default() -> Self {
        Self {
            values:        [800, 1600, 2400, 3200, 5000, 22000],
            active_stage:  2,
            angle_snap:    false,
            ripple_control: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LightingState {
    pub mode:        u8,  // LightMode as u8
    pub stage_colors: [RgbColor; 6],
    pub global_color: RgbColor,
    pub led_speed:   u8,
}

impl Default for LightingState {
    fn default() -> Self {
        Self {
            mode: LightMode::BreathingDpi as u8,
            stage_colors: [
                RgbColor { r: 0xff, g: 0x00, b: 0x00 },
                RgbColor { r: 0x00, g: 0xff, b: 0x00 },
                RgbColor { r: 0x00, g: 0x00, b: 0xff },
                RgbColor { r: 0xff, g: 0xff, b: 0x00 },
                RgbColor { r: 0x00, g: 0xff, b: 0xff },
                RgbColor { r: 0xff, g: 0x00, b: 0xff },
            ],
            global_color: RgbColor { r: 0x00, g: 0xff, b: 0x00 },
            led_speed: 3,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceState {
    pub key_response: u8,
}

impl Default for PerformanceState {
    fn default() -> Self { Self { key_response: 8 } }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerState {
    pub sleep_time:      f32,
    pub deep_sleep_time: u32,
}

impl Default for PowerState {
    fn default() -> Self {
        Self { sleep_time: 0.5, deep_sleep_time: 10 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ButtonBinding {
    #[serde(rename = "type")]
    pub kind:       String,           // "template" | "keyboard"
    pub template:   Option<String>,
    pub modifiers:  Option<u8>,
    pub key_code:   Option<u8>,
}

impl ButtonBinding {
    pub fn template(name: &str) -> Self {
        Self { kind: "template".into(), template: Some(name.into()), modifiers: None, key_code: None }
    }
    pub fn to_macro_entry(&self) -> MacroEntry {
        use crate::protocols::macros::{FirmwareAction, MOD_NONE};
        if self.kind == "keyboard" {
            MacroEntry {
                action:   FirmwareAction::Keyboard as u8,
                modifier: self.modifiers.unwrap_or(MOD_NONE),
                key_code: self.key_code.unwrap_or(0),
            }
        } else {
            let name = self.template.as_deref().unwrap_or("global-disable-button");
            MacroEntry::from_template(name)
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomMacroState {
    pub enabled:       bool,
    pub target_button: u8,
    pub mode:          u8,
    pub repeat:        u8,
    pub events:        Vec<MacroEvent>,
}

impl Default for CustomMacroState {
    fn default() -> Self {
        Self {
            enabled: false,
            target_button: 4,
            mode: MacroMode::RepeatN as u8,
            repeat: 1,
            events: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub dpi:          DpiState,
    pub polling_rate: u32,
    pub lighting:     LightingState,
    pub performance:  PerformanceState,
    pub power:        PowerState,
    pub buttons:      HashMap<String, ButtonBinding>,
    pub custom_macro: CustomMacroState,
}

impl Default for AppState {
    fn default() -> Self {
        let mut buttons = HashMap::new();
        buttons.insert("left".into(),       ButtonBinding::template("global-left-click"));
        buttons.insert("right".into(),      ButtonBinding::template("global-right-click"));
        buttons.insert("middle".into(),     ButtonBinding::template("global-middle"));
        buttons.insert("forward".into(),    ButtonBinding::template("global-forward"));
        buttons.insert("backward".into(),   ButtonBinding::template("global-backward"));
        buttons.insert("dpi".into(),        ButtonBinding::template("global-dpi-cycle"));
        buttons.insert("scrollUp".into(),   ButtonBinding::template("global-scroll-up"));
        buttons.insert("scrollDown".into(), ButtonBinding::template("global-scroll-down"));
        Self {
            dpi:          DpiState::default(),
            polling_rate: 1000,
            lighting:     LightingState::default(),
            performance:  PerformanceState::default(),
            power:        PowerState::default(),
            buttons,
            custom_macro: CustomMacroState::default(),
        }
    }
}

// ── Persistence ───────────────────────────────────────────────────────────────

fn config_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".config").join("opensharkx11")
}

pub fn load_state() -> (AppState, PathBuf) {
    let dir = config_dir();
    let _ = fs::create_dir_all(&dir);
    let path = dir.join("state.json");
    let state = (|| -> Option<AppState> {
        let data = fs::read_to_string(&path).ok()?;
        serde_json::from_str(&data).ok()
    })()
    .map(|mut s| {
        // Migration: ensure all button keys exist
        let defaults = AppState::default();
        for (k, v) in defaults.buttons {
            s.buttons.entry(k).or_insert(v);
        }
        // Hard-coded: only confirmed-functional values
        s.power = PowerState { sleep_time: 0.5, deep_sleep_time: 10 };
        s
    })
    .unwrap_or_default();
    (state, path)
}

pub fn save_state(path: &PathBuf, state: &AppState) {
    match serde_json::to_string_pretty(state) {
        Ok(json) => { let _ = fs::write(path, json); }
        Err(e)   => warn!("Failed to serialize state: {e}"),
    }
}

pub fn load_profiles(dir: &PathBuf) -> (HashMap<String, AppState>, PathBuf) {
    let path = dir.join("profiles.json");
    let profiles = (|| -> Option<HashMap<String, AppState>> {
        let data = fs::read_to_string(&path).ok()?;
        serde_json::from_str(&data).ok()
    })().unwrap_or_default();
    (profiles, path)
}

pub fn save_profiles(path: &PathBuf, profiles: &HashMap<String, AppState>) {
    match serde_json::to_string_pretty(profiles) {
        Ok(json) => { let _ = fs::write(path, json); }
        Err(e)   => warn!("Failed to serialize profiles: {e}"),
    }
}

// ── Managed state for Tauri ───────────────────────────────────────────────────

pub struct ManagedState {
    pub driver:       Arc<TokioMutex<Option<DriverVariant>>>,
    pub conn_mode:    Arc<Mutex<Option<ConnMode>>>,
    pub battery:      Arc<Mutex<i32>>,
    pub app_state:    Arc<TokioMutex<AppState>>,
    pub profiles:     Arc<TokioMutex<HashMap<String, AppState>>>,
    pub queue:        Arc<TokioMutex<()>>,
    pub state_file:   PathBuf,
    pub profiles_file: PathBuf,
}

impl ManagedState {
    pub fn new() -> Self {
        let (state, state_path) = load_state();
        let dir = config_dir();
        let (profiles, profiles_path) = load_profiles(&dir);
        Self {
            driver:        Arc::new(TokioMutex::new(None)),
            conn_mode:     Arc::new(Mutex::new(None)),
            battery:       Arc::new(Mutex::new(-1)),
            app_state:     Arc::new(TokioMutex::new(state)),
            profiles:      Arc::new(TokioMutex::new(profiles)),
            queue:         Arc::new(TokioMutex::new(())),
            state_file:    state_path,
            profiles_file: profiles_path,
        }
    }
}

// ── Battery override (mirrors batteryOverrideForLevel in index.ts) ─────────────

pub struct LightOverride {
    pub mode:      LightMode,
    pub rgb:       RgbColor,
    pub led_speed: u8,
}

pub fn battery_override(pct: i32) -> Option<LightOverride> {
    if pct < 0 || pct > 100 { return None; }
    if pct < 15 {
        Some(LightOverride { mode: LightMode::Breathing, rgb: RgbColor { r: 0xff, g: 0, b: 0 }, led_speed: 5 })
    } else if pct < 30 {
        Some(LightOverride { mode: LightMode::Breathing, rgb: RgbColor { r: 0xff, g: 0x80, b: 0 }, led_speed: 2 })
    } else {
        None
    }
}
