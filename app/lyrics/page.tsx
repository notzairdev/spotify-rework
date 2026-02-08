"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Music, SkipForward } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { useSpotifyPlayer, useQueue } from "@/lib/spotify";
import { useLyricsContext } from "@/lib/lrclib";
import { useFullscreen } from "@/lib/fullscreen";
import {
  extractDominantColor,
  hslToString,
  type HSL,
} from "@/lib/utils/color-extractor";
import { DynamicIsland } from "@/components/player";

// ---------------------------------------------------------------------------
// Interlude – breathing bars (FIXED HEIGHT so it doesn't shift lyrics)
// ---------------------------------------------------------------------------
function InterludeBreath({ progress }: { progress: number }) {
  const entrance = Math.min(1, progress * 3);
  const breath = Math.sin(progress * Math.PI * 6) * 0.5 + 0.5;

  return (
    <div
      className="flex items-center h-10 pl-1"
      style={{
        opacity: entrance,
        transition: "opacity 0.8s ease",
      }}
    >
      <div className="flex items-center gap-1.5">
        {[0, 0.25, 0.5].map((offset, i) => {
          const t = Math.sin(progress * Math.PI * 5 + offset * Math.PI * 2);
          const height = 6 + t * 10;
          return (
            <div
              key={i}
              className="rounded-full bg-white/50"
              style={{
                width: 4,
                height,
                opacity: 0.4 + breath * 0.4 + i * 0.1,
                transition:
                  "height 0.4s cubic-bezier(.4,0,.2,1), opacity 0.4s ease",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function LyricsPage() {
  const { isFullscreen, setFullscreen } = useFullscreen();
  const [ambientColor, setAmbientColor] = useState<HSL | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [outroFadeOut, setOutroFadeOut] = useState(false);
  const prevTrackIdRef = useRef<string | null>(null);
  const prevPositionRef = useRef<number>(0);
  const prevLineRef = useRef<number>(-1);
  const { state, seek } = useSpotifyPlayer();
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
  const trackId = track?.id;

  // Format time helper
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Progress percentage
  const progress =
    state?.position != null && state?.duration != null && state.duration > 0
      ? (state.position / state.duration) * 100
      : 0;

  // Queue for "Up Next" in outro — refetch on every track change
  const { data: queueData, refetch: refetchQueue } = useQueue({
    enabled: !!track,
  });
  const nextTrack = queueData?.queue?.[0];

  // Refetch queue whenever trackId changes (covers skip-forward AND skip-backward)
  useEffect(() => {
    if (trackId) {
      refetchQueue();
    }
  }, [trackId, refetchQueue]);

  // Reset fullscreen on unmount
  useEffect(() => {
    return () => {
      setFullscreen(false);
    };
  }, [setFullscreen]);

  // ---- Outro detection ----
  const outroState = useMemo(() => {
    if (!lyrics.length || !state?.duration)
      return { isOutro: false, progress: 0 };

    const lastLyric = lyrics[lyrics.length - 1];
    const durationSeconds = state.duration / 1000;
    const timeAfterLastLyric = positionSeconds - lastLyric.time;
    const remainingTime = durationSeconds - lastLyric.time;

    if (remainingTime > 10 && timeAfterLastLyric > 5) {
      const outroStart = lastLyric.time + 5;
      const outroEnd = durationSeconds - 2;
      const p = Math.min(
        1,
        Math.max(0, (positionSeconds - outroStart) / (outroEnd - outroStart))
      );
      return { isOutro: true, progress: p };
    }
    return { isOutro: false, progress: 0 };
  }, [lyrics, positionSeconds, state?.duration]);

  const showOutroVisuals = outroState.isOutro && !outroFadeOut;

  // ---- Extract dominant color ----
  useEffect(() => {
    if (!albumArt) {
      setAmbientColor(null);
      return;
    }
    extractDominantColor(albumArt).then((c) => c && setAmbientColor(c));
  }, [albumArt]);

  // ---- Track change → reset scroll + outro ----
  useEffect(() => {
    if (
      trackId &&
      prevTrackIdRef.current &&
      trackId !== prevTrackIdRef.current
    ) {
      setOutroFadeOut(true);
      setUserInteracted(false);
      setTimeout(() => setOutroFadeOut(false), 500);

      if (lyricsContainerRef.current) {
        lyricsContainerRef.current.scrollTo({ top: 0, behavior: "instant" });
      }
    }
    prevTrackIdRef.current = trackId ?? null;
  }, [trackId]);

  // ---- Reset scroll when song restarts (position jumps back significantly) ----
  useEffect(() => {
    const jumped = prevPositionRef.current - positionSeconds;
    if (jumped > 3) {
      // Also refetch queue since the user rewound
      refetchQueue();

      if (currentLineIndex <= 0 && lyricsContainerRef.current) {
        lyricsContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      } else if (lineRefs.current[currentLineIndex]) {
        lineRefs.current[currentLineIndex]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
    prevPositionRef.current = positionSeconds;
  }, [positionSeconds, currentLineIndex, refetchQueue]);

  // Seek back during outro → fade out overlay
  useEffect(() => {
    if (outroState.isOutro && positionSeconds < prevPositionRef.current - 2) {
      setOutroFadeOut(true);
      setTimeout(() => setOutroFadeOut(false), 500);
    }
  }, [positionSeconds, outroState.isOutro]);

  useEffect(() => {
    if (!outroState.isOutro) setUserInteracted(false);
  }, [outroState.isOutro]);

  const handleUserInteraction = useCallback(() => {
    if (outroState.isOutro && !userInteracted) setUserInteracted(true);
  }, [outroState.isOutro, userInteracted]);

  // ---- Auto-scroll to current line ----
  useEffect(() => {
    if (
      lyrics.length > 0 &&
      currentLineIndex >= 0 &&
      lineRefs.current[currentLineIndex]
    ) {
      lineRefs.current[currentLineIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
    prevLineRef.current = currentLineIndex;
  }, [currentLineIndex, lyrics.length]);

  // ---- Seek on click ----
  const handleLineClick = (index: number) => {
    if (lyrics[index] && state?.duration) seek(lyrics[index].time * 1000);
  };

  // Ambient CSS colour helpers
  const acAlpha = (a: number) =>
    ambientColor
      ? `hsl(${hslToString(ambientColor)} / ${a})`
      : `hsl(var(--primary) / ${a})`;
  const acSolid = ambientColor
    ? `hsl(${hslToString(ambientColor)})`
    : `hsl(var(--primary))`;

  // ------- No track -------
  if (!track) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center">
        <Music className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold text-muted-foreground">
          No track playing
        </h2>
        <p className="text-sm text-muted-foreground/70 mt-2">
          Play a song to see its lyrics
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative h-screen flex overflow-hidden",
        isFullscreen && "fixed inset-0 z-60"
      )}
      onClick={handleUserInteraction}
    >
      {/* ==============================================================
          BACKGROUND – Slowly rotating blurred album art + liquify blobs
      ============================================================== */}
      <div className="absolute inset-0 -z-20 pointer-events-none overflow-hidden">
        {/* Base blurred album art — ROTATING */}
        {albumArt && (
          <img
            key={trackId}
            src={albumArt}
            alt=""
            className="absolute -inset-20 w-[calc(100%+160px)] h-[calc(100%+160px)] object-cover animate-slow-rotate"
            style={{
              filter: "blur(90px) saturate(1.8) brightness(0.3)",
              opacity: 0.85,
            }}
          />
        )}
        <div className="absolute inset-0 bg-black/40" />

        {/* Floating liquify blobs */}
        {albumArt && (
          <>
            <div
              className="absolute rounded-full pointer-events-none animate-float-slow"
              style={{
                width: 380,
                height: 380,
                left: "5%",
                top: "10%",
                background: acAlpha(0.3),
                filter: "blur(120px)",
              }}
            />
            <div
              className="absolute rounded-full pointer-events-none animate-float-slower"
              style={{
                width: 300,
                height: 300,
                right: "10%",
                bottom: "15%",
                background: acAlpha(0.25),
                filter: "blur(100px)",
              }}
            />
            <div
              className="absolute rounded-full pointer-events-none animate-float"
              style={{
                width: 220,
                height: 220,
                left: "40%",
                top: "60%",
                background: acAlpha(0.2),
                filter: "blur(90px)",
              }}
            />
            <div
              className="absolute rounded-full pointer-events-none animate-float-slow"
              style={{
                width: 260,
                height: 260,
                right: "25%",
                top: "5%",
                background: acAlpha(0.18),
                filter: "blur(110px)",
                animationDelay: "2s",
              }}
            />
            <div
              className="absolute rounded-full pointer-events-none animate-float-slower"
              style={{
                width: 200,
                height: 200,
                left: "60%",
                top: "35%",
                background: acAlpha(0.15),
                filter: "blur(80px)",
                animationDelay: "4s",
              }}
            />
          </>
        )}
      </div>

      {/* ==============================================================
          LEFT PANEL – Album art + track info
          During OUTRO → expands to full width via Framer Motion
      ============================================================== */}
      <motion.div
        className="hidden lg:flex flex-col items-center justify-center shrink-0 px-10 relative z-10"
        animate={{
          width: showOutroVisuals ? "100%" : "33.333%",
        }}
        transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
      >
        {/* Album cover with ambient glow */}
        <motion.div
          className="relative mb-6"
          animate={{
            scale: showOutroVisuals ? 1.05 : 1,
          }}
          transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
        >
          <div
            className="absolute -inset-8 rounded-full opacity-40 blur-3xl pointer-events-none"
            style={{ background: acSolid }}
          />
          {albumArt ? (
            <img
              src={albumArt}
              alt={track.album.name}
              className="relative w-100 h-100 rounded-2xl shadow-2xl shadow-black/60 object-cover"
            />
          ) : (
            <div className="relative w-100 h-100 rounded-2xl bg-white/10 flex items-center justify-center shadow-2xl">
              <Music className="w-20 h-20 text-white/20" />
            </div>
          )}
        </motion.div>

        {/* Track info — better presentation */}
        <div className="w-64 space-y-3">
          {/* Title */}
          <div className="text-center">
            <h1 className="text-xl font-bold text-white truncate leading-snug">
              {track.name}
            </h1>
            <p className="text-sm text-white/55 truncate mt-1">
              {track.artists.join(", ")}
            </p>
          </div>

          {/* Progress bar */}
          <div>
            <div className="w-full h-0.75 rounded-full bg-white/12 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 ease-linear"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${acAlpha(0.8)}, white)`,
                }}
              />
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-white/40 font-medium tabular-nums">
              <span>{formatTime(state?.position ?? 0)}</span>
              <span>
                -{formatTime((state?.duration ?? 0) - (state?.position ?? 0))}
              </span>
            </div>
          </div>

          {/* Album name pill */}
          <div className="flex justify-center">
            <span className="text-[11px] text-white/35 bg-white/5 rounded-full px-3 py-1 truncate max-w-full">
              {track.album.name}
            </span>
          </div>
        </div>

        {/* ---- "Up Next" card overlaid on expanded left panel during outro ---- */}
        <AnimatePresence>
          {showOutroVisuals && nextTrack && (
            <motion.div
              className="absolute bottom-32 left-1/2 w-full max-w-sm px-6"
              initial={{ opacity: 0, y: 30, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 20, x: "-50%" }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/8 backdrop-blur-2xl border border-white/10">
                {nextTrack.album.images[0]?.url && (
                  <img
                    src={nextTrack.album.images[0].url}
                    alt=""
                    className="w-14 h-14 rounded-xl shadow-lg"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-widest text-white/45 mb-0.5 flex items-center gap-1.5">
                    <SkipForward className="w-3 h-3" />
                    Next
                  </p>
                  <p className="font-semibold text-white truncate text-sm">
                    {nextTrack.name}
                  </p>
                  <p className="text-xs text-white/55 truncate">
                    {nextTrack.artists
                      .map((a: { name: string }) => a.name)
                      .join(", ")}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {showOutroVisuals && !nextTrack && outroState.progress > 0.5 && (
            <motion.p
              className="absolute bottom-24 text-sm text-white/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              End of queue
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ==============================================================
          RIGHT PANEL – Lyrics (fades out during outro as left expands)
      ============================================================== */}
      <motion.div
        ref={lyricsContainerRef}
        className="flex-1 overflow-y-auto scrollbar-hide relative"
        animate={{
          opacity: showOutroVisuals && !userInteracted ? 0 : 1,
        }}
        transition={{ duration: 0.6 }}
        style={{
          pointerEvents:
            showOutroVisuals && !userInteracted ? "none" : "auto",
        }}
      >
        {/* Mobile-only: compact track info bar at top */}
        <div className="lg:hidden sticky top-0 z-20 px-6 py-3 bg-black/30 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-3">
            {albumArt && (
              <img
                src={albumArt}
                alt=""
                className="w-10 h-10 rounded-lg shadow-md"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">
                {track.name}
              </p>
              <p className="text-xs text-white/50 truncate">
                {track.artists.join(", ")}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 lg:px-14 py-[35vh] pb-[50vh]">
          <div className="max-w-3xl xl:max-w-5xl">
            {/* Loading */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-full bg-white/10 animate-pulse" />
                  <Music className="w-8 h-8 text-white/80 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-sm text-white/50">Fetching lyrics…</p>
              </div>
            )}

            {/* Instrumental */}
            {!isLoading && isInstrumental && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <Music className="w-16 h-16 text-white/20 mb-4" />
                <h2 className="text-xl font-semibold text-white/60">
                  Instrumental
                </h2>
                <p className="text-sm text-white/40 mt-2">
                  This track has no lyrics
                </p>
              </div>
            )}

            {/* No lyrics */}
            {!isLoading && !isInstrumental && !hasLyrics && error && (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <Music className="w-16 h-16 text-white/20 mb-4" />
                <h2 className="text-xl font-semibold text-white/60">
                  No lyrics available
                </h2>
                <p className="text-sm text-white/40 mt-2">{error}</p>
              </div>
            )}

            {/* ---- Synced lyrics ---- */}
            {!isLoading && lyrics.length > 0 && (
              <div>
                {interludeAfterIndex === -1 && interludeProgress !== null && (
                  <InterludeBreath progress={interludeProgress} />
                )}

                {lyrics.map((line, index) => {
                  const isCurrent = index === currentLineIndex;
                  const isPast = index < currentLineIndex;
                  const distance = Math.abs(index - currentLineIndex);
                  const hasInterludeAfter = interludeAfterIndex === index;

                  if (!line.text.trim()) return null;

                  const blurPx = isCurrent ? 0 : Math.min(distance * 2, 7);
                  const lineOpacity = isCurrent
                    ? 1
                    : isPast
                      ? Math.max(0.06, 0.35 - (distance - 1) * 0.12)
                      : Math.max(0.06, 0.4 - (distance - 1) * 0.12);

                  const cascadeDelay = Math.min(distance * 40, 200);

                  return (
                    <div key={index}>
                      <p
                        ref={(el) => {
                          lineRefs.current[index] = el;
                        }}
                        className={cn(
                          "text-[2rem] sm:text-[2.2rem] lg:text-[2.4rem] xl:text-[2.8rem] font-bold leading-[1.2] cursor-pointer py-4 origin-left select-none",
                          isCurrent && "text-white",
                          isPast && "text-white/30",
                          !isCurrent && !isPast && "text-white/25"
                        )}
                        style={{
                          opacity: lineOpacity,
                          filter: `blur(${blurPx}px)`,
                          transition: `opacity 450ms cubic-bezier(.25,.1,.25,1) ${cascadeDelay}ms, filter 450ms cubic-bezier(.25,.1,.25,1) ${cascadeDelay}ms, color 350ms ease ${cascadeDelay}ms`,
                        }}
                        onClick={() => handleLineClick(index)}
                      >
                        {line.text}
                      </p>

                      {hasInterludeAfter && interludeProgress !== null && (
                        <InterludeBreath progress={interludeProgress} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Plain lyrics fallback */}
            {!isLoading && lyrics.length === 0 && plainLyrics && (
              <div className="whitespace-pre-wrap text-2xl lg:text-3xl font-normal text-white/60 leading-relaxed">
                {plainLyrics}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Dynamic Island Player */}
      <DynamicIsland />
    </div>
  );
}
