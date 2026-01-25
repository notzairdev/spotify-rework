"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Play,
  Shuffle,
  Clock,
  MoreHorizontal,
  Heart,
  ArrowLeft,
  ListMusic,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePlaylist, usePlaylistTracks } from "@/lib/spotify/hooks";
import { startPlayback } from "@/lib/spotify/api";
import { Spinner } from "@/components/ui/spinner";
import { extractDominantColor, hslToString, type HSL } from "@/lib/utils/color-extractor";

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PlaylistPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { data: playlist, isLoading: playlistLoading } = usePlaylist(id);
  const { data: tracksData, isLoading: tracksLoading } = usePlaylistTracks(id);
  const [coverColor, setCoverColor] = useState<HSL | null>(null);

  // Extract dominant color from cover image
  useEffect(() => {
    const imageUrl = playlist?.images?.[0]?.url;
    if (!imageUrl) {
      setCoverColor(null);
      return;
    }

    extractDominantColor(imageUrl).then((color) => {
      setCoverColor(color);
    });
  }, [playlist?.images]);

  const tracks = tracksData?.items ?? [];
  const totalDuration = tracks.reduce(
    (acc, item) => acc + (item.track?.duration_ms ?? 0),
    0,
  );
  const totalHours = Math.floor(totalDuration / 3600000);
  const totalMinutes = Math.floor((totalDuration % 3600000) / 60000);

  const handlePlay = async () => {
    if (!playlist) return;
    try {
      await startPlayback({ contextUri: playlist.uri });
    } catch (e) {
      console.error("Failed to play playlist:", e);
    }
  };

  const handlePlayTrack = async (offset: number) => {
    if (!playlist) return;
    try {
      await startPlayback({
        contextUri: playlist.uri,
        offset: { position: offset },
      });
    } catch (e) {
      console.error("Failed to play track:", e);
    }
  };

  const handleShuffle = async () => {
    if (!playlist) return;
    try {
      // Start playback with shuffle enabled
      await startPlayback({ contextUri: playlist.uri });
    } catch (e) {
      console.error("Failed to shuffle playlist:", e);
    }
  };

  if (playlistLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Playlist no encontrada</p>
        <Button variant="outline" onClick={() => router.push("/home")}>
          Volver al inicio
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col container mx-auto py-26">
      {/* Header */}
      <div className="flex justify-between gap-6 px-6 pb-6 md:flex-row md:items-end">
        {/* Info */}
        <div className="flex flex-col gap-4">
          <div className="flex gap-1 items-center">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground bg-card inline-block px-2 py-1 rounded-sm w-fit">
              Playlist
            </span>
            <Link
              href={`/profile/${playlist.owner.id}`}
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground bg-card inline-block px-2 py-1 rounded-sm w-fit hover:underline"
            >
              Created by <span className="text-white">{playlist.owner.display_name}</span>
            </Link>
          </div>
          <h1 className="font-bold text-7xl">{playlist.name}</h1>
          {playlist.description && (
            <p
              className="text-xs text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: playlist.description }}
            />
          )}
          <div className="mt-2 flex items-center gap-5 text-sm text-muted-foreground">
            <div className="flex gap-1 items-center">
              <div className="p-2 rounded-full bg-primary/20 w-fit">
                <ListMusic className="w-4 h-4 text-primary" />
              </div>
              <span>{playlist.tracks.total} canciones</span>
            </div>
            {totalHours > 0 && (
              <div className="flex gap-1 items-center">
                <div className="p-2 rounded-full bg-primary/20 w-fit">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <span>
                  {totalHours} hr {totalMinutes} min
                </span>
              </div>
            )}
            {totalHours === 0 && totalMinutes > 0 && (
              <div className="flex gap-1 items-center">
                <div className="p-2 rounded-full bg-primary/20 w-fit">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <span>{totalMinutes} min</span>
              </div>
            )}
          </div>
        </div>

        {/* Cover image with glow */}
        <div className="relative">
          {/* Radial glow behind cover */}
          {coverColor && (
            <div
              className="absolute -inset-16 rounded-full blur-3xl opacity-60 transition-opacity duration-1000 z-[-1]"
              style={{
                background: `radial-gradient(circle, hsl(${hslToString(coverColor)}) 0%, transparent 70%)`,
                filter: "blur(250px)",
              }}
            />
          )}
          <div className="relative aspect-square w-48 shrink-0 overflow-hidden rounded-lg shadow-2xl md:w-56">
            {playlist.images?.[0]?.url ? (
              <Image
                src={playlist.images[0].url}
                alt={playlist.name}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-muted">
                <span className="text-4xl text-muted-foreground">♪</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 px-6 pb-6">
        <Button size="lg" onClick={handlePlay} className="p-5 rounded-2xl">
          <Play className="fill-current" />
          <p>Play</p>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleShuffle}
          className="size-12"
        >
          <Shuffle className="size-5" />
        </Button>
        <Button size="icon" variant="ghost" className="size-12">
          <Heart className="size-5" />
        </Button>
        <Button size="icon" variant="ghost" className="size-12">
          <MoreHorizontal className="size-5" />
        </Button>
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
          {tracks.map((item, index) => {
            const track = item.track;
            if (!track) return null;

            return (
              <div
                key={`${track.id}-${index}`}
                className="group grid grid-cols-[auto_1fr_1fr_auto] items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/50 rounded-2xl"
                onClick={() => handlePlayTrack(index)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handlePlayTrack(index);
                  }
                }}
              >
                {/* Track number / play button */}
                <div className="flex w-8 items-center justify-center">
                  <span className="text-sm text-muted-foreground group-hover:hidden">
                    {index + 1}
                  </span>
                  <Play className="hidden size-4 fill-current group-hover:block" />
                </div>

                {/* Track info */}
                <div className="flex min-w-0 items-center gap-3">
                  {track.album?.images?.[0]?.url && track.album?.id && (
                    <Link
                      href={`/album/${track.album.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Image
                        src={track.album.images[0].url}
                        alt={track.album.name}
                        width={40}
                        height={40}
                        className="rounded hover:opacity-80 transition-opacity"
                      />
                    </Link>
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {track.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {track.artists.map((a, i) => (
                        <span key={a.id}>
                          <Link
                            href={`/artist/${a.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-foreground hover:underline transition-colors"
                          >
                            {a.name}
                          </Link>
                          {i < track.artists.length - 1 && ", "}
                        </span>
                      ))}
                    </span>
                  </div>
                </div>

                {/* Album */}
                {track.album?.id ? (
                  <Link
                    href={`/album/${track.album.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hidden truncate text-sm text-muted-foreground md:block text-end pr-5 hover:text-foreground hover:underline transition-colors"
                  >
                    {track.album?.name}
                  </Link>
                ) : (
                  <span className="hidden truncate text-sm text-muted-foreground md:block text-end pr-5">
                    {track.album?.name}
                  </span>
                )}

                {/* Duration */}
                <div className="flex items-center justify-end gap-4 pr-4">
                  <span className="text-sm text-muted-foreground">
                    {formatDuration(track.duration_ms)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
