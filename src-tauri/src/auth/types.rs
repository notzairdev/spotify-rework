use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Spotify OAuth tokens
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_at: DateTime<Utc>,
    pub scope: String,
}

impl SpotifyTokens {
    /// Check if the access token is expired
    pub fn is_expired(&self) -> bool {
        Utc::now() >= self.expires_at
    }

    /// Check if token will expire within the given seconds
    pub fn expires_within(&self, seconds: i64) -> bool {
        Utc::now() + chrono::Duration::seconds(seconds) >= self.expires_at
    }
}

/// Spotify user profile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyUser {
    pub id: String,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub images: Vec<SpotifyImage>,
    pub product: Option<String>, // "premium", "free", etc.
    pub country: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyImage {
    pub url: String,
    pub height: Option<u32>,
    pub width: Option<u32>,
}

/// Auth state stored encrypted
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthState {
    pub tokens: SpotifyTokens,
    pub user: SpotifyUser,
    pub created_at: DateTime<Utc>,
    pub last_refresh: DateTime<Utc>,
}

/// PKCE verifier for OAuth flow
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PkceData {
    pub verifier: String,
    pub challenge: String,
    pub state: String,
}

/// Response from Spotify token endpoint
#[derive(Debug, Deserialize)]
pub struct SpotifyTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub scope: String,
    pub expires_in: i64,
    pub refresh_token: Option<String>,
}

/// Auth session info sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub user: SpotifyUser,
    pub access_token: String,
    pub expires_at: String,
    pub is_premium: bool,
}

impl From<&AuthState> for AuthSession {
    fn from(state: &AuthState) -> Self {
        AuthSession {
            user: state.user.clone(),
            access_token: state.tokens.access_token.clone(),
            expires_at: state.tokens.expires_at.to_rfc3339(),
            is_premium: state.user.product.as_deref() == Some("premium"),
        }
    }
}

/// Error types for auth operations
#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("Not authenticated")]
    NotAuthenticated,
    
    #[error("Token expired")]
    TokenExpired,
    
    #[error("Failed to refresh token: {0}")]
    RefreshFailed(String),
    
    #[error("Spotify API error: {0}")]
    SpotifyError(String),
    
    #[error("Encryption error: {0}")]
    EncryptionError(String),
    
    #[error("Storage error: {0}")]
    StorageError(String),
    
    #[error("Invalid PKCE state")]
    InvalidPkceState,
    
    #[error("HTTP error: {0}")]
    HttpError(String),
}

impl Serialize for AuthError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
