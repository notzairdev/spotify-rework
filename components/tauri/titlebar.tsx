"use client";

import { useState, useEffect, useRef } from "react";
import {
  Minus,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  Search,
  Library,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useWindow } from "@/hooks";
import { useAuth } from "@/lib/auth";
import { useFullscreen } from "@/lib/fullscreen";
import { cn } from "@/lib/utils";
import { clearPreservedNavigationState } from "@/lib/page-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import GradualBlur from "@/components/GradualBlur";

// Paths that should not be in navigation history
const EXCLUDED_PATHS = ["/", "/callback", "/app/callback"];

interface NavigationHistory {
  entries: string[];
  index: number;
}

const EMPTY_NAVIGATION_HISTORY: NavigationHistory = {
  entries: [],
  index: -1,
};

const NAV_ITEMS = [
  { icon: Home, label: "Home", path: "/app/home" },
  { icon: Search, label: "Discover", path: "/app/search" },
  { icon: Library, label: "Collection", path: "/app/library" },
];

export function Titlebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isFullscreen } = useFullscreen();
  // Navigation history tracking
  const [navigationHistory, setNavigationHistory] = useState<NavigationHistory>(
    EMPTY_NAVIGATION_HISTORY
  );
  const isNavigatingRef = useRef(false);

  const { user, logout } = useAuth();
  const {
    handleMinimize: minimize,
    handleClose: close,
    startDragging: drag,
  } = useWindow();

  // Track navigation history
  useEffect(() => {
    // Skip excluded paths
    if (EXCLUDED_PATHS.includes(pathname)) return;

    const updateTimer = window.setTimeout(() => {
      if (isNavigatingRef.current) {
        isNavigatingRef.current = false;
        return;
      }

      setNavigationHistory((previousHistory) => {
        const truncatedEntries = previousHistory.entries.slice(
          0,
          previousHistory.index + 1
        );

        if (truncatedEntries[truncatedEntries.length - 1] === pathname) {
          return previousHistory;
        }

        const entries = [...truncatedEntries, pathname];
        return { entries, index: entries.length - 1 };
      });
    }, 0);

    return () => window.clearTimeout(updateTimer);
  }, [pathname]);

  const canGoBack = navigationHistory.index > 0;
  const canGoForward = navigationHistory.index < navigationHistory.entries.length - 1;

  const handleGoBack = () => {
    if (!canGoBack) return;
    isNavigatingRef.current = true;
    const newIndex = navigationHistory.index - 1;
    setNavigationHistory((previousHistory) => ({
      ...previousHistory,
      index: newIndex,
    }));
    router.push(navigationHistory.entries[newIndex], { scroll: false });
  };

  const handleGoForward = () => {
    if (!canGoForward) return;
    isNavigatingRef.current = true;
    const newIndex = navigationHistory.index + 1;
    setNavigationHistory((previousHistory) => ({
      ...previousHistory,
      index: newIndex,
    }));
    router.push(navigationHistory.entries[newIndex], { scroll: false });
  };

  const handleLogout = async () => {
    await logout();
    // Clear history on logout
    setNavigationHistory(EMPTY_NAVIGATION_HISTORY);
    clearPreservedNavigationState();
    router.push("/");
  };

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 select-none transition-colors duration-500",
        isFullscreen && "bg-transparent",
      )}
    >
      <GradualBlur
        target="parent"
        position="top"
        height="7rem"
        strength={3.5}
        divCount={2}
        curve="bezier"
        exponential={false}
        opacity={1}
        style={{ zIndex: -1 }}
      />
      <div
        className={cn(
          "h-12 flex items-center px-4 bg-transparent transition-[height] duration-500",
          isFullscreen && "h-10",
        )}
        onMouseDown={drag}
        data-tauri-drag-region
      >
        {/* Left: Branding - always visible */}
        <div className="flex items-center gap-4 w-48 transition-opacity duration-500">
          <div className="flex items-center gap-2">
            <img
              src="/svgl/spotify.svg"
              alt="Spotify Logo"
              className="opacity-25 w-auto h-5 z-9999"
            />
          </div>
        </div>

        {/* Center: Navigation as minimal tabs - hidden in fullscreen */}
        <nav
          className={cn(
            "flex-1 flex items-center justify-center gap-4 transition-opacity duration-500",
            (isFullscreen || pathname === "/") &&
              "opacity-0 pointer-events-none",
          )}
        >
          {/* Navigation history buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
              onClick={handleGoBack}
              aria-label="Go back"
              disabled={!canGoBack}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
              onClick={handleGoForward}
              aria-label="Go forward"
              disabled={!canGoForward}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center bg-secondary/30 rounded-full p-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={cn(
                    "relative flex items-center gap-2 px-5 py-1.5 rounded-full text-xs font-medium transition-colors duration-300",
                    isActive
                      ? "bg-foreground text-background"
                      : "text-dim hover:text-foreground",
                  )}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Right: User & Controls */}
        <div className="flex items-center gap-3 w-48 justify-end">
          {/* User - hidden in fullscreen */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-2 rounded-full hover:bg-white/5 gap-1.5 transition-[opacity,background-color] duration-500",
                  isFullscreen && "opacity-0 pointer-events-none",
                )}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label="Open user menu"
              >
                <div className="w-6 h-6 rounded-full border flex items-center justify-center">
                  <span className="text-[10px] font-bold text-foreground">
                    {user?.display_name?.charAt(0) || "U"}
                  </span>
                </div>
                <ChevronDown className="w-3 h-3 text-dim" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 glass border-white/10"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2 flex gap-2">
                <p className="text-sm font-medium">
                  {user?.display_name || "Usuario"}
                </p>
                <p className="text-xs text-dim inline-block bg-primary/10 rounded-full uppercase tracking-wider text-primary px-2 py-0.5">
                  Premium
                </p>
              </div>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem asChild>
                <Link href="/app/profile" className="cursor-pointer text-sm">
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/app/settings" className="cursor-pointer text-sm">
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem
                className="text-destructive cursor-pointer text-sm"
                onSelect={handleLogout}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Window controls - minimal */}
          <div className="flex items-center">
            {!isFullscreen && (
              <>
                <button
                  className="w-7 h-7 flex items-center justify-center text-dim hover:text-foreground transition-colors"
                  onClick={minimize}
                  aria-label="Minimize window"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <button
                  className="w-7 h-7 flex items-center justify-center text-dim hover:text-destructive transition-colors"
                  onClick={close}
                  aria-label="Close window"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Titlebar;
