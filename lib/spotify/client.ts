/**
 * Spotify API Client wrapper for Tauri
 *
 * This module provides a type-safe wrapper around the Spotify Web API SDK
 * that integrates with Tauri for secure token management.
 *
 * Authentication tokens should be stored and managed by the Tauri backend,
 * not in the browser's localStorage for security reasons.
 */

import { SpotifyApi, type AccessToken } from "@spotify/web-api-ts-sdk";
import { SPOTIFY_CONFIG } from "./config";
import { devLog, devError, isTauriContext } from "@/lib/env";

/**
 * Token storage interface - implemented by Tauri backend
 * The frontend requests tokens through Tauri commands
 */
export interface TokenStorage {
  getAccessToken(): Promise<AccessToken | null>;
  setAccessToken(token: AccessToken): Promise<void>;
  clearAccessToken(): Promise<void>;
}

/**
 * Spotify client instance - lazily initialized
 */
let spotifyClient: SpotifyApi | null = null;

/**
 * Get or create the Spotify API client
 *
 * NOTE: In production, you should use Tauri commands to:
 * 1. Handle the OAuth flow securely (exchange code for tokens)
 * 2. Store tokens securely in the system keychain
 * 3. Refresh tokens automatically
 *
 * This function creates a client that can be initialized with
 * a token obtained from the Tauri backend.
 */
export function getSpotifyClient(): SpotifyApi | null {
  if (!SPOTIFY_CONFIG.clientId) {
    devError("Spotify Client ID not configured. Set NEXT_PUBLIC_SPOTIFY_CLIENT_ID");
    return null;
  }

  if (!spotifyClient) {
    // Create a client without authentication initially
    // Authentication will be handled through Tauri
    spotifyClient = SpotifyApi.withClientCredentials(
      SPOTIFY_CONFIG.clientId,
      // Client secret should come from Tauri backend, not frontend
      ""
    );
  }

  return spotifyClient;
}

/**
 * Initialize Spotify client with access token from Tauri backend
 *
 * @example
 * ```tsx
 * const { data: token } = useTauriCommand<AccessToken>("get_spotify_token");
 * if (token) {
 *   initializeSpotifyWithToken(token);
 * }
 * ```
 */
export function initializeSpotifyWithToken(token: AccessToken): SpotifyApi {
  if (!SPOTIFY_CONFIG.clientId) {
    throw new Error("Spotify Client ID not configured");
  }

  spotifyClient = SpotifyApi.withAccessToken(SPOTIFY_CONFIG.clientId, token);
  devLog("Spotify client initialized with token");

  return spotifyClient;
}

/**
 * Clear the current Spotify client (e.g., on logout)
 */
export function clearSpotifyClient(): void {
  spotifyClient = null;
  devLog("Spotify client cleared");
}

/**
 * Check if Spotify client is initialized and authenticated
 */
export function isSpotifyAuthenticated(): boolean {
  return spotifyClient !== null;
}

/**
 * Re-export useful types from the Spotify SDK
 */
export type {
  AccessToken,
  Album,
  Artist,
  Track,
  Playlist,
  User,
  PlaybackState,
  RecentlyPlayedTracksPage,
  SavedTrack,
  SearchResults,
} from "@spotify/web-api-ts-sdk";

/**
 * Re-export the SpotifyApi class for direct use if needed
 */
export { SpotifyApi };
