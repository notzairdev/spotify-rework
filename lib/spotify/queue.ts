import type { SpotifyTrack } from "./api";

type RepeatMode = "off" | "track" | "context";

/**
 * Removes repeat artifacts returned by Spotify without discarding intentional
 * duplicate queue entries during normal playback.
 */
export function normalizePlaybackQueue(
  tracks: SpotifyTrack[],
  currentTrackId: string | undefined,
  repeatMode: RepeatMode
): SpotifyTrack[] {
  if (tracks.length === 0) return [];

  const isRepeatedSingleContext = !!currentTrackId
    && tracks.length > 1
    && tracks.every((track) => track.id === currentTrackId);

  if (isRepeatedSingleContext) return [];

  const leadingCurrentTracks = currentTrackId
    ? tracks.findIndex((track) => track.id !== currentTrackId)
    : 0;
  const hasRepeatedCurrentPrefix = leadingCurrentTracks > 1;
  const shouldRemoveCurrentPrefix = repeatMode === "track"
    || hasRepeatedCurrentPrefix;
  const firstUpcomingIndex = shouldRemoveCurrentPrefix
    ? leadingCurrentTracks
    : 0;
  const upcomingTracks = firstUpcomingIndex < 0
    ? []
    : tracks.slice(firstUpcomingIndex);

  return upcomingTracks.reduce<SpotifyTrack[]>((result, track) => {
    const previousTrack = result[result.length - 1];
    if (repeatMode !== "off" && previousTrack?.id === track.id) {
      return result;
    }

    result.push(track);
    return result;
  }, []);
}
