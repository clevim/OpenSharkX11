use super::ConnectionMode;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum LightMode {
    Off            = 0x00,
    Static         = 0x10,
    Breathing      = 0x20,
    Neon           = 0x30,
    ColorBreathing = 0x40,
    StaticDpi      = 0x50,
    BreathingDpi   = 0x60,
}

impl LightMode {
    pub fn from_u8(v: u8) -> Self {
        match v {
            0x10 => Self::Static,
            0x20 => Self::Breathing,
            0x30 => Self::Neon,
            0x40 => Self::ColorBreathing,
            0x50 => Self::StaticDpi,
            0x60 => Self::BreathingDpi,
            _    => Self::Off,
        }
    }
}

pub use super::dpi::RgbColor;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPrefsConfig {
    pub light_mode:     LightMode,
    pub rgb:            RgbColor,
    pub led_speed:      u8,      // 1-5; user-facing, inverted for hardware
    pub sleep_time:     f32,     // minutes (0.5-30), hard-coded to 0.5
    pub deep_sleep_time: u32,    // minutes (1-60), hard-coded to 10
    pub key_response:   u8,      // ms (4-50, step 2)
}

impl Default for UserPrefsConfig {
    fn default() -> Self {
        Self {
            light_mode: LightMode::Off,
            rgb: RgbColor { r: 0x00, g: 0xff, b: 0x00 },
            led_speed: 3,
            sleep_time: 0.5,
            deep_sleep_time: 10,
            key_response: 8,
        }
    }
}

pub fn build_user_prefs(cfg: &UserPrefsConfig, mode: ConnectionMode) -> Vec<u8> {
    let mut buf = [0u8; 15];
    buf[0] = 0x05; buf[1] = 0x0f; buf[2] = 0x01;

    buf[3] = cfg.light_mode as u8;

    // byte[4]: high nibble = deep-sleep bucket, low nibble = hardware speed (inverted)
    let bucket = ((cfg.deep_sleep_time.saturating_sub(1)) / 16) as u8;
    let hw_speed = 6u8.saturating_sub(cfg.led_speed.clamp(1, 5));
    buf[4] = (bucket << 4) | (hw_speed & 0x0f);

    // byte[5]: deep sleep encoding: (0x08 + minutes * 0x10) & 0xFF
    let dsm = cfg.deep_sleep_time.clamp(1, 60);
    buf[5] = (0x08u32 + dsm * 0x10) as u8;

    buf[6] = cfg.rgb.r;
    buf[7] = cfg.rgb.g;
    buf[8] = cfg.rgb.b;

    // byte[9]: sleep time (0.5 min steps): round(minutes * 2)
    buf[9] = (cfg.sleep_time * 2.0).round() as u8;

    // byte[10]: key response: (ms - 4) / 2 + 0x02
    let kr = cfg.key_response.clamp(4, 50);
    buf[10] = (kr - 4) / 2 + 0x02;

    // byte[11]: count of RGB channels >= 0x64, with +1 if BreathingDpi
    let count = [cfg.rgb.r, cfg.rgb.g, cfg.rgb.b]
        .iter()
        .filter(|&&v| v >= 0x64)
        .count() as u8;
    buf[11] = if cfg.light_mode == LightMode::BreathingDpi { count + 1 } else { count };

    // byte[12]: checksum = sum of bytes 3..=10 & 0xFF
    buf[12] = buf[3..=10].iter().map(|&b| b as u16).sum::<u16>() as u8;

    match mode {
        ConnectionMode::Wired    => buf[..13].to_vec(),
        ConnectionMode::Wireless => buf.to_vec(),
    }
}

pub const USER_PREFS_CONTROL_PARAMS: (u8, u8, u16, u16) = (0x21, 0x09, 0x0305, 2);
