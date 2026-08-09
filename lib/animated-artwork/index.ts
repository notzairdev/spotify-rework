"use client";

import { useEffect, useState } from "react";
import { fetchMusicData } from "@/lib/music-data/client";

const ARTWORK_ENDPOINT = "https://artwork.m8tec.top/api/v1/artwork/search";
const ARTWORK_TTL = 7 * 24 * 60 * 60 * 1000;

export interface AnimatedArtworkResult {
  url: string | null;
  url_tall: string | null;
  artist: string;
  album: string;
  isCached: boolean;
}

interface ArtworkCacheEntry {
  data: AnimatedArtworkResult | null;
  expiresAt: number;
}

const artworkCache = new Map<string, ArtworkCacheEntry>();
const artworkRequests = new Map<string, Promise<AnimatedArtworkResult | null>>();

function normalize(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function getArtworkKey(artist: string, album: string, title?: string | null) {
  return [normalize(artist), normalize(album), normalize(title ?? "")].join(":");
}

export function getAnimatedArtwork(
  artist: string,
  album: string,
  title?: string | null,
): Promise<AnimatedArtworkResult | null> {
  const key = getArtworkKey(artist, album, title);
  const cached = artworkCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.data);

  const pending = artworkRequests.get(key);
  if (pending) return pending;

  const lookup = (trackTitle?: string | null) => {
    const params = new URLSearchParams({ artist, album });
    if (trackTitle?.trim()) params.set("title", trackTitle.trim());
    return fetchMusicData<AnimatedArtworkResult | null>(
      `${ARTWORK_ENDPOINT}?${params}`,
      ARTWORK_TTL,
    ).then((result) => result?.url || result?.url_tall ? result : null);
  };

  const request = lookup(title)
    .then((result) => result ?? (title?.trim() ? lookup() : null))
    .then((result) => {
      const data = result?.url || result?.url_tall ? result : null;
      artworkCache.set(key, {
        data,
        expiresAt: Date.now() + (data ? ARTWORK_TTL : 24 * 60 * 60 * 1000),
      });
      if (data && title?.trim()) {
        artworkCache.set(getArtworkKey(artist, album), {
          data,
          expiresAt: Date.now() + ARTWORK_TTL,
        });
      }
      return data;
    })
    .catch((error) => {
      console.warn("Animated artwork lookup failed:", error);
      artworkCache.set(key, { data: null, expiresAt: Date.now() + 60 * 60 * 1000 });
      return null;
    })
    .finally(() => artworkRequests.delete(key));

  artworkRequests.set(key, request);
  return request;
}

export function useAnimatedArtwork({
  artist,
  album,
  title,
  enabled = true,
}: {
  artist?: string | null;
  album?: string | null;
  title?: string | null;
  enabled?: boolean;
}) {
  const key = enabled && artist?.trim() && album?.trim()
    ? getArtworkKey(artist, album, title)
    : null;
  const cached = key ? artworkCache.get(key) : null;
  const [state, setState] = useState<{
    key: string | null;
    data: AnimatedArtworkResult | null;
    isLoading: boolean;
  }>({ key: null, data: null, isLoading: false });

  useEffect(() => {
    if (!key || !artist || !album) return;
    const fresh = artworkCache.get(key);
    if (fresh && fresh.expiresAt > Date.now()) return;

    let cancelled = false;
    getAnimatedArtwork(artist, album, title).then((data) => {
      if (!cancelled) setState({ key, data, isLoading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [album, artist, key, title]);

  if (!key) return { data: null, isLoading: false };
  if (cached) {
    return { data: cached.data, isLoading: false };
  }
  return {
    data: state.key === key ? state.data : null,
    isLoading: state.key !== key || state.isLoading,
  };
}
