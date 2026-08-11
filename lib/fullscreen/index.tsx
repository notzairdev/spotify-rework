"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriContext, devLog, devError } from "@/lib/env";

interface FullscreenContextType {
  isFullscreen: boolean;
  setFullscreen: (value: boolean) => Promise<void>;
  toggleFullscreen: () => Promise<void>;
}

const FullscreenContext = createContext<FullscreenContextType | undefined>(undefined);

export function FullscreenProvider({ children }: { children: ReactNode }) {
  const [isFullscreen, setIsFullscreenState] = useState(false);
  const isFullscreenRef = useRef(false);
  const restoreMaximizedRef = useRef(false);
  const transitionInProgressRef = useRef(false);

  const updateFullscreenState = useCallback((value: boolean) => {
    isFullscreenRef.current = value;
    setIsFullscreenState(value);
  }, []);

  // Sync with Tauri window state on mount
  useEffect(() => {
    if (!isTauriContext()) return;
    
    invoke<boolean>("is_fullscreen")
      .then((fullscreen) => {
        updateFullscreenState(fullscreen);
      })
      .catch((e) => {
        devError("Failed to get fullscreen state:", e);
      });
  }, [updateFullscreenState]);

  const setFullscreen = useCallback(async (value: boolean) => {
    if (transitionInProgressRef.current || value === isFullscreenRef.current) return;

    if (isTauriContext()) {
      const appWindow = getCurrentWindow();
      transitionInProgressRef.current = true;

      try {
        if (value) {
          restoreMaximizedRef.current = await appWindow.isMaximized();
          if (restoreMaximizedRef.current) {
            await appWindow.unmaximize();
          }
        }

        await invoke("set_fullscreen", { fullscreen: value });
        updateFullscreenState(value);

        if (!value && restoreMaximizedRef.current) {
          restoreMaximizedRef.current = false;
          await appWindow.maximize();
        }

        devLog("Fullscreen set to:", value);
      } catch (e) {
        if (value && restoreMaximizedRef.current) {
          restoreMaximizedRef.current = false;
          await appWindow.maximize().catch(() => undefined);
        }
        devError("Failed to set fullscreen:", e);
      } finally {
        transitionInProgressRef.current = false;
      }
    } else {
      updateFullscreenState(value);
    }
  }, [updateFullscreenState]);

  const toggleFullscreen = useCallback(async () => {
    await setFullscreen(!isFullscreenRef.current);
  }, [setFullscreen]);

  // Keep React in sync when fullscreen is left through the operating system
  // (for example, by pressing Escape) and restore the previous maximized state.
  useEffect(() => {
    if (!isTauriContext()) return;

    const appWindow = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void appWindow.onResized(async () => {
      if (disposed || transitionInProgressRef.current) return;

      try {
        const fullscreen = await appWindow.isFullscreen();
        const wasFullscreen = isFullscreenRef.current;
        updateFullscreenState(fullscreen);

        if (wasFullscreen && !fullscreen && restoreMaximizedRef.current) {
          restoreMaximizedRef.current = false;
          await appWindow.maximize();
        }
      } catch (error) {
        devError("Failed to synchronize fullscreen state:", error);
      }
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [updateFullscreenState]);

  const value = useMemo(
    () => ({ isFullscreen, setFullscreen, toggleFullscreen }),
    [isFullscreen, setFullscreen, toggleFullscreen],
  );

  return (
    <FullscreenContext.Provider value={value}>
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
