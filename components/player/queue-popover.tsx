"use client";

import { useState } from "react";
import { ListMusic, Music } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQueue } from "@/lib/spotify";
import { cn } from "@/lib/utils";

interface QueuePopoverProps {
  className?: string;
  triggerClassName?: string;
}

export function QueuePopover({ className, triggerClassName }: QueuePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const { data: queue, isLoading, refetch } = useQueue({ enabled: hasOpened });

  // Only start fetching after first open
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      if (!hasOpened) {
        setHasOpened(true);
      } else {
        refetch();
      }
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button className={cn("p-2.5 rounded-full text-muted-foreground/50 hover:text-muted-foreground transition-colors", triggerClassName)}>
          <ListMusic className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className={cn("w-80 p-0 max-h-96 overflow-hidden", className)} 
        align="end"
        sideOffset={12}
      >
        <div className="p-3 border-b border-border/50">
          <h3 className="font-semibold text-sm">Queue</h3>
        </div>
        
        <div className="overflow-y-auto max-h-80 scrollbar-hide">
          {isLoading ? (
            <div className="p-4 flex items-center justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !queue?.queue?.length ? (
            <div className="p-8 text-center text-muted-foreground">
              <ListMusic className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Queue is empty</p>
            </div>
          ) : (
            <div className="p-2">
              {/* Now Playing */}
              {queue.currently_playing && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-muted-foreground px-2 mb-2">Now Playing</p>
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-primary/10">
                    {queue.currently_playing.album.images[0]?.url ? (
                      <img
                        src={queue.currently_playing.album.images[0].url}
                        alt=""
                        className="w-10 h-10 rounded"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                        <Music className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{queue.currently_playing.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {queue.currently_playing.artists.map(a => a.name).join(", ")}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Next Up */}
              {queue.queue.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground px-2 mb-2">Next Up</p>
                  <div className="space-y-1">
                    {queue.queue.slice(0, 10).map((track, index) => (
                      <div
                        key={`${track.id}-${index}`}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-xs text-muted-foreground w-4 text-center">{index + 1}</span>
                        {track.album.images[0]?.url ? (
                          <img
                            src={track.album.images[0].url}
                            alt=""
                            className="w-8 h-8 rounded"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                            <Music className="w-3 h-3 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate">{track.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {track.artists.map(a => a.name).join(", ")}
                          </p>
                        </div>
                      </div>
                    ))}
                    {queue.queue.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        +{queue.queue.length - 10} more tracks
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
