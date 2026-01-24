"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { isTauriContext } from "@/lib/env";
import { Titlebar } from "@/components/tauri/titlebar";

interface AppGateProps {
  children: ReactNode;
}

// Pages where search bar should be hidden
const HIDE_SEARCH_PATHS = ["/", "/callback"];

/**
 * AppGate handles the initial auth verification flow:
 * 1. Shows nothing (blank screen) while checking auth state
 * 2. If authenticated → redirect to /home
 * 3. If not authenticated → show login (page content)
 * 4. Handles token refresh automatically on app start
 * 5. Renders the Titlebar consistently across all pages
 */
export function AppGate({ children }: AppGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading, isAuthenticated, session } = useAuth();
  const [isReady, setIsReady] = useState(false);
  
  const hideSearch = HIDE_SEARCH_PATHS.includes(pathname);

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
      // User is authenticated, redirect to /home if not already there
      if (pathname !== "/home") {
        router.replace("/home");
      } else {
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

  return (
    <>
      <Titlebar hideSearch={hideSearch} />
      {children}
    </>
  );
}
