"use client";

import { useState } from "react";
import { Search, Play, Music, Disc3, User, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { 
  useCategories, 
  useDebouncedSearch,
  startPlayback,
  type SpotifyCategory,
} from "@/lib/spotify";

// Predefined colors for categories (Spotify-like)
const categoryColors = [
  "from-rose-500 to-pink-600",
  "from-violet-500 to-purple-600",
  "from-blue-500 to-indigo-600",
  "from-cyan-500 to-teal-600",
  "from-emerald-500 to-green-600",
  "from-amber-500 to-orange-600",
  "from-red-500 to-rose-600",
  "from-fuchsia-500 to-pink-600",
];

function getCategoryColor(index: number): string {
  return categoryColors[index % categoryColors.length];
}

export default function SearchPage() {
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories(40);
  const { 
    query, 
    setQuery, 
    results, 
    isLoading: searchLoading, 
    clear,
    isSearching,
  } = useDebouncedSearch(2000);

  const categories = categoriesData?.categories?.items ?? [];
  const hasResults = results && (
    (results.tracks?.items?.length ?? 0) > 0 ||
    (results.artists?.items?.length ?? 0) > 0 ||
    (results.albums?.items?.length ?? 0) > 0 ||
    (results.playlists?.items?.length ?? 0) > 0
  );

  const handlePlayTrack = async (uri: string) => {
    try {
      await startPlayback({ uris: [uri] });
    } catch (e) {
      console.error("Failed to play:", e);
    }
  };

  const handlePlayContext = async (uri: string) => {
    try {
      await startPlayback({ contextUri: uri });
    } catch (e) {
      console.error("Failed to play:", e);
    }
  };

  return (
    <div className="py-24 px-6 container mx-auto animate-fade-in">
      {/* Search Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-display font-bold text-foreground mb-6">
          Discover
        </h1>
        
        {/* Search Input */}
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="What do you want to listen to?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 pr-12 h-14 text-lg bg-card/50 border-white/10 rounded-full focus:ring-2 focus:ring-primary/50"
          />
          {query && (
            <button
              onClick={clear}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          {/* Loading indicator for debounced search */}
          {isSearching && (
            <div className="absolute right-14 top-1/2 -translate-y-1/2">
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Search Results */}
      {searchLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {hasResults && !searchLoading && (
        <div className="space-y-10 mb-16">
          {/* Tracks */}
          {results.tracks?.items && results.tracks.items.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Canciones</h2>
              <div className="space-y-2">
                {results.tracks.items.slice(0, 5).map((track) => (
                  <div
                    key={track.id}
                    onClick={() => handlePlayTrack(track.uri)}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-card/50 cursor-pointer transition-colors group"
                  >
                    <div className="relative">
                      {track.album.images[0]?.url ? (
                        <img
                          src={track.album.images[0].url}
                          alt={track.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                          <Music className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                        <Play className="w-5 h-5 text-white" fill="currentColor" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{track.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {track.artists.map((a) => a.name).join(", ")}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatDuration(track.duration_ms)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Artists */}
          {results.artists?.items && results.artists.items.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Artistas</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                {results.artists.items.slice(0, 6).map((artist) => (
                  <Link
                    key={artist.id}
                    href={`/artist/${artist.id}`}
                    className="group text-center"
                  >
                    <div className="relative aspect-square mb-3 rounded-full overflow-hidden">
                      {artist.images?.[0]?.url ? (
                        <img
                          src={artist.images[0].url}
                          alt={artist.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <User className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Button size="icon" className="rounded-full">
                          <Play className="w-5 h-5" fill="currentColor" />
                        </Button>
                      </div>
                    </div>
                    <h3 className="font-medium truncate">{artist.name}</h3>
                    <p className="text-sm text-muted-foreground">Artista</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Albums */}
          {results.albums?.items && results.albums.items.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Álbumes</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                {results.albums.items.slice(0, 6).map((album) => (
                  <Link
                    key={album.id}
                    href={`/album/${album.id}`}
                    className="group"
                  >
                    <div className="relative aspect-square mb-3 rounded-xl overflow-hidden">
                      {album.images[0]?.url ? (
                        <img
                          src={album.images[0].url}
                          alt={album.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Disc3 className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Button size="icon" className="rounded-full">
                          <Play className="w-5 h-5" fill="currentColor" />
                        </Button>
                      </div>
                    </div>
                    <h3 className="font-medium truncate">{album.name}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {album.artists.map((a) => a.name).join(", ")}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Playlists */}
          {results.playlists?.items && results.playlists.items.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Playlists</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                {results.playlists.items.slice(0, 6).map((playlist) => (
                  <Link
                    key={playlist.id}
                    href={`/playlist/${playlist.id}`}
                    className="group"
                  >
                    <div className="relative aspect-square mb-3 rounded-xl overflow-hidden">
                      {playlist.images[0]?.url ? (
                        <img
                          src={playlist.images[0].url}
                          alt={playlist.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Music className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Button size="icon" className="rounded-full">
                          <Play className="w-5 h-5" fill="currentColor" />
                        </Button>
                      </div>
                    </div>
                    <h3 className="font-medium truncate">{playlist.name}</h3>
                    <p className="text-sm text-muted-foreground">Playlist</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Categories - show when no search */}
      {!query && (
        <section>
          <h2 className="text-xl font-semibold mb-6">Explorar</h2>
          {categoriesLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array(10).fill(0).map((_, i) => (
                <div key={i} className="aspect-square rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {categories.map((category, i) => (
                <CategoryCard key={category.id} category={category} colorClass={getCategoryColor(i)} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function CategoryCard({ category, colorClass }: { category: SpotifyCategory; colorClass: string }) {
  return (
    <Link
      href={`/search/category/${category.id}`}
      className={cn(
        "relative aspect-square rounded-2xl overflow-hidden group cursor-pointer",
        "bg-gradient-to-br",
        colorClass
      )}
    >
      {/* Category image */}
      {category.icons[0]?.url && (
        <img
          src={category.icons[0].url}
          alt=""
          className="absolute bottom-0 right-0 w-24 h-24 object-cover rotate-25 translate-x-4 translate-y-2 shadow-xl group-hover:scale-110 transition-transform"
        />
      )}
      
      {/* Title */}
      <div className="absolute inset-0 p-4">
        <h3 className="text-lg font-bold text-white">{category.name}</h3>
      </div>
      
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
