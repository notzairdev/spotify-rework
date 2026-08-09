"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Heart,
  MoreHorizontal,
  Play,
  Disc3,
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
import { Spinner } from "@/components/ui/spinner";
import { TrackContextMenu } from "@/components/context";
import { useAlbum, useAlbumTracks } from "@/lib/spotify/hooks";
import { invalidateSpotifyQueryCache } from "@/lib/spotify/query-cache";
import { usePreservedPageState } from "@/lib/page-state";
import {
  startPlayback,
  saveAlbums,
  removeAlbums,
  checkSavedAlbums,
} from "@/lib/spotify/api";
import {
  extractDominantColor,
  hslToString,
  type HSL,
} from "@/lib/utils/color-extractor";
import { cn } from "@/lib/utils";

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatCopyrightText(copyright: { text: string; type: "C" | "P" }) {
  const text = copyright.text.replace(/^\s*\((?:C|P)\)\s*/i, "");
  const label = copyright.type === "P" ? "Performance" : "Copyright";

  return `${label}: ${text}`;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AlbumPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const { data: album, isLoading: albumLoading } = useAlbum(id);
  const { data: tracksData, isLoading: tracksLoading } = useAlbumTracks(id);

  const [coverColor, setCoverColor] = useState<HSL | null>(null);
  const [isSaved, setIsSaved] = usePreservedPageState("is-saved", false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveChecked, setSaveChecked] = usePreservedPageState("save-checked", false);

  // Extract dominant color from cover image
  useEffect(() => {
    const imageUrl = album?.images?.[0]?.url;
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
  }, [album?.images]);

  // Check if album is saved in library
  useEffect(() => {
    if (saveChecked || !id) return;
    setSaveChecked(true);

    checkSavedAlbums([id])
      .then(([saved]) => {
        setIsSaved(saved);
      })
      .catch(() => {});
  }, [id, saveChecked, setIsSaved, setSaveChecked]);

  const tracks = tracksData?.items ?? [];
  const totalDuration = tracks.reduce(
    (acc, track) => acc + (track.duration_ms ?? 0),
    0,
  );
  const totalMinutes = Math.floor(totalDuration / 60000);

  const handlePlayAlbum = async () => {
    if (!album) return;
    try {
      await startPlayback({ contextUri: `spotify:album:${album.id}` });
    } catch (e) {
      console.error("Failed to play album:", e);
    }
  };

  const handlePlayTrack = async (trackUri: string, offset: number) => {
    if (!album) return;
    try {
      await startPlayback({
        contextUri: `spotify:album:${album.id}`,
        offset: { position: offset },
      });
    } catch (e) {
      console.error("Failed to play track:", e);
    }
  };

  const handleToggleSave = async () => {
    if (saveLoading || !id) return;
    setSaveLoading(true);

    try {
      if (isSaved) {
        await removeAlbums([id]);
        setIsSaved(false);
        toast.success("Removed from your library");
      } else {
        await saveAlbums([id]);
        setIsSaved(true);
        toast.success("Added to your library");
      }
      invalidateSpotifyQueryCache("user:me:saved-albums");
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleShare = async () => {
    const url = album?.external_urls?.spotify;
    if (url) {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  };

  if (albumLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Album not found</p>
        <Button variant="outline" onClick={() => router.push("/app/home")}>
          Go back home
        </Button>
      </div>
    );
  }

  const albumImage = album.images?.[0]?.url;
  const releaseYear = album.release_date?.split("-")[0];
  const copyrights = album.copyrights ?? [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-15 px-6 pb-42 pt-32 md:flex-row md:items-start lg:px-8">
      {/* Hero Section */}
      {/* Background glow */}
      {coverColor && (
        <div
          className="absolute inset-0 opacity-15 transition-opacity duration-1000 pointer-events-none"
          style={{
            zIndex: 0,
            background: `radial-gradient(ellipse at top, hsl(${hslToString(coverColor)}) 0%, transparent 70%)`,
          }}
        />
      )}
      <div className="w-full md:sticky md:top-28 md:w-[clamp(16rem,22vw,24rem)] md:shrink-0 md:transition-transform md:duration-300 md:ease-out md:will-change-transform" style={{ zIndex: 1 }}>
        <div className="flex flex-col items-center gap-8 pb-8 md:items-start">
          {/* Album cover */}
          <div className="relative aspect-square w-full max-w-[18rem] shrink-0 overflow-hidden rounded-[1.5rem] shadow-2xl md:max-w-none md:w-[clamp(16rem,22vw,24rem)]">
            {albumImage ? (
              <Image
                src={albumImage}
                alt={album.name}
                fill
                sizes="(min-width: 768px) 22vw, 288px"
                loading="eager"
                className="object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-muted">
                <Disc3 className="size-16 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3">
        {/* Info - Centered */}
        <div className="flex flex-col gap-2">
          {/* Album title */}
          <div className="flex items-center">
            <h1 className="text-4xl font-semibold md:text-2xl lg:text-4xl flex-1">
              {album.name}
            </h1>
            <div className="">
              <div className="mt-4 flex items-center gap-4">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleToggleSave}
                  disabled={saveLoading}
                  className={cn(isSaved && "text-primary")}
                  title={isSaved ? "Remove from library" : "Add to library"}
                >
                  <Heart className={cn("size-5", isSaved && "fill-current")} />
                </Button>
                <Button size="lg" onClick={handlePlayAlbum} className="px-8 rounded-xl">
                  Play Album
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost">
                      <MoreHorizontal className="size-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center">
                    <DropdownMenuItem onClick={handleShare}>
                      <Share2 className="mr-2 size-4" />
                      Copy Link
                    </DropdownMenuItem>
                    {album?.external_urls?.spotify && (
                      <DropdownMenuItem asChild>
                        <a
                          href={album.external_urls.spotify}
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
            </div>
          </div>

          {/* Metadata line */}
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {album.artists?.map((artist, i) => (
              <span key={artist.id}>
                <Link
                  href={`/app/artist/${artist.id}`}
                  className="text-primary hover:underline"
                >
                  {artist.name}
                </Link>
                {i < album.artists.length - 1 && (
                  <span className="text-primary">, </span>
                )}
              </span>
            ))}
            <span>·</span>
            <span>{releaseYear}</span>
            <span>·</span>
            <span>{album.total_tracks} TRACKS</span>
            <span>·</span>
            <span>{totalMinutes} MIN</span>
          </div>
        </div>

        {/* Tracks list */}
        {tracksLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : (
          <div className="flex flex-col">
            {tracks.map((track, index) => (
              <TrackContextMenu
                key={track.id}
                trackId={track.id}
                trackUri={track.uri}
                trackName={track.name}
                artistId={track.artists?.[0]?.id}
                artistName={track.artists?.[0]?.name}
                albumId={album.id}
                albumName={album.name}
                spotifyUrl={track.external_urls?.spotify}
              >
                <div
                  className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-3 transition-colors hover:bg-muted/50 rounded-lg"
                  onClick={() => handlePlayTrack(track.uri, index)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void handlePlayTrack(track.uri, index);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {/* Track number / play button */}
                  <div className="flex w-8 items-center justify-center">
                    <span className="text-sm text-muted-foreground group-hover:hidden">
                      {index + 1}
                    </span>
                    <Play className="hidden size-4 fill-current group-hover:block" />
                  </div>

                  {/* Track info */}
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{track.name}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {track.artists?.map((artist, i) => (
                        <span key={artist.id}>
                          <Link
                            href={`/app/artist/${artist.id}`}
                            className="hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {artist.name}
                          </Link>
                          {i < track.artists.length - 1 && ", "}
                        </span>
                      ))}
                    </span>
                  </div>

                  {/* Duration */}
                  <div className="flex items-center justify-end gap-4 pr-4">
                    <span className="text-sm text-muted-foreground">
                      {formatDuration(track.duration_ms)}
                    </span>
                  </div>
                </div>
              </TrackContextMenu>
            ))}

            {/* Footer Credits */}
            {copyrights.length > 0 && (
              <div className="mt-12 px-6">
                <div className="flex flex-col gap-1">
                  {copyrights.map((copyright) => (
                    <p
                      key={`${copyright.type}-${copyright.text}`}
                      className="text-xs uppercase tracking-widest text-muted-foreground"
                    >
                      {formatCopyrightText(copyright)}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
