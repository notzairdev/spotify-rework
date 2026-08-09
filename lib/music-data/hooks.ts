"use client";

import { useEffect, useRef, useState } from "react";
import {
  getArtistBiography,
  getListenBrainzTrends,
  getTasteRecommendations,
  getTrackCredits,
  type ArtistBiography,
  type ListenBrainzTrend,
  type TasteRecommendation,
  type TrackCredits,
} from "./api";

interface MusicDataResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

function useMusicDataQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
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

    fetcherRef.current()
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
  }, [key]);

  if (!key) return { data: null, error: null, isLoading: false };
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
