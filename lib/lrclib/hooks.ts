/**
 * React hooks for LRCLIB lyrics
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  const [lastTrackId, setLastTrackId] = useState<string | null>(null);

  // Fetch lyrics when track changes
  useEffect(() => {
    const track = state?.track;
    
    if (!track || track.id === lastTrackId) {
      return;
    }

    setLastTrackId(track.id);
    setIsLoading(true);
    setError(null);
    setLyricsData(null);

    const fetchLyrics = async () => {
      try {
        const result = await getLyrics({
          trackName: track.name,
          artistName: track.artists[0] || "",
          albumName: track.album.name,
          duration: state.duration ? Math.round(state.duration / 1000) : undefined,
        });

        if (result) {
          setLyricsData(result);
        } else {
          setError("No lyrics found for this track");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch lyrics");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLyrics();
  }, [state?.track?.id, state?.track?.name, state?.track?.artists, state?.track?.album.name, state?.duration, lastTrackId]);

  // Parse synced lyrics
  const lyrics = useMemo(() => {
    if (!lyricsData?.syncedLyrics) return [];
    return parseSyncedLyrics(lyricsData.syncedLyrics);
  }, [lyricsData?.syncedLyrics]);

  // Calculate current line index based on playback position
  // Add a small lookahead (0.3s) so lyrics appear slightly before they're sung
  const currentLineIndex = useMemo(() => {
    if (!lyrics.length || !state?.position) return 0;
    
    const positionSeconds = (state.position / 1000) + 0.3; // 300ms lookahead
    
    // Find the last line that has started (or is about to start)
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (lyrics[i].time <= positionSeconds) {
        return i;
      }
    }
    
    return 0;
  }, [lyrics, state?.position]);

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
