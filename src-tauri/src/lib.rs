mod auth;
mod music_metadata;
mod settings;
mod window;

use auth::{AppAuthState, SpotifyConfig};
use tauri::{Emitter, Manager, WindowEvent};

#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load Spotify config from environment
    let spotify_config = SpotifyConfig::default();

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;

                let open_item =
                    MenuItem::with_id(app, "open", "Open Spotify Rework", true, None::<&str>)?;
                let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
                let tray_menu = Menu::with_items(app, &[&open_item, &quit_item])?;
                let tray = TrayIconBuilder::with_id(window::TRAY_ID)
                    .icon(
                        app.default_window_icon()
                            .ok_or_else(|| {
                                std::io::Error::other("Application tray icon is unavailable")
                            })?
                            .clone(),
                    )
                    .tooltip("Spotify Rework")
                    .menu(&tray_menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "open" => {
                            let _ = window::restore_main_window(app);
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let _ = window::restore_main_window(tray.app_handle());
                        }
                    })
                    .build(app)?;
                tray.set_visible(false)?;
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
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
            music_metadata::fetch_music_metadata,
            settings::load_settings,
            settings::save_settings,
            settings::reset_settings,
            window::set_fullscreen,
            window::is_fullscreen,
            window::toggle_fullscreen,
            window::set_dynamic_island_visible,
        ])
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let close_behavior = settings::load_settings()
                        .map(|settings| settings.window_behavior.close_behavior)
                        .unwrap_or_default();

                    if matches!(close_behavior, settings::CloseBehavior::Tray) {
                        if let Err(error) = window::hide_windows_to_tray(window.app_handle()) {
                            log::error!("Failed to hide application to tray: {error}");
                        }
                    } else {
                        window.app_handle().exit(0);
                    }
                }
                WindowEvent::Resized(_) => {
                    if let Ok(is_min) = window.is_minimized() {
                        if window.app_handle().get_webview_window("island").is_some() {
                            let _ = window.app_handle().emit("main-window-minimized", is_min);
                        }
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
