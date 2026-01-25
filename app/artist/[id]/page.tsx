"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Play,
  Shuffle,
  Heart,
  ArrowLeft,
  Users,
  Music,
  Disc3,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  useArtist,
  useArtistTopTracks,
  useArtistAlbums,
  useRelatedArtists,
} from "@/lib/spotify/hooks";
import { startPlayback } from "@/lib/spotify/api";
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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ArtistPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { data: artist, isLoading: artistLoading } = useArtist(id);
  const { data: topTracksData, isLoading: tracksLoading } = useArtistTopTracks(id);
  const { data: albumsData, isLoading: albumsLoading } = useArtistAlbums(id);
  const { data: relatedData, isLoading: relatedLoading } = useRelatedArtists(id);

  const [coverColor, setCoverColor] = useState<HSL | null>(null);

  // Extract dominant color from artist image
  useEffect(() => {
    const imageUrl = artist?.images?.[0]?.url;
    if (!imageUrl) {
      setCoverColor(null);
      return;
    }

    extractDominantColor(imageUrl).then((color) => {
      setCoverColor(color);
    });
  }, [artist?.images]);

  const topTracks = topTracksData?.tracks ?? [];
  const albums = albumsData?.items ?? [];
  const relatedArtists = relatedData?.artists ?? [];

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
        <Button variant="outline" onClick={() => router.push("/home")}>
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

        {/* Back button */}
        <div className="relative z-10 flex items-center gap-2 px-6 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="size-8"
          >
            <ArrowLeft className="size-4" />
          </Button>
        </div>

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
            <div className="mt-2 flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="size-4" />
                <span>{formatFollowers(followersCount)} seguidores</span>
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

      {/* Top Tracks */}
      <section className="px-6 py-8">
        <h2 className="mb-6 text-2xl font-bold">
            Top Tracks of {artist.name}
        </h2>

        {tracksLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="size-6" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {topTracks.slice(0, 5).map((track, index) => (
              <div
                key={track.id}
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
                    href={`/album/${track.album.id}`}
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
            ))}
          </div>
        )}
      </section>

      {/* Discography */}
      <section className="px-6 py-8">
        <h2 className="mb-6 text-2xl font-bold">
            Discography of {artist.name}
        </h2>

        {albumsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="size-6" />
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8">
            {albums.slice(0, 10).map((album) => (
              <Link
                key={album.id}
                href={`/album/${album.id}`}
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
                  {album.release_date?.split("-")[0]} • {album.album_type === "single" ? "Sencillo" : "Álbum"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

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
                  href={`/artist/${relatedArtist.id}`}
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
