import { invoke } from "@tauri-apps/api/core";
import { isTauriContext } from "@/lib/env";

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<unknown>>();

const DEFAULT_TTL = 30 * 60 * 1000;
const MUSICBRAINZ_TTL = 24 * 60 * 60 * 1000;
const MUSICBRAINZ_INTERVAL = 1_100;

let musicBrainzQueue = Promise.resolve();
let nextMusicBrainzRequestAt = 0;

async function requestJson<T>(url: string): Promise<T> {
  if (isTauriContext()) {
    return invoke<T>("fetch_music_metadata", { url });
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status === 204) return null as T;
  if (!response.ok) {
    throw new Error(`Metadata source returned ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchMusicData<T>(
  url: string,
  ttl: number = DEFAULT_TTL,
): Promise<T> {
  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.data as T);
  }

  const pending = pendingRequests.get(url);
  if (pending) return pending as Promise<T>;

  const request = requestJson<T>(url)
    .then((data) => {
      responseCache.set(url, { data, expiresAt: Date.now() + ttl });
      return data;
    })
    .finally(() => pendingRequests.delete(url));

  pendingRequests.set(url, request);
  return request;
}

/** MusicBrainz asks clients to issue no more than one request per second. */
export function fetchMusicBrainz<T>(url: string): Promise<T> {
  const request = musicBrainzQueue.then(async () => {
    const delay = Math.max(0, nextMusicBrainzRequestAt - Date.now());
    if (delay > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }

    nextMusicBrainzRequestAt = Date.now() + MUSICBRAINZ_INTERVAL;
    return fetchMusicData<T>(url, MUSICBRAINZ_TTL);
  });

  musicBrainzQueue = request.then(
    () => undefined,
    () => undefined,
  );
  return request;
}
