"use client";

import Link from "next/link";
import { ArrowUpRight, Mic2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { keySyncedLyrics, useLyricsContext } from "@/lib/lrclib";
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

  const keyedLyrics = keySyncedLyrics(lyrics);
  const lyricsViewportRef = useRef<HTMLDivElement>(null);
  const lyricLineRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const plainLines = plainLyrics
    ?.split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5) ?? [];

  useEffect(() => {
    const viewport = lyricsViewportRef.current;
    if (!viewport) return;

    if (currentLineIndex < 0) {
      viewport.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    const line = lyricLineRefs.current[currentLineIndex];
    if (!line) return;

    const targetTop =
      line.offsetTop - (viewport.clientHeight - line.offsetHeight) * 0.42;

    viewport.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });
  }, [currentLineIndex, keyedLyrics.length]);

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
        <div ref={lyricsViewportRef} className="mt-4 h-40 overflow-hidden">
          <div className="flex flex-col gap-0.5 py-10">
            {keyedLyrics.map(({ key, line }, index) => {
              const isCurrent = index === currentLineIndex;
              return (
                <button
                  key={key}
                  type="button"
                  ref={(element) => {
                    lyricLineRefs.current[index] = element;
                  }}
                  onClick={() => void seek(line.time * 1000)}
                  className={cn(
                    "block w-full rounded-lg px-1 py-1.5 text-left text-[15px] font-semibold leading-[1.28] transition-[color,background-color,opacity] duration-500 hover:bg-white/5 hover:text-foreground",
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
