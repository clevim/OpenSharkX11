use tauri::{
    AppHandle, Emitter, Manager,
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
};
use tracing::warn;

use crate::driver::ConnMode;

const TRAY_ICON_BYTES: &[u8] = include_bytes!("../icons/tray.png");

pub fn create_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let icon = Image::from_bytes(TRAY_ICON_BYTES)?;

    let show_item = MenuItemBuilder::new("Show OpenSharkX11")
        .id("show")
        .build(app)?;
    let search_item = MenuItemBuilder::new("Search mouse")
        .id("search")
        .build(app)?;
    let quit_item = MenuItemBuilder::new("Quit")
        .id("quit")
        .build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show_item)
        .separator()
        .item(&search_item)
        .separator()
        .item(&quit_item)
        .build()?;

    TrayIconBuilder::with_id("main")
        .icon(icon)
        .menu(&menu)
        .tooltip("OpenSharkX11")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "search" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                    let _ = win.emit("tray:search", ());
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            use tauri::tray::TrayIconEvent;
            if let TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, button_state: tauri::tray::MouseButtonState::Up, .. } = event {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    if win.is_visible().unwrap_or(false) && win.is_focused().unwrap_or(false) {
                        let _ = win.hide();
                    } else {
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}

pub fn update_tray(app: &AppHandle, connected: bool, battery: i32, mode: ConnMode) {
    let Some(tray) = app.tray_by_id("main") else { return };

    let icon = make_icon(connected);
    if let Err(e) = tray.set_icon(icon) {
        warn!("tray set_icon: {e}");
    }

    // Tooltip
    let mut tooltip = "OpenSharkX11".to_string();
    match (connected, mode) {
        (false, _)               => tooltip.push_str(" · Disconnected"),
        (true, ConnMode::Wired)  => tooltip.push_str(" · USB · Charging"),
        (true, ConnMode::Bluetooth) if battery >= 0 => {
            tooltip.push_str(&format!(" · BT · {battery}%"));
        }
        (true, ConnMode::Bluetooth) => tooltip.push_str(" · BT"),
        (true, _) if battery >= 0  => tooltip.push_str(&format!(" · {battery}%")),
        _ => {}
    }
    let _ = tray.set_tooltip(Some(&tooltip));

    // Title (battery % shown next to icon on supported platforms)
    let title = if connected && !matches!(mode, ConnMode::Wired) && battery >= 0 {
        Some(format!(" {battery}%"))
    } else {
        None
    };
    let _ = tray.set_title(title.as_deref());
}

fn make_icon(connected: bool) -> Option<Image<'static>> {
    let img = image::load_from_memory(TRAY_ICON_BYTES).ok()?;
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    let mut pixels = rgba.into_raw();

    if !connected {
        // Convert to grayscale (mirrors Electron BGRA logic — PNG is RGBA)
        for chunk in pixels.chunks_exact_mut(4) {
            let gray = (0.299 * chunk[0] as f32
                      + 0.587 * chunk[1] as f32
                      + 0.114 * chunk[2] as f32) as u8;
            chunk[0] = gray;
            chunk[1] = gray;
            chunk[2] = gray;
        }
    }

    Some(Image::new_owned(pixels, w, h))
}
