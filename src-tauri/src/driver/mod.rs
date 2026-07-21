pub mod attack_shark;
pub mod attack_shark_ble;

pub use attack_shark::AttackShark;
pub use attack_shark_ble::AttackSharkBle;

use crate::protocols::ConnectionMode;

pub enum DriverVariant {
    Usb(AttackShark),
    Ble(AttackSharkBle),
}

impl DriverVariant {
    #[allow(dead_code)]
    pub fn connection_mode(&self) -> ConnMode {
        match self {
            Self::Usb(d) => d.conn_mode(),
            Self::Ble(_) => ConnMode::Bluetooth,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum ConnMode {
    Wireless,
    Wired,
    Bluetooth,
}

impl ConnMode {
    #[allow(dead_code)]
    pub fn to_protocol_mode(self) -> ConnectionMode {
        match self {
            Self::Wired => ConnectionMode::Wired,
            _           => ConnectionMode::Wireless,
        }
    }
}
