"use client";

import Image from "next/image";
import Link from "next/link";
import { Music, Play } from "lucide-react";
import { toast } from "sonner";

import { TrackContextMenu } from "@/components/context";
import { startPlayback, type SpotifyTrack } from "@/lib/spotify";

interface SearchTrackListProps {
  tracks: SpotifyTrack[];
}

async function playTrack(track: SpotifyTrack) {
  try {
    await startPlayback({ uris: [track.uri] });
  } catch (error) {
    toast.error("Could not play this song", {
      description: error instanceof Error ? error.message : undefined,
    });
  }
}

export function SearchTrackList({ tracks }: SearchTrackListProps) {
  return (
    <div className="space-y-1">
      {tracks.map((track) => {
        const primaryArtist = track.artists[0];
        return (
          <TrackContextMenu
            key={track.id}
            trackId={track.id}
            trackUri={track.uri}
            trackName={track.name}
            artistId={primaryArtist?.id}
            artistName={primaryArtist?.name}
            albumId={track.album.id}
            albumName={track.album.name}
            spotifyUrl={track.external_urls.spotify}
          >
            <div className="group flex min-w-0 items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-white/5">
              <button
                type="button"
                onClick={() => void playTrack(track)}
                aria-label={`Play ${track.name}`}
                className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-muted shadow-md"
              >
                {track.album.images[0]?.url ? (
                  <Image
                    src={track.album.images[0].url}
                    alt={track.album.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center">
                    <Music className="size-5 text-muted-foreground" />
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Play className="size-4 fill-white text-white" />
                </span>
              </button>

              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => void playTrack(track)}
                  className="block max-w-full truncate text-left text-sm font-medium hover:underline"
                >
                  {track.name}
                </button>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {track.explicit && (
                    <span className="mr-1.5 inline-flex size-3.5 items-center justify-center rounded-[3px] bg-muted-foreground/45 text-[8px] font-bold text-background">
                      E
                    </span>
                  )}
                  {track.artists.map((artist, index) => (
                    <span key={artist.id}>
                      {index > 0 && ", "}
                      <Link href={`/app/artist?id=${artist.id}`} className="hover:text-foreground hover:underline">
                        {artist.name}
                      </Link>
                    </span>
                  ))}
                </p>
              </div>

              <Link
                href={`/app/album?id=${track.album.id}`}
                className="hidden max-w-[28%] truncate text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline lg:block"
              >
                {track.album.name}
              </Link>
              <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                {formatDuration(track.duration_ms)}
              </span>
            </div>
          </TrackContextMenu>
        );
      })}
    </div>
  );
}

function formatDuration(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1_000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
