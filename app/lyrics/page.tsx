"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Music, SkipForward } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { useSpotifyPlayer, useQueue } from "@/lib/spotify";
import { keySyncedLyrics, useLyricsContext } from "@/lib/lrclib";
import { useFullscreen } from "@/lib/fullscreen";
import { Slider } from "@/components/ui/slider";
import {
  extractDominantColor,
  hslToString,
  type HSL,
} from "@/lib/utils/color-extractor";
import { DynamicIsland } from "@/components/player";
import { useTrackCredits } from "@/lib/music-data";

// ---------------------------------------------------------------------------
// Interlude – three bouncing dots (bigger)
// ---------------------------------------------------------------------------
function InterludeDots({ progress }: { progress: number }) {
  const entrance = Math.min(1, progress * 3);

  return (
    <motion.div
      className="flex items-center h-14 pl-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: entrance }}
      transition={{ duration: 0.6 }}
    >
      <div className="flex items-center gap-2.5">
        {[0, 0.33, 0.66].map((offset) => (
          <motion.div
            key={offset}
            className="rounded-full bg-white/60"
            style={{ width: 10, height: 10 }}
            animate={{
              y: [0, -10, 0],
              opacity: [0.4, 0.9, 0.4],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: offset,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

function formatTime(ms: number) {
  const secondsTotal = Math.floor(ms / 1000);
  const minutes = Math.floor(secondsTotal / 60);
  const seconds = secondsTotal % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Marquee – auto-scrolling text when it overflows
// ---------------------------------------------------------------------------
function MarqueeText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  // Inject keyframe once
  useEffect(() => {
    if (document.getElementById("marquee-keyframe")) return;
    const style = document.createElement("style");
    style.id = "marquee-keyframe";
    style.textContent = `
      @keyframes marquee-scroll {
        0%, 20% { transform: translateX(0); }
        80%, 100% { transform: translateX(var(--marquee-distance)); }
      }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const measure = () => {
      const diff = text.scrollWidth - container.clientWidth;
      setOverflow(diff > 2 ? diff : 0);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div
      ref={containerRef}
      className={cn("overflow-hidden whitespace-nowrap", className)}
      style={
        overflow > 0
          ? {
              maskImage:
                "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            }
          : undefined
      }
    >
      <span
        ref={textRef}
        className="inline-block"
        style={
          overflow > 0
            ? ({
                animation: `marquee-scroll ${Math.max(3, overflow * 0.04)}s ease-in-out infinite alternate`,
                "--marquee-distance": `-${overflow}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {children}
      </span>
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

  // ---- User scroll detection state ----
  const [userScrolling, setUserScrolling] = useState(false);
  const isProgrammaticScroll = useRef(false);
  const scrollCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const keyedLyrics = keySyncedLyrics(lyrics);

  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  const track = state?.track;
  const albumArt = track?.album.images[0]?.url;
  const trackId = track?.id;
  const { data: trackCredits } = useTrackCredits(trackId ?? null);

  // Scroll a line to ~38% from the top of the container (optical center)
  const scrollToLine = useCallback(
    (lineIndex: number, behavior: ScrollBehavior = "smooth") => {
      const container = lyricsContainerRef.current;
      const el = lineRefs.current[lineIndex];
      if (!container || !el) return;

      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      // Target: place the line at 38% from the top of the visible container
      const targetOffset = containerRect.height * 0.42;
      const elTopInContainer = elRect.top - containerRect.top + container.scrollTop;
      const scrollTarget = elTopInContainer - targetOffset;

      container.scrollTo({ top: scrollTarget, behavior });
    },
    [],
  );

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

  // ---- User scroll detection ----
  useEffect(() => {
    const container = lyricsContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Ignore programmatic scrolls (triggered by auto-scroll)
      if (isProgrammaticScroll.current) return;

      // User is actively scrolling
      setUserScrolling(true);

      // Clear existing cooldown
      if (scrollCooldownRef.current) {
        clearTimeout(scrollCooldownRef.current);
      }

      // Set 2-second cooldown to resume auto-scroll
      scrollCooldownRef.current = setTimeout(() => {
        setUserScrolling(false);
      }, 2000);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollCooldownRef.current) {
        clearTimeout(scrollCooldownRef.current);
      }
    };
  }, [userInteracted]);

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
        Math.max(0, (positionSeconds - outroStart) / (outroEnd - outroStart)),
      );
      return { isOutro: true, progress: p };
    }
    return { isOutro: false, progress: 0 };
  }, [lyrics, positionSeconds, state?.duration]);

  const showOutroVisuals =
    outroState.isOutro && !outroFadeOut && !userInteracted;

  // ---- Extract dominant color ----
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

  // ---- Track change → reset scroll + outro ----
  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    let scrollFrame: number | null = null;
    if (
      trackId &&
      prevTrackIdRef.current &&
      trackId !== prevTrackIdRef.current
    ) {
      setOutroFadeOut(true);
      setUserInteracted(false);
      setUserScrolling(false);
      fadeTimer = setTimeout(() => setOutroFadeOut(false), 500);

      isProgrammaticScroll.current = true;
      if (lyricsContainerRef.current) {
        lyricsContainerRef.current.scrollTo({ top: 0, behavior: "instant" });
      }
      scrollFrame = requestAnimationFrame(() => {
        isProgrammaticScroll.current = false;
      });
    }
    prevTrackIdRef.current = trackId ?? null;

    return () => {
      if (fadeTimer) clearTimeout(fadeTimer);
      if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
    };
  }, [trackId]);

  // ---- Reset scroll when song restarts (position jumps back significantly) ----
  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const jumped = prevPositionRef.current - positionSeconds;
    if (jumped > 3) {
      refetchQueue();

      isProgrammaticScroll.current = true;
      if (currentLineIndex <= 0 && lyricsContainerRef.current) {
        lyricsContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      } else if (lineRefs.current[currentLineIndex]) {
        scrollToLine(currentLineIndex, "smooth");
      }
      scrollTimer = setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 600);
    }
    prevPositionRef.current = positionSeconds;

    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [positionSeconds, currentLineIndex, refetchQueue, scrollToLine]);

  // Seek back during outro → fade out overlay
  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    if (outroState.isOutro && positionSeconds < prevPositionRef.current - 2) {
      setOutroFadeOut(true);
      fadeTimer = setTimeout(() => setOutroFadeOut(false), 500);
    }

    return () => {
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [positionSeconds, outroState.isOutro]);

  useEffect(() => {
    if (outroState.isOutro) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setUserInteracted(false);
    });
    return () => {
      cancelled = true;
    };
  }, [outroState.isOutro]);

  const handleUserInteraction = useCallback(() => {
    if (outroState.isOutro && !userInteracted) setUserInteracted(true);
  }, [outroState.isOutro, userInteracted]);

  // ---- Auto-scroll to current line (paused when user is scrolling) ----
  useEffect(() => {
    if (userScrolling) return; // user is scrolling — don't auto-scroll

    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    if (
      lyrics.length > 0 &&
      currentLineIndex >= 0 &&
      lineRefs.current[currentLineIndex]
    ) {
      isProgrammaticScroll.current = true;
      scrollToLine(currentLineIndex, "smooth");
      // Clear programmatic flag after scroll settles
      scrollTimer = setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 600);
    }
    prevLineRef.current = currentLineIndex;

    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [currentLineIndex, lyrics.length, userScrolling, scrollToLine]);

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
        isFullscreen && "fixed inset-0 z-60",
      )}
      onPointerDown={handleUserInteraction}
    >
      {/* ==============================================================
          BACKGROUND – Slowly rotating blurred album art + liquify blobs
      ============================================================== */}
      <div className="absolute inset-0 -z-20 pointer-events-none overflow-hidden">
        {/* Base blurred album art — ROTATING */}
        {albumArt && (
          <motion.img
            key={trackId}
            src={albumArt}
            alt=""
            className="absolute -inset-20 w-[calc(100%+160px)] h-[calc(100%+160px)] object-cover animate-slow-rotate"
            initial={{ opacity: 0, scale: 1.4 }}
            animate={{ opacity: 0.85, scale: 1.3 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{
              filter: "blur(90px) saturate(1.8) brightness(0.3)",
            }}
          />
        )}
        <div className="absolute inset-0 bg-black/40" />

        {/* Floating liquify blobs */}
        {albumArt && (
          <>
            <motion.div
              className="absolute rounded-full pointer-events-none animate-float-slow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 2, delay: 0.3 }}
              style={{
                width: 380,
                height: 380,
                left: "5%",
                top: "10%",
                background: acAlpha(0.3),
                filter: "blur(120px)",
              }}
            />
            <motion.div
              className="absolute rounded-full pointer-events-none animate-float-slower"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 2, delay: 0.6 }}
              style={{
                width: 300,
                height: 300,
                right: "10%",
                bottom: "15%",
                background: acAlpha(0.25),
                filter: "blur(100px)",
              }}
            />
            <motion.div
              className="absolute rounded-full pointer-events-none animate-float"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 2, delay: 0.9 }}
              style={{
                width: 220,
                height: 220,
                left: "40%",
                top: "60%",
                background: acAlpha(0.2),
                filter: "blur(90px)",
              }}
            />
            <motion.div
              className="absolute rounded-full pointer-events-none animate-float-slow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 2, delay: 1.2 }}
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
            <motion.div
              className="absolute rounded-full pointer-events-none animate-float-slower"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 2, delay: 1.5 }}
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
          <motion.div
            className="absolute -inset-8 rounded-full blur-3xl pointer-events-none"
            animate={{ opacity: 0.4 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            style={{ background: acSolid }}
          />
          {albumArt ? (
            <motion.img
              key={`cover-${trackId}`}
              src={albumArt}
              alt={track.album.name}
              className="relative w-100 h-100 rounded-2xl shadow-2xl shadow-black/60 object-cover"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
            />
          ) : (
            <div className="relative w-100 h-100 rounded-2xl bg-white/10 flex items-center justify-center shadow-2xl">
              <Music className="w-20 h-20 text-white/20" />
            </div>
          )}
        </motion.div>

        {/* Track info */}
        <motion.div
          key={`info-${trackId}`}
          className="w-64 space-y-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        >
          <div className="text-center">
            <MarqueeText className="text-xl font-bold text-white leading-snug">
              {track.name}
            </MarqueeText>
            <p className="text-sm text-white/55 truncate mt-1">
              {track.artists.join(", ")}
            </p>
          </div>

          <div>
            <Slider
              value={[progress]}
              onValueChange={(value) => {
                if (state?.duration) {
                  seek((value[0] / 100) * state.duration);
                }
              }}
              max={100}
              step={0.1}
              className="w-full"
              trackClassName="data-horizontal:h-1 bg-white/12 rounded-full"
              rangeClassName="data-horizontal:h-1 bg-white/80"
              thumbClassName="size-2.5 rounded-full opacity-0 hover:opacity-100 transition-opacity border-none"
            />
            <div className="flex justify-between mt-1 text-[10px] text-white/40 font-medium tabular-nums">
              <span>{formatTime(state?.position ?? 0)}</span>
              <span>
                -{formatTime((state?.duration ?? 0) - (state?.position ?? 0))}
              </span>
            </div>
          </div>

          <div className="flex justify-center">
            <span className="text-[11px] text-white/35 bg-white/5 rounded-full px-3 py-1 truncate max-w-full">
              Listening to: {track.album.name.toUpperCase()}
            </span>
          </div>
        </motion.div>

        {/* ---- "Up Next" card overlaid on expanded left panel during outro ---- */}
        <AnimatePresence>
          {showOutroVisuals && nextTrack && (
            <motion.div
              className="absolute bottom-32 left-1/2 w-full max-w-sm px-6"
              initial={{ opacity: 0, y: 30, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 20, x: "-50%" }}
              transition={{
                duration: 0.6,
                delay: 0.3,
                ease: [0.32, 0.72, 0, 1],
              }}
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
          opacity: showOutroVisuals ? 0 : 1,
        }}
        transition={{ duration: 0.6 }}
        style={{
          pointerEvents: showOutroVisuals ? "none" : "auto",
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
              <motion.div
                className="flex flex-col items-center justify-center py-32 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-full bg-white/10 animate-pulse" />
                  <Music className="w-8 h-8 text-white/80 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-sm text-white/50">Fetching lyrics…</p>
              </motion.div>
            )}

            {/* Instrumental */}
            {!isLoading && isInstrumental && (
              <motion.div
                className="flex flex-col items-center justify-center py-32 text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Music className="w-16 h-16 text-white/20 mb-4" />
                <h2 className="text-xl font-semibold text-white/60">
                  Instrumental
                </h2>
                <p className="text-sm text-white/40 mt-2">
                  This track has no lyrics
                </p>
              </motion.div>
            )}

            {/* No lyrics */}
            {!isLoading && !isInstrumental && !hasLyrics && error && (
              <motion.div
                className="flex flex-col items-center justify-center py-32 text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Music className="w-16 h-16 text-white/20 mb-4" />
                <h2 className="text-xl font-semibold text-white/60">
                  No lyrics available
                </h2>
                <p className="text-sm text-white/40 mt-2">{error}</p>
              </motion.div>
            )}

            {/* ---- Synced lyrics ---- */}
            {!isLoading && lyrics.length > 0 && (
              <div>
                {interludeAfterIndex === -1 && interludeProgress !== null && (
                  <InterludeDots progress={interludeProgress} />
                )}

                {keyedLyrics.map(({ key, line }, index) => {
                  const isCurrent = index === currentLineIndex;
                  const isPast = index < currentLineIndex;
                  const distance = Math.abs(index - currentLineIndex);
                  const hasInterludeAfter = interludeAfterIndex === index;

                  if (!line.text.trim()) return null;

                  // When user is scrolling: no blur, show all lines clearly
                  // When auto-scrolling: past lines vanish completely (fade + blur)
                  const blurPx = userScrolling
                    ? 0
                    : isCurrent
                      ? 0
                      : isPast
                        ? Math.min(4 + distance * 3, 14)
                        : Math.min(distance * 2, 7);
                  const lineOpacity = userScrolling
                    ? isCurrent
                      ? 1
                      : 0.55
                    : isCurrent
                      ? 1
                      : isPast
                        ? 0
                        : Math.max(0.06, 0.4 - (distance - 1) * 0.12);
                  // Staggered delay: each line further from current gets progressively more delay
                  const cascadeDelay = isCurrent ? 0 : 0.15 + distance * 0.06;

                  // Apple Music–style cascade: direction-aware y-offset pushes
                  // lines AWAY from the active line (past → up, future → down).
                  // When active line changes, every line moves in the same
                  // direction and the staggered spring delay creates the wave.
                  const cascadeY =
                    userScrolling || isCurrent
                      ? 0
                      : isPast
                        ? -Math.min(distance * 8, 35)
                        : Math.min(distance * 8, 35);

                  return (
                    <div key={key}>
                      <motion.p
                        ref={(el) => {
                          lineRefs.current[index] = el;
                        }}
                        className={cn(
                          "text-[2.25rem] sm:text-[2.45rem] lg:text-[2.65rem] xl:text-[3.06rem] font-bold leading-[1.2] cursor-pointer py-4 origin-left select-none",
                          isCurrent && "text-white",
                          isPast && "text-white/30",
                          !isCurrent && !isPast && "text-white/25",
                        )}
                        animate={{
                          opacity: lineOpacity,
                          filter: `blur(${blurPx}px)`,
                          y: cascadeY,
                        }}
                        transition={{
                          opacity: {
                            type: "spring",
                            stiffness: 260,
                            damping: 28,
                            mass: 0.85,
                            delay: cascadeDelay,
                          },
                          y: {
                            type: "spring",
                            stiffness: 220,
                            damping: 26,
                            mass: 0.9,
                            delay: cascadeDelay,
                          },
                          filter: {
                            duration: 0.75,
                            ease: [0.22, 1, 0.36, 1],
                            delay: cascadeDelay,
                          },
                        }}
                        onClick={() => handleLineClick(index)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleLineClick(index);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        {line.text}
                      </motion.p>

                      {hasInterludeAfter && interludeProgress !== null && (
                        <InterludeDots progress={interludeProgress} />
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

            {!isLoading && hasLyrics && trackCredits && trackCredits.writtenBy.length > 0 && (
              <motion.div
                className="mt-24 pt-8"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="mb-3 flex items-center gap-2 text-white/45">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                    Written by
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-white/75">
                  {trackCredits.writtenBy.join(" · ")}
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Dynamic Island Player */}
      <DynamicIsland />
    </div>
  );
}
