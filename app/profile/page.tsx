"use client";

import Link from "next/link";
import Image from "next/image";
import { ExternalLink, Settings, Play, Music } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  useCurrentUser,
  useTopArtists,
  useMyPlaylists,
  useFollowedArtists,
} from "@/lib/spotify/hooks";
import { startPlayback } from "@/lib/spotify/api";

export default function ProfilePage() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: topArtists, isLoading: artistsLoading } = useTopArtists("short_term", 6);
  const { data: playlists, isLoading: playlistsLoading } = useMyPlaylists(20);
  const { data: followedData } = useFollowedArtists(50);

  const publicPlaylists = playlists?.items?.filter((p) => p.public) ?? [];
  const followersCount = user?.followers?.total ?? 0;
  const followingCount = followedData?.artists?.items?.length ?? 0;

  const handlePlayArtist = async (e: React.MouseEvent, artistId: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await startPlayback({ contextUri: `spotify:artist:${artistId}` });
    } catch (err) {
      console.error("Failed to play artist:", err);
    }
  };

  const handlePlayPlaylist = async (e: React.MouseEvent, uri: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await startPlayback({ contextUri: uri });
    } catch (err) {
      console.error("Failed to play playlist:", err);
    }
  };

  if (userLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  const userInitial = user?.display_name?.charAt(0).toUpperCase() ?? "U";
  const userImage = user?.images?.[0]?.url;

  return (
    <div className="py-26 container mx-auto">
      {/* Header */}
      <div className="mb-12 flex flex-col gap-8 lg:flex-row">
        <div className="relative size-48 shrink-0 overflow-hidden rounded-full bg-linear-to-br from-primary/30 to-accent/30 shadow-2xl">
          {userImage ? (
            <Image
              src={userImage}
              alt={user?.display_name ?? "Profile"}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <span className="text-7xl font-bold">{userInitial}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-end">
          <p className="mb-3 text-xs uppercase tracking-widest text-primary">
            Perfil
          </p>
          <h1 className="mb-4 text-5xl font-bold leading-none lg:text-7xl">
            {user?.display_name ?? "Usuario"}
          </h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{publicPlaylists.length} playlists públicas</span>
            <span>•</span>
            <span>{followersCount} seguidores</span>
            <span>•</span>
            <span>{followingCount} siguiendo</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-12 flex items-center gap-4">
        <Button variant="outline" size="lg" asChild>
          <a
            href={user?.external_urls?.spotify ?? "https://open.spotify.com/"}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="mr-2 size-4" />
            Ver en Spotify
          </a>
        </Button>
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <Settings className="size-5" />
          </Link>
        </Button>
      </div>

      {/* Top Artists This Month */}
      <section className="mb-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Most Played Artists</h2>
          <span className="text-sm text-muted-foreground">This Month</span>
        </div>

        {artistsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : topArtists?.items?.length ? (
          <div className="grid grid-cols-6 gap-4 sm:grid-cols-7 md:grid-cols-8">
            {topArtists.items.map((artist) => (
              <div
                key={artist.id}
                className="group cursor-pointer text-center"
                onClick={(e) => handlePlayArtist(e, artist.id)}
              >
                <div className="relative mx-auto aspect-square overflow-hidden rounded-full transition-transform group-hover:scale-105">
                  {artist.images?.[0]?.url ? (
                    <Image
                      src={artist.images[0].url}
                      alt={artist.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted">
                      <Music className="size-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button size="icon" className="rounded-full">
                      <Play className="size-5 fill-current" />
                    </Button>
                  </div>
                </div>
                <h3 className="mt-2 truncate font-medium">{artist.name}</h3>
                <p className="text-sm text-muted-foreground">Artist</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card/50 p-8 text-center">
            <p className="text-muted-foreground">
              Listen to some artists to see them here!
            </p>
          </div>
        )}
      </section>

      {/* Public Playlists */}
      <section>
        <h2 className="mb-6 text-2xl font-bold">Public Playlists</h2>

        {playlistsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : publicPlaylists.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8">
            {publicPlaylists.map((playlist) => (
              <Link
                key={playlist.id}
                href={`/playlist/${playlist.id}`}
                className="group"
              >
                <div className="relative aspect-square overflow-hidden rounded-lg transition-transform group-hover:scale-105">
                  {playlist.images?.[0]?.url ? (
                    <Image
                      src={playlist.images[0].url}
                      alt={playlist.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted">
                      <Music className="size-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      className="rounded-full"
                      onClick={(e) => handlePlayPlaylist(e, playlist.uri)}
                    >
                      <Play className="size-5 fill-current" />
                    </Button>
                  </div>
                </div>
                <h3 className="mt-2 text-sm truncate font-medium">{playlist.name}</h3>
                <p className="text-[13px] text-muted-foreground">
                  {playlist.tracks.total} songs
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card/50 p-8 text-center">
            <p className="text-muted-foreground">
              No tienes playlists públicas
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
