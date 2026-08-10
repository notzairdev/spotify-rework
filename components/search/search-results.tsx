"use client";

import Image from "next/image";
import Link from "next/link";
import { Disc3, Music, Play, UserRound } from "lucide-react";
import { toast } from "sonner";

import { SearchResultCard } from "@/components/search/search-result-card";
import { SearchTrackList } from "@/components/search/search-track-list";
import { Button } from "@/components/ui/button";
import {
  startPlayback,
  type SpotifyAlbum,
  type SpotifyArtist,
  type SpotifyPlaylist,
  type SpotifySearchResults,
  type SpotifyTrack,
} from "@/lib/spotify";

export type SearchFilter = "all" | "track" | "artist" | "album" | "playlist";

interface SearchResultsViewProps {
  results: SpotifySearchResults;
  query: string;
  filter: SearchFilter;
}

type TopResult =
  | { kind: "track"; item: SpotifyTrack }
  | { kind: "artist"; item: SpotifyArtist }
  | { kind: "album"; item: SpotifyAlbum }
  | { kind: "playlist"; item: SpotifyPlaylist };

const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function SearchResultsView({ results, query, filter }: SearchResultsViewProps) {
  const tracks = results.tracks?.items ?? [];
  const artists = results.artists?.items ?? [];
  const albums = results.albums?.items ?? [];
  const playlists = (results.playlists?.items ?? []).filter(
    (playlist): playlist is SpotifyPlaylist => Boolean(playlist?.id),
  );
  const topResult = pickTopResult(query, tracks, artists, albums, playlists);

  if (tracks.length + artists.length + albums.length + playlists.length === 0) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center rounded-4xl border border-dashed border-white/10 bg-card/25 px-8 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/6">
          <Music className="size-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Nothing found for “{query}”</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Try a shorter title, an artist name, or check the spelling.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {filter === "all" && (
        <div className="grid gap-7 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)]">
          {topResult && (
            <ResultSection title="Top result">
              <TopResultCard result={topResult} />
            </ResultSection>
          )}
          {tracks.length > 0 && (
            <ResultSection title="Songs">
              <div className="rounded-3xl border border-white/8 bg-card/30 p-2 backdrop-blur-xl">
                <SearchTrackList tracks={tracks.slice(0, 5)} />
              </div>
            </ResultSection>
          )}
        </div>
      )}

      {(filter === "all" || filter === "artist") && artists.length > 0 && (
        <ResultSection title="Artists">
          <ResultGrid>
            {artists.map((artist) => (
              <SearchResultCard
                key={artist.id}
                title={artist.name}
                subtitle={formatArtistSubtitle(artist)}
                href={`/app/artist?id=${artist.id}`}
                imageUrl={artist.images?.[0]?.url}
                contextUri={`spotify:artist:${artist.id}`}
                kind="artist"
              />
            ))}
          </ResultGrid>
        </ResultSection>
      )}

      {filter === "track" && tracks.length > 0 && (
        <ResultSection title="Songs">
          <div className="rounded-3xl border border-white/8 bg-card/30 p-2 backdrop-blur-xl">
            <SearchTrackList tracks={tracks} />
          </div>
        </ResultSection>
      )}

      {(filter === "all" || filter === "album") && albums.length > 0 && (
        <ResultSection title="Albums & singles">
          <ResultGrid>
            {albums.map((album) => (
              <SearchResultCard
                key={album.id}
                title={album.name}
                subtitle={`${formatAlbumType(album.album_type)} · ${album.artists.map((artist) => artist.name).join(", ")}`}
                href={`/app/album?id=${album.id}`}
                imageUrl={album.images[0]?.url}
                contextUri={`spotify:album:${album.id}`}
                kind="album"
              />
            ))}
          </ResultGrid>
        </ResultSection>
      )}

      {(filter === "all" || filter === "playlist") && playlists.length > 0 && (
        <ResultSection title="Playlists">
          <ResultGrid>
            {playlists.map((playlist) => (
              <SearchResultCard
                key={playlist.id}
                title={playlist.name}
                subtitle={`Playlist · ${playlist.owner.display_name ?? "Spotify"}`}
                href={`/app/playlist?id=${playlist.id}`}
                imageUrl={playlist.images?.[0]?.url}
                contextUri={playlist.uri}
                kind="playlist"
              />
            ))}
          </ResultGrid>
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h2 className="mb-4 text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
      {children}
    </section>
  );
}

function ResultGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {children}
    </div>
  );
}

function TopResultCard({ result }: { result: TopResult }) {
  const metadata = getTopResultMetadata(result);

  const handlePlay = async () => {
    try {
      if (result.kind === "track") {
        await startPlayback({ uris: [result.item.uri] });
      } else {
        await startPlayback({ contextUri: metadata.contextUri });
      }
    } catch (error) {
      toast.error("Could not start playback", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <div className="relative min-h-72 overflow-hidden rounded-4xl border border-white/8 bg-card/50 p-5 shadow-xl shadow-black/10 sm:p-6">
      {metadata.imageUrl && (
        <Image
          src={metadata.imageUrl}
          alt=""
          fill
          sizes="50vw"
          className="pointer-events-none object-cover opacity-15 blur-3xl scale-125"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-black/5 via-background/35 to-background/85" />
      <div className="relative flex h-full min-h-60 flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <Link href={metadata.href} className="group min-w-0 flex-1">
          <div className={`relative size-32 overflow-hidden bg-muted shadow-2xl sm:size-38 ${result.kind === "artist" ? "rounded-full" : "rounded-2xl"}`}>
            {metadata.imageUrl ? (
              <Image
                src={metadata.imageUrl}
                alt={metadata.title}
                fill
                loading="eager"
                sizes="152px"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.035]"
              />
            ) : (
              <span className="flex size-full items-center justify-center">
                {result.kind === "artist" ? (
                  <UserRound className="size-12 text-muted-foreground" />
                ) : (
                  <Disc3 className="size-12 text-muted-foreground" />
                )}
              </span>
            )}
          </div>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            {metadata.typeLabel}
          </p>
          <h3 className="mt-1 line-clamp-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {metadata.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{metadata.subtitle}</p>
        </Link>
        <Button
          type="button"
          size="icon"
          aria-label={`Play ${metadata.title}`}
          onClick={() => void handlePlay()}
          className="size-13 shrink-0 rounded-full bg-foreground text-background shadow-xl hover:scale-105"
        >
          <Play className="size-5 fill-current" />
        </Button>
      </div>
    </div>
  );
}

function pickTopResult(
  query: string,
  tracks: SpotifyTrack[],
  artists: SpotifyArtist[],
  albums: SpotifyAlbum[],
  playlists: SpotifyPlaylist[],
): TopResult | null {
  const candidates: TopResult[] = [
    ...tracks.slice(0, 2).map((item): TopResult => ({ kind: "track", item })),
    ...artists.slice(0, 2).map((item): TopResult => ({ kind: "artist", item })),
    ...albums.slice(0, 2).map((item): TopResult => ({ kind: "album", item })),
    ...playlists.slice(0, 1).map((item): TopResult => ({ kind: "playlist", item })),
  ];
  return candidates.sort((a, b) => scoreResult(b, query) - scoreResult(a, query))[0] ?? null;
}

function scoreResult(result: TopResult, query: string): number {
  const name = result.item.name.toLocaleLowerCase();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const typeWeight = result.kind === "track" ? 4 : result.kind === "artist" ? 3 : result.kind === "album" ? 2 : 1;
  if (name === normalizedQuery) return 100 + typeWeight;
  if (name.startsWith(normalizedQuery)) return 70 + typeWeight;
  if (name.includes(normalizedQuery)) return 50 + typeWeight;
  return typeWeight;
}

function getTopResultMetadata(result: TopResult) {
  switch (result.kind) {
    case "track":
      return {
        title: result.item.name,
        subtitle: result.item.artists.map((artist) => artist.name).join(", "),
        typeLabel: "Song",
        imageUrl: result.item.album.images[0]?.url,
        href: `/app/album?id=${result.item.album.id}`,
        contextUri: result.item.uri,
      };
    case "artist":
      return {
        title: result.item.name,
        subtitle: formatArtistSubtitle(result.item),
        typeLabel: "Artist",
        imageUrl: result.item.images?.[0]?.url,
        href: `/app/artist?id=${result.item.id}`,
        contextUri: `spotify:artist:${result.item.id}`,
      };
    case "album":
      return {
        title: result.item.name,
        subtitle: result.item.artists.map((artist) => artist.name).join(", "),
        typeLabel: formatAlbumType(result.item.album_type),
        imageUrl: result.item.images[0]?.url,
        href: `/app/album?id=${result.item.id}`,
        contextUri: `spotify:album:${result.item.id}`,
      };
    case "playlist":
      return {
        title: result.item.name,
        subtitle: result.item.owner.display_name ?? "Spotify",
        typeLabel: "Playlist",
        imageUrl: result.item.images?.[0]?.url,
        href: `/app/playlist?id=${result.item.id}`,
        contextUri: result.item.uri,
      };
  }
}

function formatArtistSubtitle(artist: SpotifyArtist): string {
  if (artist.genres?.length) return artist.genres.slice(0, 2).join(" · ");
  if (artist.followers) return `${compactNumber(artist.followers.total)} followers`;
  return "Artist";
}

function formatAlbumType(type: SpotifyAlbum["album_type"]): string {
  return type === "single" ? "Single" : type === "compilation" ? "Compilation" : "Album";
}

function compactNumber(value: number): string {
  return COMPACT_NUMBER_FORMATTER.format(value);
}
