"use client";

import { useCallback, useState, type ReactNode } from "react";
import Image from "next/image";
import { Disc3, ListPlus } from "lucide-react";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Spinner } from "@/components/ui/spinner";
import { addTracksToPlaylist, invalidateSpotifyQueryCache } from "@/lib/spotify";
import {
  getCachedMyPlaylists,
  type MyPlaylistPage,
} from "@/lib/spotify/user-playlists-cache";

interface TrackPlaylistContextMenuProps {
  children: ReactNode;
  trackUri: string;
  trackName: string;
}

export function TrackPlaylistContextMenu({
  children,
  trackUri,
  trackName,
}: TrackPlaylistContextMenuProps) {
  const [playlists, setPlaylists] = useState<MyPlaylistPage["items"] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadPlaylists = useCallback(() => {
    if (playlists || isLoading) return;

    setIsLoading(true);
    void getCachedMyPlaylists()
      .then((data) => setPlaylists(data.items ?? []))
      .catch(() => {
        toast.error("Could not load your playlists");
        setPlaylists([]);
      })
      .finally(() => setIsLoading(false));
  }, [isLoading, playlists]);

  const addToPlaylist = async (playlistId: string, playlistName: string) => {
    try {
      await addTracksToPlaylist(playlistId, [trackUri]);
      invalidateSpotifyQueryCache(`playlist:${playlistId}`);
      toast.success(`Added to ${playlistName}`, { description: trackName });
    } catch {
      toast.error("Could not add this track", { description: playlistName });
    }
  };

  return (
    <ContextMenu onOpenChange={(open) => open && loadPlaylists()}>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="max-h-80 w-64 overflow-y-auto">
        <ContextMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
          <ListPlus className="size-3.5" />
          Add to playlist
        </ContextMenuLabel>

        {isLoading && !playlists ? (
          <ContextMenuItem disabled>
            <Spinner className="mr-2 size-3.5" />
            Loading playlists…
          </ContextMenuItem>
        ) : playlists?.length === 0 ? (
          <ContextMenuItem disabled>No playlists available</ContextMenuItem>
        ) : (
          playlists?.map((playlist) => (
            <ContextMenuItem
              key={playlist.id}
              onClick={() => void addToPlaylist(playlist.id, playlist.name)}
              className="gap-2"
            >
              <div className="relative size-7 shrink-0 overflow-hidden rounded-md bg-muted">
                {playlist.images?.[0]?.url ? (
                  <Image
                    src={playlist.images[0].url}
                    alt=""
                    fill
                    sizes="28px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <Disc3 className="size-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <span className="truncate">{playlist.name}</span>
            </ContextMenuItem>
          ))
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
