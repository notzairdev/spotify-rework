import type { SpotifyPlaylistTrack } from "@/lib/spotify/api";

export type PlaylistSortKey = "custom" | "addedAt" | "title" | "artist" | "album";
export type PlaylistSortDirection = "asc" | "desc";

export function getPlaylistTrackUris(
  items: SpotifyPlaylistTrack[],
  sortKey: PlaylistSortKey,
  direction: PlaylistSortDirection,
): string[] {
  if (sortKey === "custom") {
    return items.flatMap((item) => (item.track?.uri ? [item.track.uri] : []));
  }

  const factor = direction === "asc" ? 1 : -1;
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      let comparison = 0;
      if (sortKey === "addedAt") {
        comparison = getAddedTimestamp(left.item) - getAddedTimestamp(right.item);
      } else if (sortKey === "title") {
        comparison = compareText(left.item.track?.name, right.item.track?.name);
      } else if (sortKey === "artist") {
        comparison = compareText(getArtistNames(left.item), getArtistNames(right.item));
      } else {
        comparison = compareText(left.item.track?.album?.name, right.item.track?.album?.name);
      }
      return comparison === 0 ? left.index - right.index : comparison * factor;
    })
    .flatMap(({ item }) => (item.track?.uri ? [item.track.uri] : []));
}

function getAddedTimestamp(item: SpotifyPlaylistTrack): number {
  return item.added_at ? Date.parse(item.added_at) : 0;
}

function getArtistNames(item: SpotifyPlaylistTrack): string | undefined {
  return item.track?.artists.map((artist) => artist.name).join(", ");
}

function compareText(left?: string, right?: string): number {
  return (left ?? "").localeCompare(right ?? "", undefined, {
    numeric: true,
    sensitivity: "base",
  });
}
