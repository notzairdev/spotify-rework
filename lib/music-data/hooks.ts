"use client";

import { useEffect, useRef, useState } from "react";
import {
  getAudioDbTrackInfo,
  getArtistBiography,
  getListenBrainzTrends,
  getSpotifyTrackSuggestions,
  getTasteRecommendations,
  getTrackCredits,
  type AudioDbTrackInfo,
  type ArtistBiography,
  type ListenBrainzTrend,
  type SpotifyTrackSuggestions,
  type TasteRecommendation,
  type TrackCredits,
} from "./api";

interface MusicDataCacheEntry<T> {
  data: T;
  expiresAt: number;
}

const DEFAULT_QUERY_TTL = 6 * 60 * 60 * 1000;
const musicDataCache = new Map<string, MusicDataCacheEntry<unknown>>();
const pendingMusicData = new Map<string, Promise<unknown>>();

function runMusicDataQuery<T>(key: string, fetcher: () => Promise<T>, ttl: number) {
  const cached = musicDataCache.get(key) as MusicDataCacheEntry<T> | undefined;
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.data);

  const pending = pendingMusicData.get(key);
  if (pending) return pending as Promise<T>;

  const request = fetcher()
    .then((data) => {
      musicDataCache.set(key, { data, expiresAt: Date.now() + ttl });
      return data;
    })
    .finally(() => pendingMusicData.delete(key));
  pendingMusicData.set(key, request);
  return request;
}

interface MusicDataResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

function useMusicDataQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_QUERY_TTL,
): MusicDataResult<T> {
  const [result, setResult] = useState<{
    data: T | null;
    error: Error | null;
    key: string | null;
  }>({ data: null, error: null, key: null });
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    if (!key) return;

    let cancelled = false;

    runMusicDataQuery(key, fetcherRef.current, ttl)
      .then((result) => {
        if (!cancelled) setResult({ data: result, error: null, key });
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setResult({
            data: null,
            error: reason instanceof Error ? reason : new Error(String(reason)),
            key,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key, ttl]);

  if (!key) return { data: null, error: null, isLoading: false };
  const cached = musicDataCache.get(key) as MusicDataCacheEntry<T> | undefined;
  if (cached) {
    return { data: cached.data, error: null, isLoading: false };
  }
  const isCurrent = result.key === key;
  return {
    data: isCurrent ? result.data : null,
    error: isCurrent ? result.error : null,
    isLoading: !isCurrent,
  };
}

export function useTasteRecommendations(seedTrackIds: string[]) {
  const stableSeeds = [...new Set(seedTrackIds)].slice(0, 5);
  const key = stableSeeds.length > 0 ? `taste:${stableSeeds.join(",")}` : null;
  return useMusicDataQuery<TasteRecommendation[]>(
    key,
    () => getTasteRecommendations(stableSeeds, 10),
  );
}

export function useSpotifyTrackSuggestions(trackId: string | null) {
  return useMusicDataQuery<SpotifyTrackSuggestions>(
    trackId ? `spotify-track-suggestions:${trackId}` : null,
    () => getSpotifyTrackSuggestions(trackId!, 8),
    3 * 60 * 60 * 1000,
  );
}

export function useListenBrainzTrends() {
  return useMusicDataQuery<ListenBrainzTrend[]>(
    "listenbrainz:trends:week",
    () => getListenBrainzTrends(10),
  );
}

export function useArtistBiography(artistName: string | null) {
  const name = artistName?.trim() || null;
  return useMusicDataQuery<ArtistBiography | null>(
    name ? `artist-biography:${name.toLocaleLowerCase()}` : null,
    () => getArtistBiography(name!),
  );
}

export function useTrackCredits(trackId: string | null, enabled: boolean = true) {
  const id = enabled ? trackId : null;
  return useMusicDataQuery<TrackCredits | null>(
    id ? `track-credits:${id}` : null,
    () => getTrackCredits(id!),
  );
}

export function useAudioDbTrackInfo(
  artistName: string | null,
  trackName: string | null,
) {
  const artist = artistName?.trim() || null;
  const track = trackName?.trim() || null;
  return useMusicDataQuery<AudioDbTrackInfo | null>(
    artist && track
      ? `audiodb-track:${artist.toLocaleLowerCase()}:${track.toLocaleLowerCase()}`
      : null,
    () => getAudioDbTrackInfo(artist!, track!),
    24 * 60 * 60 * 1000,
  );
}
