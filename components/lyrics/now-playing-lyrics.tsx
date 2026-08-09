"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowUpRight, Mic2 } from "lucide-react";
import { useLyricsContext } from "@/lib/lrclib";
import { useSpotifyPlayer } from "@/lib/spotify";
import { cn } from "@/lib/utils";

export function NowPlayingLyrics() {
  const { seek } = useSpotifyPlayer();
  const {
    lyrics,
    plainLyrics,
    currentLineIndex,
    isLoading,
    hasLyrics,
  } = useLyricsContext();

  const lyricViewportRef = useRef<HTMLDivElement>(null);
  const currentLineRef = useRef<HTMLButtonElement>(null);
  const plainLines = plainLyrics
    ?.split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5) ?? [];

  useEffect(() => {
    const viewport = lyricViewportRef.current;
    const line = currentLineRef.current;
    if (!viewport || !line || currentLineIndex < 0) return;

    viewport.scrollTo({
      top: Math.max(0, line.offsetTop - viewport.clientHeight / 2 + line.clientHeight / 2),
      behavior: "smooth",
    });
  }, [currentLineIndex]);

  if (!isLoading && !hasLyrics) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/8 bg-white/4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Mic2 className="size-3.5" />
          Lyrics
        </div>
        <Link
          href="/lyrics"
          className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Open
          <ArrowUpRight className="size-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-5 space-y-3">
          <div className="h-5 w-4/5 animate-pulse rounded bg-white/8" />
          <div className="h-5 w-3/5 animate-pulse rounded bg-white/6" />
          <div className="h-5 w-11/12 animate-pulse rounded bg-white/5" />
        </div>
      ) : lyrics.length > 0 ? (
        <div
          ref={lyricViewportRef}
          className="mt-5 h-44 space-y-1.5 overflow-y-auto overscroll-contain py-16 scrollbar-hide"
        >
            {lyrics.map((line, index) => {
              const isCurrent = index === currentLineIndex;
              return (
                <button
                  ref={isCurrent ? currentLineRef : undefined}
                  key={`${line.time}:${line.text}`}
                  type="button"
                  onClick={() => void seek(line.time * 1000)}
                  className={cn(
                    "flex min-h-8 w-full items-center rounded-lg px-1 text-left text-[15px] font-semibold leading-snug transition-[color,background-color,opacity] duration-500 hover:bg-white/5 hover:text-foreground",
                    isCurrent
                      ? "text-foreground"
                      : index < currentLineIndex
                        ? "text-muted-foreground/30"
                        : "text-muted-foreground/68",
                  )}
                >
                  <span className="line-clamp-2">{line.text}</span>
                </button>
              );
            })}
        </div>
      ) : (
        <div className="mt-5 space-y-2.5">
          {plainLines.map((line, index) => (
            <p key={`${index}:${line}`} className="text-sm font-medium leading-snug text-muted-foreground/75">
              {line}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
