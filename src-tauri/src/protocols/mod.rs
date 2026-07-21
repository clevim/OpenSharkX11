pub mod dpi;
pub mod user_prefs;
pub mod polling_rate;
pub mod macros;
pub mod custom_macro;
pub mod reset;

/// Whether the device is connected via USB-C wired or 2.4GHz wireless adapter.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
pub enum ConnectionMode {
    Wired,
    Wireless,
}
