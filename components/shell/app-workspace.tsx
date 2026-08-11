"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import GradualBlur from "@/components/GradualBlur";
import { PageViewport } from "@/components/page-viewport";
import { useSpotifyPlayer } from "@/lib/spotify";
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/lib/settings";
import { LibrarySidebar } from "./library-sidebar";
import { NowPlayingPanel } from "./now-playing-panel";

const NOW_PLAYING_GRID_COLUMNS = {
  compact: {
    expanded: "2xl:grid-cols-[17rem_minmax(0,1fr)_18rem]",
    collapsed: "2xl:grid-cols-[4.75rem_minmax(0,1fr)_18rem]",
    hiddenLibrary: "2xl:grid-cols-[minmax(0,1fr)_18rem]",
  },
  comfortable: {
    expanded: "2xl:grid-cols-[17rem_minmax(0,1fr)_21rem]",
    collapsed: "2xl:grid-cols-[4.75rem_minmax(0,1fr)_21rem]",
    hiddenLibrary: "2xl:grid-cols-[minmax(0,1fr)_21rem]",
  },
  wide: {
    expanded: "2xl:grid-cols-[17rem_minmax(0,1fr)_24rem]",
    collapsed: "2xl:grid-cols-[4.75rem_minmax(0,1fr)_24rem]",
    hiddenLibrary: "2xl:grid-cols-[minmax(0,1fr)_24rem]",
  },
} as const;

export function AppWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state } = useSpotifyPlayer();
  const { settings, updateSettings } = useAppSettings();
  const showNowPlaying = settings.interface.showNowPlayingPanel && Boolean(state?.track);
  const showLibrary = settings.interface.showLibrarySidebar;
  const libraryExpanded = settings.interface.librarySidebarExpanded;
  const nowPlayingColumns = NOW_PLAYING_GRID_COLUMNS[settings.interface.nowPlayingWidth];

  const toggleLibrary = () => {
    void updateSettings("interface", {
      librarySidebarExpanded: !libraryExpanded,
    }).catch(() => {});
  };

  if (pathname === "/app/callback") {
    return children;
  }

  return (
    <div
      className={cn(
        "grid h-full min-h-0 grid-cols-[minmax(0,1fr)] gap-2 bg-background transition-[grid-template-columns] duration-300",
        showLibrary && libraryExpanded && "xl:grid-cols-[17rem_minmax(0,1fr)]",
        showLibrary && !libraryExpanded && "xl:grid-cols-[4.75rem_minmax(0,1fr)]",
        showNowPlaying && showLibrary && libraryExpanded && nowPlayingColumns.expanded,
        showNowPlaying && showLibrary && !libraryExpanded && nowPlayingColumns.collapsed,
        showNowPlaying && !showLibrary && nowPlayingColumns.hiddenLibrary,
      )}
    >
      {showLibrary && (
        <LibrarySidebar expanded={libraryExpanded} onToggle={toggleLibrary} />
      )}
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
