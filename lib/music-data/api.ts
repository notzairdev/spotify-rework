import {
  getArtistTopTracks,
  getRecommendations,
  getTrack,
  searchAlbums,
  type SpotifyAlbum,
  type SpotifyTrack,
} from "@/lib/spotify/api";
import { fetchMusicBrainz, fetchMusicData } from "./client";

const ONE_DAY = 24 * 60 * 60 * 1000;

export interface ArtistBiography {
  artistName: string;
  biography: string;
  genre: string | null;
  style: string | null;
  mood: string | null;
  sourceUrl: string;
}

export interface TrackCreditGroup {
  label: string;
  names: string[];
}

export interface TrackCredits {
  trackId: string;
  isrc: string;
  recordingMbid: string;
  sourceUrl: string;
  groups: TrackCreditGroup[];
  writtenBy: string[];
}

export interface AudioDbTrackInfo {
  trackId: string;
  trackName: string;
  artistName: string;
  albumName: string | null;
  description: string | null;
  genre: string | null;
  mood: string | null;
  style: string | null;
  theme: string | null;
  thumbnailUrl: string | null;
  musicVideoUrl: string | null;
  musicVideoDirector: string | null;
  musicVideoCompany: string | null;
  sourceUrl: string;
}

export interface TasteRecommendation {
  track: SpotifyTrack;
  reason: "taste";
}

export interface SpotifyTrackSuggestions {
  tracks: SpotifyTrack[];
  source: "spotify-recommendations" | "artist-top-tracks";
}

export interface ListenBrainzTrend {
  artistName: string;
  coverUrl: string | null;
  listenCount: number;
  releaseGroupMbid: string;
  releaseMbid: string | null;
  releaseName: string;
}

interface ReccoTrack {
  href: string;
  id: string;
}

interface ReccoRecommendationResponse {
  content?: ReccoTrack[];
}

interface ListenBrainzReleaseGroup {
  artist_name: string;
  caa_release_mbid?: string | null;
  listen_count: number;
  release_group_mbid?: string | null;
  release_group_name: string;
}

interface ListenBrainzTrendsResponse {
  payload?: {
    release_groups?: ListenBrainzReleaseGroup[];
  };
}

interface AudioDbArtist {
  idArtist: string;
  strArtist: string;
  strBiography?: string | null;
  strBiographyES?: string | null;
  strGenre?: string | null;
  strStyle?: string | null;
  strMood?: string | null;
}

interface AudioDbSearchResponse {
  artists?: AudioDbArtist[] | null;
}

interface AudioDbTrack {
  idTrack: string;
  strTrack: string;
  strArtist: string;
  strAlbum?: string | null;
  strDescriptionEN?: string | null;
  strDescriptionES?: string | null;
  strGenre?: string | null;
  strMood?: string | null;
  strStyle?: string | null;
  strTheme?: string | null;
  strTrackThumb?: string | null;
  strMusicVid?: string | null;
  strMusicVidDirector?: string | null;
  strMusicVidCompany?: string | null;
}

interface AudioDbTrackSearchResponse {
  track?: AudioDbTrack[] | null;
}

interface MusicBrainzArtist {
  id: string;
  name: string;
}

interface MusicBrainzRelation {
  type: string;
  "target-type"?: string;
  attributes?: string[];
  artist?: MusicBrainzArtist;
  work?: { id: string; title: string };
}

interface MusicBrainzRecording {
  id: string;
  title: string;
  length?: number | null;
  "artist-credit"?: Array<{
    name: string;
    artist?: MusicBrainzArtist;
  }>;
  relations?: MusicBrainzRelation[];
}

interface MusicBrainzIsrcResponse {
  recordings?: MusicBrainzRecording[];
}

interface MusicBrainzWork {
  relations?: MusicBrainzRelation[];
}

const resolvedTrendAlbums = new Map<string, SpotifyAlbum | null>();

export async function getArtistBiography(
  artistName: string,
): Promise<ArtistBiography | null> {
  const params = new URLSearchParams({ s: artistName });
  const response = await fetchMusicData<AudioDbSearchResponse>(
    `https://www.theaudiodb.com/api/v1/json/123/search.php?${params}`,
    ONE_DAY,
  );
  const artists = response.artists ?? [];
  const match = artists.find(
    (candidate) => normalize(candidate.strArtist) === normalize(artistName),
  ) ?? artists[0];
  const biography = match?.strBiographyES?.trim()
    || match?.strBiography?.trim();

  if (!match || !biography) return null;
  return {
    artistName: match.strArtist,
    biography,
    genre: cleanOptional(match.strGenre),
    style: cleanOptional(match.strStyle),
    mood: cleanOptional(match.strMood),
    sourceUrl: `https://www.theaudiodb.com/artist/${match.idArtist}`,
  };
}

export async function getTrackCredits(
  trackId: string,
): Promise<TrackCredits | null> {
  const track = await getTrack(trackId);
  const isrc = track.external_ids?.isrc?.trim();
  if (!isrc) return null;

  const params = new URLSearchParams({
    inc: "artist-credits+artist-rels+work-rels",
    fmt: "json",
  });
  const isrcResponse = await fetchMusicBrainz<MusicBrainzIsrcResponse>(
    `https://musicbrainz.org/ws/2/isrc/${encodeURIComponent(isrc)}?${params}`,
  );
  const recording = chooseRecording(isrcResponse.recordings ?? [], track);
  if (!recording) return null;

  const relations = recording.relations ?? [];
  const workIdSet = new Set<string>();
  for (const relation of relations) {
    const workId = relation["target-type"] === "work" ? relation.work?.id : null;
    if (workId) workIdSet.add(workId);
    if (workIdSet.size === 3) break;
  }
  const workIds = [...workIdSet];
  const workResults = await Promise.allSettled(
    workIds.map((workId) => {
      const workParams = new URLSearchParams({ inc: "artist-rels", fmt: "json" });
      return fetchMusicBrainz<MusicBrainzWork>(
        `https://musicbrainz.org/ws/2/work/${encodeURIComponent(workId)}?${workParams}`,
      );
    }),
  );
  const workRelations = workResults.flatMap((result) =>
    result.status === "fulfilled" ? result.value.relations ?? [] : []
  );
  const groups = buildCreditGroups(recording, workRelations);
  const writtenBy = uniqueNames(workRelations.flatMap((relation) => {
    const isWritingCredit = relation.type === "writer"
      || relation.type === "composer"
      || relation.type === "lyricist";
    return isWritingCredit && relation.artist?.name ? [relation.artist.name] : [];
  }));

  if (groups.length === 0) return null;
  return {
    trackId,
    isrc,
    recordingMbid: recording.id,
    sourceUrl: `https://musicbrainz.org/recording/${recording.id}`,
    groups,
    writtenBy,
  };
}

export async function getAudioDbTrackInfo(
  artistName: string,
  trackName: string,
): Promise<AudioDbTrackInfo | null> {
  const params = new URLSearchParams({ s: artistName, t: trackName });
  const response = await fetchMusicData<AudioDbTrackSearchResponse>(
    `https://www.theaudiodb.com/api/v1/json/123/searchtrack.php?${params}`,
    ONE_DAY,
  );
  const matches = response.track ?? [];
  const match = matches.find((candidate) =>
    normalize(candidate.strArtist) === normalize(artistName)
    && normalize(candidate.strTrack) === normalize(trackName)
  ) ?? matches[0];

  if (!match) return null;
  return {
    trackId: match.idTrack,
    trackName: match.strTrack,
    artistName: match.strArtist,
    albumName: cleanOptional(match.strAlbum),
    description: cleanOptional(match.strDescriptionES) ?? cleanOptional(match.strDescriptionEN),
    genre: cleanOptional(match.strGenre),
    mood: cleanOptional(match.strMood),
    style: cleanOptional(match.strStyle),
    theme: cleanOptional(match.strTheme),
    thumbnailUrl: cleanOptional(match.strTrackThumb),
    musicVideoUrl: cleanOptional(match.strMusicVid),
    musicVideoDirector: cleanOptional(match.strMusicVidDirector),
    musicVideoCompany: cleanOptional(match.strMusicVidCompany),
    sourceUrl: `https://www.theaudiodb.com/track/${match.idTrack}`,
  };
}

export async function getTasteRecommendations(
  seedTrackIds: string[],
  size: number = 10,
): Promise<TasteRecommendation[]> {
  const seeds = [...new Set(seedTrackIds)].slice(0, 5);
  if (seeds.length === 0) return [];

  const params = new URLSearchParams({
    seeds: seeds.join(","),
    size: Math.min(Math.max(size, 1), 20).toString(),
  });
  const response = await fetchMusicData<ReccoRecommendationResponse>(
    `https://api.reccobeats.com/v1/track/recommendation?${params}`,
    6 * 60 * 60 * 1000,
  );

  const seedSet = new Set(seeds);
  const spotifyIdSet = new Set<string>();
  for (const item of response.content ?? []) {
    const spotifyId = extractSpotifyId(item.href, "track");
    if (spotifyId && !seedSet.has(spotifyId)) spotifyIdSet.add(spotifyId);
  }
  const spotifyIds = [...spotifyIdSet].slice(0, 10);

  if (spotifyIds.length === 0) return [];
  const trackResults = await Promise.allSettled(
    spotifyIds.map((id) => getTrack(id)),
  );
  return trackResults.flatMap((result) =>
    result.status === "fulfilled"
      ? [{ track: result.value, reason: "taste" as const }]
      : []
  );
}

export async function getSpotifyTrackSuggestions(
  trackId: string,
  size: number = 8,
): Promise<SpotifyTrackSuggestions> {
  const limit = Math.min(Math.max(size, 1), 20);
  const currentTrack = await getTrack(trackId);
  const primaryArtistId = currentTrack.artists[0]?.id;

  try {
    const response = await getRecommendations({
      seedTracks: [trackId],
      seedArtists: primaryArtistId ? [primaryArtistId] : undefined,
      limit: Math.min(limit + 2, 20),
    });
    const tracks = uniqueSpotifyTracks(response.tracks, trackId).slice(0, limit);
    if (tracks.length > 0) {
      return { tracks, source: "spotify-recommendations" };
    }
  } catch (error) {
    console.info("Spotify recommendations are unavailable; using artist top tracks.", error);
  }

  if (!primaryArtistId) return { tracks: [], source: "artist-top-tracks" };

  try {
    const response = await getArtistTopTracks(primaryArtistId);
    return {
      tracks: uniqueSpotifyTracks(response.tracks, trackId).slice(0, limit),
      source: "artist-top-tracks",
    };
  } catch (error) {
    console.warn("Spotify artist suggestions failed:", error);
    return { tracks: [], source: "artist-top-tracks" };
  }
}

export async function getListenBrainzTrends(
  count: number = 12,
): Promise<ListenBrainzTrend[]> {
  const params = new URLSearchParams({
    count: Math.min(Math.max(count * 2, 10), 50).toString(),
    range: "week",
  });
  const response = await fetchMusicData<ListenBrainzTrendsResponse>(
    `https://api.listenbrainz.org/1/stats/sitewide/release-groups?${params}`,
    60 * 60 * 1000,
  );

  const seen = new Set<string>();
  return (response.payload?.release_groups ?? [])
    .filter((release) => {
      const key = release.release_group_mbid
        ?? `${normalize(release.artist_name)}:${normalize(release.release_group_name)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return Boolean(release.release_group_mbid);
    })
    .slice(0, count)
    .map((release) => ({
      artistName: release.artist_name,
      coverUrl: release.caa_release_mbid
        ? `https://coverartarchive.org/release/${release.caa_release_mbid}/front-500`
        : null,
      listenCount: release.listen_count,
      releaseGroupMbid: release.release_group_mbid!,
      releaseMbid: release.caa_release_mbid ?? null,
      releaseName: release.release_group_name,
    }));
}

export async function resolveTrendOnSpotify(
  trend: ListenBrainzTrend,
): Promise<SpotifyAlbum | null> {
  if (resolvedTrendAlbums.has(trend.releaseGroupMbid)) {
    return resolvedTrendAlbums.get(trend.releaseGroupMbid) ?? null;
  }

  const results = await searchAlbums(
    `album:${quoteSpotifySearch(trend.releaseName)} artist:${quoteSpotifySearch(trend.artistName)}`,
    5,
  );
  const best = results
    .map((album) => ({ album, score: scoreSpotifyAlbum(album, trend) }))
    .sort((a, b) => b.score - a.score)[0];
  const resolved = best && best.score >= 4 ? best.album : results[0] ?? null;
  resolvedTrendAlbums.set(trend.releaseGroupMbid, resolved);
  return resolved;
}

function scoreSpotifyAlbum(album: SpotifyAlbum, trend: ListenBrainzTrend): number {
  let score = 0;
  if (normalize(album.name) === normalize(trend.releaseName)) score += 5;
  if (album.artists.some((artist) =>
    normalize(trend.artistName).includes(normalize(artist.name)))) score += 3;
  return score;
}

function extractSpotifyId(href: string, kind: "track" | "album"): string | null {
  const match = href.match(new RegExp(`open\\.spotify\\.com/${kind}/([A-Za-z0-9]+)`));
  return match?.[1] ?? null;
}

function quoteSpotifySearch(value: string): string {
  return `\"${value.replaceAll('"', "")}\"`;
}

function chooseRecording(
  recordings: MusicBrainzRecording[],
  track: SpotifyTrack,
): MusicBrainzRecording | null {
  return recordings
    .map((recording) => {
      let score = 0;
      if (normalize(recording.title) === normalize(track.name)) score += 6;

      const creditedArtists = new Set(
        (recording["artist-credit"] ?? [])
          .map((credit) => normalize(credit.artist?.name ?? credit.name)),
      );
      if (track.artists.some((artist) => creditedArtists.has(normalize(artist.name)))) {
        score += 4;
      }

      if (recording.length) {
        const difference = Math.abs(recording.length - track.duration_ms);
        if (difference <= 2_000) score += 3;
        else if (difference <= 5_000) score += 1;
      }
      return { recording, score };
    })
    .sort((left, right) => right.score - left.score)[0]?.recording ?? null;
}

function buildCreditGroups(
  recording: MusicBrainzRecording,
  workRelations: MusicBrainzRelation[],
): TrackCreditGroup[] {
  const groups = new Map<string, Set<string>>();
  const add = (label: string, name?: string) => {
    const value = name?.trim();
    if (!value) return;
    const names = groups.get(label) ?? new Set<string>();
    names.add(value);
    groups.set(label, names);
  };

  for (const relation of workRelations) {
    const label = WORK_ROLE_LABELS[relation.type] ?? titleCase(relation.type);
    add(label, relation.artist?.name);
  }

  for (const relation of recording.relations ?? []) {
    if (!relation.artist) continue;
    const attributes = relation.attributes?.filter(Boolean) ?? [];
    const labels = relation.type === "instrument" && attributes.length > 0
      ? attributes.map(titleCase)
      : relation.type === "vocal" && attributes.length > 0
        ? attributes.map(titleCase)
        : [RECORDING_ROLE_LABELS[relation.type] ?? titleCase(relation.type)];
    labels.forEach((label) => add(label, relation.artist?.name));
  }

  for (const credit of recording["artist-credit"] ?? []) {
    add("Main performers", credit.artist?.name ?? credit.name);
  }

  return [...groups]
    .map(([label, names]) => ({ label, names: uniqueNames([...names]) }))
    .sort((left, right) => rolePriority(left.label) - rolePriority(right.label));
}

const WORK_ROLE_LABELS: Record<string, string> = {
  writer: "Written by",
  composer: "Composed by",
  lyricist: "Lyrics by",
  arranger: "Arranged by",
  translator: "Translated by",
};

const RECORDING_ROLE_LABELS: Record<string, string> = {
  vocal: "Vocals",
  instrument: "Instruments",
  performer: "Performers",
  producer: "Produced by",
  mix: "Mixed by",
  mastering: "Mastered by",
  engineer: "Engineering",
  recording: "Recorded by",
  programming: "Programming",
  conductor: "Conducted by",
  orchestra: "Orchestra",
};

const ROLE_ORDER = [
  "Written by",
  "Composed by",
  "Lyrics by",
  "Main performers",
  "Lead vocals",
  "Vocals",
  "Produced by",
  "Mixed by",
  "Mastered by",
  "Engineering",
  "Arranged by",
];

function rolePriority(label: string): number {
  const index = ROLE_ORDER.indexOf(label);
  return index === -1 ? ROLE_ORDER.length : index;
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = normalize(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueSpotifyTracks(tracks: SpotifyTrack[], excludedTrackId: string): SpotifyTrack[] {
  const seen = new Set<string>([excludedTrackId]);
  return tracks.filter((track) => {
    if (!track.id || seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
}

function titleCase(value: string): string {
  return value
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cleanOptional(value?: string | null): string | null {
  return value?.trim() || null;
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}
