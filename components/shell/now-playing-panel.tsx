"use client";

import { useEffect, useRef, type UIEvent } from "react";
import Image from "next/image";
import { ExternalLink, Music2, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { AnimatedArtwork } from "@/components/media/animated-artwork";
import { NowPlayingLyrics } from "@/components/lyrics/now-playing-lyrics";
import { useAnimatedArtwork } from "@/lib/animated-artwork";
import {
  useAudioDbTrackInfo,
  useSpotifyTrackSuggestions,
  useTrackCredits,
} from "@/lib/music-data";
import { startPlayback, useSpotifyPlayer } from "@/lib/spotify";

async function playRecommendation(uri: string) {
  try {
    await startPlayback({ uris: [uri] });
  } catch (error) {
    toast.error("Could not play this track", {
      description: error instanceof Error ? error.message : undefined,
    });
  }
}

export function NowPlayingPanel() {
  const { state, isControlling, togglePlay } = useSpotifyPlayer();
  const artworkLayerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const track = state?.track;
  const imageUrl = track?.album.images[0]?.url;
  const primaryArtist = track?.artists[0] ?? null;
  const { data: animatedArtwork } = useAnimatedArtwork({
    artist: primaryArtist,
    album: track?.album.name,
    title: track?.name,
  });
  const { data: suggestions, isLoading: recommendationsLoading } =
    useSpotifyTrackSuggestions(track?.id ?? null);
  const { data: credits, isLoading: creditsLoading } = useTrackCredits(track?.id ?? null);
  const { data: trackInfo } = useAudioDbTrackInfo(primaryArtist, track?.name ?? null);
  const hasTrackInfo = [
    trackInfo?.description,
    trackInfo?.genre,
    trackInfo?.mood,
    trackInfo?.style,
  ].some((value) => Boolean(value?.trim()));
  const progress = state?.duration
    ? Math.min(100, Math.max(0, (state.position / state.duration) * 100))
    : 0;

  useEffect(() => {
    const scroller = scrollContainerRef.current;
    const artwork = artworkLayerRef.current;
    if (scroller) scroller.scrollTop = 0;
    if (artwork) {
      artwork.style.opacity = "0.5";
      artwork.style.transform = "translate3d(0, 0, 0)";
    }
  }, [track?.id]);

  const handlePanelScroll = (event: UIEvent<HTMLDivElement>) => {
    const artwork = artworkLayerRef.current;
    if (!artwork) return;

    const scrollTop = event.currentTarget.scrollTop;
    const fadeProgress = Math.min(1, Math.max(0, (scrollTop - 24) / 220));
    artwork.style.opacity = String(0.5 * (1 - fadeProgress));
    artwork.style.transform = `translate3d(0, ${-Math.min(scrollTop * 0.3, 72)}px, 0)`;
  };

  if (!track) return null;

  const recommendations = suggestions?.tracks ?? [];

  const handleTogglePlay = async () => {
    try {
      await togglePlay();
    } catch (error) {
      toast.error("Could not change playback", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <aside
      aria-label="Now playing"
      className="relative hidden h-full min-h-0 overflow-hidden border-l border-white/6 bg-card shadow-[0_22px_80px_rgba(0,0,0,0.14)] 2xl:flex 2xl:flex-col"
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          ref={artworkLayerRef}
          data-now-playing-artwork
          className="absolute inset-0 h-[60%]"
          style={{
            opacity: 0.5,
            maskImage: "linear-gradient(to bottom, black 0%, black 46%, rgba(0,0,0,.72) 68%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 46%, rgba(0,0,0,.72) 68%, transparent 100%)",
          }}
        >
          <AnimatedArtwork
            streamUrl={animatedArtwork?.url_tall ?? animatedArtwork?.url}
            fallbackUrl={imageUrl}
            alt={`Animated artwork for ${track.album.name}`}
            sizes="336px"
          />
        </div>
        <div className="absolute inset-0 bg-linear-to-b from-black/15 via-background/10 via-42% to-background to-78%" />
      </div>

      <div className="relative z-20 mt-14 flex h-14 shrink-0 items-center justify-between px-5">
        <p className="text-sm font-semibold">Now playing</p>
      </div>

      <div
        ref={scrollContainerRef}
        data-now-playing-scroll
        onScroll={handlePanelScroll}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-6 scrollbar-hide"
      >
          <div className="relative h-[23rem]">
            <button
              type="button"
              onClick={() => void handleTogglePlay()}
              disabled={isControlling}
              aria-label={state?.isPlaying ? "Pause" : "Play"}
              className="pointer-events-auto absolute bottom-0 right-5 z-30 flex size-11 items-center justify-center rounded-full bg-white text-black shadow-xl transition-transform hover:scale-105 disabled:opacity-60"
            >
              {state?.isPlaying ? (
                <Pause className="size-4 fill-current" />
              ) : (
                <Play className="ml-0.5 size-4 fill-current" />
              )}
            </button>
          </div>

          <div className="relative z-10 -mt-10 space-y-4 px-4">
            <div className="px-1">
              <div className="flex items-start gap-3 pointer-events-none">
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 text-xl font-semibold leading-tight tracking-tight">{track.name}</h2>
                  <p className="mt-1.5 truncate text-sm text-muted-foreground">{track.artists.join(", ")}</p>
                </div>
              </div>

              <div className="mt-5">
                <div className="h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-foreground transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground">
                  <span>{formatTime(state?.position ?? 0)}</span>
                  <span>{formatTime(state?.duration ?? 0)}</span>
                </div>
              </div>
            </div>

            <NowPlayingLyrics />

            {(recommendationsLoading || recommendations.length > 0) && (
              <section className="rounded-2xl border border-white/8 bg-white/4 p-3">
                <div className="px-1 pb-2 pt-1">
                  <p className="font-semibold">
                    {`More from ${primaryArtist}`}
                  </p>
                </div>
                <div className="space-y-1">
                  {recommendationsLoading
                    ? Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="h-12 animate-pulse rounded-xl bg-white/5" />
                      ))
                    : recommendations.slice(0, 4).map((recommendation) => (
                        <button
                          key={recommendation.id}
                          type="button"
                          onClick={() => void playRecommendation(recommendation.uri)}
                          className="group flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-white/7"
                        >
                          {recommendation.album.images[0]?.url ? (
                            <Image
                              src={recommendation.album.images[0].url}
                              alt=""
                              width={40}
                              height={40}
                              style={{ width: 40, height: 40 }}
                              className="size-10 shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <Music2 className="size-4 text-muted-foreground" />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium">{recommendation.name}</span>
                            <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                              {recommendation.artists.map((artist) => artist.name).join(", ")}
                            </span>
                          </span>
                          <Play className="mr-1 size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      ))}
                </div>
              </section>
            )}

            {trackInfo && hasTrackInfo && (
              <section className="rounded-2xl border border-white/8 bg-white/4 p-4">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "genre", value: trackInfo.genre },
                    { key: "mood", value: trackInfo.mood },
                    { key: "style", value: trackInfo.style },
                  ]
                    .filter((item): item is { key: string; value: string } => Boolean(item.value))
                    .slice(0, 3)
                    .map((item) => (
                      <span key={item.key} className="rounded-full bg-white/7 px-2.5 py-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                        {item.value}
                      </span>
                    ))}
                </div>
                {trackInfo.description && (
                  <p className="mt-3 line-clamp-5 leading-relaxed text-muted-foreground">
                    {trackInfo.description}
                  </p>
                )}
                <a
                  href={trackInfo.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex items-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Track information
                  <ExternalLink className="size-3" />
                </a>
              </section>
            )}

            <section className="rounded-2xl border border-white/8 bg-white/4 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Credits</p>
                {credits && (
                  <a
                    href={credits.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open credit source"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              {creditsLoading ? (
                <div className="mt-4 space-y-2">
                  <div className="h-9 animate-pulse rounded-lg bg-white/5" />
                  <div className="h-9 animate-pulse rounded-lg bg-white/4" />
                </div>
              ) : credits?.groups.length ? (
                <dl className="mt-4 space-y-3">
                  {credits.groups.slice(0, 6).map((group) => (
                    <div key={group.label}>
                      <dt className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/65">
                        {group.label}
                      </dt>
                      <dd className="mt-1 text-xs leading-relaxed">{group.names.join(" · ")}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="mt-4">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/65">Main performers</p>
                  <p className="mt-1 text-xs leading-relaxed">{track.artists.join(" · ")}</p>
                </div>
              )}
            </section>
          </div>
      </div>
    </aside>
  );
}

function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
