"use client";

import { useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Heart,
} from "lucide-react";
import { useSpotifyPlayer, useTrackLike } from "@/lib/spotify";
import { cn } from "@/lib/utils";
import { extractDominantColor, hslToString, type HSL } from "@/lib/utils/color-extractor";
import { useEffect } from "react";

/**
 * Dynamic Island style player for the lyrics view
 * Floats at the bottom and expands on hover
 */
export function DynamicIsland() {
  const [isHovered, setIsHovered] = useState(false);
  const [ambientColor, setAmbientColor] = useState<HSL | null>(null);
  const { state, togglePlay, nextTrack, previousTrack } = useSpotifyPlayer();
  const { isLiked, toggleLike } = useTrackLike();

  const track = state?.track;
  const albumArt = track?.album.images[0]?.url;
  const isPlaying = state?.isPlaying ?? false;

  // Calculate progress percentage
  const progress =
    state?.position != null && state?.duration != null && state.duration > 0
      ? (state.position / state.duration) * 100
      : 0;

  // Extract color from album art
  useEffect(() => {
    if (!albumArt) {
      setAmbientColor(null);
      return;
    }
    extractDominantColor(albumArt).then((color) => {
      if (color) setAmbientColor(color);
    });
  }, [albumArt]);

  if (!track) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 opacity-50 blur-2xl -z-10 scale-150 transition-all duration-500"
        style={{
          background: ambientColor
            ? `radial-gradient(ellipse, hsl(${hslToString(ambientColor)} / 0.6), transparent 70%)`
            : `radial-gradient(ellipse, hsl(var(--primary) / 0.5), transparent 70%)`,
        }}
      />

      <div
        className={cn(
          "bg-card/90 backdrop-blur-2xl border border-white/[0.08] rounded-full shadow-2xl shadow-black/30",
          "transition-all duration-500 ease-out",
          isHovered ? "px-6 py-3" : "px-4 py-2"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className={cn(
            "flex items-center transition-all duration-500",
            isHovered ? "gap-4" : "gap-3"
          )}
        >
          {/* Album art with progress ring */}
          <div className="relative">
            <img
              src={albumArt}
              alt={track.name}
              className={cn(
                "rounded-full object-cover shadow-lg transition-all duration-500",
                isHovered ? "w-12 h-12" : "w-10 h-10",
                isPlaying && "animate-spin-slow"
              )}
              style={{ animationDuration: "8s" }}
            />
            {/* Progress ring */}
            <svg
              className={cn(
                "absolute inset-0 -rotate-90 transition-all duration-500",
                isHovered ? "w-12 h-12" : "w-10 h-10"
              )}
            >
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                fill="none"
                stroke={
                  ambientColor
                    ? `hsl(${hslToString(ambientColor)} / 0.2)`
                    : "hsl(var(--primary) / 0.2)"
                }
                strokeWidth="2"
              />
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                fill="none"
                stroke={
                  ambientColor
                    ? `hsl(${hslToString(ambientColor)})`
                    : "hsl(var(--primary))"
                }
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={`${progress * 2.83} 283`}
                className="transition-all duration-300"
              />
            </svg>
          </div>

          {/* Track info - only on hover */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-500",
              isHovered ? "w-32 opacity-100" : "w-0 opacity-0"
            )}
          >
            <p className="text-xs font-medium text-foreground truncate">
              {track.name}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {track.artists.join(", ")}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={previousTrack}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <SkipBack className="w-4 h-4" fill="currentColor" />
            </button>

            <button
              onClick={togglePlay}
              className={cn(
                "rounded-full bg-foreground text-background flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg",
                isHovered ? "w-10 h-10" : "w-9 h-9"
              )}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" fill="currentColor" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
              )}
            </button>

            <button
              onClick={nextTrack}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <SkipForward className="w-4 h-4" fill="currentColor" />
            </button>
          </div>

          {/* Like button - only on hover */}
          <button
            onClick={toggleLike}
            className={cn(
              "transition-all duration-500",
              isHovered ? "opacity-100 w-8" : "opacity-0 w-0",
              isLiked
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Heart
              className="w-4 h-4"
              fill={isLiked ? "currentColor" : "none"}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
