"use client";

import { useEffect } from "react";
import Image from "next/image";
import {
  ArrowUpRight,
  Clock3,
  Compass,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import {
  SearchResultsView,
  type SearchFilter,
} from "@/components/search/search-results";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePreservedPageState } from "@/lib/page-state";
import { useSearchHistory } from "@/lib/search-history";
import {
  useDebouncedSearch,
  useTopArtists,
  type SpotifyArtist,
} from "@/lib/spotify";
import { cn } from "@/lib/utils";

const SEARCH_FILTERS: { key: SearchFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "track", label: "Songs" },
  { key: "artist", label: "Artists" },
  { key: "album", label: "Albums" },
  { key: "playlist", label: "Playlists" },
];
const SEARCH_SKELETON_KEYS = Array.from(
  { length: 5 },
  (_, index) => `search-skeleton-${index}`,
);

export function SearchPage() {
  const [filter, setFilter] = usePreservedPageState<SearchFilter>("filter", "all");
  const {
    query,
    setQuery,
    results,
    isLoading,
    error,
    clear,
    refetch,
    searchNow,
    searchedQuery,
    isSearching,
  } = useDebouncedSearch();
  const { history, addSearch, removeSearch, clearHistory } = useSearchHistory();
  const { data: topArtistsData } = useTopArtists("medium_term", 8);

  const topArtists = topArtistsData?.items ?? [];
  const resultCounts: Record<SearchFilter, number> = {
    all:
      (results?.tracks?.items.length ?? 0) +
      (results?.artists?.items.length ?? 0) +
      (results?.albums?.items.length ?? 0) +
      (results?.playlists?.items.filter(Boolean).length ?? 0),
    track: results?.tracks?.items.length ?? 0,
    artist: results?.artists?.items.length ?? 0,
    album: results?.albums?.items.length ?? 0,
    playlist: results?.playlists?.items.filter(Boolean).length ?? 0,
  };
  const hasResults = resultCounts.all > 0;
  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    const normalizedInput = query.trim().replace(/\s+/g, " ").toLocaleLowerCase();
    if (
      !searchedQuery ||
      normalizedInput !== searchedQuery.toLocaleLowerCase() ||
      isLoading ||
      error ||
      !hasResults
    ) {
      return;
    }

    const timeout = window.setTimeout(() => addSearch(searchedQuery), 900);
    return () => window.clearTimeout(timeout);
  }, [addSearch, error, hasResults, isLoading, query, searchedQuery]);

  const selectHistoryQuery = (historyQuery: string) => {
    setFilter("all");
    searchNow(historyQuery);
  };

  return (
    <div className="relative mx-auto w-full max-w-[96rem] px-5 pb-40 pt-24 sm:px-7 lg:px-8 animate-fade-in">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.09),transparent_62%)]" />

      <header className="relative max-w-3xl pb-8">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
          <Compass className="size-3.5" />
          Discover
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          What do you want to hear?
        </h1>
      </header>

      <div className="relative z-10 rounded-3xl border border-white/8 bg-card/45 p-3 shadow-xl shadow-black/10 backdrop-blur-xl">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setFilter("all");
            searchNow();
          }}
          role="search"
          className="relative"
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (filter !== "all") setFilter("all");
            }}
            placeholder="Search songs, artists, albums, and playlists"
            aria-label="Search Spotify"
            autoComplete="off"
            className="h-13 rounded-2xl border-white/8 bg-black/15 pl-12 pr-24 text-base shadow-none sm:h-14"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {(isSearching || isLoading) && (
              <Loader2 className="mr-1 size-4 animate-spin text-muted-foreground" aria-label="Searching" />
            )}
            {hasQuery && (
              <button
                type="button"
                onClick={() => {
                  clear();
                  setFilter("all");
                }}
                aria-label="Clear search"
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/7 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </form>

        {hasQuery && hasResults && (
          <div className="mt-3 flex items-center gap-1 overflow-x-auto border-t border-white/7 pt-3 scrollbar-hide">
            {SEARCH_FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                disabled={item.key !== "all" && resultCounts[item.key] === 0}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-colors",
                  filter === item.key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-white/6 hover:text-foreground",
                  item.key !== "all" && resultCounts[item.key] === 0 && "cursor-not-allowed opacity-40",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "text-[10px] tabular-nums",
                    filter === item.key ? "text-background/60" : "text-muted-foreground/55",
                  )}
                >
                  {resultCounts[item.key]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <main className="relative mt-9">
        {!hasQuery && (
          <SearchLanding
            history={history}
            topArtists={topArtists}
            onSelectQuery={selectHistoryQuery}
            onRemoveQuery={removeSearch}
            onClearHistory={clearHistory}
          />
        )}

        {hasQuery && (isLoading || (isSearching && !results)) && <SearchLoading />}

        {hasQuery && error && !isLoading && (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-4xl border border-dashed border-white/10 bg-card/25 px-8 text-center">
            <Search className="mb-4 size-7 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Search is unavailable right now</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Spotify did not return results. Your previous searches are still saved locally.
            </p>
            <Button variant="outline" className="mt-5 rounded-full" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        )}

        {hasQuery && results && !isLoading && !error && (
          <SearchResultsView results={results} query={searchedQuery || query} filter={filter} />
        )}
      </main>
    </div>
  );
}

interface SearchLandingProps {
  history: { query: string; searchedAt: number }[];
  topArtists: SpotifyArtist[];
  onSelectQuery: (query: string) => void;
  onRemoveQuery: (query: string) => void;
  onClearHistory: () => void;
}

function SearchLanding({
  history,
  topArtists,
  onSelectQuery,
  onRemoveQuery,
  onClearHistory,
}: SearchLandingProps) {
  return (
    <div className="space-y-12">
      {history.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                Pick up where you left off
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Recent searches</h2>
            </div>
            <button
              type="button"
              onClick={onClearHistory}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map((entry) => (
              <div
                key={entry.query.toLocaleLowerCase()}
                className="group flex items-center rounded-full border border-white/8 bg-card/40 pl-1.5 pr-1.5 transition-colors hover:bg-white/6"
              >
                <button
                  type="button"
                  onClick={() => onSelectQuery(entry.query)}
                  className="flex min-w-0 items-center gap-2.5 py-2 pl-1.5 pr-2 text-sm"
                >
                  <Clock3 className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="max-w-52 truncate">{entry.query}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${entry.query} from history`}
                  onClick={() => onRemoveQuery(entry.query)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-60 transition-[opacity,color,background-color] hover:bg-white/8 hover:text-foreground group-hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {topArtists.length > 0 ? (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            Based on your listening
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Search from your taste</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
            {topArtists.map((artist) => (
              <button
                key={artist.id}
                type="button"
                onClick={() => onSelectQuery(artist.name)}
                className="group min-w-0 text-left"
              >
                <span className="relative block aspect-square overflow-hidden rounded-full bg-muted shadow-lg shadow-black/15">
                  {artist.images?.[0]?.url ? (
                    <Image
                      src={artist.images[0].url}
                      alt={artist.name}
                      fill
                      sizes="(min-width: 1280px) 10vw, (min-width: 640px) 20vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-2xl text-muted-foreground">♪</span>
                  )}
                  <span className="absolute inset-0 bg-black/25 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                <span className="mt-3 flex items-center gap-1 px-1 text-sm font-medium">
                  <span className="truncate">{artist.name}</span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-4xl border border-white/8 bg-card/30 p-7 sm:p-9">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="size-3.5" />
              One search, the useful results first
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Find a song and play it without digging through a wall of cards.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Start with an exact title or artist. Search keeps recent queries on this device and reuses fresh results when you return to them.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function SearchLoading() {
  return (
    <div className="space-y-9" aria-label="Loading search results">
      <div className="grid gap-7 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)]">
        <div className="h-72 animate-pulse rounded-4xl bg-muted/65" />
        <div className="h-72 animate-pulse rounded-4xl bg-muted/45" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {SEARCH_SKELETON_KEYS.map((key) => (
          <div key={key} className="space-y-3 p-2">
            <div className="aspect-square animate-pulse rounded-2xl bg-muted/55" />
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-muted/55" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted/35" />
          </div>
        ))}
      </div>
    </div>
  );
}
