use directories::ProjectDirs;
use std::fs;
use std::path::PathBuf;

use super::{crypto, types::AuthError, AuthState};

const APP_QUALIFIER: &str = "com";
const APP_ORGANIZATION: &str = "spotify-rework";
const APP_NAME: &str = "spotify-rework";
const AUTH_FILE: &str = "auth.enc";

/// Get the application data directory
fn get_data_dir() -> Result<PathBuf, AuthError> {
    ProjectDirs::from(APP_QUALIFIER, APP_ORGANIZATION, APP_NAME)
        .map(|dirs| dirs.data_local_dir().to_path_buf())
        .ok_or_else(|| AuthError::StorageError("Could not determine data directory".into()))
}

/// Get the path to the auth file
fn get_auth_file_path() -> Result<PathBuf, AuthError> {
    let mut path = get_data_dir()?;
    path.push(AUTH_FILE);
    Ok(path)
}

/// Save auth state encrypted to disk
pub fn save_auth_state(state: &AuthState) -> Result<(), AuthError> {
    let path = get_auth_file_path()?;

    // Ensure directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| AuthError::StorageError(format!("Failed to create directory: {}", e)))?;
    }

    // Serialize and encrypt
    let json = serde_json::to_string(state)
        .map_err(|e| AuthError::StorageError(format!("Failed to serialize: {}", e)))?;

    let encrypted = crypto::encrypt(&json)?;

    // Write to file
    fs::write(&path, encrypted)
        .map_err(|e| AuthError::StorageError(format!("Failed to write file: {}", e)))?;

    log::info!("Auth state saved to {:?}", path);
    Ok(())
}

/// Load auth state from disk and decrypt
pub fn load_auth_state() -> Result<Option<AuthState>, AuthError> {
    let path = get_auth_file_path()?;

    if !path.exists() {
        log::info!("No auth file found at {:?}", path);
        return Ok(None);
    }

    // Read encrypted data
    let encrypted = fs::read_to_string(&path)
        .map_err(|e| AuthError::StorageError(format!("Failed to read file: {}", e)))?;

    // Decrypt and deserialize
    let json = crypto::decrypt(&encrypted)?;

    let state: AuthState = serde_json::from_str(&json)
        .map_err(|e| AuthError::StorageError(format!("Failed to deserialize: {}", e)))?;

    log::info!("Auth state loaded from {:?}", path);
    Ok(Some(state))
}

/// Delete stored auth state (logout)
pub fn delete_auth_state() -> Result<(), AuthError> {
    let path = get_auth_file_path()?;

    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| AuthError::StorageError(format!("Failed to delete file: {}", e)))?;
        log::info!("Auth state deleted from {:?}", path);
    }

    Ok(())
}

/// Check if auth state exists
pub fn has_auth_state() -> bool {
    get_auth_file_path()
        .map(|p| p.exists())
        .unwrap_or(false)
}
