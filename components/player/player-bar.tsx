"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Mic2,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  Volume1,
  VolumeX,
  MonitorSpeaker,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import { getQueue, useSpotifyPlayer, useTrackLike } from "@/lib/spotify";
import { normalizePlaybackQueue } from "@/lib/spotify/queue";
import { useAuth } from "@/lib/auth";
import { useLyricsContext } from "@/lib/lrclib";
import Link from "next/link";
import { Slider } from "@/components/ui/slider";
import { QueuePopover } from "./queue-popover";
import { DevicePopover } from "./device-popover";
import { UpNextToast } from "./up-next-toast";
import { TrackPlaylistContextMenu } from "./track-playlist-context-menu";
import { TrackContextMenu } from "@/components/context/track-context-menu";
import { SleepTimerPopover } from "./sleep-timer-popover";
import { cn } from "@/lib/utils";
import {
  extractDominantColor,
  hslToString,
  type HSL,
} from "@/lib/utils/color-extractor";

export function PlayerBar() {
  const pathname = usePathname();
  const [ambientColor, setAmbientColor] = useState<HSL | null>(null);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const [volumePreview, setVolumePreview] = useState<number | null>(null);

  const { isAuthenticated, isPremium } = useAuth();
  const { lyricsAvailable } = useLyricsContext();
  const {
    state,
    isReady,
    isControlling,
    error,
    togglePlay,
    nextTrack,
    previousTrack,
    setVolume,
    transferPlayback,
    seek,
    toggleShuffle,
    cycleRepeatMode,
  } = useSpotifyPlayer();

  const trackId = state?.track?.id;
  const { isLiked, toggleLike, isLoading: likeLoading } = useTrackLike();

  const toastShownRef = useRef<string | null>(null);
  const toastRequestRef = useRef<string | null>(null);
  const lastAudibleVolumeRef = useRef(0.5);

  const playbackProgress =
    state?.position != null && state?.duration != null && state.duration > 0
      ? (state.position / state.duration) * 100
      : 0;
  const currentProgress = seekPreview ?? playbackProgress;

  const track = state?.track;
  const albumArt = track?.album.images[0]?.url;
  const isPlaying = state?.isPlaying ?? false;
  const duration = state?.duration ?? 0;
  const position = state?.position ?? 0;
  const repeatMode = state?.repeatMode ?? "off";

  // Extract ambient color from album art
  useEffect(() => {
    let cancelled = false;
    const colorPromise = albumArt
      ? extractDominantColor(albumArt)
      : Promise.resolve(null);

    colorPromise.then((color) => {
      if (!cancelled) setAmbientColor(color);
    });

    return () => {
      cancelled = true;
    };
  }, [albumArt]);

  // Reset the notification guard when playback moves to another track.
  useEffect(() => {
    toastShownRef.current = null;
    toastRequestRef.current = null;
  }, [trackId]);

  useEffect(() => {
    const currentVolume = state?.volume;
    if (currentVolume != null && currentVolume > 0) {
      lastAudibleVolumeRef.current = currentVolume;
    }
  }, [state?.volume]);

  // Resolve Up Next from a fresh queue snapshot at the moment it is needed.
  useEffect(() => {
    // Don't show toast on lyrics page or login
    if (pathname === "/lyrics" || pathname === "/" || pathname === "/callback" || pathname === "/app/callback") return;
    if (!trackId || !duration || !isPlaying) return;
    if (repeatMode === "track") return;

    const remaining = duration - position;
    const currentTrackId = trackId;

    if (
      remaining <= 15000 &&
      remaining > 0 &&
      toastShownRef.current !== currentTrackId &&
      toastRequestRef.current !== currentTrackId
    ) {
      toastRequestRef.current = currentTrackId;

      void getQueue()
        .then((freshQueue) => {
          if (freshQueue.currently_playing?.id !== currentTrackId) return;

          const nextTrack = normalizePlaybackQueue(
            freshQueue.queue,
            currentTrackId,
            repeatMode
          )[0];

          if (!nextTrack) return;
          toastShownRef.current = currentTrackId;
          toast.custom(
            (toastId) => (
              <UpNextToast
                track={nextTrack}
                onDismiss={() => toast.dismiss(toastId)}
              />
            ),
            { duration: 5000 },
          );
        })
        .catch((error) => {
          console.error("Failed to refresh Up Next:", error);
        });
    }
  }, [
    pathname,
    position,
    duration,
    trackId,
    isPlaying,
    repeatMode,
  ]);

  const runPlayerAction = useCallback(
    async (action: () => Promise<void>, failureMessage: string) => {
      try {
        await action();
      } catch (actionError) {
        toast.error(failureMessage, {
          description:
            actionError instanceof Error
              ? actionError.message
              : "Spotify could not complete this action.",
        });
      }
    },
    [],
  );

  const handleLike = async () => {
    const nextLikedState = !isLiked;
    try {
      await toggleLike();
      toast.success(
        nextLikedState ? "Added to Liked Songs" : "Removed from Liked Songs",
        { description: track?.name },
      );
    } catch (actionError) {
      toast.error("Could not update Liked Songs", {
        description:
          actionError instanceof Error
            ? actionError.message
            : "Spotify could not complete this action.",
      });
    }
  };

  const commitSeek = async (value: number[]) => {
    if (!state?.duration) return;
    const positionMs = (value[0] / 100) * state.duration;
    await runPlayerAction(() => seek(positionMs), "Could not seek playback");
    setSeekPreview(null);
  };

  const commitVolume = async (value: number[]) => {
    await runPlayerAction(
      () => setVolume(value[0] / 100),
      "Could not change volume",
    );
    setVolumePreview(null);
  };

  const toggleMute = async () => {
    const currentVolume = state?.volume ?? 0.5;
    if (currentVolume > 0) {
      lastAudibleVolumeRef.current = currentVolume;
    }
    const nextVolume = currentVolume === 0 ? lastAudibleVolumeRef.current : 0;
    await runPlayerAction(
      () => setVolume(nextVolume),
      "Could not change volume",
    );
  };

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Floating pill for non-premium or error states
  if (!isPremium) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-card/90 backdrop-blur-2xl border border-white/10 rounded-full px-6 py-3 shadow-2xl shadow-black/30">
          <p className="text-sm text-muted-foreground">
            Premium is required to play music on this app.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    const isEMEError = error.includes("DRM") || error.includes("Widevine");
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-card/90 backdrop-blur-2xl border border-white/10 rounded-full px-6 py-3 shadow-2xl shadow-black/30">
          <p
            className={cn(
              "text-sm",
              isEMEError ? "text-muted-foreground" : "text-destructive",
            )}
          >
            {isEMEError
              ? "Reproducción no disponible en esta plataforma"
              : error}
          </p>
          {isEMEError && (
            <p className="text-xs text-muted-foreground mt-1 text-center">
              DRM playback is not supported on this platform. Please use an
              alternative device.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="bg-card/90 backdrop-blur-2xl border border-white/10 rounded-full px-6 py-3 shadow-2xl shadow-black/30 flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Connecting...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 isolate -translate-x-1/2 z-50 transition-[width,height,opacity,transform] duration-500",
        track
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none",
      )}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 -z-10 scale-150 bg-transparent opacity-40 blur-3xl transition-[opacity,transform] duration-700"
        style={{
          background: ambientColor
            ? `radial-gradient(ellipse, hsl(${hslToString(ambientColor)} / 0.7), transparent 70%)`
            : `radial-gradient(ellipse, hsl(var(--primary) / 0.5), transparent 70%)`,
        }}
      />

      <div
        className={cn(
          "backdrop-blur-2xl border border-white/10 rounded-4xl shadow-2xl shadow-black/40 bg-card/75",
        )}
      >
        <div className="flex items-center px-5 py-3 gap-4">
          {/* Album art with spinning animation */}
          <div className="relative shrink-0">
            {albumArt ? (
              <Image
                src={albumArt}
                alt={track?.album.name}
                width={56}
                height={56}
                className={cn(
                  "w-14 h-14 rounded-full object-cover shadow-lg",
                  isPlaying && "animate-[spin_8s_linear_infinite]",
                )}
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <MonitorSpeaker className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Track info - always visible */}
          <div className="w-40 min-w-0">
            {track ? (
              <TrackContextMenu
                trackId={track.id}
                trackUri={track.uri ?? `spotify:track:${track.id}`}
                trackName={track.name}
                artistId={track.artistIds?.[0]}
                artistName={track.artists[0]}
                albumId={track.album.id}
                albumName={track.album.name}
                spotifyUrl={`https://open.spotify.com/track/${track.id}`}
              >
                <div>
                  {track.album.id ? (
                    <Link
                      href={`/app/album?id=${track.album.id}`}
                      className="block truncate text-[13px] font-medium text-foreground hover:underline"
                    >
                      {track.name}
                    </Link>
                  ) : (
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {track.name}
                    </p>
                  )}
                  <p className="truncate text-[11px] text-muted-foreground">
                    {track.artists.map((artist, index) => (
                      <span key={`${track.id}-${track.artistIds?.[index] ?? artist}`}>
                        {index > 0 && ", "}
                        {track.artistIds?.[index] ? (
                          <Link
                            href={`/app/artist?id=${track.artistIds[index]}`}
                            className="hover:text-foreground hover:underline"
                          >
                            {artist}
                          </Link>
                        ) : (
                          artist
                        )}
                      </span>
                    ))}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-muted-foreground/70">
                      {formatTime(state?.position ?? 0)}
                    </span>
                    <span className="text-[10px] text-muted-foreground/40">
                      /
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground/50">
                      {formatTime(state?.duration ?? 0)}
                    </span>
                  </div>
                </div>
              </TrackContextMenu>
            ) : (
              <div>
                <p className="text-[13px] text-muted-foreground">
                  Not playing
                </p>
                <button
                  onClick={() =>
                    void runPlayerAction(
                      () => transferPlayback(false),
                      "Could not connect playback",
                    )
                  }
                  className="text-[10px] text-primary hover:underline"
                >
                  Transfer here
                </button>
              </div>
            )}
          </div>

          {/* Like button */}
          {track && (
            <TrackPlaylistContextMenu
              trackUri={track.uri ?? `spotify:track:${track.id}`}
              trackName={track.name}
            >
              <button
                onClick={() => void handleLike()}
                aria-label={isLiked ? "Remove from Liked Songs" : "Save to Liked Songs"}
                title={isLiked ? "Remove from Liked Songs" : "Save to Liked Songs"}
                disabled={likeLoading}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  isLiked
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                  likeLoading && "opacity-50"
                )}
              >
                <Heart
                  className={cn("w-4 h-4", isLiked && "fill-current")}
                />
              </button>
            </TrackPlaylistContextMenu>
          )}

          {/* Shuffle */}
          <button
            onClick={() =>
              void runPlayerAction(toggleShuffle, "Could not change shuffle mode")
            }
            disabled={isControlling}
            aria-label={state?.shuffle ? "Disable shuffle" : "Enable shuffle"}
            className={cn(
              "p-2 rounded-full transition-colors",
              state?.shuffle
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          {/* Main controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                void runPlayerAction(previousTrack, "Could not go to the previous track")
              }
              disabled={isControlling}
              aria-label="Previous track"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <SkipBack className="w-4 h-4" fill="currentColor" />
            </button>

            <button
              onClick={() =>
                void runPlayerAction(togglePlay, "Could not change playback")
              }
              disabled={isControlling}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="w-11 h-11 rounded-full bg-foreground text-background flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" fill="currentColor" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
              )}
            </button>

            <button
              onClick={() =>
                void runPlayerAction(nextTrack, "Could not skip to the next track")
              }
              disabled={isControlling}
              aria-label="Next track"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <SkipForward className="w-4 h-4" fill="currentColor" />
            </button>
          </div>

          {/* Repeat */}
          <button
            onClick={() =>
              void runPlayerAction(cycleRepeatMode, "Could not change repeat mode")
            }
            disabled={isControlling}
            aria-label={
              state?.repeatMode === "track"
                ? "Turn repeat off"
                : state?.repeatMode === "context"
                  ? "Repeat current track"
                  : "Repeat playback context"
            }
            title={
              state?.repeatMode === "track"
                ? "Repeat track"
                : state?.repeatMode === "context"
                  ? "Repeat context"
                  : "Repeat off"
            }
            className={cn(
              "p-2 rounded-full transition-colors",
              state?.repeatMode !== "off"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {state?.repeatMode === "track" ? (
              <Repeat1 className="w-4 h-4" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-white/10" />

          {/* Extended controls */}
          <div className="flex items-center gap-1">
            {/* Lyrics */}
            {lyricsAvailable ? (
              <Link
                href="/lyrics"
                aria-label="Open lyrics"
                className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mic2 className="w-4 h-4" />
              </Link>
            ) : (
              <button
                disabled
                aria-label="Lyrics unavailable"
                className="p-2 rounded-full text-muted-foreground/30 cursor-not-allowed"
              >
                <Mic2 className="w-4 h-4" />
              </button>
            )}

            {/* Queue */}
            <QueuePopover triggerClassName="p-2 rounded-full text-muted-foreground hover:text-foreground" />

            {/* Sleep timer */}
            <SleepTimerPopover />

            {/* Devices */}
            <DevicePopover triggerClassName="p-2 rounded-full text-muted-foreground hover:text-foreground" />
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => void toggleMute()}
              disabled={isControlling}
              aria-label={state?.volume === 0 ? "Unmute" : "Mute"}
              className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              {state?.volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (state?.volume ?? 0) < 0.5 ? (
                <Volume1 className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <Slider
              value={[volumePreview ?? (state?.volume ?? 0.5) * 100]}
              onValueChange={(value) => setVolumePreview(value[0])}
              onValueCommit={(value) => void commitVolume(value)}
              disabled={isControlling}
              max={100}
              step={1}
              className="w-20 opacity-70 hover:opacity-100 transition-opacity"
              trackClassName="data-horizontal:h-1"
              rangeClassName="data-horizontal:h-1"
              thumbClassName="size-3 rounded-full"
            />
          </div>
        </div>

        {/* Seek slider at bottom */}
        <div className="h-6 px-4 pb-2">
          <Slider
            value={[currentProgress]}
            onValueChange={(value) => setSeekPreview(value[0])}
            onValueCommit={(value) => void commitSeek(value)}
            disabled={isControlling}
            max={100}
            step={0.1}
            className="w-full"
            trackClassName="data-horizontal:h-1"
            rangeClassName="data-horizontal:h-1 bg-primary"
            thumbClassName="size-3 rounded-full opacity-0 hover:opacity-100 transition-opacity"
          />
        </div>
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
