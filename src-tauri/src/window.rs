use tauri::{AppHandle, Manager, Window};

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
