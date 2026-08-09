"use client";

import Image from "next/image";
import { ExternalLink, Heart, Music2, Pause, Play } from "lucide-react";
import { AnimatedArtwork } from "@/components/media/animated-artwork";
import { NowPlayingLyrics } from "@/components/lyrics/now-playing-lyrics";
import { QueuePopover } from "@/components/player/queue-popover";
import { useAnimatedArtwork } from "@/lib/animated-artwork";
import {
  useAudioDbTrackInfo,
  useSpotifyTrackSuggestions,
  useTrackCredits,
} from "@/lib/music-data";
import { startPlayback, useSpotifyPlayer, useTrackLike } from "@/lib/spotify";
import { cn } from "@/lib/utils";

async function playRecommendation(uri: string) {
  try {
    await startPlayback({ uris: [uri] });
  } catch (error) {
    console.error("Failed to play recommendation:", error);
  }
}

export function NowPlayingPanel() {
  const { state, togglePlay } = useSpotifyPlayer();
  const { isLiked, isLoading: likeLoading, toggleLike } = useTrackLike();
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
  const progress = state?.duration
    ? Math.min(100, Math.max(0, (state.position / state.duration) * 100))
    : 0;

  if (!track) return null;

  const recommendations = suggestions?.tracks ?? [];
  const recommendationsFromSpotify = suggestions?.source === "spotify-recommendations";

  return (
    <aside
      aria-label="Now playing"
      className="relative hidden h-full min-h-0 overflow-hidden rounded-l-2xl border-l border-white/6 bg-card shadow-[0_22px_80px_rgba(0,0,0,0.14)] 2xl:flex 2xl:flex-col"
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
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
        <QueuePopover
          triggerClassName="flex size-9 items-center justify-center rounded-full bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        />
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-6 scrollbar-hide">
          <div className="relative h-[23rem]">
            <button
              type="button"
              onClick={() => void togglePlay()}
              aria-label={state?.isPlaying ? "Pause" : "Play"}
              className="absolute bottom-8 right-5 flex size-11 items-center justify-center rounded-full bg-white text-black shadow-xl transition-transform hover:scale-105"
            >
              {state?.isPlaying ? (
                <Pause className="size-4 fill-current" />
              ) : (
                <Play className="ml-0.5 size-4 fill-current" />
              )}
            </button>
          </div>

          <div className="relative -mt-10 space-y-4 px-4">
            <div className="px-1">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 text-xl font-semibold leading-tight tracking-tight">{track.name}</h2>
                  <p className="mt-1.5 truncate text-sm text-muted-foreground">{track.artists.join(", ")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleLike()}
                  disabled={likeLoading}
                  aria-label={isLiked ? "Remove from Liked Songs" : "Save to Liked Songs"}
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
                    isLiked
                      ? "bg-primary/12 text-primary"
                      : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground",
                    likeLoading && "opacity-50"
                  )}
                >
                  <Heart className={cn("size-4", isLiked && "fill-current")} />
                </button>
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
                  <p className="text-xs font-semibold">
                    {recommendationsFromSpotify ? "More like this" : `More from ${primaryArtist}`}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {recommendationsFromSpotify
                      ? "Recommended by Spotify from the current track"
                      : "Top tracks from the same artist on Spotify"}
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

            {trackInfo && (
              <section className="rounded-2xl border border-white/8 bg-white/4 p-4">
                <div className="flex flex-wrap gap-1.5">
                  {[trackInfo.genre, trackInfo.mood, trackInfo.style]
                    .filter((value): value is string => Boolean(value))
                    .slice(0, 3)
                    .map((value) => (
                      <span key={value} className="rounded-full bg-white/7 px-2.5 py-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                        {value}
                      </span>
                    ))}
                </div>
                {trackInfo.description && (
                  <p className="mt-3 line-clamp-5 text-xs leading-relaxed text-muted-foreground">
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
                <p className="text-xs font-semibold">Credits</p>
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
