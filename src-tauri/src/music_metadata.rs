use std::time::Duration;

use reqwest::{redirect::Policy, Url};
use serde_json::Value;

const USER_AGENT: &str = "SpotifyRework/0.1 (https://github.com/notzairdev/spotify-rework)";

fn is_allowed_url(url: &Url) -> bool {
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
        || !matches!(url.port(), None | Some(443))
    {
        return false;
    }

    match url.host_str() {
        Some("api.reccobeats.com") => url.path().starts_with("/v1/"),
        Some("api.listenbrainz.org") => url.path().starts_with("/1/"),
        Some("www.theaudiodb.com") => url.path().starts_with("/api/v1/json/"),
        Some("artwork.m8tec.top") => url.path() == "/api/v1/artwork/search",
        Some("musicbrainz.org") => url.path().starts_with("/ws/2/"),
        _ => false,
    }
}

#[tauri::command]
pub async fn fetch_music_metadata(url: String) -> Result<Value, String> {
    let parsed = Url::parse(&url).map_err(|_| "Invalid metadata URL".to_string())?;
    if !is_allowed_url(&parsed) {
        return Err("Metadata source is not allowed".to_string());
    }

    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .redirect(Policy::none())
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| format!("Failed to create metadata client: {error}"))?;

    let response = client
        .get(parsed)
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .await
        .map_err(|error| format!("Metadata request failed: {error}"))?;

    if response.status() == reqwest::StatusCode::NO_CONTENT {
        return Ok(Value::Null);
    }

    let status = response.status();
    if !status.is_success() {
        return Err(format!("Metadata source returned {status}"));
    }

    response
        .json::<Value>()
        .await
        .map_err(|error| format!("Invalid metadata response: {error}"))
}
