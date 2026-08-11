use tauri::{AppHandle, Emitter, Manager, Window};

pub const TRAY_ID: &str = "spotify-rework-tray";

pub fn set_island_visibility(app: &AppHandle, visible: bool) -> Result<(), String> {
    app.emit("island-visibility", visible)
        .map_err(|error| error.to_string())?;

    let Some(island) = app.get_webview_window("island") else {
        return Ok(());
    };

    if visible {
        island
            .set_always_on_top(true)
            .map_err(|error| error.to_string())?;
        island
            .set_skip_taskbar(true)
            .map_err(|error| error.to_string())?;
        island.show().map_err(|error| error.to_string())?;
    } else {
        island.hide().map_err(|error| error.to_string())?;
    }

    Ok(())
}

pub fn hide_windows_to_tray(app: &AppHandle) -> Result<(), String> {
    set_island_visibility(app, false)?;

    let tray = app
        .tray_by_id(TRAY_ID)
        .ok_or_else(|| "Application tray is unavailable".to_string())?;
    tray.set_visible(true).map_err(|error| error.to_string())?;

    if let Some(main) = app.get_webview_window("main") {
        main.hide().map_err(|error| error.to_string())?;
    }

    Ok(())
}

pub fn restore_main_window(app: &AppHandle) -> Result<(), String> {
    set_island_visibility(app, false)?;

    if let Some(main) = app.get_webview_window("main") {
        main.show().map_err(|error| error.to_string())?;
        main.unminimize().map_err(|error| error.to_string())?;
        main.set_focus().map_err(|error| error.to_string())?;
    }
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_visible(false).map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn set_dynamic_island_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    set_island_visibility(&app, visible)
}

/// Set window fullscreen state
#[tauri::command]
pub async fn set_fullscreen(window: Window, fullscreen: bool) -> Result<(), String> {
    window
        .set_fullscreen(fullscreen)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Get window fullscreen state
#[tauri::command]
pub async fn is_fullscreen(window: Window) -> Result<bool, String> {
    window.is_fullscreen().map_err(|e| e.to_string())
}

/// Toggle window fullscreen state
#[tauri::command]
pub async fn toggle_fullscreen(window: Window) -> Result<bool, String> {
    let current = window.is_fullscreen().map_err(|e| e.to_string())?;
    let new_state = !current;
    window
        .set_fullscreen(new_state)
        .map_err(|e| e.to_string())?;
    Ok(new_state)
}
