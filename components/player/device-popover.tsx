"use client";

import { useState } from "react";
import {
  Car,
  CheckCircle2,
  Gamepad2,
  Laptop,
  MonitorSpeaker,
  RefreshCw,
  Smartphone,
  Speaker,
  Tv,
} from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useDevices,
  useSpotifyPlayer,
  type SpotifyDevice,
} from "@/lib/spotify";
import { cn } from "@/lib/utils";

interface DevicePopoverProps {
  className?: string;
  triggerClassName?: string;
}

const deviceIcons: Record<string, React.ElementType> = {
  computer: Laptop,
  smartphone: Smartphone,
  speaker: Speaker,
  tv: Tv,
  game_console: Gamepad2,
  automobile: Car,
};

function getDeviceIcon(type: string) {
  return deviceIcons[type.toLowerCase()] ?? MonitorSpeaker;
}

function getDeviceKey(device: SpotifyDevice) {
  return device.id ?? `${device.type}:${device.name}`;
}

export function DevicePopover({ className, triggerClassName }: DevicePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const {
    deviceId,
    isReady,
    isControlling,
    isPlaybackLocal,
    transferPlayback,
  } = useSpotifyPlayer();
  const { data: devicesData, isLoading, refetch } = useDevices({ enabled: hasOpened });
  const devices = devicesData?.devices ?? [];
  const localDevice = devices.find((device) => device.id === deviceId);
  const isLocalActive = localDevice?.is_active ?? isPlaybackLocal;
  const otherDevices: SpotifyDevice[] = [];
  const seenDeviceKeys = new Set<string>();
  for (const device of devices) {
    const key = getDeviceKey(device);
    if (device.id !== deviceId && !seenDeviceKeys.has(key)) {
      seenDeviceKeys.add(key);
      otherDevices.push(device);
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) return;
    if (!hasOpened) setHasOpened(true);
    else void refetch();
  };

  const handleReconnect = async () => {
    try {
      await transferPlayback(false);
      await refetch();
      toast.success("Playback connected to this app");
    } catch (error) {
      toast.error("Could not reconnect playback", {
        description:
          error instanceof Error ? error.message : "Spotify rejected the device transfer.",
      });
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Playback connection"
          className={cn(
            "rounded-full p-2.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground",
            isLocalActive && "text-primary hover:text-primary",
            triggerClassName,
          )}
        >
          <MonitorSpeaker className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-80 p-0", className)}
        align="end"
        sideOffset={12}
      >
        <div className="border-b border-border/50 p-4">
          <h3 className="text-sm font-semibold">Playback connection</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Controls stay synchronized while Spotify plays through this app.
          </p>
        </div>

        <div className="space-y-3 px-3 pb-3">
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3",
              isLocalActive
                ? "border-primary/25 bg-primary/8"
                : "border-white/8 bg-white/3",
            )}
          >
            <div className="rounded-lg bg-white/6 p-2">
              <Laptop className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {localDevice?.name ?? "Spotify Rework"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {isLocalActive ? "Active in this app" : "Ready to reconnect"}
              </p>
            </div>
            {isLocalActive ? (
              <CheckCircle2 className="size-4 text-primary" />
            ) : (
              <button
                type="button"
                onClick={() => void handleReconnect()}
                disabled={!isReady || isControlling}
                className="rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background transition-opacity disabled:opacity-45"
              >
                {isControlling ? "Connecting…" : "Use here"}
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-5">
              <RefreshCw className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : otherDevices.length > 0 ? (
            <div>
              <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/65">
                Other Spotify devices
              </p>
              <div className="space-y-1">
                {otherDevices.map((device) => {
                  const Icon = getDeviceIcon(device.type);
                  return (
                    <div
                      key={getDeviceKey(device)}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 text-muted-foreground"
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-xs">{device.name}</span>
                      {device.is_active && (
                        <span className="text-[10px] text-amber-300/80">Playing there</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 px-1 text-[10px] leading-relaxed text-muted-foreground/60">
                Switch from Spotify itself if you want to hand playback to another device. Return here to reconnect this player.
              </p>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
