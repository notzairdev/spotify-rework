"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  getPreservedScrollPosition,
  setPreservedScrollPosition,
} from "@/lib/page-state";
import { cn } from "@/lib/utils";

interface PageViewportProps {
  children: ReactNode;
  className?: string;
}

export function PageViewport({ children, className }: PageViewportProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const routeKey = query ? `${pathname}?${query}` : pathname;
  const viewportRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const savedScrollTop = getPreservedScrollPosition(routeKey) ?? 0;
    let restorationFrame: number | null = null;
    let restorationTimeout: number | null = null;
    let restorationObserver: ResizeObserver | null = null;
    let isRestoring = savedScrollTop > 0;

    const stopRestoring = () => {
      isRestoring = false;
      if (restorationFrame !== null) {
        cancelAnimationFrame(restorationFrame);
        restorationFrame = null;
      }
      if (restorationTimeout !== null) {
        window.clearTimeout(restorationTimeout);
        restorationTimeout = null;
      }
      restorationObserver?.disconnect();
      restorationObserver = null;
    };

    const restoreScroll = () => {
      viewport.scrollTop = savedScrollTop;

      const hasReachedTarget = Math.abs(viewport.scrollTop - savedScrollTop) < 1;
      if (hasReachedTarget) {
        stopRestoring();
      }
    };

    const saveScroll = () => {
      if (!isRestoring) {
        setPreservedScrollPosition(routeKey, viewport.scrollTop);
      }
    };

    viewport.addEventListener("scroll", saveScroll, { passive: true });
    viewport.addEventListener("wheel", stopRestoring, { passive: true });
    viewport.addEventListener("touchstart", stopRestoring, { passive: true });
    viewport.addEventListener("pointerdown", stopRestoring, { passive: true });

    if (isRestoring) {
      // Data-heavy pages grow after their API requests finish. Retry whenever
      // the page content changes size, and stop after a bounded interval.
      restorationObserver = new ResizeObserver(restoreScroll);
      const pageContent = viewport.firstElementChild;
      if (pageContent) restorationObserver.observe(pageContent);
      restorationFrame = requestAnimationFrame(restoreScroll);
      restorationTimeout = window.setTimeout(stopRestoring, 10_000);
    } else {
      viewport.scrollTop = 0;
    }

    return () => {
      setPreservedScrollPosition(
        routeKey,
        isRestoring ? savedScrollTop : viewport.scrollTop
      );
      stopRestoring();
      viewport.removeEventListener("scroll", saveScroll);
      viewport.removeEventListener("wheel", stopRestoring);
      viewport.removeEventListener("touchstart", stopRestoring);
      viewport.removeEventListener("pointerdown", stopRestoring);
    };
  }, [routeKey]);

  return (
    <main
      ref={viewportRef}
      data-page-scroll-viewport
      className={cn(
        "min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain scrollbar-hide",
        className
      )}
    >
      {children}
    </main>
  );
}
