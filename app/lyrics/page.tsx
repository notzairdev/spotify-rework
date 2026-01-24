"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Heart, Maximize2, Minimize2, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSpotifyPlayer, useTrackLike } from "@/lib/spotify";
import { useLyricsContext } from "@/lib/lrclib";
import { extractDominantColor, hslToString, type HSL } from "@/lib/utils/color-extractor";

/**
 * Animated interlude dots component
 * Shows 3 dots with progressive opacity based on progress through the interlude
 * Includes entrance animation with scale
 */
function InterludeDots({ progress }: { progress: number }) {
  // Each dot appears progressively as progress increases
  // Dot 1: 0-33%, Dot 2: 33-66%, Dot 3: 66-100%
  const dot1Opacity = Math.min(1, progress * 3);
  const dot2Opacity = Math.min(1, Math.max(0, (progress - 0.33) * 3));
  const dot3Opacity = Math.min(1, Math.max(0, (progress - 0.66) * 3));
  
  // Entrance animation - scale up from 0
  const scale = Math.min(1, progress * 5); // Quick scale up at start
  
  return (
    <div 
      className="flex items-center justify-start py-3 gap-2 origin-left transition-all duration-500"
      style={{ 
        transform: `scale(${scale})`,
        opacity: scale,
      }}
    >
      <span 
        className="text-2xl font-bold text-muted-foreground/50 transition-opacity duration-500"
        style={{ opacity: dot1Opacity }}
      >
        •
      </span>
      <span 
        className="text-2xl font-bold text-muted-foreground/50 transition-opacity duration-500"
        style={{ opacity: dot2Opacity }}
      >
        •
      </span>
      <span 
        className="text-2xl font-bold text-muted-foreground/50 transition-opacity duration-500"
        style={{ opacity: dot3Opacity }}
      >
        •
      </span>
    </div>
  );
}

export default function LyricsPage() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ambientColor, setAmbientColor] = useState<HSL | null>(null);
  const { state, seek } = useSpotifyPlayer();
  const { isLiked, isLoading: isLikeLoading, toggleLike } = useTrackLike();
  const { 
    lyrics, 
    plainLyrics, 
    isLoading, 
    error, 
    isInstrumental, 
    currentLineIndex,
    hasLyrics,
    interludeAfterIndex,
    interludeProgress,
    positionSeconds,
  } = useLyricsContext();
  
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  const track = state?.track;
  const albumArt = track?.album.images[0]?.url;

  // Extract dominant color from album art
  useEffect(() => {
    if (!albumArt) {
      setAmbientColor(null);
      return;
    }

    extractDominantColor(albumArt).then((color) => {
      if (color) {
        setAmbientColor(color);
      }
    });
  }, [albumArt]);

  // Detect if we're in the outro (past last lyric with time remaining)
  const outroState = useMemo(() => {
    if (!lyrics.length || !state?.duration) {
      return { isOutro: false, progress: 0 };
    }

    const lastLyric = lyrics[lyrics.length - 1];
    const durationSeconds = state.duration / 1000;
    const timeAfterLastLyric = positionSeconds - lastLyric.time;
    const remainingTime = durationSeconds - lastLyric.time;

    // Consider it an outro if:
    // 1. We're past the last lyric by at least 5 seconds
    // 2. There's at least 10 seconds after the last lyric before song ends
    if (remainingTime > 10 && timeAfterLastLyric > 5) {
      const outroStart = lastLyric.time + 5;
      const outroEnd = durationSeconds - 2; // End 2 seconds before song ends
      const outroDuration = outroEnd - outroStart;
      const progress = Math.min(1, Math.max(0, (positionSeconds - outroStart) / outroDuration));
      return { isOutro: true, progress };
    }

    return { isOutro: false, progress: 0 };
  }, [lyrics, positionSeconds, state?.duration]);

  // Auto-scroll to current line
  useEffect(() => {
    if (lyrics.length > 0 && lineRefs.current[currentLineIndex]) {
      lineRefs.current[currentLineIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentLineIndex, lyrics.length]);

  // Handle clicking on a lyric line to seek
  const handleLineClick = (index: number) => {
    if (lyrics[index] && state?.duration) {
      const positionMs = lyrics[index].time * 1000;
      seek(positionMs);
    }
  };

  // No track playing
  if (!track) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center">
        <Music className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold text-muted-foreground">No track playing</h2>
        <p className="text-sm text-muted-foreground/70 mt-2">
          Play a song to see its lyrics
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative h-[calc(100vh-5rem)] flex flex-col container mx-auto pt-20",
        isFullscreen && "fixed inset-0 z-50 bg-background h-screen"
      )}
    >
      {/* Ambient Background - tinted with album color */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none transition-all duration-1000"
        style={{
          background: ambientColor
            ? `radial-gradient(ellipse 90% 80% at center top, hsl(${hslToString(ambientColor)} / 0.45), transparent 70%)`
            : `radial-gradient(ellipse at center top, hsl(var(--primary) / 0.3), transparent 60%)`,
          opacity: outroState.isOutro ? 0.4 + outroState.progress * 0.3 : 0.25,
        }}
      />
      
      {/* Secondary ambient glow */}
      {ambientColor && (
        <div
          className="fixed inset-0 -z-10 pointer-events-none transition-all duration-1000"
          style={{
            background: `radial-gradient(ellipse 60% 40% at center bottom, hsl(${hslToString(ambientColor)} / 0.2), transparent 60%)`,
            opacity: outroState.isOutro ? 0.3 + outroState.progress * 0.4 : 0.15,
          }}
        />
      )}
      
      {/* Outro visual effect - pulsing glow that intensifies */}
      {outroState.isOutro && ambientColor && (
        <>
          {/* Central glow burst */}
          <div
            className="fixed inset-0 -z-10 pointer-events-none animate-pulse"
            style={{
              background: `radial-gradient(circle at center, hsl(${hslToString(ambientColor)} / ${0.1 + outroState.progress * 0.2}), transparent 50%)`,
              animation: "pulse 3s ease-in-out infinite",
            }}
          />
          {/* Floating orbs effect */}
          <div 
            className="fixed inset-0 -z-10 pointer-events-none overflow-hidden"
            style={{ opacity: outroState.progress }}
          >
            <div 
              className="absolute w-64 h-64 rounded-full blur-3xl animate-float-slow"
              style={{
                background: `hsl(${hslToString(ambientColor)} / 0.3)`,
                top: '20%',
                left: '10%',
              }}
            />
            <div 
              className="absolute w-48 h-48 rounded-full blur-3xl animate-float-slower"
              style={{
                background: `hsl(${hslToString({ ...ambientColor, h: (ambientColor.h + 30) % 360 })} / 0.25)`,
                bottom: '30%',
                right: '15%',
              }}
            />
            <div 
              className="absolute w-32 h-32 rounded-full blur-2xl animate-float"
              style={{
                background: `hsl(${hslToString({ ...ambientColor, h: (ambientColor.h - 20 + 360) % 360 })} / 0.35)`,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          </div>
        </>
      )}

      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-transparent backdrop-blur-xl border-b border-white/5 px-6 py-4">
        <div className="flex items-center justify-between container mx-auto">
          <div className="flex items-center gap-5">
            {albumArt ? (
              <img
                src={albumArt}
                alt={track.album.name}
                className="w-14 h-14 rounded-xl shadow-lg"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
                <Music className="w-7 h-7 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">
                {track.name}
              </h1>
              <p className="text-sm text-muted-foreground truncate">{track.artists.join(", ")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLike}
              disabled={isLikeLoading}
              className={cn(isLiked && "text-primary")}
            >
              <Heart className="w-5 h-5" fill={isLiked ? "currentColor" : "none"} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Lyrics Content */}
      <div 
        ref={lyricsContainerRef}
        className="flex-1 overflow-y-auto scrollbar-hide px-6 py-8 pb-24"
      >
        <div className={cn("max-w-3xl", isFullscreen && "mx-auto")}>
          {/* Loading state - friendly indicator */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 animate-pulse" />
                <Music className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <h2 className="text-lg font-medium text-muted-foreground mb-2">Buscando letra...</h2>
              <p className="text-sm text-muted-foreground/60">
                Esto puede tomar unos segundos
              </p>
            </div>
          )}

          {/* Instrumental track */}
          {!isLoading && isInstrumental && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Music className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <h2 className="text-xl font-semibold text-muted-foreground">Instrumental</h2>
              <p className="text-sm text-muted-foreground/70 mt-2">
                This track has no lyrics
              </p>
            </div>
          )}

          {/* No lyrics found */}
          {!isLoading && !isInstrumental && !hasLyrics && error && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Music className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <h2 className="text-xl font-semibold text-muted-foreground">No lyrics available</h2>
              <p className="text-sm text-muted-foreground/70 mt-2">
                {error}
              </p>
            </div>
          )}

          {/* Synced lyrics */}
          {!isLoading && lyrics.length > 0 && (
            <div className="space-y-1">
              {/* Interlude indicator at start of song (before first lyric) */}
              {interludeAfterIndex === -1 && interludeProgress !== null && (
                <InterludeDots progress={interludeProgress} />
              )}
              
              {lyrics.map((line, index) => {
                const isCurrent = index === currentLineIndex;
                const isPast = index < currentLineIndex;
                const distance = Math.abs(index - currentLineIndex);
                
                // Check if there's an interlude AFTER this line
                const hasInterludeAfter = interludeAfterIndex === index;
                
                // Skip empty lines (shouldn't happen after filtering, but just in case)
                if (!line.text.trim()) return null;
                
                return (
                  <div key={index}>
                    <p
                      ref={(el) => { lineRefs.current[index] = el; }}
                      className={cn(
                        "text-3xl lg:text-4xl font-bold cursor-pointer py-3 transition-all duration-700 ease-out",
                        "hover:opacity-100 hover:scale-[1.02] origin-left",
                        isCurrent && "text-foreground scale-[1.05] origin-left",
                        isPast && "text-muted-foreground/50",
                        !isCurrent && !isPast && "text-muted-foreground/30"
                      )}
                      style={{
                        opacity: isCurrent ? 1 : Math.max(0.2, 1 - distance * 0.15),
                        transform: isCurrent 
                          ? "scale(1.05) translateX(0)" 
                          : `scale(1) translateX(0)`,
                        filter: isCurrent ? "none" : `blur(${Math.min(distance * 0.3, 1)}px)`,
                        textShadow: isCurrent 
                          ? ambientColor 
                            ? `0 0 30px hsl(${hslToString(ambientColor)} / 0.4)` 
                            : "0 0 30px hsl(var(--primary) / 0.3)" 
                          : "none",
                      }}
                      onClick={() => handleLineClick(index)}
                    >
                      {line.text}
                    </p>
                    
                    {/* Interlude dots between this line and next */}
                    {hasInterludeAfter && interludeProgress !== null && (
                      <InterludeDots progress={interludeProgress} />
                    )}
                  </div>
                );
              })}
              
              {/* Outro indicator - beautiful ending display */}
              {outroState.isOutro && (
                <div 
                  className="flex flex-col items-center justify-center py-16 mt-8 transition-all duration-1000"
                  style={{ opacity: outroState.progress }}
                >
                  <div 
                    className="relative"
                    style={{
                      animation: "float 4s ease-in-out infinite",
                    }}
                  >
                    <div 
                      className="absolute inset-0 blur-2xl rounded-full"
                      style={{
                        background: ambientColor 
                          ? `hsl(${hslToString(ambientColor)} / 0.4)` 
                          : "hsl(var(--primary) / 0.3)",
                        transform: "scale(1.5)",
                      }}
                    />
                    {albumArt && (
                      <img
                        src={albumArt}
                        alt=""
                        className="w-24 h-24 rounded-2xl relative z-10 shadow-2xl"
                        style={{
                          boxShadow: ambientColor 
                            ? `0 20px 60px hsl(${hslToString(ambientColor)} / 0.4)` 
                            : undefined,
                        }}
                      />
                    )}
                  </div>
                  <p 
                    className="mt-8 text-xl font-medium text-muted-foreground/60"
                    style={{
                      animation: "pulse 3s ease-in-out infinite",
                    }}
                  >
                    ♪
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Plain lyrics fallback (no sync) */}
          {!isLoading && lyrics.length === 0 && plainLyrics && (
            <div className="whitespace-pre-wrap text-2xl lg:text-3xl font-medium text-foreground/80 leading-relaxed">
              {plainLyrics}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
