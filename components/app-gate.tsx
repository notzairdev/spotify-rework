"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { isTauriContext } from "@/lib/env";
import { Titlebar } from "@/components/tauri/titlebar";
import { PlayerBar } from "@/components/player";

interface AppGateProps {
  children: ReactNode;
}

// Pages where player bar should be hidden
const HIDE_PLAYER_PATHS = ["/", "/callback"];

/**
 * AppGate handles the initial auth verification flow:
 * 1. Shows nothing (blank screen) while checking auth state
 * 2. If authenticated → allow access to authenticated pages
 * 3. If not authenticated → show login (page content)
 * 4. Handles token refresh automatically on app start
 * 5. Renders the Titlebar consistently across all pages
 */
export function AppGate({ children }: AppGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading, isAuthenticated, session } = useAuth();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Skip gate logic for callback page
    if (pathname === "/callback") {
      setIsReady(true);
      return;
    }

    // Wait for auth to finish loading
    if (isLoading) {
      return;
    }

    // Not in Tauri context (dev browser) - just show content
    if (!isTauriContext()) {
      setIsReady(true);
      return;
    }

    // Auth check complete
    if (isAuthenticated && session) {
      // User is authenticated
      if (pathname === "/") {
        // On login page but authenticated, go to home
        router.replace("/home");
      } else {
        // On any other page, allow access
        setIsReady(true);
      }
    } else {
      // User is not authenticated
      if (pathname !== "/") {
        // Redirect to login page
        router.replace("/");
      } else {
        setIsReady(true);
      }
    }
  }, [isLoading, isAuthenticated, session, pathname, router]);

  // Show absolutely nothing while verifying
  if (!isReady) {
    return null;
  }

  const showPlayerBar = isAuthenticated && !HIDE_PLAYER_PATHS.includes(pathname) && pathname !== "/lyrics";

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Titlebar />
      <main className="flex-1 overflow-y-auto scrollbar-hide">
        {children}
      </main>
      <div
        className={`shrink-0 transition-opacity duration-300 ${showPlayerBar ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <PlayerBar />
      </div>
    </div>
  );
}
