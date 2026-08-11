"use client";

import Image from "next/image";
import { ListMusic, Music, X } from "lucide-react";
import type { SpotifyTrack } from "@/lib/spotify/api";

interface UpNextToastProps {
  track: SpotifyTrack;
  onDismiss: () => void;
}

export function UpNextToast({ track, onDismiss }: UpNextToastProps) {
  const artwork = track.album.images[0]?.url;
  const artists = track.artists.map((artist) => artist.name).join(", ");

  return (
    <div
      role="status"
      aria-label={`Playing next: ${track.name} by ${artists}`}
      className="group relative w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[1.4rem] border border-white/10 bg-card/90 p-2 shadow-2xl shadow-black/45 backdrop-blur-2xl"
    >
      {artwork && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <Image
            src={artwork}
            alt=""
            fill
            sizes="352px"
            className="scale-125 object-cover opacity-20 blur-2xl saturate-150"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-card/95 via-card/90 to-card/70" />
        </div>
      )}

      <div className="relative flex items-center gap-3">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-[0.9rem] bg-muted shadow-lg shadow-black/25">
          {artwork ? (
            <Image
              src={artwork}
              alt={track.album.name}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Music className="size-5 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 py-0.5">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            <ListMusic className="size-3" />
            <span>Playing next</span>
          </div>
          <p className="truncate text-[13px] font-semibold leading-5 text-foreground">
            {track.name}
          </p>
          <p className="truncate text-[11px] leading-4 text-muted-foreground">
            {artists}
          </p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss Up Next notification"
          className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 opacity-0 transition-[opacity,background-color,color] hover:bg-white/8 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="absolute inset-x-3 bottom-0 h-px overflow-hidden bg-white/5">
        <div className="up-next-toast-progress h-full origin-left bg-primary/80" />
      </div>
    </div>
  );
}
