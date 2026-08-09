"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { isTauriContext } from "@/lib/env";
import { Titlebar } from "@/components/tauri/titlebar";
import { PlayerBar } from "@/components/player";
import { PageViewport } from "@/components/page-viewport";
import { LoginCard } from "@/components/auth/login-card";
import { useSpotifyPlayer } from "@/lib/spotify";
import { Window } from "@tauri-apps/api/window";
import { listen, emit } from "@tauri-apps/api/event";

interface AppGateProps {
  children: ReactNode;
}

// Pages where player bar should be hidden
const HIDE_PLAYER_PATHS = ["/", "/callback", "/app/callback", "/island"];

/**
 * AppGate handles the initial auth verification flow:
 * 1. Shows nothing (blank screen) while checking auth state
 * 2. If authenticated → allow access to authenticated pages
 * 3. If not authenticated → show login page (no navigation needed)
 * 4. Handles token refresh automatically on app start
 * 5. Renders the Titlebar consistently across all pages
 */
export function AppGate({ children }: AppGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading, isAuthenticated, session } = useAuth();
  const { state: playerState } = useSpotifyPlayer();
  const hasRedirectedToHome = useRef(false);
  const playerStateRef = useRef(playerState);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    playerStateRef.current = playerState;
    // If playback pauses entirely or track is cleared, hide island if we are minimized
    if ((!playerState?.track || !playerState?.isPlaying) && isTauriContext()) {
      emit("island-visibility", false);
      hideTimer = setTimeout(() => {
        Window.getByLabel("island").then(island => island?.hide()).catch(console.error);
      }, 300);
    }

    return () => {
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [playerState]);

  // Handle dynamic island visibility when main window is minimized
  useEffect(() => {
    if (!isTauriContext()) return;

    let unlisten: (() => void) | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const setupIslandListener = async () => {
      const dispose = await listen<boolean>("main-window-minimized", async (event) => {
        const isMinimized = event.payload;
        const islandWindow = await Window.getByLabel("island");
        if (!islandWindow) return;

        // Only show island when ACTIVE playback is happening (is playing)
        if (isMinimized && playerStateRef.current?.track && playerStateRef.current?.isPlaying) {
          // Tell the island to animate IN before showing window completely
          emit("island-visibility", true);
          await islandWindow.show();
        } else {
          // Tell the island to animate OUT
          emit("island-visibility", false);
          // Wait for animation before hiding completely
          if (hideTimer) clearTimeout(hideTimer);
          hideTimer = setTimeout(async () => {
            await islandWindow.hide();
          }, 300);
        }
      });
      if (cancelled) dispose();
      else unlisten = dispose;
    };
    void setupIslandListener();
    return () => {
      cancelled = true;
      if (hideTimer) clearTimeout(hideTimer);
      unlisten?.();
    };
  }, []);

  // Only redirect authenticated users from login page to home
  // This is the ONLY navigation we perform — never redirect for unauthenticated users
  useEffect(() => {
    if (isLoading || !isTauriContext()) return;

    if (isAuthenticated && session && pathname === "/" && !hasRedirectedToHome.current) {
      hasRedirectedToHome.current = true;
      router.replace("/app/home");
    }
    // Reset guard when we leave the login page
    if (pathname !== "/") {
      hasRedirectedToHome.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, pathname]);

  // While loading auth state, show nothing
  if (isLoading) {
    return null;
  }

  // In Tauri context, if not authenticated: render login page directly
  // NO router.replace() here — that was causing the infinite loop
  if (isTauriContext() && !isAuthenticated && pathname !== "/callback" && pathname !== "/app/callback") {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <Titlebar />
        <main className="flex-1 overflow-y-auto scrollbar-hide flex items-center justify-center py-4">
          <LoginCard />
        </main>
      </div>
    );
  }

  if (pathname === "/island") {
    return <main className="w-screen h-screen overflow-hidden">{children}</main>;
  }

  const showPlayerBar = isAuthenticated && !HIDE_PLAYER_PATHS.includes(pathname) && pathname !== "/lyrics";
  const usesAppWorkspace = pathname.startsWith("/app/") && pathname !== "/app/callback";

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Titlebar />
      {usesAppWorkspace ? (
        <div className="min-h-0 flex-1">{children}</div>
      ) : (
        <PageViewport>{children}</PageViewport>
      )}
      <div
        className={`shrink-0 transition-opacity duration-300 ${showPlayerBar ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <PlayerBar />
      </div>
    </div>
  );
}
