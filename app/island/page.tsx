"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import {
  currentMonitor,
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
  Window,
} from "@tauri-apps/api/window";
import { listen, emit } from "@tauri-apps/api/event";
import { Maximize2, Music2, SkipBack, SkipForward, Play, Pause } from "lucide-react";
import { isTauriContext } from "@/lib/env";
import { cn } from "@/lib/utils";
import type { PlaybackState } from "@/lib/spotify/player-provider";

const togglePlay = () => emit("island-play-pause");
const nextTrack = () => emit("island-next");
const previousTrack = () => emit("island-prev");
const ISLAND_WIDTH = 280;
const ISLAND_HEIGHT = 48;
const ISLAND_STATE_KEY = "spotify-rework-island-state:v1";

function subscribeToCachedState(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === ISLAND_STATE_KEY) onStoreChange();
  };
  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

function getCachedStateSnapshot(): string | null {
  try {
    return localStorage.getItem(ISLAND_STATE_KEY);
  } catch {
    return null;
  }
}

function getServerStateSnapshot(): null {
  return null;
}

function parseCachedState(value: string | null): PlaybackState | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as PlaybackState;
  } catch {
    return null;
  }
}

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

async function restoreMainWindow() {
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
}

export default function IslandPage() {
  const cachedStateSnapshot = useSyncExternalStore(
    subscribeToCachedState,
    getCachedStateSnapshot,
    getServerStateSnapshot,
  );
  const cachedState = useMemo(
    () => parseCachedState(cachedStateSnapshot),
    [cachedStateSnapshot],
  );
  const [liveState, setLiveState] = useState<PlaybackState | null>(null);
  const [visible, setVisible] = useState(false);
  const [progressMs, setProgressMs] = useState<number>(0);
  const state = liveState ?? cachedState;

  // Sync state from the main window using Tauri events
  useEffect(() => {
    if (!isTauriContext()) return;

    const unlistens: (() => void)[] = [];
    let disposed = false;

    const connectState = async () => {
      try {
        const listeners = await Promise.all([
          listen<PlaybackState>("spotify-player-state", (event) => {
            setLiveState(event.payload);
            if (event.payload?.position !== undefined) {
              setProgressMs(event.payload.position);
            }
          }),
          listen<boolean>("island-visibility", (event) => {
            setVisible(event.payload);
          }),
        ]);

        if (disposed) {
          listeners.forEach((unlisten) => unlisten());
        } else {
          unlistens.push(...listeners);
        }
      } catch (error) {
        console.error("Failed to connect island events:", error);
      }
    };
    void connectState();
    return () => {
      disposed = true;
      unlistens.forEach((unlisten) => unlisten());
    };
  }, []);

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

  const duration = state?.duration || 1;
  const safeProgress = Math.min(duration, Math.max(0, progressMs));
  const remainingParams = formatTime(duration - safeProgress);
  const currentParams = formatTime(safeProgress);

  // Automatically center the island window at the very top of the monitor
  useEffect(() => {
    if (!isTauriContext()) return;

    const setupIsland = async () => {
      try {
        const appWindow = getCurrentWindow();
        const monitor = await currentMonitor();
        if (monitor) {
          await appWindow.setSize(new LogicalSize(ISLAND_WIDTH, ISLAND_HEIGHT));
          await appWindow.setShadow(false);

          const physicalWidth = ISLAND_WIDTH * monitor.scaleFactor;
          const x = monitor.position.x + (monitor.size.width - physicalWidth) / 2;
          await appWindow.setPosition(
            new PhysicalPosition(Math.round(x), monitor.position.y),
          );
        }
      } catch (err) {
        console.error(err);
      }
    };
    setupIsland();
  }, []);

  if (!track) {
    return null; // Skip rendering if no playback
  }

  return (
    <div 
      className={cn(
        "h-full w-full bg-black/95 backdrop-blur-xl border-x border-b border-white/10 rounded-b-2xl shadow-2xl flex items-center px-4 overflow-hidden relative group transition-all duration-300 ease-in-out",
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
      

      <div className="relative size-8 shrink-0 overflow-hidden rounded-full shadow-md">
        {albumArt ? (
          <Image
            src={albumArt}
            alt="Album art"
            fill
            sizes="32px"
            className="object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center bg-white/10 text-white/60">
            <Music2 className="size-4" />
          </span>
        )}
      </div>

      {/* Default details (Times) visible when not hovered */}
      <div className="flex-1 flex items-center justify-between mx-3 group-hover:opacity-0 transition-opacity pointer-events-none" data-tauri-drag-region>
        <span className="text-white/60 text-xs font-mono">{currentParams}</span>
        <span className="text-white/60 text-xs font-mono">-{remainingParams}</span>
      </div>

      {/* Controls - visible on hover, replace the times */}
      <div className="absolute inset-y-0 left-16 right-4 flex items-center justify-center gap-3 bg-black/50 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
        <button onClick={previousTrack} aria-label="Previous track" className="text-white/70 hover:text-white p-1">
          <SkipBack size={14} />
        </button>
        <button onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"} className="text-white hover:scale-105 transition-transform p-1">
          {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </button>
        <button onClick={nextTrack} aria-label="Next track" className="text-white/70 hover:text-white p-1">
          <SkipForward size={14} />
        </button>
        <button onClick={restoreMainWindow} aria-label="Restore main window" className="text-white/50 hover:text-white p-1" title="Restore">
          <Maximize2 size={12} />
        </button>
      </div>
    </div>
  );
}
