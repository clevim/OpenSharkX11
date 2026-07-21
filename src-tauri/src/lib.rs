mod commands;
mod driver;
mod protocols;
mod state;
mod tray;

use state::ManagedState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("opensharkx11=debug".parse().unwrap()),
        )
        .init();

    tauri::Builder::default()
        .manage(ManagedState::new())
        .setup(|app| {
            tray::create_tray(app.handle())?;
            Ok(())
        })
        .on_window_event(|win, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = win.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::connect,
            commands::disconnect,
            commands::battery,
            commands::get_config,
            commands::apply_config,
            commands::reset_config,
            commands::profiles_list,
            commands::profiles_save,
            commands::profiles_load,
            commands::profiles_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
