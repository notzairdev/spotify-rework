/**
 * React hooks for LRCLIB lyrics
 */

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSpotifyPlayer } from "@/lib/spotify";
import {
  getLyrics,
  parseSyncedLyrics,
  type LRCLibLyrics,
  type SyncedLyricLine,
} from "./api";

interface UseLyricsResult {
  lyrics: SyncedLyricLine[];
  plainLyrics: string | null;
  isLoading: boolean;
  error: string | null;
  isInstrumental: boolean;
  currentLineIndex: number;
  hasLyrics: boolean;
}

/**
 * Hook to fetch and sync lyrics with current playing track
 */
export function useLyrics(): UseLyricsResult {
  const { state } = useSpotifyPlayer();
  const [lyricsData, setLyricsData] = useState<LRCLibLyrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastTrackIdRef = useRef<string | null>(null);
  const trackId = state?.track?.id;
  const trackName = state?.track?.name;
  const artistName = state?.track?.artists[0] ?? "";
  const albumName = state?.track?.album.name;
  const durationSeconds = state?.duration
    ? Math.round(state.duration / 1000)
    : undefined;
  const syncedLyrics = lyricsData?.syncedLyrics;
  const playbackPosition = state?.position ?? 0;

  // Fetch lyrics when track changes
  useEffect(() => {
    if (!trackId || !trackName || !albumName || trackId === lastTrackIdRef.current) {
      return;
    }

    lastTrackIdRef.current = trackId;
    setIsLoading(true);
    setError(null);
    setLyricsData(null);

    let cancelled = false;
    const fetchLyrics = async () => {
      try {
        const result = await getLyrics({
          trackName,
          artistName,
          albumName,
          duration: durationSeconds,
        });

        if (cancelled) return;
        if (result) {
          setLyricsData(result);
        } else {
          setError("No lyrics found for this track");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to fetch lyrics");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void fetchLyrics();
    return () => {
      cancelled = true;
    };
  }, [trackId, trackName, artistName, albumName, durationSeconds]);

  // Parse synced lyrics
  const lyrics = useMemo(() => {
    if (!syncedLyrics) return [];
    return parseSyncedLyrics(syncedLyrics);
  }, [syncedLyrics]);

  // Calculate current line index based on playback position
  // Add a small lookahead (0.3s) so lyrics appear slightly before they're sung
  const currentLineIndex = useMemo(() => {
    if (!lyrics.length || !playbackPosition) return 0;
    
    const positionSeconds = (playbackPosition / 1000) + 0.3; // 300ms lookahead
    
    // Find the last line that has started (or is about to start)
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (lyrics[i].time <= positionSeconds) {
        return i;
      }
    }
    
    return 0;
  }, [lyrics, playbackPosition]);

  return {
    lyrics,
    plainLyrics: lyricsData?.plainLyrics || null,
    isLoading,
    error,
    isInstrumental: lyricsData?.instrumental ?? false,
    currentLineIndex,
    hasLyrics: lyrics.length > 0 || !!lyricsData?.plainLyrics,
  };
}
