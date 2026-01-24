"use client";

import { useSpotifyPlayer } from "@/lib/spotify";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";

export function PlayerBar() {
  const { isAuthenticated, isPremium } = useAuth();
  const {
    state,
    isReady,
    error,
    togglePlay,
    nextTrack,
    previousTrack,
    setVolume,
    transferPlayback,
  } = useSpotifyPlayer();

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Premium required message
  if (!isPremium) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-card border-t flex items-center justify-center">
        <p className="text-muted-foreground">Spotify Premium required for playback</p>
      </div>
    );
  }

  // Error state
  if (error) {
    const isEMEError = error.includes("DRM") || error.includes("Widevine");
    return (
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-card border-t flex items-center justify-center px-4">
        <div className="text-center">
          <p className={isEMEError ? "text-muted-foreground" : "text-destructive"}>
            {isEMEError 
              ? "Playback not available on this platform" 
              : error}
          </p>
          {isEMEError && (
            <p className="text-xs text-muted-foreground mt-1">
              Use Spotify Connect from your phone or the official app to control playback
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
        <span className="ml-2 text-muted-foreground">Connecting to Spotify...</span>
      </div>
    );
  }

  const track = state?.track;
  const albumArt = track?.album.images[0]?.url;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-card border-t flex items-center px-4">
      {/* Track Info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {albumArt ? (
          <img
            src={albumArt}
            alt={track?.album.name}
            className="h-14 w-14 rounded shadow-sm"
          />
        ) : (
          <div className="h-14 w-14 rounded bg-muted flex items-center justify-center">
            <Volume2 className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        {track ? (
          <div className="min-w-0">
            <p className="font-medium truncate">{track.name}</p>
            <p className="text-sm text-muted-foreground truncate">
              {track.artists.join(", ")}
            </p>
          </div>
        ) : (
          <div className="min-w-0">
            <p className="text-muted-foreground">No track playing</p>
            <button
              onClick={transferPlayback}
              className="text-sm text-primary hover:underline"
            >
              Transfer playback here
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={previousTrack}>
          <SkipBack className="h-5 w-5" />
        </Button>
        <Button
          variant="default"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={togglePlay}
        >
          {state?.isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </Button>
        <Button variant="ghost" size="icon" onClick={nextTrack}>
          <SkipForward className="h-5 w-5" />
        </Button>
      </div>

      {/* Progress (simplified) */}
      <div className="flex-1 flex items-center justify-end gap-2">
        {state && (
          <>
            <span className="text-xs text-muted-foreground">
              {formatTime(state.position)}
            </span>
            <div className="w-24 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${(state.position / state.duration) * 100}%`,
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {formatTime(state.duration)}
            </span>
          </>
        )}
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
