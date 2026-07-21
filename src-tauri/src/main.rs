#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK sends a Wayland protocol error (EPROTO / Error 71) when GPU
    // compositing races with certain Wayland compositors (KDE Plasma, Hyprland).
    // Disabling compositing keeps all rendering on the CPU rasteriser; the
    // performance hit is negligible for a mouse-configurator UI.
    if std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").is_none() {
        #[allow(deprecated)]
        unsafe { std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1"); }
    }

    opensharkx11_lib::run()
}
