"use client";

import { useState, useCallback, useRef } from "react";
import {
  BookOpenText,
  Heart,
  ListPlus,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  getMyPlaylists,
  addTracksToPlaylist,
  addToQueue,
  saveTracks,
  removeTracks,
  checkSavedTracks,
  invalidateSpotifyQueryCache,
} from "@/lib/spotify";
import { useTrackCredits } from "@/lib/music-data";
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
type PlaylistPage = Awaited<ReturnType<typeof getMyPlaylists>>;

let playlistsCache: PlaylistPage | null = null;
let playlistsFetchPromise: Promise<PlaylistPage> | null = null;

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
  const [playlists, setPlaylists] = useState<PlaylistPage["items"] | null>(
    playlistsCache?.items ?? null,
  );
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingToQueue, setIsAddingToQueue] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const dataFetchedRef = useRef(false);
  const { data: credits, error: creditsError, isLoading: creditsLoading } =
    useTrackCredits(trackId, creditsOpen);

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
    } catch {
      toast.error("Failed to add to queue");
    } finally {
      setIsAddingToQueue(false);
    }
  };

  const handleAddToPlaylist = async (playlistId: string, playlistName: string) => {
    try {
      await addTracksToPlaylist(playlistId, [trackUri]);
      invalidateSpotifyQueryCache(`playlist:${playlistId}`);
      toast.success(`Added to ${playlistName}`, {
        description: trackName,
      });
    } catch {
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
      invalidateSpotifyQueryCache("user:me:saved-tracks");
    } catch {
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
    <>
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
                  {playlist.images?.[0]?.url ? (
                    <img
                      src={playlist.images?.[0]?.url}
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

        <ContextMenuItem onClick={() => setCreditsOpen(true)}>
          <BookOpenText className="mr-2 h-4 w-4" />
          Song credits
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Go to artist */}
        {artistId && (
          <ContextMenuItem asChild>
            <Link href={`/app/artist?id=${artistId}`}>
              <User className="mr-2 h-4 w-4" />
              Go to Artist
            </Link>
          </ContextMenuItem>
        )}

        {/* Go to album */}
        {albumId && (
          <ContextMenuItem asChild>
            <Link href={`/app/album?id=${albumId}`}>
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

      <Dialog open={creditsOpen} onOpenChange={setCreditsOpen}>
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto]">
          <DialogHeader className="px-6 py-5 pr-16 text-left">
            <div className="flex items-center gap-3">
              <div className="min-w-0">
                <DialogTitle className="truncate text-lg font-semibold">
                  {trackName}
                </DialogTitle>
                <DialogDescription className="truncate text-sm">
                  {[artistName, albumName].filter(Boolean).join(" · ") || "Song credits"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-48 overflow-y-auto px-6 py-5">
            {creditsLoading ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-muted-foreground">
                <Spinner className="size-6" />
                <p className="text-sm">Looking up available credits…</p>
              </div>
            ) : credits ? (
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {credits.groups.map((group) => (
                  <div key={group.label} className="min-w-0">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </p>
                    <p className="text-sm leading-relaxed text-foreground">
                      {group.names.join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center text-center">
                <BookOpenText className="mb-3 size-8 text-muted-foreground/50" />
                <p className="font-medium">No detailed credits found</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {creditsError
                    ? "Credits could not be loaded right now."
                    : "This release does not have contributor credits in the available catalog."}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="justify-between px-6 py-4">
            {credits ? (
              <a
                href={credits.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Data from MusicBrainz
                <ExternalLink className="size-3" />
              </a>
            ) : <span />}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
