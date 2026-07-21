use super::ConnectionMode;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum MacroMode {
    RepeatN       = 0x00,
    AnyKeyToStop  = 0x01,
    HoldToPlay    = 0x02,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MacroEvent {
    pub key:     u8,
    pub delay:   u32,
    pub release: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomMacroConfig {
    pub enabled:       bool,
    pub target_button: u8,   // button index 0-4 (left/right/middle/forward/backward)
    pub mode:          u8,   // MacroMode as u8
    pub repeat:        u8,   // 1-255
    pub events:        Vec<MacroEvent>,
}

impl Default for CustomMacroConfig {
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

/// Maps external button index to CUSTOM_MACRO_BUTTONS byte
fn button_to_custom_byte(btn: u8) -> u8 {
    match btn {
        0 => 0x01, // left
        1 => 0x02, // right
        2 => 0x03, // middle
        3 => 0x07, // forward
        4 => 0x08, // backward
        _ => 0x08,
    }
}

fn compute_delay(delay_ms: u32) -> (u8, Option<u8>) {
    let compute_byte = |ms: u32| -> u8 {
        (2 * ((ms + 5) / 20) + 1) as u8
    };
    if delay_ms <= 1070 {
        (compute_byte(delay_ms), None)
    } else {
        let extra_units = (delay_ms / 200) as u8;
        let rem = delay_ms % 200;
        (compute_byte(rem), Some(extra_units))
    }
}

/// Builds the macros packet that assigns this button to the custom macro action.
/// Mirrors the MacrosBuilder portion of CustomMacroBuilder.build() in TS.
fn build_assign_packet(target_btn: u8, mode: ConnectionMode) -> Vec<u8> {
    use super::macros::{build_macros, MacroEntry, MacrosConfig};

    let template_name = match target_btn {
        0 => "custom-macro-left-button",
        1 => "custom-macro-right-button",
        2 => "custom-macro-middle-button",
        3 => "custom-macro-extra-button_4",
        _ => "custom-macro-extra-button_5",
    };

    let mut cfg = MacrosConfig::default();
    cfg.buttons[target_btn as usize] = MacroEntry::from_template(template_name);
    // Note: build_macros ignores ConnectionMode (identical for both); keep signature consistent
    let _ = mode;
    build_macros(&cfg)
}

/// Returns [macros_packet, second_packet, third_packet, fourth_packet]
/// matching CustomMacroBuilder.build() in TypeScript.
pub fn build_custom_macro(cfg: &CustomMacroConfig, mode: ConnectionMode) -> [Vec<u8>; 4] {
    let btn_byte = button_to_custom_byte(cfg.target_button);

    // Packet 1: macros assignment
    let pkt1 = build_assign_packet(cfg.target_button, mode);

    // Packet 2: events header + first 17 events (34 bytes starting at offset 30)
    let mut pkt2 = vec![0u8; 64];
    pkt2[0] = 0x09; pkt2[1] = 0x40; pkt2[2] = btn_byte;
    pkt2[3] = 0x00; // page 0
    pkt2[4] = cfg.mode;
    pkt2[8] = cfg.repeat;

    // Packet 3: next events (30 events, 60 bytes starting at offset 4)
    let mut pkt3 = vec![0u8; 64];
    pkt3[0] = 0x09; pkt3[1] = 0x40; pkt3[2] = btn_byte;
    pkt3[3] = 0x01; // page 1

    // Packet 4: checksum
    let mut pkt4 = vec![0u8; 12];
    pkt4[0] = 0x09; pkt4[1] = 0x0c; pkt4[2] = btn_byte;
    pkt4[3] = 0x02; // page 2

    // Build event bytes
    let mut event_bytes: Vec<u8> = vec![];
    for ev in cfg.events.iter().take(47) {
        let (delay_byte, extra) = compute_delay(ev.delay);
        let flag = if ev.release { 0x80 | delay_byte } else { delay_byte };
        event_bytes.push(flag);
        event_bytes.push(ev.key);
        if let Some(extra_byte) = extra {
            event_bytes.push(extra_byte);
            event_bytes.push(0x03);
        }
    }

    let event_count = event_bytes.len() / 2;
    pkt2[29] = event_count.min(47) as u8;

    // Fill packet 2 (17 events max, 34 bytes from offset 30)
    let mut idx = 0;
    for i in 30..64 {
        if idx >= event_bytes.len() { break; }
        pkt2[i] = event_bytes[idx]; idx += 1;
    }
    // Fill packet 3 (30 events max, 60 bytes from offset 4)
    for i in 4..64 {
        if idx >= event_bytes.len() { break; }
        pkt3[i] = event_bytes[idx]; idx += 1;
    }

    // Checksum: sum of pkt2[8..] + pkt3[4..]
    let checksum: u32 = pkt2[8..].iter().chain(pkt3[4..].iter())
        .map(|&b| b as u32).sum();
    pkt4[10] = ((checksum >> 8) & 0xff) as u8;
    pkt4[11] = (checksum & 0xff) as u8;

    [pkt1, pkt2, pkt3, pkt4]
}

pub const CUSTOM_MACRO_CONTROL_PARAMS: (u8, u8, u16, u16) = (0x21, 0x09, 0x0309, 2);
