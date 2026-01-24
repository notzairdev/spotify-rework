"use client";

import { Play, Clock, TrendingUp, Music, Disc3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  useMyPlaylists, 
  useTopTracks, 
  useTopArtists,
  useRecentlyPlayed,
  useSpotifyPlayer,
  startPlayback,
} from "@/lib/spotify";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

export default function HomePage() {
  const { data: playlists, isLoading: playlistsLoading } = useMyPlaylists(10);
  const { data: topTracks, isLoading: tracksLoading } = useTopTracks("short_term", 10);
  const { data: topArtists, isLoading: artistsLoading } = useTopArtists("medium_term", 10);
  const { data: recentlyPlayed, isLoading: recentLoading } = useRecentlyPlayed(10);
  const { state } = useSpotifyPlayer();

  // Get unique recently played (dedupe by track id)
  const uniqueRecent = recentlyPlayed?.items
    ?.filter((item, index, self) => 
      index === self.findIndex(t => t.track.id === item.track.id)
    )
    .slice(0, 6) ?? [];

  // Handle play
  const handlePlayPlaylist = async (uri: string) => {
    try {
      await startPlayback({ contextUri: uri });
    } catch (e) {
      console.error("Failed to play:", e);
    }
  };

  const handlePlayTrack = async (uri: string) => {
    try {
      await startPlayback({ uris: [uri] });
    } catch (e) {
      console.error("Failed to play:", e);
    }
  };

  const handlePlayArtist = async (uri: string) => {
    try {
      await startPlayback({ contextUri: uri });
    } catch (e) {
      console.error("Failed to play:", e);
    }
  };

  const firstPlaylist = playlists?.items?.[0];
  const otherPlaylists = playlists?.items?.slice(1, 4) ?? [];

  return (
    <div className="space-y-16 animate-fade-in py-24 px-6 container mx-auto">
      {/* Hero Section */}
      <section className="relative">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-primary font-medium mb-2 tracking-widest uppercase">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="text-3xl font-display font-bold text-foreground leading-none">
              {getGreeting()}
            </h1>
          </div>
        </div>
      </section>

      {/* Featured / Continue Listening */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main featured playlist */}
        {playlistsLoading ? (
          <div className="aspect-4/3 rounded-3xl bg-muted animate-pulse" />
        ) : firstPlaylist ? (
          <div
            className="group relative aspect-4/3 rounded-3xl overflow-hidden cursor-pointer transition-transform hover:scale-[1.02]"
            onClick={() => handlePlayPlaylist(firstPlaylist.uri)}
          >
            {firstPlaylist.images[0]?.url ? (
              <img
                src={firstPlaylist.images[0].url}
                alt={firstPlaylist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-linear-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                <Disc3 className="w-24 h-24 text-muted-foreground/30" />
              </div>
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <p className="text-xs uppercase tracking-widest text-primary mb-2">Continue Listening</p>
              <h2 className="text-3xl font-display font-bold text-white mb-2">
                {firstPlaylist.name}
              </h2>
              <p className="text-white/60 text-sm mb-4">
                {firstPlaylist.tracks.total} songs
              </p>
              <Button
                size="lg"
                className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
              >
                <Play className="w-5 h-5 mr-2" fill="currentColor" />
                Reproducir
              </Button>
            </div>
          </div>
        ) : null}

        {/* Other playlists */}
        <div className="space-y-4">
          {playlistsLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-5 p-4 rounded-2xl bg-muted animate-pulse h-24" />
            ))
          ) : (
            otherPlaylists.map((playlist, i) => (
              <div
                key={playlist.id}
                onClick={() => handlePlayPlaylist(playlist.uri)}
                className="group flex items-center gap-5 p-4 rounded-2xl bg-card/50 hover:bg-card transition-all cursor-pointer"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {playlist.images[0]?.url ? (
                  <img
                    src={playlist.images[0].url}
                    alt={playlist.name}
                    className="w-16 h-16 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center">
                    <Music className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">
                    {playlist.name}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {playlist.description || `${playlist.tracks.total} canciones`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Play className="w-5 h-5" fill="currentColor" />
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Recently Played */}
      {uniqueRecent.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-8">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="text-2xl font-display font-bold text-foreground">
              Recently Played
            </h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {uniqueRecent.map((item, i) => (
              <div
                key={`${item.track.id}-${i}`}
                onClick={() => handlePlayTrack(item.track.uri)}
                className="group cursor-pointer"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="relative aspect-square mb-3 rounded-xl overflow-hidden transition-transform hover:scale-105">
                  <img
                    src={item.track.album.images[0]?.url}
                    alt={item.track.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button size="icon" className="rounded-full">
                      <Play className="w-5 h-5" fill="currentColor" />
                    </Button>
                  </div>
                </div>
                <h3 className="font-medium text-foreground truncate text-sm">{item.track.name}</h3>
                <p className="text-xs text-muted-foreground truncate">
                  {item.track.artists.map(a => a.name).join(", ")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Tracks Section */}
      <section>
        <div className="flex items-center gap-3 mb-8">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-2xl font-display font-bold text-foreground">
            Most Played Tracks
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-5">
          {tracksLoading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-square rounded-2xl bg-muted animate-pulse" />
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
              </div>
            ))
          ) : (
            topTracks?.items?.map((track, i) => (
              <div
                key={track.id}
                onClick={() => handlePlayTrack(track.uri)}
                className="group cursor-pointer animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="relative aspect-square mb-4 rounded-2xl overflow-hidden transition-transform hover:scale-105">
                  <img
                    src={track.album.images[0]?.url}
                    alt={track.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button size="icon" className="rounded-full">
                      <Play className="w-5 h-5" fill="currentColor" />
                    </Button>
                  </div>
                </div>
                <h3 className="font-semibold text-sm text-foreground truncate">{track.name}</h3>
                <p className="text-[13px] text-muted-foreground truncate">
                  {track.artists.map(a => a.name).join(", ")}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Top Artists Row */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-display font-bold text-foreground">
            Your Artists
          </h2>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
          {artistsLoading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="shrink-0 text-center">
                <div className="w-32 h-32 rounded-full bg-muted animate-pulse mx-auto mb-4" />
                <div className="h-4 w-24 bg-muted rounded animate-pulse mx-auto" />
              </div>
            ))
          ) : (
            topArtists?.items?.map((artist, i) => (
              <div
                key={artist.id}
                onClick={() => handlePlayArtist(artist.external_urls.spotify.replace('https://open.spotify.com/', 'spotify:').replace('/', ':'))}
                className="group shrink-0 text-center cursor-pointer animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="relative w-32 h-32 mb-4 rounded-full overflow-hidden transition-transform hover:scale-105 mx-auto shadow-lg">
                  {artist.images?.[0]?.url ? (
                    <img
                      src={artist.images[0].url}
                      alt={artist.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-linear-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                      <Music className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button size="icon" className="rounded-full">
                      <Play className="w-5 h-5" fill="currentColor" />
                    </Button>
                  </div>
                </div>
                <h3 className="font-semibold text-foreground">{artist.name}</h3>
                <p className="text-xs text-muted-foreground">Artista</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
