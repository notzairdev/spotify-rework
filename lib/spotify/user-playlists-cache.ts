import { getMyPlaylists } from "./api";

export type MyPlaylistPage = Awaited<ReturnType<typeof getMyPlaylists>>;

const PLAYLIST_CACHE_TTL = 5 * 60 * 1000;

let cachedPlaylists: MyPlaylistPage | null = null;
let cachedAt = 0;
let playlistsRequest: Promise<MyPlaylistPage> | null = null;

export function getCachedMyPlaylists(): Promise<MyPlaylistPage> {
  if (cachedPlaylists && Date.now() - cachedAt < PLAYLIST_CACHE_TTL) {
    return Promise.resolve(cachedPlaylists);
  }

  if (!playlistsRequest) {
    playlistsRequest = getMyPlaylists(50)
      .then((data) => {
        cachedPlaylists = data;
        cachedAt = Date.now();
        return data;
      })
      .finally(() => {
        playlistsRequest = null;
      });
  }

  return playlistsRequest;
}
