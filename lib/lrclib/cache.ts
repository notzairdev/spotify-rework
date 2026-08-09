import {
  getCachedLyrics,
  getLyrics,
  type LRCLibLyrics,
  type LyricsSearchParams,
} from "./api";

const lyricsCache = new Map<string, LRCLibLyrics | null>();
const pendingLyrics = new Map<string, Promise<LRCLibLyrics | null>>();

export function hasCachedLyrics(trackId: string) {
  return lyricsCache.has(trackId);
}

export function getCachedLyricsForTrack(trackId: string) {
  return lyricsCache.get(trackId);
}

export function loadLyricsForTrack(
  trackId: string,
  params: LyricsSearchParams,
): Promise<LRCLibLyrics | null> {
  if (lyricsCache.has(trackId)) {
    return Promise.resolve(lyricsCache.get(trackId) ?? null);
  }

  const pending = pendingLyrics.get(trackId);
  if (pending) return pending;

  const request = getCachedLyrics(params)
    .then((cached) => cached ?? getLyrics(params))
    .then((result) => {
      lyricsCache.set(trackId, result);
      return result;
    })
    .finally(() => pendingLyrics.delete(trackId));

  pendingLyrics.set(trackId, request);
  return request;
}
