"use client";

import { use } from "react";
import { ArrowLeft, Play, Music } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCategoryPlaylists, startPlayback } from "@/lib/spotify";

interface CategoryPageProps {
  params: Promise<{ id: string }>;
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isLoading } = useCategoryPlaylists(id, 50);

  const playlists = data?.playlists?.items ?? [];

  const handlePlayPlaylist = async (uri: string) => {
    try {
      await startPlayback({ contextUri: uri });
    } catch (e) {
      console.error("Failed to play:", e);
    }
  };

  return (
    <div className="py-24 px-6 container mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-display font-bold text-foreground">
          {id.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
        </h1>
      </div>

      {/* Playlists Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {Array(10).fill(0).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-square rounded-xl bg-muted animate-pulse" />
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Music className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No se encontraron playlists</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {playlists.map((playlist) => (
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
                  <Button 
                    size="icon" 
                    className="rounded-full"
                    onClick={(e) => {
                      e.preventDefault();
                      handlePlayPlaylist(playlist.uri);
                    }}
                  >
                    <Play className="w-5 h-5" fill="currentColor" />
                  </Button>
                </div>
              </div>
              <h3 className="font-medium truncate">{playlist.name}</h3>
              <p className="text-sm text-muted-foreground truncate">
                {playlist.description || `${playlist.tracks.total} canciones`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
