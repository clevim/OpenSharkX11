use rusb::{DeviceHandle, GlobalContext};
use std::{
    sync::{atomic::{AtomicBool, Ordering}, Arc, Mutex},
    time::Duration,
};
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;
use tracing::{debug, warn};

use crate::protocols::{
    ConnectionMode,
    dpi::{build_dpi, DpiConfig, DPI_CONTROL_PARAMS},
    user_prefs::{build_user_prefs, UserPrefsConfig, USER_PREFS_CONTROL_PARAMS},
    polling_rate::{build_polling_rate, PollingRateConfig, POLLING_RATE_CONTROL_PARAMS},
    macros::{build_macros, MacrosConfig, MACROS_CONTROL_PARAMS},
    custom_macro::{build_custom_macro, CustomMacroConfig, CUSTOM_MACRO_CONTROL_PARAMS},
    reset::{build_reset, RESET_CONTROL_PARAMS},
};
use super::ConnMode;

const VID: u16 = 0x1d57;
const PID_WIRELESS: u16 = 0xfa60;
const PID_WIRED:    u16 = 0xfa55;
const IFACE: u8 = 2;
const INTERRUPT_EP: u8 = 0x83;
const SAFE_DELAY_MS: u64 = 300;

pub struct AttackShark {
    handle:    Arc<Mutex<DeviceHandle<GlobalContext>>>,
    conn_mode: ConnMode,
    poll_stop: Option<oneshot::Sender<()>>,
    /// Sinaliza que um control transfer quer o handle. A thread de polling
    /// relocka o mutex no mesmo instante em que solta e std::sync::Mutex não é
    /// justa, então sem esse backoff o control_out espera minutos.
    io_wanted: Arc<AtomicBool>,
}

impl AttackShark {
    /// Open the device for the given connection mode.
    /// Spawns a background thread for interrupt polling.
    pub fn open(preferred: ConnMode, app: AppHandle) -> Result<Self, String> {
        let pid = match preferred {
            ConnMode::Wired    => PID_WIRED,
            ConnMode::Wireless => PID_WIRELESS,
            ConnMode::Bluetooth => return Err("BLE not handled by USB driver".into()),
        };

        let device = rusb::devices()
            .map_err(|e| format!("rusb::devices() failed: {e}"))?
            .iter()
            .find(|d| {
                let desc = d.device_descriptor().ok();
                desc.map(|d| d.vendor_id() == VID && d.product_id() == pid)
                    .unwrap_or(false)
            })
            .ok_or_else(|| format!("Device PID 0x{pid:04x} not found"))?;

        let handle = device.open()
            .map_err(|e| format!("Failed to open USB device: {e}"))?;

        // Detach kernel driver + claim interface 2 with retry
        let _ = handle.detach_kernel_driver(IFACE);
        let mut claim_err = None;
        for attempt in 0..5u32 {
            match handle.claim_interface(IFACE) {
                Ok(_) => { claim_err = None; break; }
                Err(e) => {
                    claim_err = Some(e);
                    std::thread::sleep(Duration::from_millis(if attempt < 2 { 400 } else { 800 }));
                }
            }
        }
        if let Some(e) = claim_err {
            return Err(format!("Could not claim interface {IFACE}: {e}"));
        }

        let handle = Arc::new(Mutex::new(handle));
        let io_wanted = Arc::new(AtomicBool::new(false));
        let (tx, rx) = oneshot::channel::<()>();

        // Spawn interrupt polling thread
        {
            let poll_handle = Arc::clone(&handle);
            let poll_wanted = Arc::clone(&io_wanted);
            let app_handle  = app.clone();
            let mode = preferred;
            std::thread::spawn(move || {
                let mut buf = [0u8; 64];
                let mut last_battery: i32 = -1;
                let mut rx = rx;
                loop {
                    if rx.try_recv().is_ok() { break; }

                    // Cede o handle enquanto um control transfer estiver pendente.
                    if poll_wanted.load(Ordering::Acquire) {
                        std::thread::sleep(Duration::from_millis(5));
                        continue;
                    }

                    let result = {
                        let guard = match poll_handle.lock() {
                            Ok(g) => g,
                            Err(_) => break,
                        };
                        guard.read_interrupt(INTERRUPT_EP, &mut buf, Duration::from_millis(200))
                    };

                    match result {
                        Ok(n) if n >= 4 => {
                            let data = &buf[..n];
                            // Battery: [03 55 40 01 <level>]
                            if data[0] == 0x03 && data[1] == 0x55 && data[2] == 0x40 && data[3] == 0x01 {
                                if n >= 5 {
                                    let bat = data[4] as i32;
                                    if bat != last_battery {
                                        last_battery = bat;
                                        let _ = app_handle.emit("mouse:battery", bat);
                                    }
                                }
                                continue;
                            }
                            // DPI stage: [03 55 10 <stage 1-6>]
                            if data[0] == 0x03 && data[1] == 0x55 && data[2] == 0x10 {
                                let stage = data[3];
                                if (1..=6).contains(&stage) {
                                    let _ = app_handle.emit("mouse:dpi_stage", stage - 1);
                                }
                                continue;
                            }
                            debug!("[usb] unknown interrupt: {:02x?}", data);
                        }
                        Ok(_) => {}
                        Err(rusb::Error::Timeout) => {}
                        Err(e) => {
                            warn!("[usb] interrupt read error: {e}");
                            if !matches!(e, rusb::Error::NoDevice) {
                                // Emit disconnected for unexpected errors
                                let _ = app_handle.emit("mouse:disconnected", ());
                            }
                            break;
                        }
                    }

                    if mode == ConnMode::Wired {
                        // Wired mode: no battery available, just keep polling for DPI stage
                    }
                }
            });
        }

        Ok(Self {
            handle,
            conn_mode: preferred,
            poll_stop: Some(tx),
            io_wanted,
        })
    }

    #[allow(dead_code)]
    pub fn conn_mode(&self) -> ConnMode {
        self.conn_mode
    }

    pub fn protocol_mode(&self) -> ConnectionMode {
        match self.conn_mode {
            ConnMode::Wired => ConnectionMode::Wired,
            _               => ConnectionMode::Wireless,
        }
    }

    fn control_out(&self, bm: u8, br: u8, wv: u16, wi: u16, data: &[u8]) -> Result<(), String> {
        self.io_wanted.store(true, Ordering::Release);
        let locked = self.handle.lock();
        self.io_wanted.store(false, Ordering::Release);
        let guard = locked.map_err(|e| format!("mutex poison: {e}"))?;
        let n = guard.write_control(bm, br, wv, wi as u16, data, Duration::from_secs(2))
            .map_err(|e| { warn!("[usb] control_out wValue={wv:#06x} FAILED: {e}"); format!("control transfer failed: {e}") })?;
        debug!("[usb] control_out wValue={wv:#06x} wrote {n}/{} bytes: {data:02x?}", data.len());
        drop(guard); // não segurar o handle durante o delay — a thread de polling fica presa
        std::thread::sleep(Duration::from_millis(SAFE_DELAY_MS));
        Ok(())
    }

    /// Poll battery once with a timeout. Returns -1 if wired (no battery) or on timeout.
    pub fn get_battery(&self) -> i32 {
        if self.conn_mode == ConnMode::Wired { return -1; }

        // The interrupt polling thread emits via AppHandle; here we do a direct read
        let guard = match self.handle.lock() {
            Ok(g) => g,
            Err(_) => return -1,
        };
        let mut buf = [0u8; 64];
        let deadline = std::time::Instant::now() + Duration::from_millis(2000);
        loop {
            let remaining = deadline.saturating_duration_since(std::time::Instant::now());
            if remaining.is_zero() { break; }
            match guard.read_interrupt(INTERRUPT_EP, &mut buf, remaining.min(Duration::from_millis(200))) {
                Ok(n) if n >= 5 && buf[0] == 0x03 && buf[1] == 0x55 && buf[2] == 0x40 && buf[3] == 0x01 => {
                    return buf[4] as i32;
                }
                Ok(_) | Err(rusb::Error::Timeout) => continue,
                Err(_) => break,
            }
        }
        -1
    }

    pub fn close(&mut self) {
        if let Some(tx) = self.poll_stop.take() { let _ = tx.send(()); }
        if let Ok(guard) = self.handle.lock() {
            let _ = guard.release_interface(IFACE);
        }
    }

    // ── Protocol methods ──────────────────────────────────────────────────────

    pub fn set_dpi(&self, cfg: &DpiConfig) -> Result<(), String> {
        let mode = self.protocol_mode();
        let (bm, br, wv, wi) = DPI_CONTROL_PARAMS;
        self.control_out(bm, br, wv, wi, &build_dpi(cfg, mode))
    }

    pub fn set_user_prefs(&self, cfg: &UserPrefsConfig) -> Result<(), String> {
        let mode = self.protocol_mode();
        let (bm, br, wv, wi) = USER_PREFS_CONTROL_PARAMS;
        self.control_out(bm, br, wv, wi, &build_user_prefs(cfg, mode))
    }

    pub fn set_polling_rate(&self, cfg: &PollingRateConfig) -> Result<(), String> {
        let (bm, br, wv, wi) = POLLING_RATE_CONTROL_PARAMS;
        self.control_out(bm, br, wv, wi, &build_polling_rate(cfg))
    }

    pub fn set_macros(&self, cfg: &MacrosConfig) -> Result<(), String> {
        let (bm, br, wv, wi) = MACROS_CONTROL_PARAMS;
        self.control_out(bm, br, wv, wi, &build_macros(cfg))
    }

    pub fn set_custom_macro(&self, cfg: &CustomMacroConfig) -> Result<(), String> {
        let mode = self.protocol_mode();
        let [pkt1, pkt2, pkt3, pkt4] = build_custom_macro(cfg, mode);
        let (bm, br, _, wi) = CUSTOM_MACRO_CONTROL_PARAMS;
        // Packet 1 uses macros wValue (0x0308), packets 2-4 use custom macro wValue (0x0309)
        self.control_out(bm, br, 0x0308, wi, &pkt1)?;
        self.control_out(bm, br, 0x0309, wi, &pkt2)?;
        self.control_out(bm, br, 0x0309, wi, &pkt3)?;
        self.control_out(bm, br, 0x0309, wi, &pkt4)
    }

    pub fn reset(&self) -> Result<(), String> {
        let mode = self.protocol_mode();
        let (bm, br, wv, wi) = RESET_CONTROL_PARAMS;
        self.control_out(bm, br, wv, wi, &build_reset(mode))
    }
}

/// Returns (wireless_device_found, wired_device_found)
pub fn detect_usb_devices() -> (bool, bool) {
    let devices = match rusb::devices() {
        Ok(d) => d,
        Err(_) => return (false, false),
    };
    let mut wireless = false;
    let mut wired    = false;
    for device in devices.iter() {
        let desc = match device.device_descriptor() {
            Ok(d) => d,
            Err(_) => continue,
        };
        if desc.vendor_id() == VID {
            if desc.product_id() == PID_WIRELESS { wireless = true; }
            if desc.product_id() == PID_WIRED    { wired    = true; }
        }
    }
    (wireless, wired)
}
