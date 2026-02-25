"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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
import { useSpotifyPlayer, useQueue, useTrackLike } from "@/lib/spotify";
import { useAuth } from "@/lib/auth";
import { useLyricsContext } from "@/lib/lrclib";
import Link from "next/link";
import { Slider } from "@/components/ui/slider";
import { QueuePopover } from "./queue-popover";
import { DevicePopover } from "./device-popover";
import { cn } from "@/lib/utils";
import {
  extractDominantColor,
  hslToString,
  type HSL,
} from "@/lib/utils/color-extractor";

export function PlayerBar() {
  const pathname = usePathname();
  const [ambientColor, setAmbientColor] = useState<HSL | null>(null);

  const { isAuthenticated, isPremium } = useAuth();
  const { lyricsAvailable } = useLyricsContext();
  const {
    state,
    isReady,
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

  const shouldFetchQueue = !!state?.track;
  const { data: queueData, refetch: refetchQueue } = useQueue({ enabled: shouldFetchQueue });

  // Refetch queue whenever the track changes (covers skip, previous, auto-advance)
  const trackId = state?.track?.id;
  useEffect(() => {
    if (trackId) {
      refetchQueue();
    }
  }, [trackId, refetchQueue]);
  const { isLiked, toggleLike, isLoading: likeLoading } = useTrackLike();

  const toastShownRef = useRef<string | null>(null);

  const currentProgress =
    state?.position != null && state?.duration != null && state.duration > 0
      ? (state.position / state.duration) * 100
      : 0;

  const track = state?.track;
  const albumArt = track?.album.images[0]?.url;
  const isPlaying = state?.isPlaying ?? false;

  // Extract ambient color from album art
  useEffect(() => {
    if (!albumArt) {
      setAmbientColor(null);
      return;
    }
    extractDominantColor(albumArt).then((color) => {
      if (color) setAmbientColor(color);
    });
  }, [albumArt]);

  // Next song toast at 15 seconds remaining (not on /lyrics or /)
  useEffect(() => {
    // Don't show toast on lyrics page or login
    if (pathname === "/lyrics" || pathname === "/" || pathname === "/callback") return;
    if (!state?.track || !state.duration || !state.isPlaying) return;

    const remaining = state.duration - (state.position ?? 0);
    const trackId = state.track.id;
    const nextTrackInQueue = queueData?.queue?.[0];

    if (toastShownRef.current !== null && toastShownRef.current !== trackId) {
      toastShownRef.current = null;
    }

    if (
      remaining <= 15000 &&
      remaining > 0 &&
      toastShownRef.current !== trackId &&
      nextTrackInQueue
    ) {
      toastShownRef.current = trackId;
      toast("Up Next", {
        description: `${nextTrackInQueue.name} • ${nextTrackInQueue.artists.map((a) => a.name).join(", ")}`,
        duration: 5000,
      });
    }
  }, [
    pathname,
    state?.position,
    state?.duration,
    state?.track?.id,
    state?.isPlaying,
    queueData?.queue,
  ]);

  const handleSeek = (value: number[]) => {
    if (state?.duration) {
      const positionMs = (value[0] / 100) * state.duration;
      seek(positionMs);
    }
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
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500",
        track
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none",
      )}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 opacity-40 blur-3xl -z-10 scale-150 transition-all duration-700"
        style={{
          background: ambientColor
            ? `radial-gradient(ellipse, hsl(${hslToString(ambientColor)} / 0.7), transparent 70%)`
            : `radial-gradient(ellipse, hsl(var(--primary) / 0.5), transparent 70%)`,
        }}
      />

      <div
        className={cn(
          "bg-card/85 backdrop-blur-2xl border border-white/10 rounded-[28px] shadow-2xl shadow-black/40",
        )}
      >
        <div className="flex items-center px-5 py-3 gap-4">
          {/* Album art with spinning animation */}
          <div className="relative shrink-0">
            {albumArt ? (
              <img
                src={albumArt}
                alt={track?.album.name}
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
              <div>
                <p className="text-[13px] font-medium text-foreground truncate">
                  {track.name}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {track.artists.join(", ")}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground/70">
                    {formatTime(state?.position ?? 0)}
                  </span>
                  <span className="text-[10px] text-muted-foreground/40">
                    /
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground/50">
                    {formatTime(state?.duration ?? 0)}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[13px] text-muted-foreground">
                  Not playing
                </p>
                <button
                  onClick={transferPlayback}
                  className="text-[10px] text-primary hover:underline"
                >
                  Transfer here
                </button>
              </div>
            )}
          </div>

          {/* Like button */}
          {track && (
            <button
              onClick={toggleLike}
              disabled={likeLoading}
              className={cn(
                "p-2 rounded-full transition-all",
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
          )}

          {/* Shuffle */}
          <button
            onClick={toggleShuffle}
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
              onClick={previousTrack}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <SkipBack className="w-4 h-4" fill="currentColor" />
            </button>

            <button
              onClick={togglePlay}
              className="w-11 h-11 rounded-full bg-foreground text-background flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" fill="currentColor" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
              )}
            </button>

            <button
              onClick={nextTrack}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <SkipForward className="w-4 h-4" fill="currentColor" />
            </button>
          </div>

          {/* Repeat */}
          <button
            onClick={cycleRepeatMode}
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
                className="p-2 rounded-full text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mic2 className="w-4 h-4" />
              </Link>
            ) : (
              <button
                disabled
                className="p-2 rounded-full text-muted-foreground/30 cursor-not-allowed"
              >
                <Mic2 className="w-4 h-4" />
              </button>
            )}

            {/* Queue */}
            <QueuePopover triggerClassName="p-2 rounded-full text-muted-foreground hover:text-foreground" />

            {/* Devices */}
            <DevicePopover triggerClassName="p-2 rounded-full text-muted-foreground hover:text-foreground" />
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVolume(state?.volume === 0 ? 0.5 : 0)}
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
              value={[(state?.volume ?? 0.5) * 100]}
              onValueChange={(value) => setVolume(value[0] / 100)}
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
            onValueChange={handleSeek}
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
