"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { isTauriContext } from "@/lib/env";
import { Titlebar } from "@/components/tauri/titlebar";
import { PlayerBar } from "@/components/player";
import { LoginCard } from "@/components/auth/login-card";

interface AppGateProps {
  children: ReactNode;
}

// Pages where player bar should be hidden
const HIDE_PLAYER_PATHS = ["/", "/callback"];

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
  const hasRedirectedToHome = useRef(false);

  // Only redirect authenticated users from login page to home
  // This is the ONLY navigation we perform — never redirect for unauthenticated users
  useEffect(() => {
    if (isLoading || !isTauriContext()) return;

    if (isAuthenticated && session && pathname === "/" && !hasRedirectedToHome.current) {
      hasRedirectedToHome.current = true;
      router.replace("/home");
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
  if (isTauriContext() && !isAuthenticated && pathname !== "/callback") {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <Titlebar />
        <main className="flex-1 overflow-y-auto scrollbar-hide flex items-center justify-center p-4">
          <LoginCard />
        </main>
      </div>
    );
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
