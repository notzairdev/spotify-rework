mod auth;
mod window;

use auth::{AppAuthState, SpotifyConfig};
use tauri::{Emitter, Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load Spotify config from environment
    let spotify_config = SpotifyConfig::default();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppAuthState::new(spotify_config))
        .invoke_handler(tauri::generate_handler![
            auth::get_auth_url,
            auth::exchange_code,
            auth::refresh_token,
            auth::get_session,
            auth::get_access_token,
            auth::logout,
            auth::is_authenticated,
            auth::start_auth_flow,
            window::set_fullscreen,
            window::is_fullscreen,
            window::toggle_fullscreen,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::Resized(_) = event {
                    if let Ok(is_min) = window.is_minimized() {
                        if let Some(island) = window.app_handle().get_webview_window("island") {
                            // Let the frontend manage visibility based on playback state
                            // We just emit an event to the frontend
                            let _ = window.app_handle().emit("main-window-minimized", is_min);
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
