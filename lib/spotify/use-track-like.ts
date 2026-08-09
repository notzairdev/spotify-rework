/**
 * Hook for track like/unlike functionality
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSpotifyPlayer } from "@/lib/spotify";
import { saveTracks, removeTracks, checkSavedTracks } from "@/lib/spotify/api";

interface UseTrackLikeResult {
  isLiked: boolean;
  isLoading: boolean;
  toggleLike: () => Promise<void>;
}

/**
 * Hook to manage like state for a track
 * @param trackIdParam Optional track ID. If not provided, uses the current playing track.
 */
export function useTrackLike(trackIdParam?: string): UseTrackLikeResult {
  const { state } = useSpotifyPlayer();
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const lastCheckedTrackIdRef = useRef<string | null>(null);

  // Use provided trackId or fallback to current playing track
  const trackId = trackIdParam ?? state?.track?.id;

  // Check if current track is liked when it changes
  useEffect(() => {
    if (!trackId || trackId === lastCheckedTrackIdRef.current) {
      return;
    }

    lastCheckedTrackIdRef.current = trackId;
    let cancelled = false;

    const checkLiked = async () => {
      try {
        const [liked] = await checkSavedTracks([trackId]);
        if (!cancelled) setIsLiked(liked);
      } catch (error) {
        console.error("Failed to check if track is liked:", error);
      }
    };

    void checkLiked();
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  const toggleLike = useCallback(async () => {
    if (!trackId || isLoading) return;

    setIsLoading(true);
    
    try {
      if (isLiked) {
        await removeTracks([trackId]);
        setIsLiked(false);
      } else {
        await saveTracks([trackId]);
        setIsLiked(true);
      }
    } catch (error) {
      console.error("Failed to toggle like:", error);
    } finally {
      setIsLoading(false);
    }
  }, [trackId, isLiked, isLoading]);

  return {
    isLiked,
    isLoading,
    toggleLike,
  };
}
