"use client";

import { Minus, X, Settings, User, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWindow } from "@/hooks";
import { Input } from "../ui/input";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TitlebarProps {
  hideSearch?: boolean;
}

export function Titlebar({ hideSearch = false }: TitlebarProps) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const {
    handleMinimize: minimize,
    handleClose: close,
    startDragging: drag,
  } = useWindow();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const windowActions = [
    { id: "minimize", label: "Minimizar", icon: Minus, onPress: minimize },
    { id: "close", label: "Cerrar", icon: X, onPress: close },
  ];

  return (
    <header
      className="bg-transparent border-border/80 border-b flex h-11 items-center gap-3 px-3 text-sm fixed top-0 left-0 right-0 select-none"
      onMouseDown={drag}
      style={{
        zIndex: 9999,
      }}
    >
      <div className="flex items-center gap-2 select-none">
        <div className="leading-tight flex items-center gap-2">
          <img src="/svgl/spotify.svg" alt="Spotify Logo" className="opacity-50 w-4 h-4"/>
          <p className="text-[0.75rem] uppercase tracking-wide text-muted-foreground font-mono">
            BETA
          </p>
        </div>
      </div>
      
      {!hideSearch && (
        <div className="flex-1 flex justify-center">
          <div className="max-w-md w-full">
            <Input placeholder="What do you want to listen to?"/>
          </div>
        </div>
      )}
      {hideSearch && <div className="flex-1" />}

      <div
        className="flex items-center gap-2"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* User menu dropdown - only show when authenticated */}
        {isAuthenticated && user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 h-7 px-2 hover:bg-accent/60"
              >
                {user.images?.[0]?.url ? (
                  <img
                    src={user.images[0].url}
                    alt={user.display_name ?? "User"}
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-3 h-3" />
                  </div>
                )}
                <span className="text-xs font-medium max-w-24 truncate">
                  {user.display_name ?? "User"}
                </span>
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium">{user.display_name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {user.email ?? user.id}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {user.product === "premium" ? "Premium" : "Free"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2" />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut className="mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="flex items-center gap-1 rounded-md border border-transparent px-1 text-muted-foreground">
          {/* Window control buttons mimic native Tauri chrome */}
          {windowActions.map(({ id, label, icon: Icon, onPress }) => (
            <Button
              variant="ghost"
              size="icon-sm"
              className="hover:bg-accent/60"
              aria-label={label}
              key={id}
              onClick={onPress}
            >
              <Icon className="size-4" aria-hidden="true" />
            </Button>
          ))}
        </div>
      </div>
    </header>
  );
}

export default Titlebar;
