"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Compass,
  Disc3,
  Grid,
  Library,
  List,
  ListMusic,
  Play,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SortablePlaylists } from "@/components/library/sortable-playlists";
import { cn } from "@/lib/utils";
import { usePreservedPageState } from "@/lib/page-state";
import {
  useMyPlaylists,
  useSavedAlbums,
  useFollowedArtists,
} from "@/lib/spotify/hooks";
import { startPlayback } from "@/lib/spotify/api";

type Filter = "all" | "playlists" | "albums" | "artists";
type ViewMode = "grid" | "list";

const LIBRARY_FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "playlists", label: "Playlists" },
  { key: "albums", label: "Albums" },
  { key: "artists", label: "Artists" },
];
const LIBRARY_SKELETON_KEYS = Array.from(
  { length: 10 },
  (_, index) => `library-skeleton-${index}`,
);

async function playContext(event: React.MouseEvent, uri: string) {
  event.preventDefault();
  event.stopPropagation();
  try {
    await startPlayback({ contextUri: uri });
  } catch (error) {
    toast.error("Could not start playback", {
      description: error instanceof Error ? error.message : undefined,
    });
  }
}

export default function LibraryPage() {
  const [filter, setFilter] = usePreservedPageState<Filter>("filter", "all");
  const [viewMode, setViewMode] = usePreservedPageState<ViewMode>("view-mode", "grid");
  const [searchQuery, setSearchQuery] = usePreservedPageState("search-query", "");

  // Fetch data
  const { data: playlistsData, isLoading: playlistsLoading } = useMyPlaylists();
  const { data: albumsData, isLoading: albumsLoading } = useSavedAlbums();
  const { data: artistsData, isLoading: artistsLoading } = useFollowedArtists();

  const playlists = useMemo(() => playlistsData?.items ?? [], [playlistsData?.items]);
  const albums = useMemo(() => albumsData?.items ?? [], [albumsData?.items]);
  const artists = useMemo(
    () => artistsData?.artists?.items ?? [],
    [artistsData?.artists?.items],
  );

  const isLoading = playlistsLoading || albumsLoading || artistsLoading;

  // Filter by search query
  const filteredPlaylists = useMemo(() => {
    if (!searchQuery) return playlists;
    const q = searchQuery.toLowerCase();
    return playlists.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.owner.display_name?.toLowerCase().includes(q)
    );
  }, [playlists, searchQuery]);

  const filteredAlbums = useMemo(() => {
    if (!searchQuery) return albums;
    const q = searchQuery.toLowerCase();
    return albums.filter(
      (a) =>
        a.album.name.toLowerCase().includes(q) ||
        a.album.artists.some((artist) =>
          artist.name.toLowerCase().includes(q)
        )
    );
  }, [albums, searchQuery]);

  const filteredArtists = useMemo(() => {
    if (!searchQuery) return artists;
    const q = searchQuery.toLowerCase();
    return artists.filter((a) => a.name.toLowerCase().includes(q));
  }, [artists, searchQuery]);

  const filterCounts: Record<Filter, number> = {
    all: playlists.length + albums.length + artists.length,
    playlists: playlists.length,
    albums: albums.length,
    artists: artists.length,
  };
  const visibleItemCount =
    filter === "all"
      ? filteredPlaylists.length + filteredAlbums.length + filteredArtists.length
      : filter === "playlists"
        ? filteredPlaylists.length
        : filter === "albums"
          ? filteredAlbums.length
          : filteredArtists.length;

  return (
    <div className="relative mx-auto w-full max-w-[96rem] px-5 pb-40 pt-24 sm:px-7 lg:px-8 animate-fade-in">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.08),transparent_62%)]" />

      <header className="relative flex flex-col gap-7 pb-8 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
            <Library className="size-3.5" />
            Your collection
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
            Your Library
          </h1>
        </div>
      </header>

      <section className="relative rounded-3xl border border-white/8 bg-card/40 p-3 shadow-xl shadow-black/10 backdrop-blur-xl">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {LIBRARY_FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-colors",
                  filter === item.key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-white/6 hover:text-foreground",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "text-[10px] tabular-nums",
                    filter === item.key ? "text-background/60" : "text-muted-foreground/55",
                  )}
                >
                  {filterCounts[item.key]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2 xl:max-w-xl xl:justify-end">
            <div className="relative min-w-0 flex-1 xl:max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search your library"
                aria-label="Search your library"
                className="h-10 rounded-full border-white/8 bg-black/10 pl-10 pr-10 text-sm shadow-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear library search"
                  className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/7 hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center rounded-full border border-white/8 bg-black/10 p-1">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors",
                  viewMode === "grid" && "bg-white/10 text-foreground",
                )}
              >
                <Grid className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="List view"
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors",
                  viewMode === "list" && "bg-white/10 text-foreground",
                )}
              >
                <List className="size-4" />
              </button>
            </div>

            <Button asChild variant="ghost" size="sm" className="hidden shrink-0 rounded-full sm:flex">
              <Link href="/app/search">
                <Compass className="size-4" />
                Discover
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="mt-8">
      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {LIBRARY_SKELETON_KEYS.map((key) => (
            <div key={key} className="space-y-3 p-2">
              <div className="aspect-square animate-pulse rounded-2xl bg-muted" />
              <div className="h-3.5 w-4/5 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted/70" />
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {!isLoading && viewMode === "grid" && (
        <>
          {/* Sortable Playlists when filter is "playlists" */}
          {filter === "playlists" && (
            <SortablePlaylists
              playlists={filteredPlaylists}
              viewMode="grid"
              onPlay={playContext}
            />
          )}

          {/* Normal grid for "all" or other filters */}
          {filter !== "playlists" && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {/* Playlists */}
              {filter === "all" &&
                filteredPlaylists.map((playlist) => (
                  <Link
                    key={playlist.id}
                    href={`/app/playlist/${playlist.id}`}
                    className="group min-w-0 rounded-3xl border border-transparent p-2 transition-colors hover:border-white/8 hover:bg-white/4"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted shadow-lg shadow-black/15">
                      {playlist.images?.[0]?.url ? (
                        <Image
                          src={playlist.images[0].url}
                          alt={playlist.name}
                          fill
                          sizes="(min-width: 1024px) 12.5vw, (min-width: 640px) 20vw, 50vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-muted">
                          <span className="text-4xl text-muted-foreground">♪</span>
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          size="icon"
                          className="pointer-events-auto absolute bottom-3 right-3 size-11 translate-y-2 rounded-full bg-foreground text-background opacity-0 shadow-xl transition-[opacity,transform] group-hover:translate-y-0 group-hover:opacity-100"
                          onClick={(e) => void playContext(e, playlist.uri)}
                        >
                          <Play className="size-5 fill-current" />
                        </Button>
                      </div>
                    </div>
                    <h3 className="mt-3 truncate px-1 text-sm font-semibold">{playlist.name}</h3>
                    <p className="mt-1 truncate px-1 text-[11px] text-muted-foreground">
                      Playlist · {playlist.owner.display_name}
                    </p>
                  </Link>
                ))}

              {/* Albums */}
              {(filter === "all" || filter === "albums") &&
            filteredAlbums.map(({ album }) => (
              <Link
                key={album.id}
                href={`/app/album/${album.id}`}
                className="group min-w-0 rounded-3xl border border-transparent p-2 transition-colors hover:border-white/8 hover:bg-white/4"
              >
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted shadow-lg shadow-black/15">
                  {album.images?.[0]?.url ? (
                    <Image
                      src={album.images[0].url}
                      alt={album.name}
                      fill
                      sizes="(min-width: 1024px) 12.5vw, (min-width: 640px) 20vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted">
                      <span className="text-4xl text-muted-foreground">♪</span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      className="pointer-events-auto absolute bottom-3 right-3 size-11 translate-y-2 rounded-full bg-foreground text-background opacity-0 shadow-xl transition-[opacity,transform] group-hover:translate-y-0 group-hover:opacity-100"
                      onClick={(e) =>
                        void playContext(e, `spotify:album:${album.id}`)
                      }
                    >
                      <Play className="size-5 fill-current" />
                    </Button>
                  </div>
                </div>
                <h3 className="mt-3 truncate px-1 text-sm font-semibold">{album.name}</h3>
                <p className="mt-1 truncate px-1 text-[11px] text-muted-foreground">
                  Album · {album.artists.map((a) => a.name).join(", ")}
                </p>
              </Link>
            ))}

          {/* Artists */}
          {(filter === "all" || filter === "artists") &&
            filteredArtists.map((artist) => (
              <Link
                key={artist.id}
                href={`/app/artist/${artist.id}`}
                className="group min-w-0 rounded-3xl border border-transparent p-2 text-left transition-colors hover:border-white/8 hover:bg-white/4"
              >
                <div className="relative mx-auto aspect-square overflow-hidden rounded-full bg-muted shadow-lg shadow-black/15">
                  {artist.images?.[0]?.url ? (
                    <Image
                      src={artist.images[0].url}
                      alt={artist.name}
                      fill
                      sizes="(min-width: 1024px) 12.5vw, (min-width: 640px) 20vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted">
                      <span className="text-4xl text-muted-foreground">♪</span>
                    </div>
                  )}
                </div>
                <h3 className="mt-3 truncate px-1 text-sm font-semibold">{artist.name}</h3>
                <p className="mt-1 px-1 text-[11px] text-muted-foreground">Artist</p>
              </Link>
            ))}
            </div>
          )}
        </>
      )}

      {!isLoading && viewMode === "list" && (
        <>
          {/* Sortable Playlists List when filter is "playlists" */}
          {filter === "playlists" && (
            <SortablePlaylists
              playlists={filteredPlaylists}
              viewMode="list"
              onPlay={playContext}
            />
          )}

          {/* Normal list for "all" or other filters */}
          {filter !== "playlists" && (
            <div className="space-y-1 rounded-3xl border border-white/8 bg-card/25 p-2 backdrop-blur-xl">
              {/* Playlists */}
              {filter === "all" &&
                filteredPlaylists.map((playlist) => (
                  <Link
                    key={playlist.id}
                    href={`/app/playlist/${playlist.id}`}
                    className="group flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-white/5"
                  >
                    <div className="relative size-13 shrink-0 overflow-hidden rounded-xl bg-muted shadow-md">
                      {playlist.images?.[0]?.url ? (
                        <Image
                          src={playlist.images[0].url}
                          alt={playlist.name}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-muted">
                          <span className="text-xl text-muted-foreground">♪</span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{playlist.name}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        Playlist · {playlist.owner.display_name}
                      </p>
                    </div>
                  </Link>
                ))}

              {/* Albums */}
              {(filter === "all" || filter === "albums") &&
            filteredAlbums.map(({ album }) => (
              <Link
                key={album.id}
                href={`/app/album/${album.id}`}
                className="group flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-white/5"
              >
                <div className="relative size-13 shrink-0 overflow-hidden rounded-xl bg-muted shadow-md">
                  {album.images?.[0]?.url ? (
                    <Image
                      src={album.images[0].url}
                      alt={album.name}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted">
                      <span className="text-xl text-muted-foreground">♪</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{album.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    Album · {album.artists.map((a) => a.name).join(", ")}
                  </p>
                </div>
              </Link>
            ))}

          {/* Artists */}
          {(filter === "all" || filter === "artists") &&
            filteredArtists.map((artist) => (
              <Link
                key={artist.id}
                href={`/app/artist/${artist.id}`}
                className="group flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-white/5"
              >
                <div className="relative size-13 shrink-0 overflow-hidden rounded-full bg-muted shadow-md">
                  {artist.images?.[0]?.url ? (
                    <Image
                      src={artist.images[0].url}
                      alt={artist.name}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted">
                      <span className="text-xl text-muted-foreground">♪</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{artist.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    Artist
                  </p>
                </div>
              </Link>
            ))}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!isLoading && visibleItemCount === 0 && (
        <div className="flex min-h-80 flex-col items-center justify-center rounded-4xl border border-dashed border-white/10 bg-card/25 px-8 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/6">
            {searchQuery ? (
              <Search className="size-6 text-muted-foreground" />
            ) : (
              <Library className="size-6 text-muted-foreground" />
            )}
          </div>
          <h2 className="text-lg font-semibold">
            {searchQuery ? "Nothing matched your search" : "Your collection starts here"}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {searchQuery
              ? `Try another title, artist or owner instead of “${searchQuery}”.`
              : "Save an album, follow an artist or add a playlist and it will appear here."}
          </p>
          {searchQuery ? (
            <Button variant="outline" className="mt-5 rounded-full" onClick={() => setSearchQuery("")}>
              Clear search
            </Button>
          ) : (
            <Button asChild className="mt-5 rounded-full">
              <Link href="/app/search">Open Discover</Link>
            </Button>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

function LibraryStat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2 rounded-full border border-border/70 bg-card/55 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur-xl">
      <Icon className="size-3.5 text-primary" />
      <strong className="font-semibold tabular-nums text-foreground">{value}</strong>
      {label}
    </span>
  );
}
