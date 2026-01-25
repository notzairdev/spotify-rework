"use client";

import { useState } from "react";
import {
  MonitorSpeaker,
  Smartphone,
  Speaker,
  Laptop,
  Tv,
  Gamepad2,
  Car,
  Check,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDevices, useTransferPlayback } from "@/lib/spotify";
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

export function DevicePopover({ className, triggerClassName }: DevicePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const { data: devicesData, isLoading, refetch } = useDevices({ enabled: hasOpened });
  const { mutate: transferPlayback, isLoading: isTransferring } = useTransferPlayback();

  const devices = devicesData?.devices ?? [];

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

  const handleDeviceSelect = async (deviceId: string | null) => {
    if (!deviceId) return;
    try {
      await transferPlayback({ deviceId, play: true });
      setIsOpen(false);
      // Refetch to update active state
      setTimeout(() => refetch(), 1000);
    } catch (e) {
      console.error("Failed to transfer playback:", e);
    }
  };

  const getDeviceIcon = (type: string) => {
    const Icon = deviceIcons[type.toLowerCase()] ?? MonitorSpeaker;
    return Icon;
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button className={cn("p-2.5 rounded-full text-muted-foreground/50 hover:text-muted-foreground transition-colors", triggerClassName)}>
          <MonitorSpeaker className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className={cn("w-72 p-0", className)} 
        align="end"
        sideOffset={12}
      >
        <div className="p-3 border-b border-border/50">
          <h3 className="font-semibold text-sm">Connect to a device</h3>
        </div>
        
        <div className="p-2">
          {isLoading ? (
            <div className="p-4 flex items-center justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : devices.length === 0 ? (
            <div className="px-6 text-center text-muted-foreground">
              <MonitorSpeaker className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No devices found</p>
              <p className="text-xs mt-1 opacity-70">
                Open Spotify on another device to connect
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {devices.map((device) => {
                const Icon = getDeviceIcon(device.type);
                return (
                  <button
                    key={device.id}
                    onClick={() => handleDeviceSelect(device.id)}
                    disabled={isTransferring || device.is_active}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                      device.is_active
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg",
                      device.is_active ? "bg-primary/20" : "bg-muted"
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{device.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {device.type.replace("_", " ")}
                      </p>
                    </div>
                    {device.is_active && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
