use std::collections::HashMap;
use std::ops::Deref;
use futures_util::StreamExt;
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;
use tracing::debug;
use zbus::{Connection, proxy};
use zbus::zvariant::{OwnedValue, Value};

use crate::protocols::{
    ConnectionMode,
    dpi::{build_dpi, DpiConfig},
    user_prefs::{build_user_prefs, UserPrefsConfig},
    macros::{build_macros, MacrosConfig},
};

const BLUEZ:    &str = "org.bluez";
const GATT_CH:  &str = "org.bluez.GattCharacteristic1";
const DEV_IF:   &str = "org.bluez.Device1";

const FEE0_UUID: &str = "0000fee0-0000-1000-8000-00805f9b34fb";
const FEE3_UUID: &str = "0000fee3-0000-1000-8000-00805f9b34fb";
const FEE4_UUID: &str = "0000fee4-0000-1000-8000-00805f9b34fb";
const FFC2_UUID: &str = "f000ffc2-0451-4000-b000-000000000000";

const DELAY_MS: u64 = 150;

#[proxy(
    interface = "org.bluez.GattCharacteristic1",
    default_service = "org.bluez"
)]
trait GattChar {
    async fn write_value(&self, value: Vec<u8>, options: HashMap<String, OwnedValue>) -> zbus::Result<()>;
    async fn start_notify(&self) -> zbus::Result<()>;
    async fn stop_notify(&self)  -> zbus::Result<()>;
}

pub struct AttackSharkBle {
    conn:         Connection,
    fee3_path:    String,
    fee4_path:    String,
    ffc2_path:    String,
    notify_stop:  Option<oneshot::Sender<()>>,
    last_battery: std::sync::Arc<std::sync::Mutex<i32>>,
}

impl AttackSharkBle {
    pub async fn open(app: AppHandle) -> Result<Self, String> {
        let conn = Connection::system().await
            .map_err(|e| format!("D-Bus system bus error: {e}"))?;

        let (_device_path, fee3, fee4, ffc2) = Self::discover(&conn).await?;

        let (tx, mut rx) = oneshot::channel::<()>();
        let fee4_path_clone = fee4.clone();
        let app2 = app.clone();
        let last_battery = std::sync::Arc::new(std::sync::Mutex::new(-1i32));
        let last_bat_clone = std::sync::Arc::clone(&last_battery);

        tokio::spawn(async move {
            let Ok(conn2) = Connection::system().await else { return };
            let mut stream = zbus::MessageStream::from(&conn2);
            loop {
                tokio::select! {
                    _ = &mut rx => break,
                    msg = stream.next() => {
                        let Some(Ok(msg)) = msg else { break };
                        // Filter: PropertiesChanged on our fee4 path
                        let hdr = msg.header();
                        let path_match = hdr.path()
                            .map(|p| p.as_str() == fee4_path_clone.as_str())
                            .unwrap_or(false);
                        if !path_match { continue; }
                        if let Ok(body) = msg.body().deserialize::<(String, HashMap<String, OwnedValue>, Vec<String>)>() {
                            if body.0 == GATT_CH {
                                if let Some(raw) = extract_gatt_value(&body.1) {
                                    handle_fee4_data(&raw, &last_bat_clone, &app2);
                                }
                            }
                        }
                    }
                }
            }
        });

        // StartNotify on fee4
        {
            let fee4_proxy = GattCharProxy::builder(&conn)
                .path(fee4.as_str()).map_err(|e| e.to_string())?
                .build().await.map_err(|e| e.to_string())?;
            fee4_proxy.start_notify().await
                .map_err(|e| format!("StartNotify failed: {e}"))?;
        }

        Ok(Self {
            conn,
            fee3_path: fee3,
            fee4_path: fee4,
            ffc2_path: ffc2,
            notify_stop: Some(tx),
            last_battery,
        })
    }

    async fn discover(conn: &Connection) -> Result<(String, String, String, String), String> {
        let om = zbus::fdo::ObjectManagerProxy::builder(conn)
            .destination(BLUEZ).map_err(|e| e.to_string())?
            .path("/").map_err(|e| e.to_string())?
            .build().await
            .map_err(|e| format!("ObjectManager proxy: {e}"))?;
        let objects = om.get_managed_objects().await
            .map_err(|e| format!("GetManagedObjects: {e}"))?;

        let mut device_path = String::new();
        for (path, ifaces) in &objects {
            let Some(dev) = ifaces.get(DEV_IF) else { continue };
            let connected = get_bool(dev, "Connected");
            if !connected { continue; }
            let uuids = get_string_array(dev, "UUIDs");
            if uuids.iter().any(|u| u.to_lowercase() == FEE0_UUID) {
                device_path = path.to_string();
                break;
            }
        }
        if device_path.is_empty() {
            return Err("X11 BLE device not found or not connected".into());
        }

        let mut fee3 = String::new();
        let mut fee4 = String::new();
        let mut ffc2 = String::new();
        for (path, ifaces) in &objects {
            let path_str = path.as_str();
            if !path_str.starts_with(&format!("{device_path}/")) { continue; }
            let Some(ch) = ifaces.get(GATT_CH) else { continue };
            let uuid = get_string(ch, "UUID").to_lowercase();
            match uuid.as_str() {
                s if s == FEE3_UUID => fee3 = path_str.to_string(),
                s if s == FEE4_UUID => fee4 = path_str.to_string(),
                s if s == FFC2_UUID => ffc2 = path_str.to_string(),
                _ => {}
            }
        }

        if fee3.is_empty() || fee4.is_empty() {
            return Err(format!("BLE characteristics missing — fee3:{} fee4:{}", !fee3.is_empty(), !fee4.is_empty()));
        }

        debug!("[ble] device: {device_path}");
        debug!("[ble] fee3:   {fee3}");
        debug!("[ble] fee4:   {fee4}");

        Ok((device_path, fee3, fee4, ffc2))
    }

    async fn write_fee3(&self, payload: &[u8]) -> Result<(), String> {
        let proxy = GattCharProxy::builder(&self.conn)
            .path(self.fee3_path.as_str()).map_err(|e| e.to_string())?
            .build().await.map_err(|e| e.to_string())?;

        let mut opts: HashMap<String, OwnedValue> = HashMap::new();
        opts.insert(
            "type".to_string(),
            OwnedValue::try_from(Value::from("request"))
                .map_err(|e| e.to_string())?,
        );
        proxy.write_value(payload.to_vec(), opts).await
            .map_err(|e| format!("WriteValue failed: {e}"))
    }

    pub async fn get_battery(&self) -> i32 {
        if let Ok(bat) = self.last_battery.lock() {
            if *bat >= 0 { return *bat; }
        }
        if !self.ffc2_path.is_empty() {
            let _ = tokio::time::timeout(
                std::time::Duration::from_millis(500),
                async {
                    let Ok(proxy) = GattCharProxy::builder(&self.conn)
                        .path(self.ffc2_path.as_str())
                        .map_err(|_| ())?
                        .build().await.map_err(|_| ()) else { return Err(()) };
                    let mut opts: HashMap<String, OwnedValue> = HashMap::new();
                    let _ = OwnedValue::try_from(Value::from("request")).map(|v| opts.insert("type".to_string(), v));
                    let _ = proxy.write_value(vec![0x05, 0x0f, 0x01], opts).await;
                    Ok(())
                }
            ).await;
        }
        -1
    }

    pub async fn set_dpi(&self, cfg: &DpiConfig) -> Result<(), String> {
        let payload = build_dpi(cfg, ConnectionMode::Wireless);
        self.write_fee3(&payload).await?;
        tokio::time::sleep(std::time::Duration::from_millis(DELAY_MS)).await;
        Ok(())
    }

    pub async fn set_user_prefs(&self, cfg: &UserPrefsConfig) -> Result<(), String> {
        let payload = build_user_prefs(cfg, ConnectionMode::Wireless);
        self.write_fee3(&payload).await?;
        tokio::time::sleep(std::time::Duration::from_millis(DELAY_MS)).await;
        Ok(())
    }

    pub async fn set_macros(&self, cfg: &MacrosConfig) -> Result<(), String> {
        let payload = build_macros(cfg);
        self.write_fee3(&payload).await?;
        tokio::time::sleep(std::time::Duration::from_millis(DELAY_MS)).await;
        Ok(())
    }

    #[allow(dead_code)]
    pub async fn set_polling_rate(&self) -> Result<(), String> { Ok(()) }
    #[allow(dead_code)]
    pub async fn set_custom_macro(&self) -> Result<(), String> { Ok(()) }

    pub async fn close(&mut self) {
        if let Some(tx) = self.notify_stop.take() { let _ = tx.send(()); }
        if !self.fee4_path.is_empty() {
            if let Ok(proxy) = GattCharProxy::builder(&self.conn)
                .path(self.fee4_path.as_str())
                .map_err(|_| ())
            {
                if let Ok(p) = proxy.build().await {
                    let _ = p.stop_notify().await;
                }
            }
        }
    }
}

// ── zvariant value helpers ────────────────────────────────────────────────────

fn get_bool(props: &HashMap<String, OwnedValue>, key: &str) -> bool {
    props.get(key).and_then(|v| match v.deref() {
        Value::Bool(b) => Some(*b),
        _ => None,
    }).unwrap_or(false)
}

fn get_string(props: &HashMap<String, OwnedValue>, key: &str) -> String {
    props.get(key).and_then(|v| match v.deref() {
        Value::Str(s) => Some(s.to_string()),
        _ => None,
    }).unwrap_or_default()
}

fn get_string_array(props: &HashMap<String, OwnedValue>, key: &str) -> Vec<String> {
    props.get(key).and_then(|v| match v.deref() {
        Value::Array(arr) => Some(
            arr.iter()
                .filter_map(|item| match item {
                    Value::Str(s) => Some(s.to_string()),
                    _ => None,
                })
                .collect()
        ),
        _ => None,
    }).unwrap_or_default()
}

fn extract_gatt_value(changed: &HashMap<String, OwnedValue>) -> Option<Vec<u8>> {
    changed.get("Value").and_then(|v| match v.deref() {
        Value::Array(arr) => Some(
            arr.iter()
                .filter_map(|item| match item {
                    Value::U8(b) => Some(*b),
                    _ => None,
                })
                .collect()
        ),
        _ => None,
    })
}

fn handle_fee4_data(data: &[u8], last_bat: &std::sync::Mutex<i32>, app: &AppHandle) {
    if data.len() < 3 { return; }
    if data[0] == 0x55 && data[1] == 0x40 && data[2] == 0x01 && data.len() >= 4 {
        let bat = data[3] as i32;
        if let Ok(mut last) = last_bat.lock() {
            if bat != *last {
                *last = bat;
                let _ = app.emit("mouse:battery", bat);
            }
        }
        return;
    }
    if data[0] == 0x55 && data[1] == 0x10 {
        let stage = data[2];
        if (1..=6).contains(&stage) {
            let _ = app.emit("mouse:dpi_stage", stage - 1);
        }
    }
}
