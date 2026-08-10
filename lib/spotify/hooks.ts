/**
 * React hooks for Spotify API
 *
 * Provides hooks to fetch and mutate Spotify data with caching and loading states.
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { usePreservedPageState } from "@/lib/page-state";
import * as spotifyApi from "./api";
import {
  getSpotifyQueryCacheEntry,
  invalidateSpotifyQueryCache,
  runSpotifyQuery,
} from "./query-cache";

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

interface SpotifyQueryOptions {
  enabled?: boolean;
  staleTime?: number;
}

// ============================================================================
// Helper Hook
// ============================================================================

const DEFAULT_STALE_TIME = 5 * 60 * 1000;
const COLLECTION_STALE_TIME = 2 * 60 * 1000;
const DETAIL_STALE_TIME = 15 * 60 * 1000;
const SEARCH_STALE_TIME = 15 * 60 * 1000;
const SEARCH_TYPES: spotifyApi.SearchType[] = [
  "track",
  "artist",
  "album",
  "playlist",
];

function useSpotifyQuery<T>(
  queryKey: string | null,
  fetcher: () => Promise<T>,
  options?: SpotifyQueryOptions,
): UseQueryResult<T> {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  const staleTime = options?.staleTime ?? DEFAULT_STALE_TIME;
  const initialEntry = queryKey
    ? getSpotifyQueryCacheEntry<T>(queryKey)
    : null;
  const [result, setResult] = useState<{
    key: string | null;
    data: T | null;
    isLoading: boolean;
    error: Error | null;
  }>({
    key: queryKey,
    data: initialEntry?.data ?? null,
    isLoading: Boolean(isAuthenticated && enabled && queryKey && !initialEntry),
    error: null,
  });
  const fetcherRef = useRef(fetcher);
  const queryKeyRef = useRef(queryKey);
  const mountedRef = useRef(false);

  useEffect(() => {
    fetcherRef.current = fetcher;
    queryKeyRef.current = queryKey;
  }, [fetcher, queryKey]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    const activeKey = queryKeyRef.current;
    if (!isAuthenticated || !enabled || !activeKey) return;

    const cached = getSpotifyQueryCacheEntry<T>(activeKey);

    try {
      const data = await runSpotifyQuery(activeKey, fetcherRef.current);
      if (mountedRef.current && queryKeyRef.current === activeKey) {
        setResult({ key: activeKey, data, isLoading: false, error: null });
      }
    } catch (reason: unknown) {
      if (mountedRef.current && queryKeyRef.current === activeKey) {
        setResult({
          key: activeKey,
          data: cached?.data ?? null,
          isLoading: false,
          error: reason instanceof Error ? reason : new Error(String(reason)),
        });
      }
    }
  }, [isAuthenticated, enabled]);

  useEffect(() => {
    if (!queryKey || !isAuthenticated || !enabled) {
      return;
    }

    const cached = getSpotifyQueryCacheEntry<T>(queryKey);
    if (!cached || Date.now() - cached.updatedAt >= staleTime) {
      void refetch();
    }
  }, [queryKey, isAuthenticated, enabled, staleTime, refetch]);

  if (result.key === queryKey) return { ...result, refetch };

  const cached = queryKey ? getSpotifyQueryCacheEntry<T>(queryKey) : null;
  return {
    data: cached?.data ?? null,
    isLoading: Boolean(isAuthenticated && enabled && queryKey && !cached),
    error: null,
    refetch,
  };
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
  return useSpotifyQuery("user:me", () => spotifyApi.getCurrentUser(), {
    staleTime: DETAIL_STALE_TIME,
  });
}

/**
 * Get a user's profile by ID
 */
export function useUser(userId: string | null) {
  return useSpotifyQuery(userId ? `user:${userId}` : null, () => spotifyApi.getUser(userId!), {
    enabled: !!userId,
    staleTime: DETAIL_STALE_TIME,
  });
}

/**
 * Get a user's public playlists
 */
export function useUserPlaylists(userId: string | null, limit: number = 50) {
  return useSpotifyQuery(userId ? `user:${userId}:playlists:${limit}` : null, () => spotifyApi.getUserPlaylists(userId!, limit), {
    enabled: !!userId,
    staleTime: COLLECTION_STALE_TIME,
  });
}

/**
 * Get current user's top tracks
 */
export function useTopTracks(
  timeRange: "short_term" | "medium_term" | "long_term" = "medium_term",
  limit: number = 20
) {
  return useSpotifyQuery(
    `user:me:top-tracks:${timeRange}:${limit}`,
    () => spotifyApi.getTopTracks(timeRange, limit),
    { staleTime: COLLECTION_STALE_TIME },
  );
}

/**
 * Get current user's top artists
 */
export function useTopArtists(
  timeRange: "short_term" | "medium_term" | "long_term" = "medium_term",
  limit: number = 20
) {
  return useSpotifyQuery(
    `user:me:top-artists:${timeRange}:${limit}`,
    () => spotifyApi.getTopArtists(timeRange, limit),
    { staleTime: COLLECTION_STALE_TIME },
  );
}

// ============================================================================
// Playlist Hooks
// ============================================================================

/**
 * Get current user's playlists
 */
export function useMyPlaylists(limit: number = 50, options?: { enabled?: boolean }) {
  return useSpotifyQuery(`user:me:playlists:${limit}`, () => spotifyApi.getMyPlaylists(limit), {
    enabled: options?.enabled ?? true,
    staleTime: COLLECTION_STALE_TIME,
  });
}

/**
 * Get all user's playlists (paginated automatically)
 */
export function useAllMyPlaylists() {
  return useSpotifyQuery("user:me:playlists:all", () => spotifyApi.getAllMyPlaylists(), {
    staleTime: COLLECTION_STALE_TIME,
  });
}

/**
 * Get a specific playlist
 */
export function usePlaylist(playlistId: string | null) {
  return useSpotifyQuery(playlistId ? `playlist:${playlistId}` : null, () => spotifyApi.getPlaylist(playlistId!), {
    enabled: !!playlistId,
    staleTime: DETAIL_STALE_TIME,
  });
}

/**
 * Get tracks from a playlist
 */
export function usePlaylistTracks(playlistId: string | null, limit: number = 100) {
  return useSpotifyQuery(
    playlistId ? `playlist:${playlistId}:tracks:${limit}` : null,
    () => spotifyApi.getPlaylistTracks(playlistId!, limit),
    { enabled: !!playlistId, staleTime: COLLECTION_STALE_TIME }
  );
}

/**
 * Create a new playlist
 */
export function useCreatePlaylist() {
  return useSpotifyMutation(
    async ({
      name,
      description,
      isPublic,
    }: {
      name: string;
      description?: string;
      isPublic?: boolean;
    }) => {
      const playlist = await spotifyApi.createPlaylist(name, {
        description,
        public: isPublic,
      });
      invalidateSpotifyQueryCache("user:me:playlists");
      return playlist;
    }
  );
}

/**
 * Add tracks to a playlist
 */
export function useAddTracksToPlaylist() {
  return useSpotifyMutation(
    async ({ playlistId, uris }: { playlistId: string; uris: string[] }) => {
      const result = await spotifyApi.addTracksToPlaylist(playlistId, uris);
      invalidateSpotifyQueryCache(`playlist:${playlistId}`);
      return result;
    }
  );
}

/**
 * Remove tracks from a playlist
 */
export function useRemoveTracksFromPlaylist() {
  return useSpotifyMutation(
    async ({ playlistId, uris }: { playlistId: string; uris: string[] }) => {
      const result = await spotifyApi.removeTracksFromPlaylist(playlistId, uris);
      invalidateSpotifyQueryCache(`playlist:${playlistId}`);
      return result;
    }
  );
}

// ============================================================================
// Device Hooks
// ============================================================================

/**
 * Get available playback devices
 */
export function useDevices(options?: { enabled?: boolean }) {
  return useSpotifyQuery("player:devices", () => spotifyApi.getDevices(), {
    ...options,
    staleTime: 0,
  });
}

/**
 * Get current playback state
 */
export function usePlaybackState(options?: { enabled?: boolean }) {
  return useSpotifyQuery("player:state", () => spotifyApi.getPlaybackState(), {
    ...options,
    staleTime: 0,
  });
}

/**
 * Get currently playing track
 */
export function useCurrentlyPlaying(options?: { enabled?: boolean }) {
  return useSpotifyQuery("player:current", () => spotifyApi.getCurrentlyPlaying(), {
    ...options,
    staleTime: 0,
  });
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
  return useSpotifyQuery("player:queue", () => spotifyApi.getQueue(), {
    ...options,
    staleTime: 0,
  });
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
      limit: number = 10
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
  return useSpotifyQuery(
    `user:me:saved-tracks:${limit}`,
    () => spotifyApi.getSavedTracks(limit),
    { staleTime: COLLECTION_STALE_TIME },
  );
}

/**
 * Save tracks to library
 */
export function useSaveTracks() {
  return useSpotifyMutation(async (ids: string[]) => {
    const result = await spotifyApi.saveTracks(ids);
    invalidateSpotifyQueryCache("user:me:saved-tracks");
    return result;
  });
}

/**
 * Remove tracks from library
 */
export function useRemoveTracks() {
  return useSpotifyMutation(async (ids: string[]) => {
    const result = await spotifyApi.removeTracks(ids);
    invalidateSpotifyQueryCache("user:me:saved-tracks");
    return result;
  });
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
  return useSpotifyQuery(
    `user:me:saved-albums:${limit}`,
    () => spotifyApi.getSavedAlbums(limit),
    { staleTime: COLLECTION_STALE_TIME },
  );
}

/**
 * Get recently played tracks
 */
export function useRecentlyPlayed(limit: number = 50) {
  return useSpotifyQuery(
    `user:me:recently-played:${limit}`,
    () => spotifyApi.getRecentlyPlayed(limit),
    { staleTime: 60 * 1000 },
  );
}

// ============================================================================
// Artist Hooks
// ============================================================================

/**
 * Get an artist by ID
 */
export function useArtist(artistId: string | null) {
  return useSpotifyQuery(artistId ? `artist:${artistId}` : null, () => spotifyApi.getArtist(artistId!), {
    enabled: !!artistId,
    staleTime: DETAIL_STALE_TIME,
  });
}

/**
 * Get artist's top tracks
 */
export function useArtistTopTracks(artistId: string | null) {
  return useSpotifyQuery(artistId ? `artist:${artistId}:top-tracks` : null, () => spotifyApi.getArtistTopTracks(artistId!), {
    enabled: !!artistId,
    staleTime: DETAIL_STALE_TIME,
  });
}

/**
 * Get artist's albums
 */
export function useArtistAlbums(
  artistId: string | null,
  includeGroups: ("album" | "single" | "appears_on" | "compilation")[] = ["album", "single"]
) {
  return useSpotifyQuery(
    artistId ? `artist:${artistId}:albums:${[...includeGroups].sort().join(",")}` : null,
    () => spotifyApi.getArtistAlbums(artistId!, includeGroups),
    { enabled: !!artistId, staleTime: DETAIL_STALE_TIME }
  );
}

/**
 * Get artist's appearances on other albums (collaborations)
 */
export function useArtistAppearsOn(artistId: string | null) {
  return useSpotifyQuery(
    artistId ? `artist:${artistId}:albums:appears_on` : null,
    () => spotifyApi.getArtistAlbums(artistId!, ["appears_on"]),
    { enabled: !!artistId, staleTime: DETAIL_STALE_TIME }
  );
}

/**
 * Get related artists
 */
export function useRelatedArtists(artistId: string | null) {
  return useSpotifyQuery(artistId ? `artist:${artistId}:related` : null, () => spotifyApi.getRelatedArtists(artistId!), {
    enabled: !!artistId,
    staleTime: DETAIL_STALE_TIME,
  });
}

/**
 * Get user's followed artists
 */
export function useFollowedArtists(limit: number = 50) {
  return useSpotifyQuery(
    `user:me:followed-artists:${limit}`,
    () => spotifyApi.getFollowedArtists(limit),
    { staleTime: COLLECTION_STALE_TIME },
  );
}

// ============================================================================
// Album Hooks
// ============================================================================

/**
 * Get an album by ID
 */
export function useAlbum(albumId: string | null) {
  return useSpotifyQuery(albumId ? `album:${albumId}` : null, () => spotifyApi.getAlbum(albumId!), {
    enabled: !!albumId,
    staleTime: DETAIL_STALE_TIME,
  });
}

/**
 * Get album tracks
 */
export function useAlbumTracks(albumId: string | null) {
  return useSpotifyQuery(albumId ? `album:${albumId}:tracks` : null, () => spotifyApi.getAlbumTracks(albumId!), {
    enabled: !!albumId,
    staleTime: DETAIL_STALE_TIME,
  });
}

// ============================================================================
// Track Hooks
// ============================================================================

/**
 * Get a track by ID
 */
export function useTrack(trackId: string | null) {
  return useSpotifyQuery(trackId ? `track:${trackId}` : null, () => spotifyApi.getTrack(trackId!), {
    enabled: !!trackId,
    staleTime: DETAIL_STALE_TIME,
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
  return useSpotifyQuery(
    "browse:genre-seeds",
    () => spotifyApi.getAvailableGenreSeeds(),
    { staleTime: DETAIL_STALE_TIME },
  );
}

// ============================================================================
// Browse Hooks
// ============================================================================

/**
 * Get browse categories
 */
export function useCategories(limit: number = 50) {
  return useSpotifyQuery(
    `browse:categories:${limit}`,
    () => spotifyApi.getCategories(limit),
    { staleTime: DETAIL_STALE_TIME },
  );
}

/**
 * Get category playlists
 */
export function useCategoryPlaylists(categoryId: string | null, limit: number = 50) {
  return useSpotifyQuery(
    categoryId ? `browse:category:${categoryId}:playlists:${limit}` : null,
    () => spotifyApi.getCategoryPlaylists(categoryId!, limit),
    { enabled: !!categoryId, staleTime: COLLECTION_STALE_TIME }
  );
}

/**
 * Get new album releases
 */
export function useNewReleases(limit: number = 20) {
  return useSpotifyQuery(
    `browse:new-releases:${limit}`,
    () => spotifyApi.getNewReleases(limit),
    { staleTime: COLLECTION_STALE_TIME },
  );
}

/**
 * Get featured playlists
 */
export function useFeaturedPlaylists(limit: number = 20) {
  return useSpotifyQuery(
    `browse:featured-playlists:${limit}`,
    () => spotifyApi.getFeaturedPlaylists(limit),
    { staleTime: COLLECTION_STALE_TIME },
  );
}

// ============================================================================
// Debounced Search Hook
// ============================================================================

/**
 * Debounced search hook - waits for user to stop typing
 */
export function useDebouncedSearch(debounceMs: number = 350) {
  const [query, setQuery] = usePreservedPageState("spotify-search.query", "");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const normalizedDebouncedQuery = debouncedQuery.trim().replace(/\s+/g, " ");
  const searchKey = normalizedDebouncedQuery
    ? `search:${normalizedDebouncedQuery.toLocaleLowerCase()}:${SEARCH_TYPES.join(",")}:10`
    : null;
  const {
    data: results,
    isLoading,
    error,
    refetch,
  } = useSpotifyQuery(
    searchKey,
    () => spotifyApi.search(normalizedDebouncedQuery, SEARCH_TYPES, 10),
    { enabled: Boolean(normalizedDebouncedQuery), staleTime: SEARCH_STALE_TIME },
  );

  // Debounce the query
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const normalizedQuery = query.trim();
    timeoutRef.current = setTimeout(() => {
      setDebouncedQuery(normalizedQuery);
    }, normalizedQuery ? debounceMs : 0);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query, debounceMs]);

  const searchNow = useCallback((nextQuery?: string) => {
    const value = (nextQuery ?? query).trim().replace(/\s+/g, " ");
    if (nextQuery !== undefined) setQuery(nextQuery);
    setDebouncedQuery(value);
  }, [query, setQuery]);

  const clear = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
  }, [setQuery]);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    clear,
    refetch,
    searchNow,
    searchedQuery: normalizedDebouncedQuery,
    isSearching: query !== debouncedQuery && query.trim().length > 0,
  };
}
