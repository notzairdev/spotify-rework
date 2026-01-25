"use client";

import { use } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Music } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useUser, useUserPlaylists, useCurrentUser } from "@/lib/spotify/hooks";
import { startPlayback } from "@/lib/spotify/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function UserProfilePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { data: user, isLoading: userLoading } = useUser(id);
  const { data: playlists, isLoading: playlistsLoading } = useUserPlaylists(id);
  const { data: currentUser } = useCurrentUser();

  // If viewing own profile, redirect to /profile
  const isOwnProfile = currentUser?.id === id;

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

  if (!user) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Usuario no encontrado</p>
        <Button variant="outline" onClick={() => router.push("/home")}>
          Volver al inicio
        </Button>
      </div>
    );
  }

  const userInitial = user.display_name?.charAt(0).toUpperCase() ?? "U";
  const userImage = user.images?.[0]?.url;
  const followersCount = user.followers?.total ?? 0;
  const publicPlaylists = playlists?.items ?? [];

  return (
    <div className="pt-10 pb-8 container mx-auto">
      {/* Back button */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="size-8"
        >
          <ArrowLeft className="size-4" />
        </Button>
      </div>

      {/* Header */}
      <div className="mb-12 flex flex-col gap-8 lg:flex-row">
        <div className="relative size-48 shrink-0 overflow-hidden rounded-full bg-linear-to-br from-primary/30 to-accent/30 shadow-2xl">
          {userImage ? (
            <Image
              src={userImage}
              alt={user.display_name ?? "Profile"}
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
            {user.display_name ?? "Usuario"}
          </h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{publicPlaylists.length} playlists públicas</span>
            <span>•</span>
            <span>{followersCount} seguidores</span>
          </div>
        </div>
      </div>

      {/* If own profile, show link to full profile */}
      {isOwnProfile && (
        <div className="mb-8">
          <Button variant="outline" asChild>
            <Link href="/profile">Ver mi perfil completo</Link>
          </Button>
        </div>
      )}

      {/* Public Playlists */}
      <section>
        <h2 className="mb-6 text-2xl font-bold">Playlists públicas</h2>

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
                  {playlist.tracks.total} canciones
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card/50 p-8 text-center">
            <p className="text-muted-foreground">
              Este usuario no tiene playlists públicas
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
