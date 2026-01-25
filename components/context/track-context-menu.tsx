"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Heart,
  ListPlus,
  Radio,
  Share2,
  User,
  Disc3,
  Plus,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  useMyPlaylists,
  getMyPlaylists,
  addTracksToPlaylist,
  addToQueue,
  saveTracks,
  removeTracks,
  checkSavedTracks,
} from "@/lib/spotify";
import { toast } from "sonner";

interface TrackContextMenuProps {
  children: React.ReactNode;
  trackId: string;
  trackUri: string;
  trackName: string;
  artistId?: string;
  artistName?: string;
  albumId?: string;
  albumName?: string;
  spotifyUrl?: string;
}

// Shared cache for playlists to avoid multiple fetches
let playlistsCache: { items: any[] } | null = null;
let playlistsFetchPromise: Promise<any> | null = null;

export function TrackContextMenu({
  children,
  trackId,
  trackUri,
  trackName,
  artistId,
  artistName,
  albumId,
  albumName,
  spotifyUrl,
}: TrackContextMenuProps) {
  const [playlists, setPlaylists] = useState<any[] | null>(playlistsCache?.items ?? null);
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingToQueue, setIsAddingToQueue] = useState(false);
  const dataFetchedRef = useRef(false);

  // Lazy load data when menu is about to open (on right click)
  const handleContextMenu = useCallback(() => {
    if (dataFetchedRef.current) return;
    dataFetchedRef.current = true;

    // Fetch playlists (with shared cache)
    if (!playlistsCache) {
      if (!playlistsFetchPromise) {
        playlistsFetchPromise = getMyPlaylists(50).then(data => {
          playlistsCache = data;
          playlistsFetchPromise = null;
          return data;
        });
      }
      playlistsFetchPromise.then(data => {
        setPlaylists(data?.items ?? []);
      });
    } else {
      setPlaylists(playlistsCache.items);
    }

    // Check like status
    checkSavedTracks([trackId]).then(([liked]) => {
      setIsLiked(liked);
    }).catch(() => {});
  }, [trackId]);

  const handleAddToQueue = async () => {
    setIsAddingToQueue(true);
    try {
      await addToQueue(trackUri);
      toast.success("Added to queue", {
        description: trackName,
      });
    } catch (e) {
      toast.error("Failed to add to queue");
    } finally {
      setIsAddingToQueue(false);
    }
  };

  const handleAddToPlaylist = async (playlistId: string, playlistName: string) => {
    try {
      await addTracksToPlaylist(playlistId, [trackUri]);
      toast.success(`Added to ${playlistName}`, {
        description: trackName,
      });
    } catch (e) {
      toast.error("Failed to add to playlist");
    }
  };

  const handleToggleLike = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      if (isLiked) {
        await removeTracks([trackId]);
        setIsLiked(false);
        toast.success("Removed from Liked Songs", { description: trackName });
      } else {
        await saveTracks([trackId]);
        setIsLiked(true);
        toast.success("Added to Liked Songs", { description: trackName });
      }
    } catch (e) {
      toast.error("Failed to update");
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (spotifyUrl) {
      await navigator.clipboard.writeText(spotifyUrl);
      toast.success("Link copied to clipboard");
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenu}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {/* Add to playlist submenu */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <ListPlus className="mr-2 h-4 w-4" />
            Add to Playlist
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48 max-h-64 overflow-y-auto">
            {playlists?.map((playlist) => (
              <ContextMenuItem
                key={playlist.id}
                onClick={() => handleAddToPlaylist(playlist.id, playlist.name)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {playlist.images[0]?.url ? (
                    <img
                      src={playlist.images[0].url}
                      alt=""
                      className="w-6 h-6 rounded object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                      <Disc3 className="w-3 h-3 text-muted-foreground" />
                    </div>
                  )}
                  <span className="truncate">{playlist.name}</span>
                </div>
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        {/* Like/Unlike */}
        <ContextMenuItem onClick={handleToggleLike} disabled={isLoading}>
          <Heart
            className="mr-2 h-4 w-4"
            fill={isLiked ? "currentColor" : "none"}
          />
          {isLiked ? "Remove from Liked Songs" : "Save to Liked Songs"}
        </ContextMenuItem>

        {/* Add to queue */}
        <ContextMenuItem onClick={handleAddToQueue} disabled={isAddingToQueue}>
          <Plus className="mr-2 h-4 w-4" />
          Add to Queue
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Go to artist */}
        {artistId && (
          <ContextMenuItem asChild>
            <Link href={`/artist/${artistId}`}>
              <User className="mr-2 h-4 w-4" />
              Go to Artist
            </Link>
          </ContextMenuItem>
        )}

        {/* Go to album */}
        {albumId && (
          <ContextMenuItem asChild>
            <Link href={`/album/${albumId}`}>
              <Disc3 className="mr-2 h-4 w-4" />
              Go to Album
            </Link>
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {/* Share */}
        {spotifyUrl && (
          <ContextMenuItem onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Copy Link
          </ContextMenuItem>
        )}

        {/* Open in Spotify */}
        {spotifyUrl && (
          <ContextMenuItem asChild>
            <a href={spotifyUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in Spotify
            </a>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
