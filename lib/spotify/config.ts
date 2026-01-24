/**
 * Spotify SDK Configuration
 *
 * To use the Spotify Web API, you need to:
 * 1. Create an app at https://developer.spotify.com/dashboard
 * 2. Set the redirect URI in your app settings
 * 3. Add your Client ID here (or use environment variables)
 *
 * IMPORTANT: The Client Secret should NEVER be stored in the frontend.
 * Use Tauri backend commands to handle authentication securely.
 */

export const SPOTIFY_CONFIG = {
  /**
   * Your Spotify App Client ID
   * Get it from: https://developer.spotify.com/dashboard
   */
  clientId: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? "",

  /**
   * Redirect URI for OAuth flow
   * Must match what's configured in Spotify Dashboard
   */
  redirectUri: process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI ?? "http://127.0.0.1:8888/callback",

  /**
   * Scopes define what permissions your app requests
   * See: https://developer.spotify.com/documentation/web-api/concepts/scopes
   */
  scopes: [
    // User
    "user-read-private",
    "user-read-email",

    // Playback
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",

    // Library
    "user-library-read",
    "user-library-modify",

    // Playlists
    "playlist-read-private",
    "playlist-read-collaborative",
    "playlist-modify-public",
    "playlist-modify-private",

    // Listening history
    "user-read-recently-played",
    "user-top-read",

    // Follow
    "user-follow-read",
    "user-follow-modify",

    // Streaming (for Web Playback SDK)
    "streaming",
  ] as const,
} as const;

export type SpotifyScope = (typeof SPOTIFY_CONFIG.scopes)[number];

/**
 * Generate the Spotify authorization URL
 */
export function getSpotifyAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: SPOTIFY_CONFIG.clientId,
    response_type: "code",
    redirect_uri: SPOTIFY_CONFIG.redirectUri,
    scope: SPOTIFY_CONFIG.scopes.join(" "),
    ...(state && { state }),
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}
