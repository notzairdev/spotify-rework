"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import GradualBlur from "@/components/GradualBlur";
import { PageViewport } from "@/components/page-viewport";
import { useSpotifyPlayer } from "@/lib/spotify";
import { cn } from "@/lib/utils";
import { LibrarySidebar } from "./library-sidebar";
import { NowPlayingPanel } from "./now-playing-panel";

const LIBRARY_EXPANDED_KEY = "spotify-rework-library-expanded:v1";
const LIBRARY_EVENT = "spotify-rework:library-layout";

function subscribeToLibraryLayout(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(LIBRARY_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LIBRARY_EVENT, callback);
  };
}

function getLibraryLayoutSnapshot() {
  return window.localStorage.getItem(LIBRARY_EXPANDED_KEY) !== "false";
}

export function AppWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state } = useSpotifyPlayer();
  const showNowPlaying = Boolean(state?.track);
  const libraryExpanded = useSyncExternalStore(
    subscribeToLibraryLayout,
    getLibraryLayoutSnapshot,
    () => true,
  );

  const toggleLibrary = () => {
    window.localStorage.setItem(LIBRARY_EXPANDED_KEY, String(!libraryExpanded));
    window.dispatchEvent(new Event(LIBRARY_EVENT));
  };

  if (pathname === "/app/callback") {
    return children;
  }

  return (
    <div
      className={cn(
        "grid h-full min-h-0 grid-cols-[minmax(0,1fr)] gap-2 bg-background transition-[grid-template-columns] duration-300",
        libraryExpanded && showNowPlaying
          ? "xl:grid-cols-[17rem_minmax(0,1fr)] 2xl:grid-cols-[17rem_minmax(0,1fr)_21rem]"
          : libraryExpanded
            ? "xl:grid-cols-[17rem_minmax(0,1fr)]"
            : showNowPlaying
              ? "xl:grid-cols-[4.75rem_minmax(0,1fr)] 2xl:grid-cols-[4.75rem_minmax(0,1fr)_21rem]"
              : "xl:grid-cols-[4.75rem_minmax(0,1fr)]",
      )}
    >
      <LibrarySidebar expanded={libraryExpanded} onToggle={toggleLibrary} />
      <div className="relative min-h-0 min-w-0 overflow-hidden">
        <PageViewport className="h-full shadow-[0_22px_80px_rgba(0,0,0,0.18)]">
          {children}
        </PageViewport>
        <GradualBlur
          target="parent"
          position="top"
          height="7rem"
          strength={3.5}
          divCount={2}
          curve="bezier"
          exponential={false}
          opacity={1}
          style={{ zIndex: 40 }}
        />
      </div>
      {showNowPlaying && <NowPlayingPanel />}
    </div>
  );
}
