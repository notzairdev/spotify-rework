"use client";

import { useState, useCallback, useRef } from "react";
import {
  Play,
  ListPlus,
  Share2,
  Trash2,
  Pencil,
  ExternalLink,
  UserPlus,
  UserMinus,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { startPlayback, getCurrentUser } from "@/lib/spotify";
import { toast } from "sonner";

interface PlaylistContextMenuProps {
  children: React.ReactNode;
  playlistId: string;
  playlistUri: string;
  playlistName: string;
  ownerId: string;
  spotifyUrl?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

// Shared cache for current user
let currentUserCache: { id: string } | null = null;
let currentUserFetchPromise: Promise<any> | null = null;

export function PlaylistContextMenu({
  children,
  playlistId,
  playlistUri,
  playlistName,
  ownerId,
  spotifyUrl,
  onEdit,
  onDelete,
}: PlaylistContextMenuProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(currentUserCache?.id ?? null);
  const [isPlaying, setIsPlaying] = useState(false);
  const dataFetchedRef = useRef(false);

  // Lazy load user data when menu is about to open
  const handleContextMenu = useCallback(() => {
    if (dataFetchedRef.current) return;
    dataFetchedRef.current = true;

    if (!currentUserCache) {
      if (!currentUserFetchPromise) {
        currentUserFetchPromise = getCurrentUser().then(user => {
          currentUserCache = user;
          currentUserFetchPromise = null;
          return user;
        });
      }
      currentUserFetchPromise.then(user => {
        setCurrentUserId(user?.id ?? null);
      });
    } else {
      setCurrentUserId(currentUserCache.id);
    }
  }, []);

  const isOwner = currentUserId === ownerId;

  const handlePlay = async () => {
    setIsPlaying(true);
    try {
      await startPlayback({ contextUri: playlistUri });
      toast.success("Playing", {
        description: playlistName,
      });
    } catch (e) {
      toast.error("Failed to play playlist");
    } finally {
      setIsPlaying(false);
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

        <ContextMenuSeparator />

        {/* Edit (only for owner) */}
        {isOwner && onEdit && (
          <ContextMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Details
          </ContextMenuItem>
        )}

        {/* Delete (only for owner) */}
        {isOwner && onDelete && (
          <>
            <ContextMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Playlist
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

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
