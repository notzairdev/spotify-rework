"use client";

import { useState, useEffect } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Heart,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useSpotifyPlayer, useTrackLike } from "@/lib/spotify";
import { useFullscreen } from "@/lib/fullscreen";
import { cn } from "@/lib/utils";
import { extractDominantColor, hslToString, type HSL } from "@/lib/utils/color-extractor";
import { QueuePopover } from "./queue-popover";

/**
 * Compact Dynamic Island for lyrics view
 * Morphs from the main player bar with a liquid glass effect
 * Includes Like + Fullscreen controls on hover
 */
export function DynamicIsland() {
  const [isHovered, setIsHovered] = useState(false);
  const [ambientColor, setAmbientColor] = useState<HSL | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { state, togglePlay, nextTrack, previousTrack } = useSpotifyPlayer();
  const { isLiked, toggleLike } = useTrackLike();
  const { isFullscreen, toggleFullscreen } = useFullscreen();

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

  // Animate in on mount (liquid glass morph effect)
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!track) return null;

  return (
    <div 
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        // Liquid glass morph animation
        "transition-all duration-700 ease-out",
        isVisible 
          ? "opacity-100 scale-100 translate-y-0" 
          : "opacity-0 scale-75 translate-y-8"
      )}
    >
      {/* Ambient glow - more subtle for lyrics view */}
      <div
        className={cn(
          "absolute inset-0 blur-2xl -z-10 scale-125 transition-all duration-700",
          isVisible ? "opacity-40" : "opacity-0"
        )}
        style={{
          background: ambientColor
            ? `radial-gradient(ellipse, hsl(${hslToString(ambientColor)} / 0.5), transparent 70%)`
            : `radial-gradient(ellipse, hsl(var(--primary) / 0.4), transparent 70%)`,
        }}
      />

      {/* Liquid glass container */}
      <div
        className={cn(
          // Base styles - compact pill shape
          "backdrop-blur-xl border rounded-full shadow-2xl shadow-black/50",
          // Liquid glass effect
          "relative overflow-hidden",
          // Hover expansion
          "transition-all duration-500 ease-out",
          isHovered ? "px-5 py-2.5" : "px-4 py-2"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          // Subtle inner glow for glass effect
          boxShadow: ambientColor
            ? `inset 0 1px 1px rgba(255,255,255,0.1), 0 20px 40px -10px hsl(${hslToString(ambientColor)} / 0.3)`
            : "inset 0 1px 1px rgba(255,255,255,0.1), 0 20px 40px -10px rgba(0,0,0,0.5)",
        }}
      >
        {/* Liquid glass shine overlay */}
        <div 
          className="absolute inset-0 pointer-events-none rounded-full"
          style={{ height: "50%" }}
        />
        
        {/* Progress arc around the container */}
        <div 
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `conic-gradient(from 0deg, hsl(var(--primary) / 0.3) ${progress}%, transparent ${progress}%)`,
            mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))",
            WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))",
          }}
        />

        <div
          className={cn(
            "flex items-center relative z-10",
            "transition-all duration-500",
            isHovered ? "gap-3" : "gap-2"
          )}
        >
          {/* Album art - vinyl record effect */}
          <div className="relative">
            <img
              src={albumArt}
              alt={track.name}
              className={cn(
                "rounded-full object-cover shadow-lg border border-white/10",
                "transition-all duration-500",
                isHovered ? "w-10 h-10" : "w-9 h-9",
                isPlaying && "animate-[spin_8s_linear_infinite]"
              )}
            />
            {/* Center dot like a vinyl */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-2 h-2 rounded-full bg-black/50 border border-white/20" />
            </div>
          </div>

          {/* Track info - only on hover */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-500",
              isHovered ? "w-28 opacity-100" : "w-0 opacity-0"
            )}
          >
            <p className="text-xs font-medium text-white truncate">
              {track.name}
            </p>
            <p className="text-[10px] text-white/60 truncate">
              {track.artists.join(", ")}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={previousTrack}
              className="p-1.5 text-white/60 hover:text-white transition-colors"
            >
              <SkipBack className="w-3.5 h-3.5" fill="currentColor" />
            </button>

            <button
              onClick={togglePlay}
              className={cn(
                "rounded-full bg-white text-black flex items-center justify-center",
                "hover:scale-105 active:scale-95 transition-all shadow-lg",
                isHovered ? "w-9 h-9" : "w-8 h-8"
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
              className="p-1.5 text-white/60 hover:text-white transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" fill="currentColor" />
            </button>
          </div>

          {/* Like button - only on hover */}
          <div
            className={cn(
              "transition-all duration-500 overflow-hidden",
              isHovered ? "w-7 opacity-100" : "w-0 opacity-0"
            )}
          >
            <button
              onClick={toggleLike}
              className={cn(
                "p-1.5",
                isLiked
                  ? "text-primary"
                  : "text-white/60 hover:text-white"
              )}
            >
              <Heart
                className="w-3.5 h-3.5"
                fill={isLiked ? "currentColor" : "none"}
              />
            </button>
          </div>

          {/* Fullscreen toggle - only on hover */}
          <div
            className={cn(
              "transition-all duration-500 overflow-hidden",
              isHovered ? "w-7 opacity-100" : "w-0 opacity-0"
            )}
          >
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-white/60 hover:text-white"
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Queue - only on hover */}
          <div
            className={cn(
              "transition-all duration-500 overflow-hidden",
              isHovered ? "opacity-100 w-7" : "opacity-0 w-0"
            )}
          >
            <QueuePopover 
              triggerClassName="p-1.5 text-white/60 hover:text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
