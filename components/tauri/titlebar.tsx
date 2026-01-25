"use client";

import { useState, useEffect, useRef } from "react";
import { Minus, X, ChevronDown, ChevronLeft, ChevronRight, Home, Search, Library } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useWindow } from "@/hooks";
import { useAuth } from "@/lib/auth";
import { useFullscreen } from "@/lib/fullscreen";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Paths that should not be in navigation history
const EXCLUDED_PATHS = ["/", "/callback"];

export function Titlebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isFullscreen } = useFullscreen();
  const { isAuthenticated } = useAuth();

  // Navigation history tracking
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
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
    
    // Skip if we're navigating via back/forward buttons
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false;
      return;
    }

    // Check if we should add this path
    setHistoryStack((prev) => {
      // If navigating forward from middle of history, truncate
      const truncated = prev.slice(0, currentIndex + 1);
      
      // Don't add duplicate consecutive entries
      if (truncated[truncated.length - 1] === pathname) {
        return prev;
      }
      
      const newStack = [...truncated, pathname];
      // Update index to point to the newly added entry
      // Use setTimeout to batch with React's state updates
      setTimeout(() => setCurrentIndex(newStack.length - 1), 0);
      return newStack;
    });
  }, [pathname, currentIndex]);

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < historyStack.length - 1;

  const handleGoBack = () => {
    if (!canGoBack) return;
    isNavigatingRef.current = true;
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    router.push(historyStack[newIndex]);
  };

  const handleGoForward = () => {
    if (!canGoForward) return;
    isNavigatingRef.current = true;
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    router.push(historyStack[newIndex]);
  };

  const handleLogout = async () => {
    await logout();
    // Clear history on logout
    setHistoryStack([]);
    setCurrentIndex(-1);
    router.push("/");
  };

  const navItems = [
    { icon: Home, label: "Home", path: "/home" },
    { icon: Search, label: "Discover", path: "/search" },
    { icon: Library, label: "Collection", path: "/library" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 select-none">
      <div
        className={cn(
          "h-12 flex items-center px-4 bg-transparent transition-all duration-500",
          isFullscreen && "bg-transparent backdrop-blur-none h-8"
        )}
        onMouseDown={drag}
        data-tauri-drag-region
      >
        {/* Left: Branding */}
        <div className={cn(
          "flex items-center gap-4 w-48 transition-all duration-500",
          isFullscreen && "opacity-0 pointer-events-none"
        )}>
          <div className="flex items-center gap-2">
            <img src="/svgl/spotify.svg" alt="Spotify Logo" className="opacity-50 w-auto h-5" />
            {/* <span className="opacity-50 font-mono text-sm tracking-tight">
              DEV
            </span> */}
          </div>
        </div>

        {/* Center: Navigation as minimal tabs */}
        <nav className={cn(
          "flex-1 flex items-center justify-center gap-4 transition-all duration-500",
          isFullscreen && "opacity-0 pointer-events-none"
        )}>
          {/* Navigation history buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
              onClick={handleGoBack}
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
              disabled={!canGoForward}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center bg-secondary/30 rounded-full p-1">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={cn(
                    "relative flex items-center gap-2 px-5 py-1.5 rounded-full text-xs font-medium transition-all duration-300",
                    isActive
                      ? "bg-foreground text-background"
                      : "text-dim hover:text-foreground"
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
                  "h-8 px-2 rounded-full hover:bg-white/5 gap-1.5 transition-all duration-500",
                  isFullscreen && "opacity-0 pointer-events-none"
                )}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="w-6 h-6 rounded-full bg-linear-to-br from-primary/60 to-accent/60 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-foreground">
                    {user?.display_name?.charAt(0) || "U"}
                  </span>
                </div>
                <ChevronDown className="w-3 h-3 text-dim" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 glass border-white/10" onMouseDown={(e) => e.stopPropagation()}>
              <div className="px-3 py-2">
                <p className="text-sm font-medium">
                  {user?.display_name || "Usuario"}
                </p>
                <p className="text-xs text-dim">Premium</p>
              </div>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer text-sm">
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer text-sm">
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem className="text-destructive cursor-pointer text-sm" onSelect={handleLogout}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Window controls - minimal */}
          <div className="flex items-center">
            <button
              className="w-7 h-7 flex items-center justify-center text-dim hover:text-foreground transition-colors"
              onClick={minimize}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center text-dim hover:text-destructive transition-colors"
              onClick={close}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Titlebar;