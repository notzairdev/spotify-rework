interface SpotifyQueryCacheEntry<T> {
  data: T;
  updatedAt: number;
}

const MAX_CACHE_ENTRIES = 300;
const queryCache = new Map<string, SpotifyQueryCacheEntry<unknown>>();
const pendingQueries = new Map<string, Promise<unknown>>();
let cacheGeneration = 0;

function writeCacheEntry<T>(key: string, data: T) {
  queryCache.delete(key);
  queryCache.set(key, { data, updatedAt: Date.now() });

  if (queryCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey) queryCache.delete(oldestKey);
  }
}

export function getSpotifyQueryCacheEntry<T>(
  key: string,
): SpotifyQueryCacheEntry<T> | null {
  const entry = queryCache.get(key) as SpotifyQueryCacheEntry<T> | undefined;
  return entry ?? null;
}

export function runSpotifyQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const pending = pendingQueries.get(key);
  if (pending) return pending as Promise<T>;

  const requestGeneration = cacheGeneration;
  const request = fetcher()
    .then((data) => {
      if (requestGeneration === cacheGeneration) writeCacheEntry(key, data);
      return data;
    })
    .finally(() => {
      if (pendingQueries.get(key) === request) pendingQueries.delete(key);
    });

  pendingQueries.set(key, request);
  return request;
}

export function invalidateSpotifyQueryCache(prefix?: string) {
  if (!prefix) {
    queryCache.clear();
    return;
  }

  for (const key of queryCache.keys()) {
    if (key.startsWith(prefix)) queryCache.delete(key);
  }
}

export function clearSpotifyQueryCache() {
  cacheGeneration += 1;
  queryCache.clear();
  pendingQueries.clear();
}
