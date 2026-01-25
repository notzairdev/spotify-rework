"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Grid, List, Plus, Search, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  useMyPlaylists,
  useSavedAlbums,
  useFollowedArtists,
} from "@/lib/spotify/hooks";
import { startPlayback } from "@/lib/spotify/api";

type Filter = "all" | "playlists" | "albums" | "artists";
type ViewMode = "grid" | "list";

export default function LibraryPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch data
  const { data: playlistsData, isLoading: playlistsLoading } = useMyPlaylists();
  const { data: albumsData, isLoading: albumsLoading } = useSavedAlbums();
  const { data: artistsData, isLoading: artistsLoading } = useFollowedArtists();

  const playlists = playlistsData?.items ?? [];
  const albums = albumsData?.items ?? [];
  const artists = artistsData?.artists?.items ?? [];

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

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Todo" },
    { key: "playlists", label: "Playlists" },
    { key: "albums", label: "Álbumes" },
    { key: "artists", label: "Artistas" },
  ];

  const handlePlayPlaylist = async (
    e: React.MouseEvent,
    uri: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await startPlayback({ contextUri: uri });
    } catch (err) {
      console.error("Failed to play:", err);
    }
  };

  const handlePlayAlbum = async (e: React.MouseEvent, uri: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await startPlayback({ contextUri: uri });
    } catch (err) {
      console.error("Failed to play:", err);
    }
  };

  return (
    <div className="py-26 mt-10 container mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-6xl font-bold">My Library</h1>
        <Button variant="outline" size="icon">
          <Plus className="size-5" />
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2">
        {filters.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Search & View Toggle */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en biblioteca"
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode("list")}
            className={cn(viewMode === "list" && "text-primary")}
          >
            <List className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode("grid")}
            className={cn(viewMode === "grid" && "text-primary")}
          >
            <Grid className="size-5" />
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Spinner className="size-8" />
        </div>
      )}

      {/* Content */}
      {!isLoading && viewMode === "grid" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
          {/* Playlists */}
          {(filter === "all" || filter === "playlists") &&
            filteredPlaylists.map((playlist) => (
              <Link
                key={playlist.id}
                href={`/playlist/${playlist.id}`}
                className="group"
              >
                <div className="relative aspect-square overflow-hidden rounded-lg">
                  {playlist.images?.[0]?.url ? (
                    <Image
                      src={playlist.images[0].url}
                      alt={playlist.name}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted">
                      <span className="text-4xl text-muted-foreground">♪</span>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      className="size-12 rounded-full"
                      onClick={(e) => handlePlayPlaylist(e, playlist.uri)}
                    >
                      <Play className="size-5 fill-current" />
                    </Button>
                  </div>
                </div>
                <h3 className="mt-2 truncate font-medium">{playlist.name}</h3>
                <p className="truncate text-sm text-muted-foreground">
                  Playlist • {playlist.owner.display_name}
                </p>
              </Link>
            ))}

          {/* Albums */}
          {(filter === "all" || filter === "albums") &&
            filteredAlbums.map(({ album }) => (
              <Link
                key={album.id}
                href={`/album/${album.id}`}
                className="group"
              >
                <div className="relative aspect-square overflow-hidden rounded-lg">
                  {album.images?.[0]?.url ? (
                    <Image
                      src={album.images[0].url}
                      alt={album.name}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted">
                      <span className="text-4xl text-muted-foreground">♪</span>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      className="size-12 rounded-full"
                      onClick={(e) =>
                        handlePlayAlbum(e, `spotify:album:${album.id}`)
                      }
                    >
                      <Play className="size-5 fill-current" />
                    </Button>
                  </div>
                </div>
                <h3 className="mt-2 truncate font-medium">{album.name}</h3>
                <p className="truncate text-sm text-muted-foreground">
                  Álbum • {album.artists.map((a) => a.name).join(", ")}
                </p>
              </Link>
            ))}

          {/* Artists */}
          {(filter === "all" || filter === "artists") &&
            filteredArtists.map((artist) => (
              <Link
                key={artist.id}
                href={`/artist/${artist.id}`}
                className="group text-center"
              >
                <div className="relative mx-auto aspect-square overflow-hidden rounded-full">
                  {artist.images?.[0]?.url ? (
                    <Image
                      src={artist.images[0].url}
                      alt={artist.name}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted">
                      <span className="text-4xl text-muted-foreground">♪</span>
                    </div>
                  )}
                </div>
                <h3 className="mt-2 font-medium">{artist.name}</h3>
                <p className="text-sm text-muted-foreground">Artista</p>
              </Link>
            ))}
        </div>
      )}

      {!isLoading && viewMode === "list" && (
        <div className="overflow-hidden rounded-lg border border-border">
          {/* Playlists */}
          {(filter === "all" || filter === "playlists") &&
            filteredPlaylists.map((playlist) => (
              <Link
                key={playlist.id}
                href={`/playlist/${playlist.id}`}
                className="flex items-center gap-4 p-3 transition-colors hover:bg-muted/50"
              >
                <div className="relative size-14 shrink-0 overflow-hidden rounded-lg">
                  {playlist.images?.[0]?.url ? (
                    <Image
                      src={playlist.images[0].url}
                      alt={playlist.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted">
                      <span className="text-xl text-muted-foreground">♪</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{playlist.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    Playlist • {playlist.owner.display_name}
                  </p>
                </div>
              </Link>
            ))}

          {/* Albums */}
          {(filter === "all" || filter === "albums") &&
            filteredAlbums.map(({ album }) => (
              <Link
                key={album.id}
                href={`/album/${album.id}`}
                className="flex items-center gap-4 p-3 transition-colors hover:bg-muted/50"
              >
                <div className="relative size-14 shrink-0 overflow-hidden rounded-lg">
                  {album.images?.[0]?.url ? (
                    <Image
                      src={album.images[0].url}
                      alt={album.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted">
                      <span className="text-xl text-muted-foreground">♪</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{album.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    Álbum • {album.artists.map((a) => a.name).join(", ")}
                  </p>
                </div>
              </Link>
            ))}

          {/* Artists */}
          {(filter === "all" || filter === "artists") &&
            filteredArtists.map((artist) => (
              <Link
                key={artist.id}
                href={`/artist/${artist.id}`}
                className="flex items-center gap-4 p-3 transition-colors hover:bg-muted/50"
              >
                <div className="relative size-14 shrink-0 overflow-hidden rounded-full">
                  {artist.images?.[0]?.url ? (
                    <Image
                      src={artist.images[0].url}
                      alt={artist.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted">
                      <span className="text-xl text-muted-foreground">♪</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{artist.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    Artista
                  </p>
                </div>
              </Link>
            ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading &&
        filteredPlaylists.length === 0 &&
        filteredAlbums.length === 0 &&
        filteredArtists.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">
              {searchQuery
                ? "No se encontraron resultados"
                : "Tu biblioteca está vacía"}
            </p>
          </div>
        )}
    </div>
  );
}
