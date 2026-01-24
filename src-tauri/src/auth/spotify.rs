use base64::{engine::general_purpose::URL_SAFE_NO_PAD as BASE64_URL, Engine};
use chrono::{Duration, Utc};
use rand::RngCore;
use reqwest::Client;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;
use url::Url;

use super::{
    storage,
    types::{
        AuthError, AuthSession, AuthState, PkceData, SpotifyTokenResponse, SpotifyTokens,
        SpotifyUser,
    },
};

/// Spotify OAuth configuration
pub struct SpotifyConfig {
    pub client_id: String,
    pub redirect_uri: String,
    pub scopes: Vec<String>,
}

impl Default for SpotifyConfig {
    fn default() -> Self {
        Self {
            client_id: std::env::var("SPOTIFY_CLIENT_ID")
                .unwrap_or_else(|_| "a53c8535d69c4f0d9109b007bf10ca2d".into()),
            redirect_uri: std::env::var("SPOTIFY_REDIRECT_URI")
                .unwrap_or_else(|_| "http://127.0.0.1:8888/callback".into()),
            scopes: vec![
                "user-read-private".into(),
                "user-read-email".into(),
                "user-read-playback-state".into(),
                "user-modify-playback-state".into(),
                "user-read-currently-playing".into(),
                "user-library-read".into(),
                "user-library-modify".into(),
                "playlist-read-private".into(),
                "playlist-read-collaborative".into(),
                "playlist-modify-public".into(),
                "playlist-modify-private".into(),
                "user-read-recently-played".into(),
                "user-top-read".into(),
                "user-follow-read".into(),
                "user-follow-modify".into(),
                "streaming".into(),
            ],
        }
    }
}

/// Application state for auth
pub struct AppAuthState {
    pub config: SpotifyConfig,
    pub pending_pkce: Mutex<Option<PkceData>>,
    pub current_auth: Mutex<Option<AuthState>>,
    pub http_client: Client,
}

impl AppAuthState {
    pub fn new(config: SpotifyConfig) -> Self {
        Self {
            config,
            pending_pkce: Mutex::new(None),
            current_auth: Mutex::new(None),
            http_client: Client::new(),
        }
    }
}

/// Generate PKCE code verifier and challenge
fn generate_pkce() -> PkceData {
    // Generate 64 random bytes for verifier
    let mut verifier_bytes = [0u8; 64];
    rand::thread_rng().fill_bytes(&mut verifier_bytes);
    let verifier = BASE64_URL.encode(&verifier_bytes);

    // Create SHA256 hash of verifier for challenge
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let challenge = BASE64_URL.encode(hasher.finalize());

    // Generate random state
    let mut state_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut state_bytes);
    let state = BASE64_URL.encode(&state_bytes);

    PkceData {
        verifier,
        challenge,
        state,
    }
}

/// Generate the Spotify authorization URL
#[tauri::command]
pub fn get_auth_url(state: State<AppAuthState>) -> Result<String, AuthError> {
    if state.config.client_id.is_empty() {
        return Err(AuthError::SpotifyError("Client ID not configured".into()));
    }

    let pkce = generate_pkce();

    // Build authorization URL
    let params = [
        ("client_id", state.config.client_id.as_str()),
        ("response_type", "code"),
        ("redirect_uri", state.config.redirect_uri.as_str()),
        ("scope", &state.config.scopes.join(" ")),
        ("code_challenge_method", "S256"),
        ("code_challenge", &pkce.challenge),
        ("state", &pkce.state),
    ];

    let query = params
        .iter()
        .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
        .collect::<Vec<_>>()
        .join("&");

    let url = format!("https://accounts.spotify.com/authorize?{}", query);

    // Store PKCE data for callback
    *state.pending_pkce.lock().unwrap() = Some(pkce);

    log::info!("Generated auth URL");
    Ok(url)
}

/// Exchange authorization code for tokens
#[tauri::command]
pub async fn exchange_code(
    code: String,
    returned_state: String,
    state: State<'_, AppAuthState>,
) -> Result<AuthSession, AuthError> {
    // Verify PKCE state
    let pkce = state
        .pending_pkce
        .lock()
        .unwrap()
        .take()
        .ok_or(AuthError::InvalidPkceState)?;

    if pkce.state != returned_state {
        return Err(AuthError::InvalidPkceState);
    }

    // Exchange code for tokens
    let mut params = HashMap::new();
    params.insert("grant_type", "authorization_code");
    params.insert("code", &code);
    params.insert("redirect_uri", &state.config.redirect_uri);
    params.insert("client_id", &state.config.client_id);
    params.insert("code_verifier", &pkce.verifier);

    let response = state
        .http_client
        .post("https://accounts.spotify.com/api/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| AuthError::HttpError(e.to_string()))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        log::error!("Token exchange failed: {}", error_text);
        return Err(AuthError::SpotifyError(format!(
            "Token exchange failed: {}",
            error_text
        )));
    }

    let token_response: SpotifyTokenResponse = response
        .json()
        .await
        .map_err(|e| AuthError::SpotifyError(format!("Failed to parse token response: {}", e)))?;

    // Calculate expiration time
    let expires_at = Utc::now() + Duration::seconds(token_response.expires_in);

    let tokens = SpotifyTokens {
        access_token: token_response.access_token,
        refresh_token: token_response
            .refresh_token
            .ok_or_else(|| AuthError::SpotifyError("No refresh token received".into()))?,
        token_type: token_response.token_type,
        expires_at,
        scope: token_response.scope,
    };

    // Fetch user profile
    let user = fetch_user_profile(&state.http_client, &tokens.access_token).await?;

    let now = Utc::now();
    let auth_state = AuthState {
        tokens,
        user,
        created_at: now,
        last_refresh: now,
    };

    // Save encrypted to disk
    storage::save_auth_state(&auth_state)?;

    // Store in memory
    let session = AuthSession::from(&auth_state);
    *state.current_auth.lock().unwrap() = Some(auth_state);

    log::info!("Authentication successful");
    Ok(session)
}

/// Fetch user profile from Spotify API
async fn fetch_user_profile(client: &Client, access_token: &str) -> Result<SpotifyUser, AuthError> {
    let response = client
        .get("https://api.spotify.com/v1/me")
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| AuthError::HttpError(e.to_string()))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(AuthError::SpotifyError(format!(
            "Failed to fetch user profile: {}",
            error_text
        )));
    }

    response
        .json()
        .await
        .map_err(|e| AuthError::SpotifyError(format!("Failed to parse user profile: {}", e)))
}

/// Refresh the access token
#[tauri::command]
pub async fn refresh_token(state: State<'_, AppAuthState>) -> Result<AuthSession, AuthError> {
    let auth_state = state
        .current_auth
        .lock()
        .unwrap()
        .clone()
        .or_else(|| storage::load_auth_state().ok().flatten())
        .ok_or(AuthError::NotAuthenticated)?;

    let mut params = HashMap::new();
    params.insert("grant_type", "refresh_token");
    params.insert("refresh_token", &auth_state.tokens.refresh_token);
    params.insert("client_id", &state.config.client_id);

    let response = state
        .http_client
        .post("https://accounts.spotify.com/api/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| AuthError::HttpError(e.to_string()))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        log::error!("Token refresh failed: {}", error_text);
        return Err(AuthError::RefreshFailed(error_text));
    }

    let token_response: SpotifyTokenResponse = response
        .json()
        .await
        .map_err(|e| AuthError::SpotifyError(format!("Failed to parse token response: {}", e)))?;

    let expires_at = Utc::now() + Duration::seconds(token_response.expires_in);

    let new_tokens = SpotifyTokens {
        access_token: token_response.access_token,
        // Spotify might return a new refresh token, use it if available
        refresh_token: token_response
            .refresh_token
            .unwrap_or(auth_state.tokens.refresh_token),
        token_type: token_response.token_type,
        expires_at,
        scope: token_response.scope,
    };

    let new_auth_state = AuthState {
        tokens: new_tokens,
        user: auth_state.user,
        created_at: auth_state.created_at,
        last_refresh: Utc::now(),
    };

    // Save updated state
    storage::save_auth_state(&new_auth_state)?;

    let session = AuthSession::from(&new_auth_state);
    *state.current_auth.lock().unwrap() = Some(new_auth_state);

    log::info!("Token refreshed successfully");
    Ok(session)
}

/// Get current session (checks and refreshes if needed)
#[tauri::command]
pub async fn get_session(state: State<'_, AppAuthState>) -> Result<Option<AuthSession>, AuthError> {
    // Try memory first, then storage
    let auth_state = {
        let guard = state.current_auth.lock().unwrap();
        guard.clone()
    }
    .or_else(|| {
        storage::load_auth_state()
            .ok()
            .flatten()
            .map(|s| {
                // Store in memory for next time
                *state.current_auth.lock().unwrap() = Some(s.clone());
                s
            })
    });

    let Some(auth_state) = auth_state else {
        return Ok(None);
    };

    // Check if token needs refresh (within 5 minutes of expiry)
    if auth_state.tokens.expires_within(300) {
        log::info!("Token expiring soon, refreshing...");
        match refresh_token(state).await {
            Ok(session) => return Ok(Some(session)),
            Err(e) => {
                log::error!("Failed to refresh token: {}", e);
                // If refresh fails, still return existing session if not expired
                if auth_state.tokens.is_expired() {
                    return Err(AuthError::TokenExpired);
                }
            }
        }
    }

    Ok(Some(AuthSession::from(&auth_state)))
}

/// Get access token for Playback SDK
#[tauri::command]
pub async fn get_access_token(
    state: State<'_, AppAuthState>,
) -> Result<String, AuthError> {
    let session = get_session(state)
        .await?
        .ok_or(AuthError::NotAuthenticated)?;

    Ok(session.access_token)
}

/// Logout - clear all stored auth data
#[tauri::command]
pub fn logout(state: State<AppAuthState>) -> Result<(), AuthError> {
    storage::delete_auth_state()?;
    *state.current_auth.lock().unwrap() = None;
    log::info!("Logged out");
    Ok(())
}

/// Check if user is authenticated
#[tauri::command]
pub fn is_authenticated(state: State<AppAuthState>) -> bool {
    state.current_auth.lock().unwrap().is_some() || storage::has_auth_state()
}

/// Start OAuth flow - opens browser and starts local server to capture callback
#[tauri::command]
pub async fn start_auth_flow(
    state: State<'_, AppAuthState>,
) -> Result<AuthSession, AuthError> {
    use tiny_http::{Response, Server};
    
    if state.config.client_id.is_empty() {
        return Err(AuthError::SpotifyError("Client ID not configured".into()));
    }

    // Start local server on port 8888 to capture callback (avoiding Next.js on 3000)
    let server = Server::http("127.0.0.1:8888")
        .map_err(|e| AuthError::SpotifyError(format!("Failed to start callback server: {}", e)))?;

    let pkce = generate_pkce();
    let expected_state = pkce.state.clone();

    // Build authorization URL with callback to our local server
    let redirect_uri = "http://127.0.0.1:8888/callback";
    let params = [
        ("client_id", state.config.client_id.as_str()),
        ("response_type", "code"),
        ("redirect_uri", redirect_uri),
        ("scope", &state.config.scopes.join(" ")),
        ("code_challenge_method", "S256"),
        ("code_challenge", &pkce.challenge),
        ("state", &pkce.state),
    ];

    let query = params
        .iter()
        .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
        .collect::<Vec<_>>()
        .join("&");

    let auth_url = format!("https://accounts.spotify.com/authorize?{}", query);

    // Store PKCE data
    *state.pending_pkce.lock().unwrap() = Some(pkce.clone());

    log::info!("Starting auth flow, opening browser...");

    // Open browser with auth URL
    if let Err(e) = open::that(&auth_url) {
        log::error!("Failed to open browser: {}", e);
        return Err(AuthError::SpotifyError(format!("Failed to open browser: {}", e)));
    }

    // Wait for callback request (with timeout)
    let (code, returned_state) = tokio::task::spawn_blocking(move || {
        loop {
            // Use recv_timeout for 5 minute timeout
            match server.recv_timeout(std::time::Duration::from_secs(300)) {
                Ok(Some(request)) => {
                    let url = request.url();
                    
                    // Check if this is the callback
                    if url.starts_with("/callback") {
                        let full_url = format!("http://127.0.0.1:8888{}", url);
                        
                        if let Ok(parsed) = Url::parse(&full_url) {
                            let params: HashMap<_, _> = parsed.query_pairs().into_owned().collect();
                            
                            // Check for error from Spotify
                            if let Some(error) = params.get("error") {
                                let html = format!(
                                    "<html><body style='font-family: sans-serif; text-align: center; padding-top: 50px;'>\
                                    <h1 style='color: #e74c3c;'>Authentication Failed</h1>\
                                    <p>Error: {}</p>\
                                    <p>You can close this window.</p>\
                                    </body></html>",
                                    error
                                );
                                let _ = request.respond(Response::from_string(html)
                                    .with_header(tiny_http::Header::from_bytes(
                                        &b"Content-Type"[..],
                                        &b"text/html"[..]
                                    ).unwrap()));
                                return Err(AuthError::SpotifyError(error.clone()));
                            }
                            
                            // Get code and state
                            if let (Some(code), Some(state_param)) = (params.get("code"), params.get("state")) {
                                // Validate state
                                if state_param != &expected_state {
                                    let html = "<html><body style='font-family: sans-serif; text-align: center; padding-top: 50px;'>\
                                        <h1 style='color: #e74c3c;'>Authentication Failed</h1>\
                                        <p>Invalid state parameter.</p>\
                                        <p>You can close this window.</p>\
                                        </body></html>";
                                    let _ = request.respond(Response::from_string(html)
                                        .with_header(tiny_http::Header::from_bytes(
                                            &b"Content-Type"[..],
                                            &b"text/html"[..]
                                        ).unwrap()));
                                    return Err(AuthError::InvalidPkceState);
                                }
                                
                                // Success! Send response and return
                                let html = "<html><body style='font-family: sans-serif; text-align: center; padding-top: 50px;'>\
                                    <h1 style='color: #1DB954;'>Success!</h1>\
                                    <p>You have been logged in successfully.</p>\
                                    <p>You can close this window and return to the app.</p>\
                                    <script>setTimeout(function() { window.close(); }, 2000);</script>\
                                    </body></html>";
                                let _ = request.respond(Response::from_string(html)
                                    .with_header(tiny_http::Header::from_bytes(
                                        &b"Content-Type"[..],
                                        &b"text/html"[..]
                                    ).unwrap()));
                                
                                return Ok((code.clone(), state_param.clone()));
                            }
                        }
                        
                        // Bad callback request
                        let _ = request.respond(Response::from_string("Bad request"));
                    } else {
                        // Not the callback endpoint, return 404
                        let _ = request.respond(Response::from_string("Not found").with_status_code(404));
                    }
                }
                Ok(None) => {
                    // Timeout - no request received
                    return Err(AuthError::SpotifyError("Auth timeout or cancelled".into()));
                }
                Err(e) => {
                    log::error!("Server error: {}", e);
                    return Err(AuthError::SpotifyError("Auth timeout or cancelled".into()));
                }
            }
        }
    })
    .await
    .map_err(|e| AuthError::SpotifyError(format!("Task error: {}", e)))??;

    log::info!("Received callback, exchanging code for tokens...");

    // Verify PKCE state
    let pkce = state
        .pending_pkce
        .lock()
        .unwrap()
        .take()
        .ok_or(AuthError::InvalidPkceState)?;

    if pkce.state != returned_state {
        return Err(AuthError::InvalidPkceState);
    }

    // Exchange code for tokens
    let redirect_uri = "http://127.0.0.1:8888/callback";
    let mut params = HashMap::new();
    params.insert("grant_type", "authorization_code");
    params.insert("code", &code);
    params.insert("redirect_uri", redirect_uri);
    params.insert("client_id", &state.config.client_id);
    params.insert("code_verifier", &pkce.verifier);

    let response = state
        .http_client
        .post("https://accounts.spotify.com/api/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| AuthError::HttpError(e.to_string()))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        log::error!("Token exchange failed: {}", error_text);
        return Err(AuthError::SpotifyError(format!(
            "Token exchange failed: {}",
            error_text
        )));
    }

    let token_response: SpotifyTokenResponse = response
        .json()
        .await
        .map_err(|e| AuthError::SpotifyError(format!("Failed to parse token response: {}", e)))?;

    let expires_at = Utc::now() + Duration::seconds(token_response.expires_in);

    let tokens = SpotifyTokens {
        access_token: token_response.access_token,
        refresh_token: token_response
            .refresh_token
            .ok_or_else(|| AuthError::SpotifyError("No refresh token received".into()))?,
        token_type: token_response.token_type,
        expires_at,
        scope: token_response.scope,
    };

    // Fetch user profile
    let user = fetch_user_profile(&state.http_client, &tokens.access_token).await?;

    let now = Utc::now();
    let auth_state = AuthState {
        tokens,
        user,
        created_at: now,
        last_refresh: now,
    };

    // Save encrypted to disk
    storage::save_auth_state(&auth_state)?;

    // Store in memory
    let session = AuthSession::from(&auth_state);
    *state.current_auth.lock().unwrap() = Some(auth_state);

    log::info!("Authentication successful");
    Ok(session)
}
