use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PollingRate {
    Hz125  = 125,
    Hz250  = 250,
    Hz500  = 500,
    Hz1000 = 1000,
}

impl PollingRate {
    pub fn from_hz(hz: u32) -> Self {
        match hz {
            125  => Self::Hz125,
            250  => Self::Hz250,
            500  => Self::Hz500,
            _    => Self::Hz1000,
        }
    }

    fn to_byte(self) -> u8 {
        match self {
            Self::Hz125  => 0x08,
            Self::Hz250  => 0x04,
            Self::Hz500  => 0x02,
            Self::Hz1000 => 0x01,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PollingRateConfig {
    pub rate: PollingRate,
}

pub fn build_polling_rate(cfg: &PollingRateConfig) -> Vec<u8> {
    let mut buf = [0u8; 9];
    buf[0] = 0x06; buf[1] = 0x09; buf[2] = 0x01;
    buf[3] = cfg.rate.to_byte();
    buf[4] = 0xffu8.wrapping_sub(buf[3]);  // checksum: 0xFF - rate_byte
    buf.to_vec()
}

pub const POLLING_RATE_CONTROL_PARAMS: (u8, u8, u16, u16) = (0x21, 0x09, 0x0306, 2);
