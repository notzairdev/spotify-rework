"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock3,
  Compass,
  Disc3,
  Flame,
  Headphones,
  Library,
  LoaderCircle,
  Music2,
  Pause,
  Play,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  resolveTrendOnSpotify,
  useListenBrainzTrends,
  useTasteRecommendations,
  type ListenBrainzTrend,
} from "@/lib/music-data";
import {
  startPlayback,
  useMyPlaylists,
  useNewReleases,
  useRecentlyPlayed,
  useSpotifyPlayer,
  useTopArtists,
  useTopTracks,
  type SpotifyAlbum,
  type SpotifyTrack,
} from "@/lib/spotify";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { state, togglePlay } = useSpotifyPlayer();
  const { data: playlistsData, isLoading: playlistsLoading } = useMyPlaylists(8);
  const { data: topTracksData, isLoading: tracksLoading } = useTopTracks("short_term", 12);
  const { data: topArtistsData, isLoading: artistsLoading } = useTopArtists("medium_term", 10);
  const { data: recentlyPlayedData, isLoading: recentLoading } = useRecentlyPlayed(20);
  const { data: newReleasesData, isLoading: releasesLoading } = useNewReleases(10);
  const [resolvingTrend, setResolvingTrend] = useState<string | null>(null);

  const playlists = playlistsData?.items ?? [];
  const topTracks = topTracksData?.items ?? [];
  const topArtists = topArtistsData?.items ?? [];
  const recentItems = deduplicateRecentTracks(recentlyPlayedData?.items ?? []);
  const recentTracks = recentItems.map((item) => item.track);
  const rotationAlbums = deduplicateAlbums(topTracks.map((track) => track.album)).slice(0, 6);
  const newAlbums = deduplicateAlbums(newReleasesData?.albums.items ?? []).slice(0, 8);
  const spotlightTrack = recentTracks.find((track) => track.id === state?.track?.id)
    ?? recentTracks[0]
    ?? topTracks[0];
  const quickPicks = topTracks
    .filter((track) => track.id !== spotlightTrack?.id)
    .slice(0, 6);
  const recommendationSeeds = topTracks.slice(0, 4).map((track) => track.id);
  const {
    data: tasteRecommendations,
    isLoading: recommendationsLoading,
  } = useTasteRecommendations(recommendationSeeds);
  const {
    data: listeningTrends,
    isLoading: trendsLoading,
  } = useListenBrainzTrends();
  const recommendedTracks = tasteRecommendations?.map(({ track }) => track) ?? [];

  const playTrack = async (track: SpotifyTrack) => {
    try {
      if (state?.track?.id === track.id) {
        await togglePlay();
      } else {
        await startPlayback({ uris: [track.uri] });
      }
    } catch (error) {
      console.error("Failed to play track:", error);
    }
  };

  const playAlbum = async (albumId: string) => {
    try {
      await startPlayback({ contextUri: `spotify:album:${albumId}` });
    } catch (error) {
      console.error("Failed to play album:", error);
    }
  };

  const playPlaylist = async (playlistId: string) => {
    try {
      await startPlayback({ contextUri: `spotify:playlist:${playlistId}` });
    } catch (error) {
      console.error("Failed to play playlist:", error);
    }
  };

  const openTrendingRelease = async (trend: ListenBrainzTrend) => {
    if (resolvingTrend) return;
    setResolvingTrend(trend.releaseGroupMbid);

    try {
      const album = await resolveTrendOnSpotify(trend);
      if (album) {
        router.push(`/app/album/${album.id}`);
      } else {
        toast.error("This release is not available in the Spotify catalog.");
      }
    } catch (error) {
      console.error("Failed to resolve ListenBrainz release:", error);
      toast.error("Couldn't open this release on Spotify.");
    } finally {
      setResolvingTrend(null);
    }
  };

  const isSpotlightPlaying = state?.track?.id === spotlightTrack?.id
    && Boolean(state?.isPlaying);
  const firstName = user?.display_name?.split(" ")[0];

  return (
    <div className="container mx-auto space-y-14 px-6 pb-40 pt-24 animate-fade-in">
      <header className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {formatToday()}
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {getGreeting()}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Pick up where you left off, revisit your rotation, or find something released this week.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatPill icon={Clock3} label={`${recentTracks.length} recent tracks`} />
          <StatPill icon={Library} label={`${playlists.length} playlists`} />
          {topArtists[0] && (
            <StatPill icon={TrendingUp} label={`Top artist: ${topArtists[0].name}`} />
          )}
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.75fr)]">
        {recentLoading && !spotlightTrack ? (
          <div className="min-h-96 animate-pulse rounded-4xl bg-muted" />
        ) : spotlightTrack ? (
          <div className="group relative min-h-96 overflow-hidden rounded-4xl border border-white/10 bg-card shadow-2xl shadow-black/20">
            {spotlightTrack.album.images[0]?.url && (
              <Image
                src={spotlightTrack.album.images[0].url}
                alt={spotlightTrack.album.name}
                fill
                priority
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 bg-linear-to-r from-black/95 via-black/65 to-black/15" />
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />

            <div className="relative flex min-h-96 max-w-2xl flex-col justify-end p-7 sm:p-10">
              <div className="mb-auto flex items-center gap-2">
                <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur-xl">
                  Jump back in
                </span>
                {state?.track?.id === spotlightTrack.id && (
                  <span className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold text-primary-foreground">
                    <Music2 className="size-3" />
                    Current session
                  </span>
                )}
              </div>

              <p className="mb-2 text-xs font-medium text-white/60">
                {spotlightTrack.artists.map((artist) => artist.name).join(", ")}
              </p>
              <h2 className="max-w-xl text-4xl font-bold leading-none text-white sm:text-5xl">
                {spotlightTrack.name}
              </h2>
              <p className="mt-3 line-clamp-1 text-sm text-white/55">
                {spotlightTrack.album.name}
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Button
                  size="lg"
                  className="h-11 rounded-full bg-white px-6 text-black hover:bg-white/90"
                  onClick={() => playTrack(spotlightTrack)}
                >
                  {isSpotlightPlaying ? (
                    <Pause className="size-4 fill-current" />
                  ) : (
                    <Play className="size-4 fill-current" />
                  )}
                  {isSpotlightPlaying ? "Pause" : "Play now"}
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-11 rounded-full border-white/20 bg-black/20 px-5 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href={`/app/album/${spotlightTrack.album.id}`}>
                    View album
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <EmptyHero />
        )}

        <div className="rounded-4xl border border-border/60 bg-card/45 p-4 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between px-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Quick picks</p>
              <h2 className="mt-1 text-lg font-semibold">Your current favorites</h2>
            </div>
            <Flame className="size-5 text-primary" />
          </div>

          <div className="space-y-1">
            {tracksLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-xl bg-muted" />
              ))
            ) : quickPicks.length > 0 ? (
              quickPicks.map((track, index) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => playTrack(track)}
                  className="group flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-muted/70"
                >
                  <span className="w-4 text-center text-[10px] tabular-nums text-muted-foreground/60">
                    {index + 1}
                  </span>
                  <CoverImage
                    src={track.album.images[0]?.url}
                    alt={track.album.name}
                    size={38}
                    className="rounded-lg"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{track.name}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                      {track.artists.map((artist) => artist.name).join(", ")}
                    </span>
                  </span>
                  <Play className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))
            ) : (
              <SmallEmptyState label="Listen to a few songs to build your quick picks." />
            )}
          </div>
        </div>
      </section>

      {(tracksLoading || rotationAlbums.length > 0) && (
        <section>
          <SectionHeading
            eyebrow="Based on your last four weeks"
            title="In your rotation"
            icon={Flame}
          />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {tracksLoading
              ? Array.from({ length: 6 }).map((_, index) => <CardSkeleton key={index} />)
              : rotationAlbums.map((album) => (
                  <AlbumCard key={album.id} album={album} onPlay={() => playAlbum(album.id)} />
                ))}
          </div>
        </section>
      )}

      {(recommendationsLoading || recommendedTracks.length > 0) && (
        <section>
          <SectionHeading
            eyebrow="Recommendations powered by ReccoBeats"
            title="A little outside your rotation"
            icon={Compass}
          />
          <div className="grid gap-2 md:grid-cols-2">
            {recommendationsLoading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-18 animate-pulse rounded-2xl bg-muted" />
                ))
              : recommendedTracks.slice(0, 8).map((track) => (
                  <RecommendationCard
                    key={track.id}
                    track={track}
                    isPlaying={state?.track?.id === track.id && Boolean(state?.isPlaying)}
                    onPlay={() => playTrack(track)}
                  />
                ))}
          </div>
        </section>
      )}

      {(trendsLoading || (listeningTrends?.length ?? 0) > 0) && (
        <section>
          <SectionHeading
            eyebrow="This week's community pulse · ListenBrainz"
            title="Trending beyond your bubble"
            icon={Headphones}
          />
          <div className="flex gap-4 overflow-x-auto overflow-y-clip overscroll-x-contain pb-3 scrollbar-hide">
            {trendsLoading
              ? Array.from({ length: 7 }).map((_, index) => (
                  <div key={index} className="w-44 shrink-0"><CardSkeleton /></div>
                ))
              : listeningTrends?.map((trend) => (
                  <TrendCard
                    key={trend.releaseGroupMbid}
                    trend={trend}
                    isResolving={resolvingTrend === trend.releaseGroupMbid}
                    onOpen={() => openTrendingRelease(trend)}
                  />
                ))}
          </div>
        </section>
      )}

      {(recentLoading || recentItems.length > 0) && (
        <section>
          <SectionHeading
            eyebrow="Listening history"
            title="Recently played"
            icon={Clock3}
          />
          <div className="grid gap-2 md:grid-cols-2">
            {recentLoading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-2xl bg-muted" />
                ))
              : recentItems.slice(0, 8).map((item, index) => (
                  <button
                    key={`${item.track.id}-${item.played_at}`}
                    type="button"
                    onClick={() => playTrack(item.track)}
                    className="group flex items-center gap-3 rounded-2xl border border-transparent bg-card/35 p-2.5 text-left transition-all hover:border-border/60 hover:bg-card"
                  >
                    <CoverImage
                      src={item.track.album.images[0]?.url}
                      alt={item.track.album.name}
                      size={48}
                      className="rounded-xl"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.track.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.track.artists.map((artist) => artist.name).join(", ")}
                      </span>
                    </span>
                    <span className="hidden text-[10px] text-muted-foreground sm:block">
                      {formatRelativeTime(item.played_at)}
                    </span>
                    <span className="flex size-8 items-center justify-center rounded-full bg-foreground text-background opacity-0 transition-all group-hover:opacity-100">
                      <Play className="size-3 fill-current" />
                    </span>
                    <span className="sr-only">Play item {index + 1}</span>
                  </button>
                ))}
          </div>
        </section>
      )}

      {(playlistsLoading || playlists.length > 0) && (
        <section>
          <SectionHeading
            eyebrow="Saved by you"
            title="Your playlists"
            icon={Library}
            action={{ label: "Open library", href: "/app/library" }}
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {playlistsLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-3xl bg-muted" />
                ))
              : playlists.slice(0, 8).map((playlist) => (
                  <div
                    key={playlist.id}
                    className="group flex min-w-0 items-center gap-4 rounded-3xl border border-border/50 bg-card/45 p-3 transition-all hover:-translate-y-0.5 hover:bg-card hover:shadow-xl hover:shadow-black/10"
                  >
                    <Link href={`/app/playlist/${playlist.id}`} className="shrink-0">
                      <CoverImage
                        src={playlist.images?.[0]?.url}
                        alt={playlist.name}
                        size={76}
                        className="rounded-2xl"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/app/playlist/${playlist.id}`} className="font-semibold hover:underline">
                        <span className="block truncate">{playlist.name}</span>
                      </Link>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {playlist.tracks.total} tracks
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => playPlaylist(playlist.id)}
                      aria-label={`Play ${playlist.name}`}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background opacity-0 transition-all group-hover:opacity-100"
                    >
                      <Play className="size-3.5 fill-current" />
                    </button>
                  </div>
                ))}
          </div>
        </section>
      )}

      {(releasesLoading || newAlbums.length > 0) && (
        <section>
          <SectionHeading
            eyebrow="Released in the last two weeks"
            title="Fresh on Spotify"
            icon={Sparkles}
            action={{ label: "Discover more", href: "/app/search" }}
          />
          <div className="flex gap-4 overflow-x-auto overflow-y-clip overscroll-x-contain pb-3 scrollbar-hide">
            {releasesLoading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="w-40 shrink-0"><CardSkeleton /></div>
                ))
              : newAlbums.map((album) => (
                  <div key={album.id} className="w-40 shrink-0">
                    <AlbumCard album={album} onPlay={() => playAlbum(album.id)} compact />
                  </div>
                ))}
          </div>
        </section>
      )}

      {(artistsLoading || topArtists.length > 0) && (
        <section>
          <SectionHeading
            eyebrow="Your six-month affinity"
            title="Artists you come back to"
            icon={TrendingUp}
          />
          <div className="flex gap-5 overflow-x-auto overflow-y-clip overscroll-x-contain pb-3 scrollbar-hide">
            {artistsLoading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="size-32 shrink-0 animate-pulse rounded-full bg-muted" />
                ))
              : topArtists.map((artist) => (
                  <Link
                    key={artist.id}
                    href={`/app/artist/${artist.id}`}
                    className="group w-32 shrink-0 text-center"
                  >
                    <div className="relative mx-auto size-28 overflow-hidden rounded-full border border-border/60 bg-muted shadow-lg transition-transform group-hover:scale-105">
                      {artist.images?.[0]?.url ? (
                        <Image src={artist.images[0].url} alt={artist.name} fill className="object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <Music2 className="size-7 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <h3 className="mt-3 truncate text-sm font-semibold">{artist.name}</h3>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Artist</p>
                  </Link>
                ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  icon: Icon,
  action,
}: {
  eyebrow: string;
  title: string;
  icon: React.ElementType;
  action?: { label: string; href: string };
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          <Icon className="size-3.5" />
          {eyebrow}
        </p>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      </div>
      {action && (
        <Link
          href={action.href}
          className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {action.label}
          <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

function AlbumCard({
  album,
  onPlay,
  compact = false,
}: {
  album: SpotifyAlbum;
  onPlay: () => void;
  compact?: boolean;
}) {
  return (
    <article className="group min-w-0">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted shadow-lg">
        <Link href={`/app/album/${album.id}`}>
          {album.images[0]?.url ? (
            <Image
              src={album.images[0].url}
              alt={album.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <span className="flex size-full items-center justify-center">
              <Disc3 className="size-8 text-muted-foreground" />
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={onPlay}
          aria-label={`Play ${album.name}`}
          className="absolute bottom-2.5 right-2.5 flex size-10 translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-xl transition-all group-hover:translate-y-0 group-hover:opacity-100"
        >
          <Play className="size-4 fill-current" />
        </button>
      </div>
      <Link href={`/app/album/${album.id}`} className="mt-3 block truncate text-sm font-semibold hover:underline">
        {album.name}
      </Link>
      <p className={cn("mt-1 truncate text-xs text-muted-foreground", compact && "text-[11px]")}>
        {album.artists.map((artist) => artist.name).join(", ")}
      </p>
    </article>
  );
}

function RecommendationCard({
  track,
  isPlaying,
  onPlay,
}: {
  track: SpotifyTrack;
  isPlaying: boolean;
  onPlay: () => void;
}) {
  return (
    <article className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border/45 bg-card/35 p-2.5 transition-all hover:border-border hover:bg-card/70">
      <Link href={`/app/album/${track.album.id}`} className="shrink-0">
        <CoverImage
          src={track.album.images[0]?.url}
          alt={track.album.name}
          size={52}
          className="rounded-xl"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{track.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {track.artists.map((artist) => artist.name).join(", ")}
        </p>
      </div>
      <button
        type="button"
        onClick={onPlay}
        aria-label={`${isPlaying ? "Pause" : "Play"} ${track.name}`}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105"
      >
        {isPlaying ? (
          <Pause className="size-3.5 fill-current" />
        ) : (
          <Play className="size-3.5 fill-current" />
        )}
      </button>
    </article>
  );
}

function TrendCard({
  trend,
  isResolving,
  onOpen,
}: {
  trend: ListenBrainzTrend;
  isResolving: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-44 shrink-0 text-left"
      aria-label={`Open ${trend.releaseName} on Spotify`}
    >
      <span className="relative block aspect-square overflow-hidden rounded-2xl border border-border/50 bg-muted shadow-lg">
        {trend.coverUrl ? (
          <Image
            src={trend.coverUrl}
            alt={trend.releaseName}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Disc3 className="size-8 text-muted-foreground" />
          </span>
        )}
        <span className="absolute inset-0 bg-linear-to-t from-black/65 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="absolute bottom-2.5 right-2.5 flex size-9 translate-y-2 items-center justify-center rounded-full bg-white text-black opacity-0 shadow-xl transition-all group-hover:translate-y-0 group-hover:opacity-100">
          {isResolving ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
        </span>
      </span>
      <span className="mt-3 block truncate text-sm font-semibold">{trend.releaseName}</span>
      <span className="mt-1 block truncate text-xs text-muted-foreground">{trend.artistName}</span>
      <span className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/75">
        <Headphones className="size-3" />
        {formatCompactNumber(trend.listenCount)} listens this week
      </span>
    </button>
  );
}

function CoverImage({
  src,
  alt,
  size,
  className,
}: {
  src?: string;
  alt: string;
  size: number;
  className?: string;
}) {
  if (!src) {
    return (
      <span
        className={cn("flex shrink-0 items-center justify-center bg-muted", className)}
        style={{ width: size, height: size }}
      >
        <Music2 className="size-4 text-muted-foreground" />
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn("shrink-0 object-cover", className)}
    />
  );
}

function StatPill({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="flex items-center gap-2 rounded-full border border-border/70 bg-card/55 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur-xl">
      <Icon className="size-3.5 text-primary" />
      {label}
    </span>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="aspect-square animate-pulse rounded-2xl bg-muted" />
      <div className="h-3.5 w-4/5 animate-pulse rounded bg-muted" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
    </div>
  );
}

function SmallEmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
      <Music2 className="mb-3 size-6 text-muted-foreground" />
      <p className="text-xs leading-relaxed text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyHero() {
  return (
    <div className="flex min-h-96 flex-col items-center justify-center rounded-4xl border border-dashed bg-card/30 px-8 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted">
        <Disc3 className="size-6 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold">Your listening starts here</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Play something from Discover and this space will become your personal launchpad.
      </p>
      <Button asChild className="mt-5 rounded-full">
        <Link href="/app/search">Open Discover</Link>
      </Button>
    </div>
  );
}

function deduplicateAlbums(albums: SpotifyAlbum[]): SpotifyAlbum[] {
  const seen = new Set<string>();
  return albums.filter((album) => {
    if (seen.has(album.id)) return false;
    seen.add(album.id);
    return true;
  });
}

function deduplicateRecentTracks<T extends { track: SpotifyTrack }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.track.id)) return false;
    seen.add(item.track.id);
    return true;
  });
}

function formatRelativeTime(playedAt: string): string {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(playedAt).getTime()) / 60_000)
  );
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatToday(): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
