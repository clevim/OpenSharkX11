use super::ConnectionMode;

/// Internal state reset report — clears mouse RAM config.
/// MUST be followed by a full config reapply (DPI + UserPrefs + PollingRate + Macros).
pub fn build_reset(mode: ConnectionMode) -> Vec<u8> {
    let full = [0x0c, 0x0a, 0x01, 0xfe, 0x01, 0xfe, 0x00, 0x00, 0x00, 0x00u8];
    match mode {
        ConnectionMode::Wired    => full[..6].to_vec(),
        ConnectionMode::Wireless => full.to_vec(),
    }
}

pub const RESET_CONTROL_PARAMS: (u8, u8, u16, u16) = (0x21, 0x09, 0x030c, 2);
