/**
 * React hooks for Spotify API
 *
 * Provides hooks to fetch and mutate Spotify data with caching and loading states.
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import * as spotifyApi from "./api";

// ============================================================================
// Types
// ============================================================================

interface UseQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface UseMutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData>;
  data: TData | null;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
}

// ============================================================================
// Helper Hook
// ============================================================================

function useSpotifyQuery<T>(
  fetcher: () => Promise<T>,
  options?: { enabled?: boolean }
): UseQueryResult<T> {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const hasFetchedRef = useRef(false);
  const fetcherRef = useRef(fetcher);
  
  // Keep fetcher ref updated
  fetcherRef.current = fetcher;

  const enabled = options?.enabled ?? true;

  const refetch = useCallback(async () => {
    if (!isAuthenticated || !enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetcherRef.current();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, enabled]);

  // Auto-fetch on mount (only once)
  useEffect(() => {
    if (isAuthenticated && enabled && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      refetch();
    }
  }, [isAuthenticated, enabled, refetch]);

  // Reset hasFetched when enabled changes to false then true
  useEffect(() => {
    if (!enabled) {
      hasFetchedRef.current = false;
    }
  }, [enabled]);

  return { data, isLoading, error, refetch };
}

function useSpotifyMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>
): UseMutationResult<TData, TVariables> {
  const [data, setData] = useState<TData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await mutationFn(variables);
        setData(result);
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [mutationFn]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { mutate, data, isLoading, error, reset };
}

// ============================================================================
// User Hooks
// ============================================================================

/**
 * Get current user's Spotify profile
 */
export function useCurrentUser() {
  return useSpotifyQuery(() => spotifyApi.getCurrentUser());
}

/**
 * Get current user's top tracks
 */
export function useTopTracks(
  timeRange: "short_term" | "medium_term" | "long_term" = "medium_term",
  limit: number = 20
) {
  return useSpotifyQuery(() => spotifyApi.getTopTracks(timeRange, limit));
}

/**
 * Get current user's top artists
 */
export function useTopArtists(
  timeRange: "short_term" | "medium_term" | "long_term" = "medium_term",
  limit: number = 20
) {
  return useSpotifyQuery(() => spotifyApi.getTopArtists(timeRange, limit));
}

// ============================================================================
// Playlist Hooks
// ============================================================================

/**
 * Get current user's playlists
 */
export function useMyPlaylists(limit: number = 50) {
  return useSpotifyQuery(() => spotifyApi.getMyPlaylists(limit));
}

/**
 * Get all user's playlists (paginated automatically)
 */
export function useAllMyPlaylists() {
  return useSpotifyQuery(() => spotifyApi.getAllMyPlaylists());
}

/**
 * Get a specific playlist
 */
export function usePlaylist(playlistId: string | null) {
  return useSpotifyQuery(() => spotifyApi.getPlaylist(playlistId!), {
    enabled: !!playlistId,
  });
}

/**
 * Get tracks from a playlist
 */
export function usePlaylistTracks(playlistId: string | null, limit: number = 100) {
  return useSpotifyQuery(
    () => spotifyApi.getPlaylistTracks(playlistId!, limit),
    { enabled: !!playlistId }
  );
}

/**
 * Create a new playlist
 */
export function useCreatePlaylist() {
  return useSpotifyMutation(
    ({
      name,
      description,
      isPublic,
    }: {
      name: string;
      description?: string;
      isPublic?: boolean;
    }) =>
      spotifyApi.createPlaylist(name, {
        description,
        public: isPublic,
      })
  );
}

/**
 * Add tracks to a playlist
 */
export function useAddTracksToPlaylist() {
  return useSpotifyMutation(
    ({ playlistId, uris }: { playlistId: string; uris: string[] }) =>
      spotifyApi.addTracksToPlaylist(playlistId, uris)
  );
}

/**
 * Remove tracks from a playlist
 */
export function useRemoveTracksFromPlaylist() {
  return useSpotifyMutation(
    ({ playlistId, uris }: { playlistId: string; uris: string[] }) =>
      spotifyApi.removeTracksFromPlaylist(playlistId, uris)
  );
}

// ============================================================================
// Device Hooks
// ============================================================================

/**
 * Get available playback devices
 */
export function useDevices(options?: { enabled?: boolean }) {
  return useSpotifyQuery(() => spotifyApi.getDevices(), options);
}

/**
 * Get current playback state
 */
export function usePlaybackState(options?: { enabled?: boolean }) {
  return useSpotifyQuery(() => spotifyApi.getPlaybackState(), options);
}

/**
 * Get currently playing track
 */
export function useCurrentlyPlaying(options?: { enabled?: boolean }) {
  return useSpotifyQuery(() => spotifyApi.getCurrentlyPlaying(), options);
}

/**
 * Transfer playback to a device
 */
export function useTransferPlayback() {
  return useSpotifyMutation(
    ({ deviceId, play }: { deviceId: string; play?: boolean }) =>
      spotifyApi.transferPlayback(deviceId, play)
  );
}

/**
 * Get player queue
 */
export function useQueue(options?: { enabled?: boolean }) {
  return useSpotifyQuery(() => spotifyApi.getQueue(), options);
}

// ============================================================================
// Search Hook
// ============================================================================

/**
 * Search for content on Spotify
 */
export function useSearch() {
  const [results, setResults] = useState<spotifyApi.SpotifySearchResults | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const search = useCallback(
    async (
      query: string,
      types: spotifyApi.SearchType[] = ["track", "artist", "album", "playlist"],
      limit: number = 20
    ) => {
      if (!query.trim()) {
        setResults(null);
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await spotifyApi.search(query, types, limit);
        setResults(data);
        return data;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clear = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  return { search, results, isLoading, error, clear };
}

// ============================================================================
// Library Hooks
// ============================================================================

/**
 * Get user's saved tracks (Liked Songs)
 */
export function useSavedTracks(limit: number = 50) {
  return useSpotifyQuery(() => spotifyApi.getSavedTracks(limit));
}

/**
 * Save tracks to library
 */
export function useSaveTracks() {
  return useSpotifyMutation((ids: string[]) => spotifyApi.saveTracks(ids));
}

/**
 * Remove tracks from library
 */
export function useRemoveTracks() {
  return useSpotifyMutation((ids: string[]) => spotifyApi.removeTracks(ids));
}

/**
 * Check if tracks are saved
 */
export function useCheckSavedTracks() {
  return useSpotifyMutation((ids: string[]) => spotifyApi.checkSavedTracks(ids));
}

/**
 * Get user's saved albums
 */
export function useSavedAlbums(limit: number = 50) {
  return useSpotifyQuery(() => spotifyApi.getSavedAlbums(limit));
}

/**
 * Get recently played tracks
 */
export function useRecentlyPlayed(limit: number = 50) {
  return useSpotifyQuery(() => spotifyApi.getRecentlyPlayed(limit));
}

// ============================================================================
// Artist Hooks
// ============================================================================

/**
 * Get an artist by ID
 */
export function useArtist(artistId: string | null) {
  return useSpotifyQuery(() => spotifyApi.getArtist(artistId!), {
    enabled: !!artistId,
  });
}

/**
 * Get artist's top tracks
 */
export function useArtistTopTracks(artistId: string | null) {
  return useSpotifyQuery(() => spotifyApi.getArtistTopTracks(artistId!), {
    enabled: !!artistId,
  });
}

/**
 * Get artist's albums
 */
export function useArtistAlbums(artistId: string | null) {
  return useSpotifyQuery(() => spotifyApi.getArtistAlbums(artistId!), {
    enabled: !!artistId,
  });
}

/**
 * Get related artists
 */
export function useRelatedArtists(artistId: string | null) {
  return useSpotifyQuery(() => spotifyApi.getRelatedArtists(artistId!), {
    enabled: !!artistId,
  });
}

/**
 * Get user's followed artists
 */
export function useFollowedArtists(limit: number = 50) {
  return useSpotifyQuery(() => spotifyApi.getFollowedArtists(limit));
}

// ============================================================================
// Album Hooks
// ============================================================================

/**
 * Get an album by ID
 */
export function useAlbum(albumId: string | null) {
  return useSpotifyQuery(() => spotifyApi.getAlbum(albumId!), {
    enabled: !!albumId,
  });
}

/**
 * Get album tracks
 */
export function useAlbumTracks(albumId: string | null) {
  return useSpotifyQuery(() => spotifyApi.getAlbumTracks(albumId!), {
    enabled: !!albumId,
  });
}

// ============================================================================
// Track Hooks
// ============================================================================

/**
 * Get a track by ID
 */
export function useTrack(trackId: string | null) {
  return useSpotifyQuery(() => spotifyApi.getTrack(trackId!), {
    enabled: !!trackId,
  });
}

// ============================================================================
// Recommendations Hook
// ============================================================================

/**
 * Get track recommendations
 */
export function useRecommendations() {
  return useSpotifyMutation((options: spotifyApi.RecommendationOptions) =>
    spotifyApi.getRecommendations(options)
  );
}

/**
 * Get available genre seeds
 */
export function useAvailableGenreSeeds() {
  return useSpotifyQuery(() => spotifyApi.getAvailableGenreSeeds());
}
