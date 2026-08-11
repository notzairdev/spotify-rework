"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Play,
  Shuffle,
  Clock,
  MoreHorizontal,
  Heart,
  ListMusic,
  Share2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePlaylist, usePlaylistTracks, useCurrentUser } from "@/lib/spotify/hooks";
import { invalidateSpotifyQueryCache } from "@/lib/spotify/query-cache";
import { usePreservedPageState } from "@/lib/page-state";
import {
  startPlayback,
  setShuffle,
  followPlaylist,
  unfollowPlaylist,
  checkUserFollowsPlaylist,
} from "@/lib/spotify/api";
import { Spinner } from "@/components/ui/spinner";
import { PlaylistTrackTable } from "@/components/library/playlist-track-table";
import {
  getPlaylistTrackUris,
  type PlaylistSortDirection,
  type PlaylistSortKey,
} from "@/lib/spotify/playlist-sort";
import { extractDominantColor, hslToString, type HSL } from "@/lib/utils/color-extractor";
import { cn } from "@/lib/utils";

async function playTrackUris(uris: string[]): Promise<void> {
  if (uris.length === 0) return;
  try {
    await startPlayback({ uris });
  } catch (error) {
    console.error("Failed to play sorted playlist:", error);
    toast.error("Could not start playback", {
      description: "Spotify did not accept the selected track order.",
    });
  }
}

export default function PlaylistPage() {
  return (
    <Suspense fallback={<PlaylistPageFallback />}>
      <PlaylistPageContent />
    </Suspense>
  );
}

function PlaylistPageFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner className="size-8" />
    </div>
  );
}

function PlaylistPageContent() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();

  const { data: playlist, isLoading: playlistLoading } = usePlaylist(id);
  const { data: tracksData, isLoading: tracksLoading } = usePlaylistTracks(id);
  const { data: currentUser } = useCurrentUser();
  
  const [coverColor, setCoverColor] = useState<HSL | null>(null);
  const [isFollowing, setIsFollowing] = usePreservedPageState("is-following", false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followChecked, setFollowChecked] = usePreservedPageState("follow-checked", false);
  const [sortKey, setSortKey] = usePreservedPageState<PlaylistSortKey>(
    "playlist-sort-key",
    "custom",
  );
  const [sortDirection, setSortDirection] =
    usePreservedPageState<PlaylistSortDirection>("playlist-sort-direction", "asc");

  // Extract dominant color from cover image
  useEffect(() => {
    const imageUrl = playlist?.images?.[0]?.url;
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
  }, [playlist?.images]);

  // Check if user follows this playlist
  useEffect(() => {
    if (followChecked || !currentUser?.id || !id) return;
    setFollowChecked(true);
    
    checkUserFollowsPlaylist(id, [currentUser.id]).then(([follows]) => {
      setIsFollowing(follows);
    }).catch(() => {});
  }, [currentUser?.id, id, followChecked, setFollowChecked, setIsFollowing]);

  const tracks = tracksData?.items ?? [];
  const canReorder =
    playlist?.owner.id === currentUser?.id || Boolean(playlist?.collaborative);
  const totalDuration = tracks.reduce(
    (acc, item) => acc + (item.track?.duration_ms ?? 0),
    0,
  );
  const totalHours = Math.floor(totalDuration / 3600000);
  const totalMinutes = Math.floor((totalDuration % 3600000) / 60000);

  const handlePlay = async () => {
    if (!playlist) return;
    try {
      if (sortKey === "custom") {
        await startPlayback({ contextUri: playlist.uri });
      } else {
        const uris = getPlaylistTrackUris(tracks, sortKey, sortDirection);
        if (uris.length === 0) return;
        await startPlayback({ uris });
      }
    } catch (e) {
      console.error("Failed to play playlist:", e);
    }
  };

  const handleShuffle = async () => {
    if (!playlist) return;
    try {
      // Enable shuffle first, then start playback
      await setShuffle(true);
      await startPlayback({ contextUri: playlist.uri });
      toast.success("Shuffle play started");
    } catch (e) {
      console.error("Failed to shuffle playlist:", e);
      toast.error("Failed to start shuffle play");
    }
  };

  const handleToggleFollow = async () => {
    if (followLoading || !id) return;
    setFollowLoading(true);
    
    try {
      if (isFollowing) {
        await unfollowPlaylist(id);
        setIsFollowing(false);
        toast.success("Removed from your library");
      } else {
        await followPlaylist(id);
        setIsFollowing(true);
        toast.success("Added to your library");
      }
      invalidateSpotifyQueryCache("user:me:playlists");
    } catch {
      toast.error("Failed to update");
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShare = async () => {
    const url = playlist?.external_urls?.spotify;
    if (url) {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  };

  if (playlistLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Playlist no encontrada</p>
        <Button variant="outline" onClick={() => router.push("/app/home")}>
          Volver al inicio
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col container mx-auto pt-26 pb-40">
      {/* Header */}
      <div className="flex justify-between gap-6 px-6 pb-6 md:flex-row md:items-end">
        {/* Info */}
        <div className="flex flex-col gap-4">
          <div className="flex gap-1 items-center">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground bg-card inline-block px-2 py-1 rounded-sm w-fit">
              Playlist
            </span>
            <Link
              href={`/app/user?id=${playlist.owner.id}`}
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground bg-card inline-block px-2 py-1 rounded-sm w-fit hover:underline"
            >
              Created by <span className="text-white">{playlist.owner.display_name}</span>
            </Link>
          </div>
          <h1 className="font-bold text-7xl">{playlist.name}</h1>
          {playlist.description && (
            <p
              className="text-xs text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: playlist.description }}
            />
          )}
          <div className="mt-2 flex items-center gap-5 text-sm text-muted-foreground">
            <div className="flex gap-1 items-center">
              <div className="p-2 rounded-full bg-primary/20 w-fit">
                <ListMusic className="w-4 h-4 text-primary" />
              </div>
              <span>{playlist.tracks.total} canciones</span>
            </div>
            {totalHours > 0 && (
              <div className="flex gap-1 items-center">
                <div className="p-2 rounded-full bg-primary/20 w-fit">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <span>
                  {totalHours} hr {totalMinutes} min
                </span>
              </div>
            )}
            {totalHours === 0 && totalMinutes > 0 && (
              <div className="flex gap-1 items-center">
                <div className="p-2 rounded-full bg-primary/20 w-fit">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <span>{totalMinutes} min</span>
              </div>
            )}
          </div>
        </div>

        {/* Cover image with glow */}
        <div className="relative">
          {/* Radial glow behind cover */}
          {coverColor && (
            <div
              className="absolute -inset-16 rounded-full blur-3xl opacity-60 transition-opacity duration-1000 z-[-1]"
              style={{
                background: `radial-gradient(circle, hsl(${hslToString(coverColor)}) 0%, transparent 70%)`,
                filter: "blur(250px)",
              }}
            />
          )}
          <div className="relative aspect-square w-48 shrink-0 overflow-hidden rounded-lg shadow-2xl md:w-56">
            {playlist.images?.[0]?.url ? (
              <Image
                src={playlist.images[0].url}
                alt={playlist.name}
                fill
                sizes="(min-width: 768px) 224px, 192px"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-muted">
                <span className="text-4xl text-muted-foreground">♪</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 px-6 pb-6">
        <Button size="lg" onClick={handlePlay} className="p-5 rounded-2xl">
          <Play className="fill-current" />
          <p>Play</p>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleShuffle}
          className="size-12"
          title="Shuffle play"
        >
          <Shuffle className="size-5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleToggleFollow}
          disabled={followLoading}
          className={cn("size-12", isFollowing && "text-primary")}
          title={isFollowing ? "Remove from library" : "Add to library"}
        >
          <Heart className={cn("size-5", isFollowing && "fill-current")} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-12">
              <MoreHorizontal className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleShare}>
              <Share2 className="mr-2 size-4" />
              Copy Link
            </DropdownMenuItem>
            {playlist?.external_urls?.spotify && (
              <DropdownMenuItem asChild>
                <a
                  href={playlist.external_urls.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 size-4" />
                  Open in Spotify
                </a>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="px-6 py-2 text-md font-medium text-muted-foreground">
        <p>Tracklist</p>
      </div>

      {/* Tracks list */}
      {tracksLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="size-6" />
        </div>
      ) : (
        <PlaylistTrackTable
          key={playlist.id}
          items={tracks}
          playlistId={playlist.id}
          snapshotId={playlist.snapshot_id}
          canReorder={canReorder}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={(key, direction) => {
            setSortKey(key);
            setSortDirection(direction);
          }}
          onPlayTracks={playTrackUris}
        />
      )}
    </div>
  );
}
