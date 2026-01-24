import { useParams } from "react-router-dom";
import { Heart, MoreHorizontal, Play, Shuffle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockPlaylists, mockTracks } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { useState } from "react";

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const PlaylistView = () => {
  const { id } = useParams();
  const playlist = mockPlaylists.find((p) => p.id === id) || mockPlaylists[0];

  return (
    <div className="animate-fade-in pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-8 mb-12">
        <div className="relative group">
          <img
            src={playlist.coverUrl}
            alt={playlist.name}
            className="w-64 h-64 rounded-4xl object-cover shadow-2xl hover-lift"
          />
          <div className="absolute inset-0 rounded-4xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button variant="play" size="icon-xl">
              <Play className="w-8 h-8" fill="currentColor" />
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col justify-end">
          <p className="text-xs uppercase tracking-widest text-primary mb-3">Playlist</p>
          <h1 className="text-5xl lg:text-7xl font-display font-bold text-foreground mb-4 leading-none">
            {playlist.name}
          </h1>
          {playlist.description && (
            <p className="text-dim mb-4 max-w-md">{playlist.description}</p>
          )}
          <div className="flex items-center gap-2 text-sm text-dim">
            <span className="font-medium text-foreground">{playlist.owner}</span>
            <span>•</span>
            <span>{playlist.tracks.length} canciones</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-10">
        <Button variant="play" size="icon-lg">
          <Play className="w-6 h-6" fill="currentColor" />
        </Button>
        <Button variant="glass" size="icon-lg">
          <Shuffle className="w-5 h-5" />
        </Button>
        <Button variant="glass" size="icon-lg">
          <Heart className="w-5 h-5" />
        </Button>
        <Button variant="glass" size="icon-lg">
          <MoreHorizontal className="w-5 h-5" />
        </Button>
      </div>

      {/* Track List */}
      <div className="glass rounded-4xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-6 py-4 text-xs text-dim uppercase border-b border-white/5">
          <span className="w-8">#</span>
          <span>Título</span>
          <span className="hidden md:block">Álbum</span>
          <Clock className="w-4 h-4" />
        </div>

        {/* Tracks */}
        {mockTracks.map((track, index) => (
          <TrackRow key={track.id} track={track} index={index + 1} />
        ))}
      </div>
    </div>
  );
};

const TrackRow = ({ track, index }: { track: any; index: number }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isLiked, setIsLiked] = useState(track.isLiked);

  return (
    <div
      className="group grid grid-cols-[auto_1fr_auto_auto] gap-4 px-6 py-4 hover:bg-white/5 transition-colors items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="w-8 flex items-center justify-center">
        {isHovered ? (
          <Button variant="ghost" size="icon-sm" className="text-foreground">
            <Play className="w-4 h-4" fill="currentColor" />
          </Button>
        ) : (
          <span className="text-sm text-dim font-mono">{index}</span>
        )}
      </div>

      <div className="flex items-center gap-4 min-w-0">
        <img
          src={track.coverUrl}
          alt={track.title}
          className="w-12 h-12 rounded-xl object-cover"
        />
        <div className="min-w-0">
          <p className="font-medium text-foreground truncate">{track.title}</p>
          <p className="text-sm text-dim truncate">{track.artist}</p>
        </div>
      </div>

      <p className="text-sm text-dim truncate hidden md:block">{track.album}</p>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity",
            isLiked && "opacity-100 text-primary"
          )}
          onClick={() => setIsLiked(!isLiked)}
        >
          <Heart className="w-4 h-4" fill={isLiked ? "currentColor" : "none"} />
        </Button>
        <span className="text-sm text-dim font-mono w-12 text-right">
          {formatDuration(track.duration)}
        </span>
      </div>
    </div>
  );
};

export default PlaylistView;
