"use client";

import { useState } from "react";
import {
  Play,
  Share2,
  ExternalLink,
  UserPlus,
  UserMinus,
  Radio,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { startPlayback } from "@/lib/spotify";
import { toast } from "sonner";

interface ArtistContextMenuProps {
  children: React.ReactNode;
  artistId: string;
  artistUri: string;
  artistName: string;
  spotifyUrl?: string;
  isFollowing?: boolean;
  onToggleFollow?: () => Promise<void>;
}

export function ArtistContextMenu({
  children,
  artistId,
  artistUri,
  artistName,
  spotifyUrl,
  isFollowing,
  onToggleFollow,
}: ArtistContextMenuProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  const handlePlay = async () => {
    setIsPlaying(true);
    try {
      await startPlayback({ contextUri: artistUri });
      toast.success("Playing", {
        description: artistName,
      });
    } catch (e) {
      toast.error("Failed to play artist");
    } finally {
      setIsPlaying(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!onToggleFollow) return;
    setIsFollowLoading(true);
    try {
      await onToggleFollow();
      toast.success(isFollowing ? "Unfollowed" : "Following", {
        description: artistName,
      });
    } catch (e) {
      toast.error("Failed to update");
    } finally {
      setIsFollowLoading(false);
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
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {/* Play */}
        <ContextMenuItem onClick={handlePlay} disabled={isPlaying}>
          <Play className="mr-2 h-4 w-4" />
          Play
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Follow/Unfollow */}
        {onToggleFollow && (
          <ContextMenuItem onClick={handleToggleFollow} disabled={isFollowLoading}>
            {isFollowing ? (
              <>
                <UserMinus className="mr-2 h-4 w-4" />
                Unfollow
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Follow
              </>
            )}
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
