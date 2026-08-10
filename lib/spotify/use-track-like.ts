/**
 * Hook for track like/unlike functionality
 */

"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useSpotifyPlayer } from "@/lib/spotify";
import { saveTracks, removeTracks, checkSavedTracks } from "@/lib/spotify/api";
import { invalidateSpotifyQueryCache } from "@/lib/spotify/query-cache";

interface UseTrackLikeResult {
  isLiked: boolean;
  isLoading: boolean;
  toggleLike: () => Promise<void>;
}

interface LikeEntry {
  isLiked: boolean;
  isLoading: boolean;
}

const EMPTY_ENTRY: LikeEntry = { isLiked: false, isLoading: false };
const likeEntries = new Map<string, LikeEntry>();
const likeListeners = new Set<() => void>();
const pendingChecks = new Map<string, Promise<boolean>>();
const pendingMutations = new Map<string, Promise<void>>();

function emitLikeState() {
  likeListeners.forEach((listener) => listener());
}

function setLikeEntry(trackId: string, entry: LikeEntry) {
  likeEntries.set(trackId, entry);
  emitLikeState();
}

function subscribeToLikes(listener: () => void) {
  likeListeners.add(listener);
  return () => likeListeners.delete(listener);
}

async function loadLikeState(trackId: string): Promise<boolean> {
  const cached = likeEntries.get(trackId);
  if (cached && !cached.isLoading) return cached.isLiked;

  const existing = pendingChecks.get(trackId);
  if (existing) return existing;

  setLikeEntry(trackId, {
    isLiked: cached?.isLiked ?? false,
    isLoading: true,
  });

  const request = checkSavedTracks([trackId])
    .then(([isLiked = false]) => {
      setLikeEntry(trackId, { isLiked, isLoading: false });
      return isLiked;
    })
    .catch((error) => {
      likeEntries.delete(trackId);
      emitLikeState();
      throw error;
    })
    .finally(() => {
      pendingChecks.delete(trackId);
    });

  pendingChecks.set(trackId, request);
  return request;
}

/**
 * Hook to manage like state for a track
 * @param trackIdParam Optional track ID. If not provided, uses the current playing track.
 */
export function useTrackLike(trackIdParam?: string): UseTrackLikeResult {
  const { state } = useSpotifyPlayer();
  const trackId = trackIdParam ?? state?.track?.id;
  const entry = useSyncExternalStore(
    subscribeToLikes,
    () => (trackId ? likeEntries.get(trackId) ?? EMPTY_ENTRY : EMPTY_ENTRY),
    () => EMPTY_ENTRY,
  );

  useEffect(() => {
    if (!trackId || likeEntries.has(trackId)) return;
    void loadLikeState(trackId).catch(() => {
      // The next interaction retries the check. The API helper already reports
      // the diagnostic error in development.
    });
  }, [trackId]);

  const toggleLike = useCallback(async () => {
    if (!trackId) return;

    const existing = pendingMutations.get(trackId);
    if (existing) return existing;

    const currentIsLiked = likeEntries.has(trackId)
      ? likeEntries.get(trackId)!.isLiked
      : await loadLikeState(trackId);
    const nextIsLiked = !currentIsLiked;

    setLikeEntry(trackId, { isLiked: nextIsLiked, isLoading: true });

    const mutation = (nextIsLiked
      ? saveTracks([trackId])
      : removeTracks([trackId]))
      .then(() => {
        setLikeEntry(trackId, { isLiked: nextIsLiked, isLoading: false });
        invalidateSpotifyQueryCache("user:me:saved-tracks");
      })
      .catch((error) => {
        setLikeEntry(trackId, { isLiked: currentIsLiked, isLoading: false });
        throw error;
      })
      .finally(() => {
        pendingMutations.delete(trackId);
      });

    pendingMutations.set(trackId, mutation);
    return mutation;
  }, [trackId]);

  return {
    isLiked: entry.isLiked,
    isLoading: entry.isLoading,
    toggleLike,
  };
}
