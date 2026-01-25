"use client";

import { useEffect } from "react";
import { isTauriContext } from "@/lib/env";

/**
 * Blocks the default browser/webview context menu globally.
 * Custom context menus from shadcn/ui will still work as Radix handles its own events.
 */
export function ContextMenuBlocker() {
  useEffect(() => {
    // Only block in Tauri context
    if (!isTauriContext()) return;

    const handleContextMenu = (e: MouseEvent) => {
      // Prevent the default browser context menu
      // Radix context menus intercept the event before it bubbles up
      e.preventDefault();
    };

    // Use capture phase to run before Radix, but Radix will stop propagation for its triggers
    document.addEventListener("contextmenu", handleContextMenu);
    
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  return null;
}
