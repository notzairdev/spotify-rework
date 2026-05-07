"use client";

import { useEffect, useState } from "react";
import { getCurrentWindow, Window, LogicalSize, LogicalPosition, currentMonitor } from "@tauri-apps/api/window";
import { listen, emit } from "@tauri-apps/api/event";
import { Maximize2, SkipBack, SkipForward, Play, Pause } from "lucide-react";
import { extractDominantColor, hslToString, type HSL } from "@/lib/utils/color-extractor";
import { cn } from "@/lib/utils";
import type { PlaybackState } from "@/lib/spotify/player-provider";

export default function IslandPage() {
  const [state, setState] = useState<PlaybackState | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("spotify-rework-island-state");
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  });
  const [ambientColor, setAmbientColor] = useState<HSL | null>(null);
  const [visible, setVisible] = useState(false);
  const [progressMs, setProgressMs] = useState<number>(0);

  // Sync state from the main window using Tauri events
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let unlistenVis: (() => void) | undefined;

    const connectState = async () => {
      unlisten = await listen<PlaybackState>("spotify-player-state", (event) => {
        setState(event.payload);
        if (event.payload?.position !== undefined) {
          setProgressMs(event.payload.position);
        }
      });
      unlistenVis = await listen<boolean>("island-visibility", (event) => {
        setVisible(event.payload);
      });
    };
    connectState();
    return () => {
      unlisten?.();
      unlistenVis?.();
    };
  }, []);

  const togglePlay = () => emit("island-play-pause");
  const nextTrack = () => emit("island-next");
  const previousTrack = () => emit("island-prev");

  const track = state?.track;
  const albumArt = track?.album.images?.[0]?.url;
  const isPlaying = state?.isPlaying ?? false;

  // Local progress ticker
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => setProgressMs((prev) => prev + 1000), 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Format time utility
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const duration = state?.duration || 1;
  const remainingParams = formatTime(duration - progressMs);
  const currentParams = formatTime(progressMs);

  useEffect(() => {
    if (!albumArt) {
      setAmbientColor(null);
      return;
    }
    extractDominantColor(albumArt).then((color) => {
      if (color) setAmbientColor(color);
    });
  }, [albumArt]);

  // Automatically center the island window at the very top of the monitor
  useEffect(() => {
    const setupIsland = async () => {
      try {
        const appWindow = getCurrentWindow();
        const monitor = await currentMonitor();
        if (monitor) {
          const width = 200;
          const height = 50;
          
          await appWindow.setSize(new LogicalSize(width, height));
          await appWindow.setShadow(false); // Fix transparency on Windows by removing shadow
          
          // Center it horizontally, attach to top
          const x = monitor.position.x + (monitor.size.width / monitor.scaleFactor) / 2 - width / 2;
          const y = monitor.position.y;
          
          await appWindow.setPosition(new LogicalPosition(x, y));
        }
      } catch (err) {
        console.error(err);
      }
    };
    setupIsland();
  }, []);

  const restoreMainWindow = async () => {
    try {
      const mainWindow = await Window.getByLabel("main");
      if (mainWindow) {
        await mainWindow.unminimize();
        await mainWindow.setFocus();
      }
      await getCurrentWindow().hide();
    } catch (err) {
      console.error(err);
    }
  };

  if (!track) {
    return null; // Skip rendering if no playback
  }

  return (
    <div 
      className={cn(
        "w-[200px] h-[50px] bg-black backdrop-blur-xl border border-white/10 rounded-b-3xl shadow-2xl flex items-center px-4 overflow-hidden relative group transition-all duration-300 ease-in-out",
        visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      )}
    >
      {/* Force transparent background for this specific window */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root, [data-theme], .dark, html, body, main { 
          background: transparent !important; 
          background-color: transparent !important; 
        }
      `}} />
      

      <div className="flex-shrink-0">
        <img 
          src={albumArt} 
          alt="Album Art" 
          className="w-8 h-8 rounded-full object-cover shadow-md"
        />
      </div>

      {/* Default details (Times) visible when not hovered */}
      <div className="flex-1 flex items-center justify-between mx-3 group-hover:opacity-0 transition-opacity pointer-events-none" data-tauri-drag-region>
        <span className="text-white/60 text-xs font-mono">{currentParams}</span>
        <span className="text-white/60 text-xs font-mono">-{remainingParams}</span>
      </div>

      {/* Controls - visible on hover, replace the times */}
      <div className="absolute left-16 right-4 top-0 bottom-0 flex justify-center items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm">
        <button onClick={previousTrack} className="text-white/70 hover:text-white p-1">
          <SkipBack size={14} />
        </button>
        <button onClick={togglePlay} className="text-white hover:scale-105 transition-transform p-1">
          {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </button>
        <button onClick={nextTrack} className="text-white/70 hover:text-white p-1">
          <SkipForward size={14} />
        </button>
        <button onClick={restoreMainWindow} className="text-white/50 hover:text-white p-1" title="Restore">
          <Maximize2 size={12} />
        </button>
      </div>
    </div>
  );
}
