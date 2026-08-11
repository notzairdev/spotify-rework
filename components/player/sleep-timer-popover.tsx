"use client";

import { useState } from "react";
import { MoonStar, TimerReset, X } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSleepTimer } from "@/lib/sleep-timer";
import { cn } from "@/lib/utils";

const TIMER_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

export function SleepTimerPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const { endsAt, remainingMs, setTimer, cancelTimer } = useSleepTimer();
  const isActive = endsAt !== null;

  const selectTimer = (minutes: number) => {
    setTimer(minutes);
    setIsOpen(false);
    toast.success("Sleep timer set", {
      description: `Playback will pause in ${formatOption(minutes)}.`,
    });
  };

  const cancel = () => {
    cancelTimer();
    setIsOpen(false);
    toast.success("Sleep timer cancelled");
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={isActive ? `Sleep timer: ${formatRemaining(remainingMs)} remaining` : "Set sleep timer"}
          title={isActive ? `Sleep timer · ${formatRemaining(remainingMs)}` : "Sleep timer"}
          className={cn(
            "flex h-8 items-center justify-center gap-1.5 rounded-full px-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            isActive && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
          )}
        >
          <MoonStar className="size-4" />
          {isActive && (
            <span className="text-[10px] font-medium tabular-nums">
              {formatCompactRemaining(remainingMs)}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={14}
        className="w-72 overflow-hidden rounded-3xl border-white/10 bg-card/95 p-0 shadow-2xl shadow-black/40 backdrop-blur-2xl"
      >
        <div className="flex items-center gap-3 px-4 pt-4">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {isActive ? <TimerReset className="size-4" /> : <MoonStar className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Sleep timer</p>
            <p className="text-[11px] text-muted-foreground">
              {isActive
                ? `${formatRemaining(remainingMs)} remaining`
                : "Pause playback automatically"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 px-3 pb-3">
          {TIMER_OPTIONS.map((minutes) => (
            <button
              type="button"
              key={minutes}
              onClick={() => selectTimer(minutes)}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-colors hover:bg-muted"
            >
              {formatOption(minutes)}
            </button>
          ))}
        </div>

        {isActive && (
          <div className="border-t border-white/8 p-2">
            <button
              type="button"
              onClick={cancel}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
              Cancel timer
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function formatOption(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

function formatRemaining(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatCompactRemaining(milliseconds: number): string {
  return `${Math.max(1, Math.ceil(milliseconds / 60_000))}m`;
}
