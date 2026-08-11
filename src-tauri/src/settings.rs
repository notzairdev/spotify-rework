use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;

const APP_QUALIFIER: &str = "com";
const APP_ORGANIZATION: &str = "spotify-rework";
const APP_NAME: &str = "spotify-rework";
const SETTINGS_FILE: &str = "settings.json";
const SETTINGS_TEMP_FILE: &str = "settings.tmp";
const SETTINGS_BACKUP_FILE: &str = "settings.bak";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemePreference {
    Dark,
    Light,
    System,
}

impl Default for ThemePreference {
    fn default() -> Self {
        Self::Dark
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppearanceSettings {
    pub theme: ThemePreference,
    pub reduce_motion: bool,
    pub reduce_transparency: bool,
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            theme: ThemePreference::Dark,
            reduce_motion: false,
            reduce_transparency: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct InterfaceSettings {
    pub show_library_sidebar: bool,
    pub library_sidebar_expanded: bool,
    pub show_now_playing_panel: bool,
    pub now_playing_width: NowPlayingWidth,
}

impl Default for InterfaceSettings {
    fn default() -> Self {
        Self {
            show_library_sidebar: true,
            library_sidebar_expanded: true,
            show_now_playing_panel: true,
            now_playing_width: NowPlayingWidth::Comfortable,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NowPlayingWidth {
    Compact,
    Comfortable,
    Wide,
}

impl Default for NowPlayingWidth {
    fn default() -> Self {
        Self::Comfortable
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PreviousButtonBehavior {
    Smart,
    Previous,
}

impl Default for PreviousButtonBehavior {
    fn default() -> Self {
        Self::Smart
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PlaybackSettings {
    pub startup_volume: f64,
    pub remember_volume: bool,
    pub auto_transfer_playback: bool,
    pub previous_button_behavior: PreviousButtonBehavior,
}

impl Default for PlaybackSettings {
    fn default() -> Self {
        Self {
            startup_volume: 0.5,
            remember_volume: true,
            auto_transfer_playback: true,
            previous_button_behavior: PreviousButtonBehavior::Smart,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PrivacySettings {
    pub save_search_history: bool,
    pub save_playback_state: bool,
}

impl Default for PrivacySettings {
    fn default() -> Self {
        Self {
            save_search_history: true,
            save_playback_state: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct UpdateSettings {
    pub automatic_checks: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MinimizeBehavior {
    Taskbar,
    DynamicIsland,
}

impl Default for MinimizeBehavior {
    fn default() -> Self {
        Self::DynamicIsland
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CloseBehavior {
    Exit,
    #[serde(alias = "minimize")]
    Tray,
}

impl Default for CloseBehavior {
    fn default() -> Self {
        Self::Exit
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct WindowSettings {
    pub minimize_behavior: MinimizeBehavior,
    pub close_behavior: CloseBehavior,
}

impl Default for WindowSettings {
    fn default() -> Self {
        Self {
            minimize_behavior: MinimizeBehavior::DynamicIsland,
            close_behavior: CloseBehavior::Exit,
        }
    }
}

impl Default for UpdateSettings {
    fn default() -> Self {
        Self {
            automatic_checks: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AppSettings {
    pub schema_version: u32,
    pub appearance: AppearanceSettings,
    pub interface: InterfaceSettings,
    pub playback: PlaybackSettings,
    pub privacy: PrivacySettings,
    pub updates: UpdateSettings,
    #[serde(alias = "window")]
    pub window_behavior: WindowSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            schema_version: 4,
            appearance: AppearanceSettings::default(),
            interface: InterfaceSettings::default(),
            playback: PlaybackSettings::default(),
            privacy: PrivacySettings::default(),
            updates: UpdateSettings::default(),
            window_behavior: WindowSettings::default(),
        }
    }
}

fn get_data_dir() -> Result<PathBuf, String> {
    ProjectDirs::from(APP_QUALIFIER, APP_ORGANIZATION, APP_NAME)
        .map(|dirs| dirs.data_local_dir().to_path_buf())
        .ok_or_else(|| "Could not determine the application data directory".to_string())
}

fn settings_path(file_name: &str) -> Result<PathBuf, String> {
    let mut path = get_data_dir()?;
    path.push(file_name);
    Ok(path)
}

fn normalize_settings(mut settings: AppSettings) -> AppSettings {
    settings.schema_version = 4;
    settings.playback.startup_volume = settings.playback.startup_volume.clamp(0.05, 1.0);
    settings
}

fn write_settings(settings: &AppSettings) -> Result<(), String> {
    let target = settings_path(SETTINGS_FILE)?;
    let temporary = settings_path(SETTINGS_TEMP_FILE)?;
    let backup = settings_path(SETTINGS_BACKUP_FILE)?;

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create settings directory: {error}"))?;
    }

    let json = serde_json::to_vec_pretty(settings)
        .map_err(|error| format!("Failed to serialize settings: {error}"))?;
    let mut file = fs::File::create(&temporary)
        .map_err(|error| format!("Failed to create temporary settings file: {error}"))?;
    file.write_all(&json)
        .map_err(|error| format!("Failed to write settings: {error}"))?;
    file.sync_all()
        .map_err(|error| format!("Failed to flush settings: {error}"))?;

    if backup.exists() {
        fs::remove_file(&backup)
            .map_err(|error| format!("Failed to remove stale settings backup: {error}"))?;
    }
    if target.exists() {
        fs::rename(&target, &backup)
            .map_err(|error| format!("Failed to prepare settings update: {error}"))?;
    }

    if let Err(error) = fs::rename(&temporary, &target) {
        if backup.exists() {
            let _ = fs::rename(&backup, &target);
        }
        return Err(format!("Failed to replace settings file: {error}"));
    }

    if backup.exists() {
        fs::remove_file(&backup)
            .map_err(|error| format!("Failed to remove settings backup: {error}"))?;
    }

    Ok(())
}

#[tauri::command]
pub fn load_settings() -> Result<AppSettings, String> {
    let target = settings_path(SETTINGS_FILE)?;
    let backup = settings_path(SETTINGS_BACKUP_FILE)?;

    if !target.exists() && backup.exists() {
        fs::rename(&backup, &target)
            .map_err(|error| format!("Failed to recover settings backup: {error}"))?;
    }
    if !target.exists() {
        let defaults = AppSettings::default();
        write_settings(&defaults)?;
        return Ok(defaults);
    }

    let json =
        fs::read_to_string(&target).map_err(|error| format!("Failed to read settings: {error}"))?;
    let settings = serde_json::from_str::<AppSettings>(&json)
        .map_err(|error| format!("Failed to parse settings: {error}"))?;
    Ok(normalize_settings(settings))
}

#[tauri::command]
pub fn save_settings(settings: AppSettings) -> Result<AppSettings, String> {
    let settings = normalize_settings(settings);
    write_settings(&settings)?;
    Ok(settings)
}

#[tauri::command]
pub fn reset_settings() -> Result<AppSettings, String> {
    let settings = AppSettings::default();
    write_settings(&settings)?;
    Ok(settings)
}
