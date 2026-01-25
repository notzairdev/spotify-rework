"use client";

import { useState, useCallback, useRef } from "react";
import {
  Play,
  ListPlus,
  Share2,
  ExternalLink,
  User,
  Heart,
  Disc3,
  Plus,
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
import { getMyPlaylists, startPlayback, addTracksToPlaylist, addToQueue } from "@/lib/spotify";
import { toast } from "sonner";

interface AlbumContextMenuProps {
  children: React.ReactNode;
  albumId: string;
  albumUri: string;
  albumName: string;
  artistId?: string;
  artistName?: string;
  spotifyUrl?: string;
  trackUris?: string[];
}

// Shared cache for playlists
let playlistsCache: { items: any[] } | null = null;
let playlistsFetchPromise: Promise<any> | null = null;

export function AlbumContextMenu({
  children,
  albumId,
  albumUri,
  albumName,
  artistId,
  artistName,
  spotifyUrl,
  trackUris = [],
}: AlbumContextMenuProps) {
  const [playlists, setPlaylists] = useState<any[] | null>(playlistsCache?.items ?? null);
  const [isPlaying, setIsPlaying] = useState(false);
  const dataFetchedRef = useRef(false);

  // Lazy load playlists when menu is about to open
  const handleContextMenu = useCallback(() => {
    if (dataFetchedRef.current) return;
    dataFetchedRef.current = true;

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
  }, []);

  const handlePlay = async () => {
    setIsPlaying(true);
    try {
      await startPlayback({ contextUri: albumUri });
      toast.success("Playing", {
        description: albumName,
      });
    } catch (e) {
      toast.error("Failed to play album");
    } finally {
      setIsPlaying(false);
    }
  };

  const handleAddToPlaylist = async (playlistId: string, playlistName: string) => {
    if (trackUris.length === 0) {
      toast.error("No tracks to add");
      return;
    }
    try {
      await addTracksToPlaylist(playlistId, trackUris);
      toast.success(`Added ${trackUris.length} tracks to ${playlistName}`, {
        description: albumName,
      });
    } catch (e) {
      toast.error("Failed to add to playlist");
    }
  };

  const handleAddToQueue = async () => {
    if (trackUris.length === 0) {
      toast.error("No tracks to add");
      return;
    }
    try {
      for (const uri of trackUris) {
        await addToQueue(uri);
      }
      toast.success(`Added ${trackUris.length} tracks to queue`, {
        description: albumName,
      });
    } catch (e) {
      toast.error("Failed to add to queue");
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
        {/* Play */}
        <ContextMenuItem onClick={handlePlay} disabled={isPlaying}>
          <Play className="mr-2 h-4 w-4" />
          Play
        </ContextMenuItem>

        {/* Add to queue */}
        {trackUris.length > 0 && (
          <ContextMenuItem onClick={handleAddToQueue}>
            <Plus className="mr-2 h-4 w-4" />
            Add to Queue
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {/* Add to playlist submenu */}
        {trackUris.length > 0 && (
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
        )}

        {/* Go to artist */}
        {artistId && (
          <ContextMenuItem asChild>
            <Link href={`/artist/${artistId}`}>
              <User className="mr-2 h-4 w-4" />
              Go to Artist
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
