"use client";

import { use } from "react";
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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePlaylist, usePlaylistTracks } from "@/lib/spotify/hooks";
import { startPlayback } from "@/lib/spotify/api";
import { Spinner } from "@/components/ui/spinner";

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

  const tracks = tracksData?.items ?? [];
  const totalDuration = tracks.reduce(
    (acc, item) => acc + (item.track?.duration_ms ?? 0),
    0
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
    <div className="flex flex-col pb-8 container mx-auto py-10">
      {/* Back button */}
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/80 px-6 py-4 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="size-8"
        >
          <ArrowLeft className="size-4" />
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-6 px-6 pb-6 md:flex-row md:items-end">
        {/* Cover image */}
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

        {/* Info */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Playlist
          </span>
          <h1 className="text-4xl font-bold md:text-5xl lg:text-6xl">
            {playlist.name}
          </h1>
          {playlist.description && (
            <p
              className="text-sm text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: playlist.description }}
            />
          )}
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href={`/profile/${playlist.owner.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {playlist.owner.display_name}
            </Link>
            <span>•</span>
            <span>{playlist.tracks.total} canciones</span>
            {totalHours > 0 && (
              <>
                <span>•</span>
                <span>
                  {totalHours} hr {totalMinutes} min
                </span>
              </>
            )}
            {totalHours === 0 && totalMinutes > 0 && (
              <>
                <span>•</span>
                <span>{totalMinutes} min</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 px-6 pb-6">
        <Button
          size="lg"
          onClick={handlePlay}
          className="size-14 rounded-full"
        >
          <Play className="size-6 fill-current" />
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

      {/* Tracks table header */}
      <div className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-4 border-b border-border px-6 py-2 text-sm font-medium text-muted-foreground">
        <span className="w-8 text-center">#</span>
        <span>Título</span>
        <span className="hidden md:block">Álbum</span>
        <span className="flex items-center justify-end pr-4">
          <Clock className="size-4" />
        </span>
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
                className="group grid grid-cols-[auto_1fr_1fr_auto] items-center gap-4 px-6 py-2 transition-colors hover:bg-muted/50"
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
                  {track.album?.images?.[0]?.url && (
                    <Image
                      src={track.album.images[0].url}
                      alt={track.album.name}
                      width={40}
                      height={40}
                      className="rounded"
                    />
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {track.name}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {track.artists.map((a) => a.name).join(", ")}
                    </span>
                  </div>
                </div>

                {/* Album */}
                <span className="hidden truncate text-sm text-muted-foreground md:block">
                  {track.album?.name}
                </span>

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
