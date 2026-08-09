"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { AudioLines, ListMusic, Music, Repeat1 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useQueue, useSpotifyPlayer } from "@/lib/spotify";
import { normalizePlaybackQueue } from "@/lib/spotify/queue";
import { cn } from "@/lib/utils";

interface QueuePopoverProps {
  className?: string;
  triggerClassName?: string;
  children?: ReactNode;
}

export function QueuePopover({ className, triggerClassName, children }: QueuePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const { state } = useSpotifyPlayer();
  const { data: queue, isLoading, refetch } = useQueue({ enabled: hasOpened });

  const isRepeatingTrack = state?.repeatMode === "track";
  const currentTrackId = queue?.currently_playing?.id ?? state?.track?.id;
  const playbackSignature = `${state?.track?.id ?? ""}:${state?.repeatMode ?? "off"}`;
  const previousPlaybackSignatureRef = useRef(playbackSignature);

  const visibleQueue = useMemo(() => {
    return normalizePlaybackQueue(
      queue?.queue ?? [],
      currentTrackId,
      state?.repeatMode ?? "off"
    );
  }, [currentTrackId, queue?.queue, state?.repeatMode]);

  useEffect(() => {
    if (previousPlaybackSignatureRef.current === playbackSignature) return;
    previousPlaybackSignatureRef.current = playbackSignature;

    if (isOpen && hasOpened) {
      void refetch();
    }
  }, [hasOpened, isOpen, playbackSignature, refetch]);

  // Only start fetching after first open
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) return;

    if (!hasOpened) {
      setHasOpened(true);
    } else {
      void refetch();
    }
  };

  const upcomingLabel = isRepeatingTrack ? "After repeat is turned off" : "Next in queue";
  const hasPlaybackData = !!queue?.currently_playing || visibleQueue.length > 0;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Open playback queue"
          title="Queue"
          className={cn(
            "rounded-full p-2.5 text-muted-foreground/50 transition-all hover:bg-muted hover:text-foreground",
            isOpen && "bg-muted text-foreground",
            triggerClassName
          )}
        >
          {children ?? <ListMusic className="size-4" />}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className={cn(
          "w-[min(24rem,calc(100vw-2rem))] gap-0 overflow-hidden rounded-3xl border-white/10 bg-card/95 p-0 shadow-2xl shadow-black/40 backdrop-blur-2xl",
          className
        )}
        align="end"
        sideOffset={14}
      >
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">Playback queue</h3>
            <p className="text-[11px] text-muted-foreground">
              {visibleQueue.length === 1
                ? "1 track coming up"
                : `${visibleQueue.length} tracks coming up`}
            </p>
          </div>
          {isRepeatingTrack && (
            <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
              <Repeat1 className="size-3" />
              Track repeat
            </div>
          )}
        </div>

        <div className="max-h-[min(32rem,calc(100vh-9rem))] overflow-y-auto scrollbar-hide">
          {isLoading && !queue ? (
            <div className="flex min-h-52 items-center justify-center">
              <Spinner className="size-5" />
            </div>
          ) : !hasPlaybackData ? (
            <div className="flex min-h-52 flex-col items-center justify-center px-8 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted">
                <ListMusic className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Your queue is empty</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Add a song from its menu and it will appear here.
              </p>
            </div>
          ) : (
            <div className="p-3">
              {queue?.currently_playing && (
                <section aria-labelledby="queue-now-playing">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <p
                      id="queue-now-playing"
                      className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                    >
                      Now playing
                    </p>
                    <div className="flex items-center gap-1 text-[10px] font-medium text-primary">
                      <AudioLines className="size-3" />
                      Playing
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl p-3">
                    <div className="flex items-center gap-3">
                      {queue.currently_playing.album.images[0]?.url ? (
                        <Image
                          src={queue.currently_playing.album.images[0].url}
                          alt={queue.currently_playing.album.name}
                          width={52}
                          height={52}
                          className="shrink-0 rounded-xl object-cover shadow-lg"
                        />
                      ) : (
                        <div className="flex size-13 shrink-0 items-center justify-center rounded-xl bg-muted">
                          <Music className="size-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {queue.currently_playing.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {queue.currently_playing.artists.map((artist) => artist.name).join(", ")}
                        </p>
                        {isRepeatingTrack && (
                          <p className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-primary">
                            <Repeat1 className="size-3" />
                            This track will repeat
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <section className={cn(queue?.currently_playing && "mt-5")} aria-labelledby="queue-next-up">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p
                    id="queue-next-up"
                    className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    {upcomingLabel}
                  </p>
                  {visibleQueue.length > 0 && (
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {visibleQueue.length}
                    </span>
                  )}
                </div>

                {visibleQueue.length > 0 ? (
                  <div className="space-y-0.5">
                    {visibleQueue.map((track, index) => (
                      <div
                        key={`${track.id}-${index}`}
                        className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/70"
                      >
                        <span className="w-4 shrink-0 text-center text-[10px] tabular-nums text-muted-foreground/60">
                          {index + 1}
                        </span>
                        {track.album.images[0]?.url ? (
                          <Image
                            src={track.album.images[0].url}
                            alt={track.album.name}
                            width={40}
                            height={40}
                            className="shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <Music className="size-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-foreground/90 group-hover:text-foreground">
                            {track.name}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {track.artists.map((artist) => artist.name).join(", ")}
                          </p>
                        </div>
                        <span className="hidden text-[10px] text-muted-foreground sm:block">
                          {formatDuration(track.duration_ms)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed px-5 py-6 text-center">
                    <p className="text-xs font-medium">
                      {isRepeatingTrack ? "The current track stays on repeat" : "No tracks coming up"}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {isRepeatingTrack
                        ? "Turn off track repeat to continue through the queue."
                        : "Add more music to keep listening."}
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
