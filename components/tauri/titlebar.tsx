"use client";

import { Minus, X, ChevronDown, Home, Search, Library, Disc3 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useWindow } from "@/hooks";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Titlebar() {
  const router = useRouter();
  const location = usePathname();

  const { user, logout } = useAuth();
  const {
    handleMinimize: minimize,
    handleClose: close,
    startDragging: drag,
  } = useWindow();

  const handleLogout = async () => {
    await logout();
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
        className="h-12 flex items-center px-4 bg-background/60 backdrop-blur-2xl border-b border-white/5"
        onMouseDown={drag}
        data-tauri-drag-region
      >
        {/* Left: Branding */}
        <div className="flex items-center gap-4 w-48">
          <div className="flex items-center gap-2">
            <img src="/svgl/spotify.svg" alt="Spotify Logo" className="opacity-50 w-4 h-4" />
            <span className="opacity-50 font-mono text-sm tracking-tight">
              BETA
            </span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-[10px] font-mono text-dim uppercase tracking-widest">
            v0.1
          </span>
        </div>

        {/* Center: Navigation as minimal tabs */}
        <nav className="flex-1 flex items-center justify-center">
          <div className="flex items-center bg-secondary/30 rounded-full p-1">
            {navItems.map((item) => {
              const isActive = location === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
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

          {/* User */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 rounded-full hover:bg-white/5 gap-1.5"
              >
                <div className="w-6 h-6 rounded-full bg-linear-to-br from-primary/60 to-accent/60 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-foreground">
                    {user?.display_name?.charAt(0) || "U"}
                  </span>
                </div>
                <ChevronDown className="w-3 h-3 text-dim" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 glass border-white/10">
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
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center text-dim hover:text-destructive transition-colors"
              onClick={close}
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