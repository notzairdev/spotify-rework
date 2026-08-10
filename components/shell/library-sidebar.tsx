"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Disc3, Library, ListMusic, Music2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMyPlaylists } from "@/lib/spotify";
import { cn } from "@/lib/utils";

const PLAYLIST_LIMIT = 30;

export function LibrarySidebar({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const { data, isLoading } = useMyPlaylists();
  const playlists = data?.items.slice(0, PLAYLIST_LIMIT) ?? [];
  const toggleButton = (
    <button
      type="button"
      onClick={onToggle}
      aria-label={expanded ? "Collapse library" : "Expand library"}
      className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-white/6 hover:text-foreground"
    >
      {expanded ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
    </button>
  );

  return (
    <aside
      aria-label="Your library"
      className="hidden min-h-0 overflow-hidden pt-14 xl:flex xl:flex-col"
    >
      <div className={cn("flex h-14 shrink-0 items-center px-3", expanded ? "gap-1 px-4" : "justify-center")}>
        {expanded && (
          <Link
            href="/app/library"
            aria-label="Open your collection"
            className={cn(
              "flex size-11 min-w-0 flex-1 items-center justify-start gap-3 rounded-xl px-3 text-muted-foreground transition-colors hover:bg-white/6 hover:text-foreground",
              pathname === "/app/library" && "bg-white/8 text-foreground"
            )}
          >
            <Library className="size-5 shrink-0" />
            <span className="truncate text-sm font-semibold">Your collection</span>
          </Link>
        )}
        {expanded ? toggleButton : (
          <Tooltip>
            <TooltipTrigger asChild>{toggleButton}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>Expand library</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="mx-3 h-px shrink-0 bg-white/6 2xl:mx-5" />

      <div className={cn("items-center justify-between px-5 pb-2 pt-4", expanded ? "flex" : "hidden")}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Playlists
          </p>
          <p className="mt-1 text-xs text-muted-foreground/65">
            {data?.total ?? playlists.length} saved
          </p>
        </div>
        <ListMusic className="size-4 text-muted-foreground/60" />
      </div>

      <nav
        key={expanded ? "expanded-library" : "compact-library"}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-2 scrollbar-hide",
          expanded ? "space-y-1 px-3 py-3" : "space-y-2.5 py-4",
        )}
      >
        {isLoading
          ? Array.from({ length: 9 }).map((_, index) => (
              <div
                key={index}
                className={cn("mx-auto size-11 animate-pulse rounded-lg bg-white/6", expanded && "mx-0 h-14 w-full")}
              />
            ))
          : playlists.map((playlist) => {
              const href = `/app/playlist/${playlist.id}`;
              const isActive = pathname === href;

              return (
                <Tooltip
                  key={`${expanded ? "expanded" : "compact"}:${playlist.id}`}
                  open={expanded ? false : undefined}
                >
                  <TooltipTrigger asChild>
                    <Link
                      href={href}
                      aria-label={playlist.name}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group mx-auto flex size-11 items-center rounded-xl transition-colors hover:bg-white/6",
                        expanded && "mx-0 h-14 w-full gap-3 px-2",
                        isActive && "bg-white/9"
                      )}
                    >
                  {playlist.images[0]?.url ? (
                    <Image
                      src={playlist.images[0].url}
                      alt=""
                      width={44}
                      height={44}
                      className="size-11 shrink-0 rounded-lg object-cover shadow-md"
                    />
                  ) : (
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Music2 className="size-4 text-muted-foreground" />
                    </span>
                  )}
                  {expanded && <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[13px] font-medium", isActive && "text-primary")}>
                      {playlist.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      Playlist · {playlist.owner.display_name ?? "Spotify user"}
                    </span>
                  </span>}
                    </Link>
                  </TooltipTrigger>
                  {!expanded && <TooltipContent side="right" sideOffset={8}>{playlist.name}</TooltipContent>}
                </Tooltip>
              );
            })}

        {!isLoading && playlists.length === 0 && (
          <div className={cn("px-3 py-8 text-center", !expanded && "hidden")}>
            <Disc3 className="mx-auto size-6 text-muted-foreground/50" />
            <p className="mt-3 text-xs text-muted-foreground">Your playlists will appear here.</p>
          </div>
        )}
      </nav>
    </aside>
  );
}
