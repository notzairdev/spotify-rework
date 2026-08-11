"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { pausePlayback } from "@/lib/spotify/api";

const STORAGE_KEY = "spotify-rework:sleep-timer:v1";

interface SleepTimerContextValue {
  endsAt: number | null;
  remainingMs: number;
  setTimer: (minutes: number) => void;
  cancelTimer: () => void;
}

const SleepTimerContext = createContext<SleepTimerContextValue | null>(null);

export function SleepTimerProvider({ children }: { children: ReactNode }) {
  const [endsAt, setEndsAt] = useState<number | null>(readStoredDeadline);
  const [remainingMs, setRemainingMs] = useState(() => remainingUntil(readStoredDeadline()));
  const completionStartedRef = useRef(false);

  const cancelTimer = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    completionStartedRef.current = false;
    setEndsAt(null);
    setRemainingMs(0);
  }, []);

  const setTimer = useCallback((minutes: number) => {
    const deadline = Date.now() + minutes * 60_000;
    localStorage.setItem(STORAGE_KEY, deadline.toString());
    completionStartedRef.current = false;
    setEndsAt(deadline);
    setRemainingMs(remainingUntil(deadline));
  }, []);

  useEffect(() => {
    if (!endsAt) return;

    const updateRemainingTime = () => {
      const remaining = remainingUntil(endsAt);
      setRemainingMs(remaining);
      if (remaining > 0 || completionStartedRef.current) return;

      completionStartedRef.current = true;
      localStorage.removeItem(STORAGE_KEY);
      setEndsAt(null);

      void pausePlayback()
        .then(() => {
          toast.success("Sleep timer finished", {
            description: "Playback has been paused.",
          });
        })
        .catch(() => {
          toast.error("Sleep timer could not pause playback");
        });
    };

    updateRemainingTime();
    const interval = window.setInterval(updateRemainingTime, 1_000);
    return () => window.clearInterval(interval);
  }, [endsAt]);

  const value = useMemo(
    () => ({ endsAt, remainingMs, setTimer, cancelTimer }),
    [cancelTimer, endsAt, remainingMs, setTimer],
  );

  return (
    <SleepTimerContext.Provider value={value}>
      {children}
    </SleepTimerContext.Provider>
  );
}

export function useSleepTimer(): SleepTimerContextValue {
  const context = useContext(SleepTimerContext);
  if (!context) {
    throw new Error("useSleepTimer must be used inside SleepTimerProvider");
  }
  return context;
}

function readStoredDeadline(): number | null {
  if (typeof window === "undefined") return null;
  const storedValue = Number(localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(storedValue) && storedValue > Date.now()
    ? storedValue
    : null;
}

function remainingUntil(deadline: number | null): number {
  return deadline ? Math.max(0, deadline - Date.now()) : 0;
}
