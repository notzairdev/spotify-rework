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

// Spotify API functions
export * from "./api";

// Spotify React hooks
export {
  // User
  useCurrentUser,
  useTopTracks,
  useTopArtists,
  // Playlists
  useMyPlaylists,
  useAllMyPlaylists,
  usePlaylist,
  usePlaylistTracks,
  useCreatePlaylist,
  useAddTracksToPlaylist,
  useRemoveTracksFromPlaylist,
  // Devices
  useDevices,
  usePlaybackState,
  useCurrentlyPlaying,
  useTransferPlayback,
  useQueue,
  // Search
  useSearch,
  // Library
  useSavedTracks,
  useSaveTracks,
  useRemoveTracks,
  useCheckSavedTracks,
  useSavedAlbums,
  useRecentlyPlayed,
  // Artists
  useArtist,
  useArtistTopTracks,
  useArtistAlbums,
  useRelatedArtists,
  useFollowedArtists,
  // Albums
  useAlbum,
  useAlbumTracks,
  // Tracks
  useTrack,
  // Recommendations
  useRecommendations,
  useAvailableGenreSeeds,
} from "./hooks";

// Track like hook
export { useTrackLike } from "./use-track-like";
