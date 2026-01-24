// Spotify configuration
export { SPOTIFY_CONFIG, getSpotifyAuthUrl, type SpotifyScope } from "./config";

// Spotify client
export {
  getSpotifyClient,
  initializeSpotifyWithToken,
  clearSpotifyClient,
  isSpotifyAuthenticated,
  SpotifyApi,
  type TokenStorage,
  // Re-exported types
  type AccessToken,
  type Album,
  type Artist,
  type Track,
  type Playlist,
  type User,
  type PlaybackState,
  type RecentlyPlayedTracksPage,
  type SavedTrack,
  type SearchResults,
} from "./client";

// Spotify Player (Web Playback SDK)
export {
  SpotifyPlayerProvider,
  useSpotifyPlayer,
  type SpotifyPlayerContextValue,
  type PlaybackState as PlayerPlaybackState,
} from "./player-provider";
