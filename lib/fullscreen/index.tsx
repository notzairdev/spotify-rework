"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isTauriContext, devLog, devError } from "@/lib/env";

interface FullscreenContextType {
  isFullscreen: boolean;
  setFullscreen: (value: boolean) => void;
  toggleFullscreen: () => void;
}

const FullscreenContext = createContext<FullscreenContextType | undefined>(undefined);

export function FullscreenProvider({ children }: { children: ReactNode }) {
  const [isFullscreen, setIsFullscreenState] = useState(false);

  // Sync with Tauri window state on mount
  useEffect(() => {
    if (!isTauriContext()) return;
    
    invoke<boolean>("is_fullscreen")
      .then((fullscreen) => {
        setIsFullscreenState(fullscreen);
      })
      .catch((e) => {
        devError("Failed to get fullscreen state:", e);
      });
  }, []);

  const setFullscreen = useCallback(async (value: boolean) => {
    if (isTauriContext()) {
      try {
        await invoke("set_fullscreen", { fullscreen: value });
        setIsFullscreenState(value);
        devLog("Fullscreen set to:", value);
      } catch (e) {
        devError("Failed to set fullscreen:", e);
      }
    } else {
      setIsFullscreenState(value);
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (isTauriContext()) {
      try {
        const newState = await invoke<boolean>("toggle_fullscreen");
        setIsFullscreenState(newState);
        devLog("Fullscreen toggled to:", newState);
      } catch (e) {
        devError("Failed to toggle fullscreen:", e);
      }
    } else {
      setIsFullscreenState((prev) => !prev);
    }
  }, []);

  return (
    <FullscreenContext.Provider value={{ isFullscreen, setFullscreen, toggleFullscreen }}>
      {children}
    </FullscreenContext.Provider>
  );
}

export function useFullscreen() {
  const context = useContext(FullscreenContext);
  if (!context) {
    throw new Error("useFullscreen must be used within a FullscreenProvider");
  }
  return context;
}
