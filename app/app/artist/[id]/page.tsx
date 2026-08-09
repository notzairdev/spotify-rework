"use client";

import { use, useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Play,
  Shuffle,
  Heart,
  ChevronDown,
  ChevronUp,
  Users,
  Music,
  Disc3,
  BookOpenText,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TrackContextMenu } from "@/components/context";
import {
  useArtist,
  useArtistTopTracks,
  useArtistAlbums,
  useArtistAppearsOn,
  useRelatedArtists,
} from "@/lib/spotify/hooks";
import { startPlayback } from "@/lib/spotify/api";
import type { SpotifyAlbum } from "@/lib/spotify/api";
import { usePreservedPageState } from "@/lib/page-state";
import { useArtistBiography } from "@/lib/music-data";
import {
  extractDominantColor,
  hslToString,
  type HSL,
} from "@/lib/utils/color-extractor";

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatFollowers(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

type DiscographyCategory = "album" | "ep" | "single" | "compilation";

const DISCOGRAPHY_CATEGORIES: {
  key: DiscographyCategory;
  label: string;
  singular: string;
}[] = [
  { key: "album", label: "Albums", singular: "Album" },
  { key: "ep", label: "EPs", singular: "EP" },
  { key: "single", label: "Singles", singular: "Single" },
  { key: "compilation", label: "Compilations", singular: "Compilation" },
];

function getDiscographyCategory(album: SpotifyAlbum): DiscographyCategory {
  if (album.album_group === "compilation" || album.album_type === "compilation") {
    return "compilation";
  }

  // Spotify has no dedicated EP type. Explicitly labelled releases and short
  // releases returned as albums are the best signals available in this payload.
  const isExplicitEp = /(?:^|[\s([{—–-])e\.?p\.?(?:$|[\s)\]}—–\-:])/i.test(album.name);
  const isShortAlbum = album.album_type === "album"
    && album.total_tracks >= 2
    && album.total_tracks <= 6;

  if (isExplicitEp || isShortAlbum) return "ep";
  return album.album_type === "single" ? "single" : "album";
}

function deduplicateAlbums(albums: SpotifyAlbum[]): SpotifyAlbum[] {
  const seen = new Set<string>();

  return albums.filter((album) => {
    const key = [
      album.name.trim().toLocaleLowerCase(),
      album.release_date,
      album.total_tracks,
      getDiscographyCategory(album),
    ].join("|");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ArtistPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { data: artist, isLoading: artistLoading } = useArtist(id);
  const { data: topTracksData, isLoading: tracksLoading } = useArtistTopTracks(id);
  const { data: albumsData, isLoading: albumsLoading } = useArtistAlbums(id, [
    "album",
    "single",
    "compilation",
  ]);
  const { data: appearsOnData, isLoading: appearsOnLoading } = useArtistAppearsOn(id);
  const { data: relatedData, isLoading: relatedLoading } = useRelatedArtists(id);
  const { data: biography, isLoading: biographyLoading } = useArtistBiography(
    artist?.name ?? null,
  );

  const [coverColor, setCoverColor] = useState<HSL | null>(null);
  const [discographyCategory, setDiscographyCategory] = usePreservedPageState<DiscographyCategory>(
    "discography-category",
    "album"
  );
  const [showAllAlbums, setShowAllAlbums] = usePreservedPageState(
    "show-all-albums",
    false
  );
  const [showAllTracks, setShowAllTracks] = usePreservedPageState(
    "show-all-tracks",
    false
  );
  const [biographyOpen, setBiographyOpen] = useState(false);

  // Extract dominant color from artist image
  useEffect(() => {
    const imageUrl = artist?.images?.[0]?.url;
    let cancelled = false;
    const colorPromise = imageUrl
      ? extractDominantColor(imageUrl)
      : Promise.resolve(null);

    colorPromise.then((color) => {
      if (!cancelled) setCoverColor(color);
    });

    return () => {
      cancelled = true;
    };
  }, [artist?.images]);

  const topTracks = topTracksData?.tracks ?? [];
  const albums = albumsData?.items;
  const appearsOn = appearsOnData?.items ?? [];
  const relatedArtists = relatedData?.artists ?? [];
  
  const groupedDiscography = useMemo(() => {
    const groups: Record<DiscographyCategory, SpotifyAlbum[]> = {
      album: [],
      ep: [],
      single: [],
      compilation: [],
    };

    deduplicateAlbums(albums ?? []).forEach((album) => {
      groups[getDiscographyCategory(album)].push(album);
    });

    return groups;
  }, [albums]);

  const availableDiscographyCategories = DISCOGRAPHY_CATEGORIES.filter(
    ({ key }) => groupedDiscography[key].length > 0
  );
  const activeDiscographyCategory = groupedDiscography[discographyCategory].length > 0
    ? discographyCategory
    : (availableDiscographyCategories[0]?.key ?? "album");
  const activeCategoryDetails = DISCOGRAPHY_CATEGORIES.find(
    ({ key }) => key === activeDiscographyCategory
  )!;
  const filteredAlbums = groupedDiscography[activeDiscographyCategory];
  const displayedAlbums = showAllAlbums ? filteredAlbums : filteredAlbums.slice(0, 8);
  const displayedTracks = showAllTracks ? topTracks : topTracks.slice(0, 5);

  const handlePlayArtist = async () => {
    if (!artist) return;
    try {
      await startPlayback({ contextUri: `spotify:artist:${artist.id}` });
    } catch (e) {
      console.error("Failed to play artist:", e);
    }
  };

  const handlePlayTrack = async (uri: string) => {
    try {
      await startPlayback({ uris: [uri] });
    } catch (e) {
      console.error("Failed to play track:", e);
    }
  };

  const handlePlayAlbum = async (e: React.MouseEvent, albumId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await startPlayback({ contextUri: `spotify:album:${albumId}` });
    } catch (err) {
      console.error("Failed to play album:", err);
    }
  };

  if (artistLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Artista no encontrado</p>
        <Button variant="outline" onClick={() => router.push("/app/home")}>
          Volver al inicio
        </Button>
      </div>
    );
  }

  const artistImage = artist.images?.[0]?.url;
  const followersCount = artist.followers?.total ?? 0;

  return (
    <div className="flex flex-col pb-26 container mx-auto">
      {/* Hero Section with Background Glow */}
      <div className="relative overflow-hidden pt-26">
        {/* Background glow */}
        {coverColor && (
          <div
            className="absolute inset-0 opacity-30 transition-opacity duration-1000"
            style={{
              background: `radial-gradient(ellipse at top, hsl(${hslToString(coverColor)}) 0%, transparent 70%)`,
            }}
          />
        )}

        {/* Artist Header */}
        <div className="relative z-10 flex flex-col items-center gap-6 px-6 pb-8 text-center">
          {/* Artist Image */}
          <div className="relative size-48 overflow-hidden rounded-full shadow-2xl md:size-56">
            {artistImage ? (
              <Image
                src={artistImage}
                alt={artist.name}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-muted">
                <Music className="size-16 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-primary">
              Artist
            </span>
            <h1 className="text-4xl font-bold md:text-5xl lg:text-6xl">
              {artist.name}
            </h1>
            {biographyLoading ? (
              <div className="mx-auto mt-2 h-10 w-full max-w-sm animate-pulse rounded-lg bg-muted/60" />
            ) : biography ? (
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setBiographyOpen(true)}
                className="mx-auto mt-2 max-w-lg cursor-pointer text-sm leading-6 text-muted-foreground transition-colors line-clamp-3 hover:text-foreground"
              >
                {biography.biography}
              </button>
            ) : null}
            <div className="mt-2 flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="size-4" />
                <span>{formatFollowers(followersCount)} followers</span>
              </div>
              {artist.genres && artist.genres.length > 0 && (
                <>
                  <span>•</span>
                  <span className="capitalize">{artist.genres.slice(0, 2).join(", ")}</span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Button
              size="lg"
              onClick={handlePlayArtist}
              className="rounded-2xl px-8"
            >
              <Play className="mr-2 size-4 fill-current" />
              Play
            </Button>
            <Button size="icon" variant="outline" className="size-8 rounded-full">
              <Shuffle className="size-4" />
            </Button>
            <Button size="icon" variant="outline" className="size-8 rounded-full">
              <Heart className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {biography && (
        <Dialog open={biographyOpen} onOpenChange={setBiographyOpen}>
          <DialogContent className="w-[min(46rem,calc(100vw-2rem))] grid-rows-[auto_minmax(0,1fr)_auto]">
            <DialogHeader className="border-b border-border/70 px-7 py-6 pr-16">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BookOpenText className="size-5" />
                </div>
                <div className="min-w-0">
                  <DialogDescription className="text-xs font-medium uppercase tracking-[0.18em]">
                    About the artist
                  </DialogDescription>
                  <DialogTitle className="truncate text-2xl">{artist.name}</DialogTitle>
                </div>
              </div>
            </DialogHeader>

            <div className="overflow-y-auto px-7 py-6">
              {(biography.genre || biography.style || biography.mood) && (
                <div className="mb-6 flex flex-wrap gap-2">
                  {[biography.genre, biography.style, biography.mood]
                    .filter((value): value is string => Boolean(value))
                    .map((value) => (
                      <span
                        key={value}
                        className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                      >
                        {value}
                      </span>
                    ))}
                </div>
              )}
              <p className="whitespace-pre-line text-[15px] leading-7 text-muted-foreground">
                {biography.biography}
              </p>
            </div>

            <DialogFooter className="justify-between border-t border-border/70 px-7 py-4">
              <a
                href={biography.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Information from TheAudioDB
                <ExternalLink className="size-3" />
              </a>
              <DialogClose className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
                Done
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Top Tracks */}
      <section className="px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">
            Top Tracks of {artist.name}
          </h2>
          {topTracks.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllTracks(!showAllTracks)}
              className="text-muted-foreground hover:text-foreground"
            >
              {showAllTracks ? (
                <>Show Less <ChevronUp className="ml-1 size-4" /></>
              ) : (
                <>Show All <ChevronDown className="ml-1 size-4" /></>
              )}
            </Button>
          )}
        </div>

        {tracksLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="size-6" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {displayedTracks.map((track, index) => (
              <TrackContextMenu
                key={track.id}
                trackId={track.id}
                trackUri={track.uri}
                trackName={track.name}
                artistId={artist.id}
                artistName={artist.name}
                albumId={track.album?.id}
                albumName={track.album?.name}
                spotifyUrl={track.external_urls?.spotify}
              >
                <div
                  className="group flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-muted/50"
                  onClick={() => handlePlayTrack(track.uri)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex w-8 items-center justify-center">
                    <span className="text-sm text-muted-foreground group-hover:hidden">
                      {index + 1}
                    </span>
                    <Play className="hidden size-4 fill-current group-hover:block" />
                  </div>

                  {track.album?.images?.[0]?.url && (
                    <Image
                      src={track.album.images[0].url}
                      alt={track.album.name}
                      width={40}
                      height={40}
                      className="rounded"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{track.name}</p>
                  </div>

                  {track.album?.id ? (
                    <Link
                      href={`/app/album/${track.album.id}`}
                      className="hidden truncate text-sm text-muted-foreground hover:underline md:block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {track.album?.name}
                    </Link>
                  ) : (
                    <span className="hidden truncate text-sm text-muted-foreground md:block">
                      {track.album?.name}
                    </span>
                  )}

                  <span className="text-sm text-muted-foreground">
                    {formatDuration(track.duration_ms)}
                  </span>
                </div>
              </TrackContextMenu>
            ))}
          </div>
        )}
      </section>

      {/* Discography */}
      <section className="px-6 py-8">
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Discography</h2>
            </div>
            {filteredAlbums.length > 8 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllAlbums(!showAllAlbums)}
                className="text-muted-foreground hover:text-foreground"
              >
                {showAllAlbums ? (
                  <>Show Less <ChevronUp className="ml-1 size-4" /></>
                ) : (
                  <>Show All ({filteredAlbums.length}) <ChevronDown className="ml-1 size-4" /></>
                )}
              </Button>
            )}
          </div>

          {!albumsLoading && availableDiscographyCategories.length > 0 && (
            <div
              className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
              role="tablist"
              aria-label="Discography formats"
            >
              {availableDiscographyCategories.map(({ key, label }) => {
                const isActive = key === activeDiscographyCategory;

                return (
                  <Button
                    key={key}
                    id={`discography-tab-${key}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`discography-${key}`}
                    variant={isActive ? "default" : "secondary"}
                    size="sm"
                    className="shrink-0 rounded-full px-4"
                    onClick={() => {
                      setDiscographyCategory(key);
                      setShowAllAlbums(false);
                    }}
                  >
                    {label}
                    <span className={isActive ? "text-primary-foreground/70" : "text-muted-foreground"}>
                      {groupedDiscography[key].length}
                    </span>
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        {albumsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="size-6" />
          </div>
        ) : filteredAlbums.length > 0 ? (
          <div
            id={`discography-${activeDiscographyCategory}`}
            role="tabpanel"
            aria-labelledby={`discography-tab-${activeDiscographyCategory}`}
            className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8"
          >
            {displayedAlbums.map((album) => (
              <Link
                key={album.id}
                href={`/app/album/${album.id}`}
                className="group"
              >
                <div className="relative aspect-square overflow-hidden rounded-lg transition-transform group-hover:scale-105">
                  {album.images?.[0]?.url ? (
                    <Image
                      src={album.images[0].url}
                      alt={album.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted">
                      <Disc3 className="size-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      className="rounded-full"
                      onClick={(e) => handlePlayAlbum(e, album.id)}
                    >
                      <Play className="size-5 fill-current" />
                    </Button>
                  </div>
                </div>
                <h3 className="mt-2 truncate font-medium">{album.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {album.release_date?.split("-")[0]} • {activeCategoryDetails.singular}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            No discography releases found
          </div>
        )}
      </section>

      {/* Collaborations (Appears On) */}
      {appearsOn.length > 0 && (
        <section className="px-6 py-8">
          <h2 className="mb-6 text-2xl font-bold">
            Featuring {artist.name}
          </h2>

          {appearsOnLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="size-6" />
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {appearsOn.slice(0, 10).map((album) => (
                <Link
                  key={album.id}
                  href={`/app/album/${album.id}`}
                  className="group shrink-0 w-36"
                >
                  <div className="relative aspect-square overflow-hidden rounded-lg transition-transform group-hover:scale-105">
                    {album.images?.[0]?.url ? (
                      <Image
                        src={album.images[0].url}
                        alt={album.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-muted">
                        <Disc3 className="size-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        size="icon"
                        className="rounded-full"
                        onClick={(e) => handlePlayAlbum(e, album.id)}
                      >
                        <Play className="size-5 fill-current" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="mt-2 truncate font-medium text-sm">{album.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {album.artists.map(a => a.name).join(", ")}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Related Artists */}
      {relatedArtists.length > 0 && (
        <section className="px-6 py-8">
          <h2 className="mb-6 text-2xl font-bold">Artistas similares</h2>

          {relatedLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="size-6" />
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {relatedArtists.slice(0, 8).map((relatedArtist) => (
                <Link
                  key={relatedArtist.id}
                  href={`/app/artist/${relatedArtist.id}`}
                  className="group shrink-0 text-center"
                >
                  <div className="relative size-32 overflow-hidden rounded-full transition-transform group-hover:scale-105">
                    {relatedArtist.images?.[0]?.url ? (
                      <Image
                        src={relatedArtist.images[0].url}
                        alt={relatedArtist.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-muted">
                        <Music className="size-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <h3 className="mt-2 truncate font-medium">{relatedArtist.name}</h3>
                  <p className="text-sm text-muted-foreground">Artista</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
