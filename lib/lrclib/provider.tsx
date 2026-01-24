"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useSpotifyPlayer } from "@/lib/spotify";
import {
  getCachedLyrics,
  getLyrics,
  parseSyncedLyrics,
  type LRCLibLyrics,
  type SyncedLyricLine,
} from "./api";

// Threshold in seconds for detecting an interlude (must be a significant gap)
const INTERLUDE_THRESHOLD = 8;
// Minimum time after a line before showing interlude (let the line "finish")
const MIN_TIME_AFTER_LINE = 4;

interface LyricsContextValue {
  /** Parsed synced lyrics lines */
  lyrics: SyncedLyricLine[];
  /** Plain lyrics if synced not available */
  plainLyrics: string | null;
  /** Whether lyrics are currently loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Whether the track is instrumental */
  isInstrumental: boolean;
  /** Index of current line based on playback position */
  currentLineIndex: number;
  /** Whether any lyrics are available */
  hasLyrics: boolean;
  /** Whether we're currently in an interlude (long gap between lyrics) */
  isInterlude: boolean;
  /** Whether we're before the first lyric line */
  isBeforeFirstLyric: boolean;
  /** Quick check if lyrics are available for current track */
  lyricsAvailable: boolean;
  /** Current track ID that lyrics belong to */
  trackId: string | null;
  /** Index after which the interlude is happening (-1 for before first, null if no interlude) */
  interludeAfterIndex: number | null;
  /** Progress through current interlude (0-1), null if not in interlude */
  interludeProgress: number | null;
  /** Current position in seconds */
  positionSeconds: number;
}

const LyricsContext = createContext<LyricsContextValue | null>(null);

// In-memory cache for lyrics by track ID
const lyricsCache = new Map<string, LRCLibLyrics | null>();

interface LyricsProviderProps {
  children: ReactNode;
}

export function LyricsProvider({ children }: LyricsProviderProps) {
  const { state } = useSpotifyPlayer();
  const [lyricsData, setLyricsData] = useState<LRCLibLyrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  
  // Use ref to track the current fetch request and cancel stale ones
  const fetchIdRef = useRef(0);

  // Fetch and cache lyrics when track changes
  useEffect(() => {
    const track = state?.track;
    const trackId = track?.id ?? null;

    // If no track, clear everything
    if (!track || !trackId) {
      setLyricsData(null);
      setError(null);
      setIsLoading(false);
      setCurrentTrackId(null);
      return;
    }

    // Skip if same track (already loaded or loading)
    if (trackId === currentTrackId) {
      return;
    }

    // Increment fetch ID to invalidate any in-flight requests
    const thisFetchId = ++fetchIdRef.current;

    // Immediately clear old lyrics and set loading for new track
    setCurrentTrackId(trackId);
    setLyricsData(null);
    setError(null);
    setIsLoading(true);

    // Check cache first (synchronous)
    if (lyricsCache.has(trackId)) {
      const cached = lyricsCache.get(trackId);
      setLyricsData(cached ?? null);
      setError(cached ? null : "No lyrics found for this track");
      setIsLoading(false);
      return;
    }

    // Fetch lyrics asynchronously
    const fetchLyrics = async () => {
      try {
        // Try cached endpoint first (faster)
        let result = await getCachedLyrics({
          trackName: track.name,
          artistName: track.artists[0] || "",
          albumName: track.album.name,
          duration: state.duration ? Math.round(state.duration / 1000) : undefined,
        });

        // Check if this request is still valid
        if (fetchIdRef.current !== thisFetchId) {
          return; // Stale request, discard
        }

        // If not cached, try full endpoint
        if (!result) {
          result = await getLyrics({
            trackName: track.name,
            artistName: track.artists[0] || "",
            albumName: track.album.name,
            duration: state.duration ? Math.round(state.duration / 1000) : undefined,
          });
        }

        // Check again after second request
        if (fetchIdRef.current !== thisFetchId) {
          return; // Stale request, discard
        }

        // Cache the result (even if null)
        lyricsCache.set(trackId, result);

        if (result) {
          setLyricsData(result);
          setError(null);
        } else {
          setLyricsData(null);
          setError("No lyrics found for this track");
        }
      } catch (e) {
        // Only update state if this is still the current request
        if (fetchIdRef.current !== thisFetchId) {
          return;
        }
        setError(e instanceof Error ? e.message : "Failed to fetch lyrics");
        setLyricsData(null);
        lyricsCache.set(trackId, null);
      } finally {
        // Only update loading state if this is still the current request
        if (fetchIdRef.current === thisFetchId) {
          setIsLoading(false);
        }
      }
    };

    fetchLyrics();
  }, [state?.track?.id, state?.track?.name, state?.track?.artists, state?.track?.album.name, state?.duration, currentTrackId]);

  // Parse synced lyrics and filter out empty lines
  const lyrics = useMemo(() => {
    if (!lyricsData?.syncedLyrics) return [];
    const parsed = parseSyncedLyrics(lyricsData.syncedLyrics);
    // Filter out empty lines - they shouldn't be displayed
    return parsed.filter(line => line.text.trim().length > 0);
  }, [lyricsData?.syncedLyrics]);

  // Calculate current line index and detect interludes
  const { currentLineIndex, isInterlude, isBeforeFirstLyric, interludeAfterIndex, interludeProgress, positionSeconds } = useMemo(() => {
    const posSeconds = (state?.position ?? 0) / 1000;
    const positionWithLookahead = posSeconds + 0.3; // 300ms lookahead for current line

    if (!lyrics.length) {
      return { 
        currentLineIndex: -1, 
        isInterlude: false, 
        isBeforeFirstLyric: false,
        interludeAfterIndex: null,
        interludeProgress: null,
        positionSeconds: posSeconds 
      };
    }

    // Check if we're before the first lyric
    const firstLyricTime = lyrics[0].time;
    if (positionWithLookahead < firstLyricTime) {
      // Before first lyric - show interlude if gap is significant
      const beforeFirst = firstLyricTime > INTERLUDE_THRESHOLD;
      const progress = beforeFirst ? Math.min(1, posSeconds / firstLyricTime) : null;
      return { 
        currentLineIndex: -1, 
        isInterlude: beforeFirst, 
        isBeforeFirstLyric: true,
        interludeAfterIndex: beforeFirst ? -1 : null,
        interludeProgress: progress,
        positionSeconds: posSeconds
      };
    }

    // Find the current line (last line with time <= position)
    let currentIdx = 0;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (lyrics[i].time <= positionWithLookahead) {
        currentIdx = i;
        break;
      }
    }

    // Check if we're in an interlude (gap to next line > threshold)
    let inInterlude = false;
    let afterIndex: number | null = null;
    let progress: number | null = null;

    const currentLine = lyrics[currentIdx];
    const nextLine = lyrics[currentIdx + 1];

    if (currentLine && nextLine) {
      const gap = nextLine.time - currentLine.time;
      const timeSinceCurrentLine = posSeconds - currentLine.time;
      // Only show interlude if:
      // 1. Gap is larger than threshold (8+ seconds)
      // 2. We're past the minimum time after line started (4+ seconds for vocals to finish)
      if (gap > INTERLUDE_THRESHOLD && timeSinceCurrentLine > MIN_TIME_AFTER_LINE) {
        inInterlude = true;
        afterIndex = currentIdx;
        // Calculate progress through the interlude
        // Start showing dots after MIN_TIME_AFTER_LINE, end 1 second before next line
        const interludeStart = currentLine.time + MIN_TIME_AFTER_LINE;
        const interludeEnd = nextLine.time - 1; // Stop 1 second before next line
        const interludeDuration = interludeEnd - interludeStart;
        if (interludeDuration > 0) {
          progress = Math.min(1, Math.max(0, (posSeconds - interludeStart) / interludeDuration));
        }
      }
    }

    return { 
      currentLineIndex: currentIdx, 
      isInterlude: inInterlude, 
      isBeforeFirstLyric: false,
      interludeAfterIndex: afterIndex,
      interludeProgress: progress,
      positionSeconds: posSeconds
    };
  }, [lyrics, state?.position]);

  const hasLyrics = lyrics.length > 0 || !!lyricsData?.plainLyrics;
  
  // Only show as available if we're done loading AND have lyrics AND it's for the current track
  const lyricsAvailable = !isLoading && hasLyrics && !lyricsData?.instrumental && currentTrackId === state?.track?.id;

  const value = useMemo<LyricsContextValue>(
    () => ({
      lyrics,
      plainLyrics: lyricsData?.plainLyrics || null,
      isLoading,
      error,
      isInstrumental: lyricsData?.instrumental ?? false,
      currentLineIndex,
      hasLyrics,
      isInterlude,
      isBeforeFirstLyric,
      lyricsAvailable,
      trackId: currentTrackId,
      interludeAfterIndex,
      interludeProgress,
      positionSeconds,
    }),
    [lyrics, lyricsData, isLoading, error, currentLineIndex, hasLyrics, isInterlude, isBeforeFirstLyric, lyricsAvailable, currentTrackId, interludeAfterIndex, interludeProgress, positionSeconds]
  );

  return (
    <LyricsContext.Provider value={value}>{children}</LyricsContext.Provider>
  );
}

/**
 * Hook to access lyrics state
 */
export function useLyricsContext(): LyricsContextValue {
  const context = useContext(LyricsContext);
  if (!context) {
    throw new Error("useLyricsContext must be used within a LyricsProvider");
  }
  return context;
}
