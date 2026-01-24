/**
 * LRCLIB API Service
 * 
 * Fetches synchronized lyrics from lrclib.net
 * API docs: https://lrclib.net/docs
 */

const LRCLIB_API_BASE = "https://lrclib.net/api";

// ============================================================================
// Types
// ============================================================================

export interface LRCLibLyrics {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export interface SyncedLyricLine {
  time: number; // in seconds
  text: string;
}

export interface LyricsSearchParams {
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number; // in seconds
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse synced lyrics format [mm:ss.xx] or [mm:ss.xxx] into structured data
 * Supports both centiseconds (2 digits) and milliseconds (3 digits)
 */
export function parseSyncedLyrics(syncedLyrics: string): SyncedLyricLine[] {
  const lines: SyncedLyricLine[] = [];
  // Match [mm:ss.xx] or [mm:ss.xxx] - supports 2 or 3 digit fractions
  const regex = /\[(\d{1,2}):(\d{2})\.(\d{2,3})\]\s?(.*)/g;
  
  let match;
  while ((match = regex.exec(syncedLyrics)) !== null) {
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const fractionStr = match[3];
    // Normalize: if 2 digits treat as centiseconds, if 3 digits treat as milliseconds
    const fraction = fractionStr.length === 2 
      ? parseInt(fractionStr, 10) / 100 
      : parseInt(fractionStr, 10) / 1000;
    const text = match[4].trim();
    
    const time = minutes * 60 + seconds + fraction;
    lines.push({ time, text });
  }
  
  return lines.sort((a, b) => a.time - b.time);
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get lyrics with exact track signature
 * This may access external sources if not cached
 */
export async function getLyrics(params: LyricsSearchParams): Promise<LRCLibLyrics | null> {
  const searchParams = new URLSearchParams({
    track_name: params.trackName,
    artist_name: params.artistName,
  });
  
  if (params.albumName) {
    searchParams.set("album_name", params.albumName);
  }
  
  if (params.duration) {
    searchParams.set("duration", Math.round(params.duration).toString());
  }

  try {
    const response = await fetch(`${LRCLIB_API_BASE}/get?${searchParams}`, {
      headers: {
        "User-Agent": "SpotifyRework/1.0 (https://github.com/spotify-rework)",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`LRCLIB API error: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error("Failed to fetch lyrics from LRCLIB:", error);
    return null;
  }
}

/**
 * Get cached lyrics only (faster, won't access external sources)
 */
export async function getCachedLyrics(params: LyricsSearchParams): Promise<LRCLibLyrics | null> {
  const searchParams = new URLSearchParams({
    track_name: params.trackName,
    artist_name: params.artistName,
  });
  
  if (params.albumName) {
    searchParams.set("album_name", params.albumName);
  }
  
  if (params.duration) {
    searchParams.set("duration", Math.round(params.duration).toString());
  }

  try {
    const response = await fetch(`${LRCLIB_API_BASE}/get-cached?${searchParams}`, {
      headers: {
        "User-Agent": "SpotifyRework/1.0 (https://github.com/spotify-rework)",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`LRCLIB API error: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error("Failed to fetch cached lyrics from LRCLIB:", error);
    return null;
  }
}

/**
 * Search for lyrics by keywords
 */
export async function searchLyrics(query: string): Promise<LRCLibLyrics[]> {
  try {
    const response = await fetch(`${LRCLIB_API_BASE}/search?q=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": "SpotifyRework/1.0 (https://github.com/spotify-rework)",
      },
    });

    if (!response.ok) {
      throw new Error(`LRCLIB API error: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error("Failed to search lyrics from LRCLIB:", error);
    return [];
  }
}

/**
 * Get lyrics by LRCLIB ID
 */
export async function getLyricsById(id: number): Promise<LRCLibLyrics | null> {
  try {
    const response = await fetch(`${LRCLIB_API_BASE}/get/${id}`, {
      headers: {
        "User-Agent": "SpotifyRework/1.0 (https://github.com/spotify-rework)",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`LRCLIB API error: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error("Failed to fetch lyrics by ID from LRCLIB:", error);
    return null;
  }
}
