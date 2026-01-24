/**
 * Spotify API Service
 *
 * Provides functions to interact with the Spotify Web API.
 * Uses the access token from the Tauri backend for authentication.
 */

import { invoke } from "@tauri-apps/api/core";
import { isTauriContext, devError, devLog } from "@/lib/env";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

// ============================================================================
// Types
// ============================================================================

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyUser {
  id: string;
  display_name: string | null;
  email?: string;
  images: SpotifyImage[];
  product?: "premium" | "free" | "open";
  country?: string;
  followers?: {
    total: number;
  };
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images?: SpotifyImage[];
  genres?: string[];
  followers?: {
    total: number;
  };
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  artists: SpotifyArtist[];
  release_date: string;
  total_tracks: number;
  album_type: "album" | "single" | "compilation";
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  explicit: boolean;
  preview_url: string | null;
  track_number: number;
  uri: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: SpotifyImage[];
  owner: {
    id: string;
    display_name: string | null;
  };
  public: boolean;
  collaborative: boolean;
  tracks: {
    total: number;
    href: string;
  };
  uri: string;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyPlaylistTrack {
  added_at: string;
  added_by: {
    id: string;
  };
  track: SpotifyTrack;
}

export interface SpotifyDevice {
  id: string | null;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number | null;
  supports_volume: boolean;
}

export interface SpotifyPlaybackState {
  device: SpotifyDevice;
  shuffle_state: boolean;
  repeat_state: "off" | "track" | "context";
  timestamp: number;
  progress_ms: number | null;
  is_playing: boolean;
  item: SpotifyTrack | null;
  currently_playing_type: "track" | "episode" | "ad" | "unknown";
}

export interface SpotifySearchResults {
  tracks?: {
    items: SpotifyTrack[];
    total: number;
    limit: number;
    offset: number;
  };
  artists?: {
    items: SpotifyArtist[];
    total: number;
    limit: number;
    offset: number;
  };
  albums?: {
    items: SpotifyAlbum[];
    total: number;
    limit: number;
    offset: number;
  };
  playlists?: {
    items: SpotifyPlaylist[];
    total: number;
    limit: number;
    offset: number;
  };
}

export interface SpotifyPaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  next: string | null;
  previous: string | null;
}

export interface SpotifyRecentlyPlayed {
  items: {
    track: SpotifyTrack;
    played_at: string;
  }[];
  next: string | null;
  cursors: {
    after: string;
    before: string;
  } | null;
  limit: number;
}

export interface SpotifyTopItems<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get access token from Tauri backend
 */
async function getAccessToken(): Promise<string> {
  if (!isTauriContext()) {
    throw new Error("Spotify API requires Tauri context");
  }

  try {
    const token = await invoke<string>("get_access_token");
    return token;
  } catch (e) {
    devError("Failed to get access token:", e);
    throw new Error("Not authenticated");
  }
}

/**
 * Make authenticated request to Spotify API
 */
async function spotifyFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${SPOTIFY_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    devError(`Spotify API error (${response.status}):`, errorText);
    throw new Error(`Spotify API error: ${response.status} - ${errorText}`);
  }

  // Some endpoints return empty response (204)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ============================================================================
// User API
// ============================================================================

/**
 * Get current user's profile
 */
export async function getCurrentUser(): Promise<SpotifyUser> {
  return spotifyFetch<SpotifyUser>("/me");
}

/**
 * Get a user's profile by ID
 */
export async function getUser(userId: string): Promise<SpotifyUser> {
  return spotifyFetch<SpotifyUser>(`/users/${encodeURIComponent(userId)}`);
}

/**
 * Get current user's top tracks
 */
export async function getTopTracks(
  timeRange: "short_term" | "medium_term" | "long_term" = "medium_term",
  limit: number = 20,
  offset: number = 0
): Promise<SpotifyTopItems<SpotifyTrack>> {
  const params = new URLSearchParams({
    time_range: timeRange,
    limit: limit.toString(),
    offset: offset.toString(),
  });
  return spotifyFetch<SpotifyTopItems<SpotifyTrack>>(`/me/top/tracks?${params}`);
}

/**
 * Get current user's top artists
 */
export async function getTopArtists(
  timeRange: "short_term" | "medium_term" | "long_term" = "medium_term",
  limit: number = 20,
  offset: number = 0
): Promise<SpotifyTopItems<SpotifyArtist>> {
  const params = new URLSearchParams({
    time_range: timeRange,
    limit: limit.toString(),
    offset: offset.toString(),
  });
  return spotifyFetch<SpotifyTopItems<SpotifyArtist>>(`/me/top/artists?${params}`);
}

// ============================================================================
// Playlists API
// ============================================================================

/**
 * Get current user's playlists
 */
export async function getMyPlaylists(
  limit: number = 50,
  offset: number = 0
): Promise<SpotifyPaginatedResponse<SpotifyPlaylist>> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  return spotifyFetch<SpotifyPaginatedResponse<SpotifyPlaylist>>(
    `/me/playlists?${params}`
  );
}

/**
 * Get all user's playlists (handles pagination)
 */
export async function getAllMyPlaylists(): Promise<SpotifyPlaylist[]> {
  const playlists: SpotifyPlaylist[] = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const response = await getMyPlaylists(limit, offset);
    playlists.push(...response.items);

    if (!response.next) break;
    offset += limit;
  }

  return playlists;
}

/**
 * Get a playlist by ID
 */
export async function getPlaylist(playlistId: string): Promise<SpotifyPlaylist> {
  return spotifyFetch<SpotifyPlaylist>(
    `/playlists/${encodeURIComponent(playlistId)}`
  );
}

/**
 * Get playlist tracks
 */
export async function getPlaylistTracks(
  playlistId: string,
  limit: number = 100,
  offset: number = 0
): Promise<SpotifyPaginatedResponse<SpotifyPlaylistTrack>> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  return spotifyFetch<SpotifyPaginatedResponse<SpotifyPlaylistTrack>>(
    `/playlists/${encodeURIComponent(playlistId)}/tracks?${params}`
  );
}

/**
 * Create a new playlist
 */
export async function createPlaylist(
  name: string,
  options?: {
    description?: string;
    public?: boolean;
    collaborative?: boolean;
  }
): Promise<SpotifyPlaylist> {
  const user = await getCurrentUser();
  return spotifyFetch<SpotifyPlaylist>(`/users/${user.id}/playlists`, {
    method: "POST",
    body: JSON.stringify({
      name,
      description: options?.description ?? "",
      public: options?.public ?? true,
      collaborative: options?.collaborative ?? false,
    }),
  });
}

/**
 * Add tracks to a playlist
 */
export async function addTracksToPlaylist(
  playlistId: string,
  uris: string[],
  position?: number
): Promise<{ snapshot_id: string }> {
  return spotifyFetch<{ snapshot_id: string }>(
    `/playlists/${encodeURIComponent(playlistId)}/tracks`,
    {
      method: "POST",
      body: JSON.stringify({
        uris,
        position,
      }),
    }
  );
}

/**
 * Remove tracks from a playlist
 */
export async function removeTracksFromPlaylist(
  playlistId: string,
  uris: string[]
): Promise<{ snapshot_id: string }> {
  return spotifyFetch<{ snapshot_id: string }>(
    `/playlists/${encodeURIComponent(playlistId)}/tracks`,
    {
      method: "DELETE",
      body: JSON.stringify({
        tracks: uris.map((uri) => ({ uri })),
      }),
    }
  );
}

// ============================================================================
// Devices & Player API
// ============================================================================

/**
 * Get available devices
 */
export async function getDevices(): Promise<{ devices: SpotifyDevice[] }> {
  return spotifyFetch<{ devices: SpotifyDevice[] }>("/me/player/devices");
}

/**
 * Get current playback state
 */
export async function getPlaybackState(): Promise<SpotifyPlaybackState | null> {
  try {
    return await spotifyFetch<SpotifyPlaybackState>("/me/player");
  } catch {
    // Returns 204 if no active device
    return null;
  }
}

/**
 * Get currently playing track
 */
export async function getCurrentlyPlaying(): Promise<SpotifyPlaybackState | null> {
  try {
    return await spotifyFetch<SpotifyPlaybackState>("/me/player/currently-playing");
  } catch {
    return null;
  }
}

/**
 * Transfer playback to a device
 */
export async function transferPlayback(
  deviceId: string,
  play: boolean = false
): Promise<void> {
  await spotifyFetch("/me/player", {
    method: "PUT",
    body: JSON.stringify({
      device_ids: [deviceId],
      play,
    }),
  });
}

/**
 * Start/Resume playback
 */
export async function startPlayback(options?: {
  deviceId?: string;
  contextUri?: string;
  uris?: string[];
  offset?: { position: number } | { uri: string };
  positionMs?: number;
}): Promise<void> {
  const params = options?.deviceId
    ? `?device_id=${encodeURIComponent(options.deviceId)}`
    : "";

  await spotifyFetch(`/me/player/play${params}`, {
    method: "PUT",
    body: JSON.stringify({
      context_uri: options?.contextUri,
      uris: options?.uris,
      offset: options?.offset,
      position_ms: options?.positionMs,
    }),
  });
}

/**
 * Pause playback
 */
export async function pausePlayback(deviceId?: string): Promise<void> {
  const params = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  await spotifyFetch(`/me/player/pause${params}`, { method: "PUT" });
}

/**
 * Skip to next track
 */
export async function skipToNext(deviceId?: string): Promise<void> {
  const params = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  await spotifyFetch(`/me/player/next${params}`, { method: "POST" });
}

/**
 * Skip to previous track
 */
export async function skipToPrevious(deviceId?: string): Promise<void> {
  const params = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
  await spotifyFetch(`/me/player/previous${params}`, { method: "POST" });
}

/**
 * Seek to position
 */
export async function seekToPosition(
  positionMs: number,
  deviceId?: string
): Promise<void> {
  const params = new URLSearchParams({
    position_ms: positionMs.toString(),
  });
  if (deviceId) params.set("device_id", deviceId);
  await spotifyFetch(`/me/player/seek?${params}`, { method: "PUT" });
}

/**
 * Set repeat mode
 */
export async function setRepeatMode(
  state: "track" | "context" | "off",
  deviceId?: string
): Promise<void> {
  const params = new URLSearchParams({ state });
  if (deviceId) params.set("device_id", deviceId);
  await spotifyFetch(`/me/player/repeat?${params}`, { method: "PUT" });
}

/**
 * Set shuffle mode
 */
export async function setShuffleMode(
  state: boolean,
  deviceId?: string
): Promise<void> {
  const params = new URLSearchParams({ state: state.toString() });
  if (deviceId) params.set("device_id", deviceId);
  await spotifyFetch(`/me/player/shuffle?${params}`, { method: "PUT" });
}

/**
 * Set volume
 */
export async function setVolume(
  volumePercent: number,
  deviceId?: string
): Promise<void> {
  const params = new URLSearchParams({
    volume_percent: Math.round(volumePercent).toString(),
  });
  if (deviceId) params.set("device_id", deviceId);
  await spotifyFetch(`/me/player/volume?${params}`, { method: "PUT" });
}

/**
 * Add item to playback queue
 */
export async function addToQueue(uri: string, deviceId?: string): Promise<void> {
  const params = new URLSearchParams({ uri });
  if (deviceId) params.set("device_id", deviceId);
  await spotifyFetch(`/me/player/queue?${params}`, { method: "POST" });
}

// ============================================================================
// Search API
// ============================================================================

export type SearchType = "track" | "artist" | "album" | "playlist";

/**
 * Search for content
 */
export async function search(
  query: string,
  types: SearchType[] = ["track", "artist", "album", "playlist"],
  limit: number = 20,
  offset: number = 0,
  market?: string
): Promise<SpotifySearchResults> {
  const params = new URLSearchParams({
    q: query,
    type: types.join(","),
    limit: limit.toString(),
    offset: offset.toString(),
  });
  if (market) params.set("market", market);

  return spotifyFetch<SpotifySearchResults>(`/search?${params}`);
}

/**
 * Search tracks only
 */
export async function searchTracks(
  query: string,
  limit: number = 20,
  offset: number = 0
): Promise<SpotifyTrack[]> {
  const results = await search(query, ["track"], limit, offset);
  return results.tracks?.items ?? [];
}

/**
 * Search artists only
 */
export async function searchArtists(
  query: string,
  limit: number = 20,
  offset: number = 0
): Promise<SpotifyArtist[]> {
  const results = await search(query, ["artist"], limit, offset);
  return results.artists?.items ?? [];
}

/**
 * Search albums only
 */
export async function searchAlbums(
  query: string,
  limit: number = 20,
  offset: number = 0
): Promise<SpotifyAlbum[]> {
  const results = await search(query, ["album"], limit, offset);
  return results.albums?.items ?? [];
}

/**
 * Search playlists only
 */
export async function searchPlaylists(
  query: string,
  limit: number = 20,
  offset: number = 0
): Promise<SpotifyPlaylist[]> {
  const results = await search(query, ["playlist"], limit, offset);
  return results.playlists?.items ?? [];
}

// ============================================================================
// Library API
// ============================================================================

/**
 * Get user's saved tracks (Liked Songs)
 */
export async function getSavedTracks(
  limit: number = 50,
  offset: number = 0
): Promise<SpotifyPaginatedResponse<{ added_at: string; track: SpotifyTrack }>> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  return spotifyFetch<
    SpotifyPaginatedResponse<{ added_at: string; track: SpotifyTrack }>
  >(`/me/tracks?${params}`);
}

/**
 * Save tracks to library
 */
export async function saveTracks(ids: string[]): Promise<void> {
  await spotifyFetch(`/me/tracks?ids=${ids.join(",")}`, { method: "PUT" });
}

/**
 * Remove tracks from library
 */
export async function removeTracks(ids: string[]): Promise<void> {
  await spotifyFetch(`/me/tracks?ids=${ids.join(",")}`, { method: "DELETE" });
}

/**
 * Check if tracks are saved
 */
export async function checkSavedTracks(ids: string[]): Promise<boolean[]> {
  return spotifyFetch<boolean[]>(`/me/tracks/contains?ids=${ids.join(",")}`);
}

/**
 * Get user's saved albums
 */
export async function getSavedAlbums(
  limit: number = 50,
  offset: number = 0
): Promise<SpotifyPaginatedResponse<{ added_at: string; album: SpotifyAlbum }>> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  return spotifyFetch<
    SpotifyPaginatedResponse<{ added_at: string; album: SpotifyAlbum }>
  >(`/me/albums?${params}`);
}

/**
 * Get recently played tracks
 */
export async function getRecentlyPlayed(
  limit: number = 50
): Promise<SpotifyRecentlyPlayed> {
  const params = new URLSearchParams({
    limit: limit.toString(),
  });
  return spotifyFetch<SpotifyRecentlyPlayed>(`/me/player/recently-played?${params}`);
}

// ============================================================================
// Artists API
// ============================================================================

/**
 * Get an artist by ID
 */
export async function getArtist(artistId: string): Promise<SpotifyArtist> {
  return spotifyFetch<SpotifyArtist>(`/artists/${encodeURIComponent(artistId)}`);
}

/**
 * Get artist's top tracks
 */
export async function getArtistTopTracks(
  artistId: string,
  market: string = "US"
): Promise<{ tracks: SpotifyTrack[] }> {
  return spotifyFetch<{ tracks: SpotifyTrack[] }>(
    `/artists/${encodeURIComponent(artistId)}/top-tracks?market=${market}`
  );
}

/**
 * Get artist's albums
 */
export async function getArtistAlbums(
  artistId: string,
  includeGroups: ("album" | "single" | "appears_on" | "compilation")[] = [
    "album",
    "single",
  ],
  limit: number = 50,
  offset: number = 0
): Promise<SpotifyPaginatedResponse<SpotifyAlbum>> {
  const params = new URLSearchParams({
    include_groups: includeGroups.join(","),
    limit: limit.toString(),
    offset: offset.toString(),
  });
  return spotifyFetch<SpotifyPaginatedResponse<SpotifyAlbum>>(
    `/artists/${encodeURIComponent(artistId)}/albums?${params}`
  );
}

/**
 * Get related artists
 */
export async function getRelatedArtists(
  artistId: string
): Promise<{ artists: SpotifyArtist[] }> {
  return spotifyFetch<{ artists: SpotifyArtist[] }>(
    `/artists/${encodeURIComponent(artistId)}/related-artists`
  );
}

/**
 * Get user's followed artists
 */
export async function getFollowedArtists(
  limit: number = 50,
  after?: string
): Promise<{ artists: { items: SpotifyArtist[]; cursors: { after: string | null } } }> {
  const params = new URLSearchParams({
    type: "artist",
    limit: limit.toString(),
  });
  if (after) params.set("after", after);
  return spotifyFetch<{
    artists: { items: SpotifyArtist[]; cursors: { after: string | null } };
  }>(`/me/following?${params}`);
}

// ============================================================================
// Albums API
// ============================================================================

/**
 * Get an album by ID
 */
export async function getAlbum(albumId: string): Promise<SpotifyAlbum> {
  return spotifyFetch<SpotifyAlbum>(`/albums/${encodeURIComponent(albumId)}`);
}

/**
 * Get album tracks
 */
export async function getAlbumTracks(
  albumId: string,
  limit: number = 50,
  offset: number = 0
): Promise<SpotifyPaginatedResponse<SpotifyTrack>> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  return spotifyFetch<SpotifyPaginatedResponse<SpotifyTrack>>(
    `/albums/${encodeURIComponent(albumId)}/tracks?${params}`
  );
}

// ============================================================================
// Tracks API
// ============================================================================

/**
 * Get a track by ID
 */
export async function getTrack(trackId: string): Promise<SpotifyTrack> {
  return spotifyFetch<SpotifyTrack>(`/tracks/${encodeURIComponent(trackId)}`);
}

/**
 * Get multiple tracks by IDs
 */
export async function getTracks(trackIds: string[]): Promise<{ tracks: SpotifyTrack[] }> {
  return spotifyFetch<{ tracks: SpotifyTrack[] }>(
    `/tracks?ids=${trackIds.join(",")}`
  );
}

// ============================================================================
// Recommendations API
// ============================================================================

export interface RecommendationOptions {
  seedArtists?: string[];
  seedTracks?: string[];
  seedGenres?: string[];
  limit?: number;
  // Audio features - all 0-1 range (except tempo, key, mode, duration)
  targetAcousticness?: number;
  targetDanceability?: number;
  targetEnergy?: number;
  targetInstrumentalness?: number;
  targetLiveness?: number;
  targetLoudness?: number;
  targetPopularity?: number;
  targetSpeechiness?: number;
  targetTempo?: number;
  targetValence?: number;
}

/**
 * Get track recommendations
 */
export async function getRecommendations(
  options: RecommendationOptions
): Promise<{ tracks: SpotifyTrack[]; seeds: unknown[] }> {
  const params = new URLSearchParams();

  if (options.seedArtists?.length) {
    params.set("seed_artists", options.seedArtists.join(","));
  }
  if (options.seedTracks?.length) {
    params.set("seed_tracks", options.seedTracks.join(","));
  }
  if (options.seedGenres?.length) {
    params.set("seed_genres", options.seedGenres.join(","));
  }
  if (options.limit) {
    params.set("limit", options.limit.toString());
  }

  // Audio features
  if (options.targetAcousticness !== undefined) {
    params.set("target_acousticness", options.targetAcousticness.toString());
  }
  if (options.targetDanceability !== undefined) {
    params.set("target_danceability", options.targetDanceability.toString());
  }
  if (options.targetEnergy !== undefined) {
    params.set("target_energy", options.targetEnergy.toString());
  }
  if (options.targetValence !== undefined) {
    params.set("target_valence", options.targetValence.toString());
  }
  if (options.targetTempo !== undefined) {
    params.set("target_tempo", options.targetTempo.toString());
  }

  return spotifyFetch<{ tracks: SpotifyTrack[]; seeds: unknown[] }>(
    `/recommendations?${params}`
  );
}

/**
 * Get available genre seeds for recommendations
 */
export async function getAvailableGenreSeeds(): Promise<{ genres: string[] }> {
  return spotifyFetch<{ genres: string[] }>("/recommendations/available-genre-seeds");
}
