"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Heart,
  MoreHorizontal,
  Play,
  ArrowLeft,
  Clock,
  Disc3,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAlbum, useAlbumTracks } from "@/lib/spotify/hooks";
import { startPlayback } from "@/lib/spotify/api";
import {
  extractDominantColor,
  hslToString,
  type HSL,
} from "@/lib/utils/color-extractor";
import { cn } from "@/lib/utils";

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AlbumPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { data: album, isLoading: albumLoading } = useAlbum(id);
  const { data: tracksData, isLoading: tracksLoading } = useAlbumTracks(id);

  const [coverColor, setCoverColor] = useState<HSL | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Extract dominant color from cover image
  useEffect(() => {
    const imageUrl = album?.images?.[0]?.url;
    if (!imageUrl) {
      setCoverColor(null);
      return;
    }

    extractDominantColor(imageUrl).then((color) => {
      setCoverColor(color);
    });
  }, [album?.images]);

  const tracks = tracksData?.items ?? [];
  const totalDuration = tracks.reduce(
    (acc, track) => acc + (track.duration_ms ?? 0),
    0,
  );
  const totalMinutes = Math.floor(totalDuration / 60000);

  const handlePlayAlbum = async () => {
    if (!album) return;
    try {
      await startPlayback({ contextUri: `spotify:album:${album.id}` });
      setIsPlaying(true);
    } catch (e) {
      console.error("Failed to play album:", e);
    }
  };

  const handlePlayTrack = async (trackUri: string, offset: number) => {
    if (!album) return;
    try {
      await startPlayback({
        contextUri: `spotify:album:${album.id}`,
        offset: { position: offset },
      });
      setIsPlaying(true);
    } catch (e) {
      console.error("Failed to play track:", e);
    }
  };

  if (albumLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Album not found</p>
        <Button variant="outline" onClick={() => router.push("/home")}>
          Go back home
        </Button>
      </div>
    );
  }

  const albumImage = album.images?.[0]?.url;
  const releaseYear = album.release_date?.split("-")[0];

  return (
    <div className="flex flex-col container mx-auto pb-26">
      {/* Hero Section */}
      <div className="relative overflow-hidden pt-26">
        {/* Background glow */}
        {coverColor && (
          <div
            className="absolute inset-0 opacity-30 transition-opacity duration-1000"
            style={{
              background: `radial-gradient(ellipse at top, hsl(${hslToString(coverColor)}) 0%, transparent 70%)`,
            }}
          />
        )}

        {/* Album Header - Centered Layout */}
        <div className="relative z-10 flex flex-col items-center gap-8 px-6 pb-8">
          {/* Cover with vinyl effect */}
          <div className="relative flex items-center justify-center">
            {/* Album cover */}
            <div className="relative z-10 aspect-square w-48 shrink-0 overflow-hidden rounded-lg shadow-2xl md:w-56">
              {albumImage ? (
                <Image
                  src={albumImage}
                  alt={album.name}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-muted">
                  <Disc3 className="size-16 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Vinyl disc - white/cream colored */}
            <div
              className={cn(
                "absolute -right-16 size-48 rounded-full bg-linear-to-br from-stone-100 to-stone-200 shadow-xl transition-transform duration-1000 md:-right-20 md:size-56",
                isPlaying && "animate-spin-slow",
              )}
            >
              {/* Vinyl grooves */}
              <div className="absolute inset-3 rounded-full border border-stone-300/40" />
              <div className="absolute inset-6 rounded-full border border-stone-300/30" />
              <div className="absolute inset-9 rounded-full border border-stone-300/30" />
              <div className="absolute inset-12 rounded-full border border-stone-300/20" />
              <div className="absolute inset-15 rounded-full border border-stone-300/20" />
              {/* Center label */}
              <div className="absolute inset-18 rounded-full bg-primary md:inset-20" />
            </div>
          </div>

          {/* Info - Centered */}
          <div className="flex flex-col items-center gap-4 text-center">
            {/* Metadata line */}
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              <span>{releaseYear}</span>
              <span>·</span>
              <span>{album.total_tracks} TRACKS</span>
              <span>·</span>
              <span>{totalMinutes} MIN</span>
            </div>

            {/* Album title */}
            <h1 className="text-4xl font-bold md:text-5xl lg:text-6xl">
              {album.name}
            </h1>

            {/* Artist name */}
            <div className="flex flex-wrap items-center justify-center gap-1">
              {album.artists?.map((artist, i) => (
                <span key={artist.id}>
                  <Link
                    href={`/artist/${artist.id}`}
                    className="text-lg text-primary hover:underline"
                  >
                    {artist.name}
                  </Link>
                  {i < album.artists.length - 1 && (
                    <span className="text-primary">, </span>
                  )}
                </span>
              ))}
            </div>

            {/* Action buttons - Centered */}
            <div className="mt-4 flex items-center gap-4">
              <Button size="icon" variant="outline" className="size-12 rounded-full border-muted-foreground/30">
                <Heart className="size-5" />
              </Button>
              <Button
                size="lg"
                onClick={handlePlayAlbum}
                className="rounded-full px-8"
              >
                Play Album
              </Button>
              <Button size="icon" variant="outline" className="size-12 rounded-full border-muted-foreground/30">
                <MoreHorizontal className="size-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-2 text-md font-medium text-muted-foreground">
        <p>Tracklist</p>
      </div>

      {/* Tracks list */}
      {tracksLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="size-6" />
        </div>
      ) : (
        <div className="flex flex-col">
          {tracks.map((track, index) => (
            <div
              key={track.id}
              className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-3 transition-colors hover:bg-muted/50 rounded-lg"
              onClick={() => handlePlayTrack(track.uri, index)}
              role="button"
              tabIndex={0}
            >
              {/* Track number / play button */}
              <div className="flex w-8 items-center justify-center">
                <span className="text-sm text-muted-foreground group-hover:hidden">
                  {index + 1}
                </span>
                <Play className="hidden size-4 fill-current group-hover:block" />
              </div>

              {/* Track info */}
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{track.name}</span>
                <span className="truncate text-sm text-muted-foreground">
                  {track.artists?.map((artist, i) => (
                    <span key={artist.id}>
                      <Link
                        href={`/artist/${artist.id}`}
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {artist.name}
                      </Link>
                      {i < track.artists.length - 1 && ", "}
                    </span>
                  ))}
                </span>
              </div>

              {/* Duration */}
              <div className="flex items-center justify-end gap-4 pr-4">
                <span className="text-sm text-muted-foreground">
                  {formatDuration(track.duration_ms)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Credits */}
      <div className="mt-12 px-6 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          ℗ {releaseYear} {album.artists?.[0]?.name}
        </p>
      </div>
    </div>
  );
}
