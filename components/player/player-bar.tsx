"use client";

import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Mic2,
  ListMusic,
  MonitorSpeaker,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  Volume1,
  VolumeX,
} from "lucide-react";
import { useSpotifyPlayer } from "@/lib/spotify";
import { useAuth } from "@/lib/auth";
import { useLyricsContext } from "@/lib/lrclib";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Slider } from "@/components/ui/slider";

export function PlayerBar() {
  const { isAuthenticated, isPremium } = useAuth();
  const { lyricsAvailable, isLoading: lyricsLoading } = useLyricsContext();
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

  // Calculate current progress percentage
  const currentProgress =
    state?.position != null && state?.duration != null && state.duration > 0
      ? (state.position / state.duration) * 100
      : 0;

  const handleSeek = (percentage: number) => {
    if (state?.duration) {
      const positionMs = (percentage / 100) * state.duration;
      seek(positionMs);
    }
  };

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Premium required message
  if (!isPremium) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-card border-t flex items-center justify-center">
        <p className="text-muted-foreground">
          Spotify Premium required for playback
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    const isEMEError = error.includes("DRM") || error.includes("Widevine");
    return (
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-card border-t flex items-center justify-center px-4">
        <div className="text-center">
          <p
            className={
              isEMEError ? "text-muted-foreground" : "text-destructive"
            }
          >
            {isEMEError ? "Playback not available on this platform" : error}
          </p>
          {isEMEError && (
            <p className="text-xs text-muted-foreground mt-1">
              Use Spotify Connect from your phone or the official app to control
              playback
            </p>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  if (!isReady) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-card border-t flex items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="ml-2 text-muted-foreground">
          Connecting to Spotify...
        </span>
      </div>
    );
  }

  const track = state?.track;
  const albumArt = track?.album.images[0]?.url;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-18 border-t flex flex-col bg-card/80">
      <div className="relative h-3 -mt-1.5 group cursor-pointer w-full flex items-center">
        <div className="absolute left-0 right-0 h-1 top-1/2 -translate-y-1/2">
          <div className="absolute inset-0 bg-white/4" />
          <div
            className="absolute left-0 top-0 h-full bg-linear-to-r from-primary to-primary/70 transition-all duration-150"
            style={{ width: `${currentProgress}%` }}
          />
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={currentProgress}
          onChange={(e) => handleSeek(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        {/* Hover thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-lg shadow-primary/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ left: `${currentProgress}%`, marginLeft: "-6px" }}
        />
      </div>
      <div className="h-18 px-5 flex items-center gap-6">
        {/* Track Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {albumArt ? (
            <img
              src={albumArt}
              alt={track?.album.name}
              className="h-12 w-12 rounded-full shadow-sm"
            />
          ) : null}
          {track ? (
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground hover:underline decoration-foreground/30 truncate block leading-tight">
                {track.name}
              </p>
              <p className="text-[11px] text-muted-foreground hover:text-foreground truncate block transition-colors leading-tight mt-0.5">
                {track.artists.join(", ")}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] font-mono text-muted-foreground/70">
                  {formatTime(state?.position ?? 0)}
                </span>
                <span className="text-[10px] text-muted-foreground/40">/</span>
                <span className="text-[10px] font-mono text-muted-foreground/50">
                  {formatTime(state?.duration ?? 0)}
                </span>
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-muted-foreground text-[13px]">
                Currently no track playing
              </p>
              <button
                onClick={transferPlayback}
                className="text-[10px] text-primary hover:underline"
              >
                Transfer playback here
              </button>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleShuffle}
            className={state?.shuffle ? "text-primary" : ""}
          >
            <Shuffle className={`h-5 w-5 ${state?.shuffle ? "text-primary" : "text-white"}`} />
          </Button>
          <Button variant="ghost" size="icon" onClick={previousTrack}>
            <SkipBack className="h-5 w-5 text-white" fill="#fff" />
          </Button>
          <Button
            variant="default"
            size="icon"
            className="h-10 w-10 rounded-full bg-white"
            onClick={togglePlay}
          >
            {state?.isPlaying ? (
              <Pause className="h-5 w-5 text-black" fill="#000" />
            ) : (
              <Play className="h-5 w-5 ml-0.5 text-black" fill="#000" />
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={nextTrack}>
            <SkipForward className="h-5 w-5 text-white" fill="#fff" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={cycleRepeatMode}
            className={state?.repeatMode !== "off" ? "text-primary" : ""}
          >
            {state?.repeatMode === "track" ? (
              <Repeat1 className="h-5 w-5 text-primary" />
            ) : (
              <Repeat className={`h-5 w-5 ${state?.repeatMode === "context" ? "text-primary" : "text-white"}`} />
            )}
          </Button>
        </div>

        {/* Progress (simplified) */}
        <div className="flex items-center gap-1 flex-1 justify-end">
          {state && (
            <>
              {lyricsAvailable ? (
                <Link
                  href="/lyrics"
                  className="p-2.5 rounded-full text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  <Mic2 className="w-4 h-4" />
                </Link>
              ) : (
                <button
                  disabled
                  className="p-2.5 rounded-full text-muted-foreground/20 cursor-not-allowed"
                >
                  <Mic2 className="w-4 h-4" />
                </button>
              )}
              {/* Queue */}
              <button className="p-2.5 rounded-full text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                <ListMusic className="w-4 h-4" />
              </button>

              {/* Devices */}
              <button className="p-2.5 rounded-full text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                <MonitorSpeaker className="w-4 h-4" />
              </button>

              {/* Divider */}
              <div className="w-px h-5 bg-white/6 mx-2" />

              <div className="flex items-center gap-2 group">
                <button className="p-2.5 rounded-full text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                  {state.volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : state.volume < 0.5 ? (
                    <Volume1 className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <div className="w-24">
                  <Slider 
                    value={[state.volume * 100]}
                    onValueChange={(value) => setVolume(value[0] / 100)}
                    max={100}
                    step={1}
                    className="opacity-60 hover:opacity-100 transition-opacity"
                    trackClassName="data-horizontal:h-1"
                    rangeClassName="data-horizontal:h-1"
                    thumbClassName="size-3 rounded-full"
                  />
                </div>
              </div>
            </>
          )}
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
