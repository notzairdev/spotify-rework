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
import { invoke } from "@tauri-apps/api/core";

import { isTauriContext } from "@/lib/env";

export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = Exclude<ThemePreference, "system">;
export type NowPlayingWidth = "compact" | "comfortable" | "wide";
export type PreviousButtonBehavior = "smart" | "previous";
export type MinimizeBehavior = "taskbar" | "dynamicIsland";
export type CloseBehavior = "exit" | "tray";

export interface AppSettings {
  schemaVersion: number;
  appearance: {
    theme: ThemePreference;
    reduceMotion: boolean;
    reduceTransparency: boolean;
  };
  interface: {
    showLibrarySidebar: boolean;
    librarySidebarExpanded: boolean;
    showNowPlayingPanel: boolean;
    nowPlayingWidth: NowPlayingWidth;
  };
  playback: {
    startupVolume: number;
    rememberVolume: boolean;
    autoTransferPlayback: boolean;
    previousButtonBehavior: PreviousButtonBehavior;
  };
  privacy: {
    saveSearchHistory: boolean;
    savePlaybackState: boolean;
  };
  updates: {
    automaticChecks: boolean;
  };
  windowBehavior: {
    minimizeBehavior: MinimizeBehavior;
    closeBehavior: CloseBehavior;
  };
}

type SettingsSection =
  | "appearance"
  | "interface"
  | "playback"
  | "privacy"
  | "updates"
  | "windowBehavior";
type SaveStatus = "loading" | "saved" | "saving" | "error";

interface AppSettingsContextValue {
  settings: AppSettings;
  status: SaveStatus;
  error: string | null;
  isLoaded: boolean;
  isNativeStorage: boolean;
  resolvedTheme: ResolvedTheme;
  updateSettings: <Section extends SettingsSection>(
    section: Section,
    patch: Partial<AppSettings[Section]>,
  ) => Promise<void>;
  resetSettings: () => Promise<void>;
}

const SETTINGS_FALLBACK_KEY = "spotify-rework.settings.v1";

const DEFAULT_APP_SETTINGS: AppSettings = {
  schemaVersion: 4,
  appearance: {
    theme: "dark",
    reduceMotion: false,
    reduceTransparency: false,
  },
  interface: {
    showLibrarySidebar: true,
    librarySidebarExpanded: true,
    showNowPlayingPanel: true,
    nowPlayingWidth: "comfortable",
  },
  playback: {
    startupVolume: 0.5,
    rememberVolume: true,
    autoTransferPlayback: true,
    previousButtonBehavior: "smart",
  },
  privacy: {
    saveSearchHistory: true,
    savePlaybackState: true,
  },
  updates: {
    automaticChecks: true,
  },
  windowBehavior: {
    minimizeBehavior: "dynamicIsland",
    closeBehavior: "exit",
  },
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

function normalizeSettings(value: AppSettings): AppSettings {
  const legacyWindow = (value as AppSettings & {
    window?: AppSettings["windowBehavior"];
  }).window;
  const storedWindow = value.windowBehavior ?? legacyWindow;
  const storedCloseBehavior = (
    storedWindow as
      | (Omit<AppSettings["windowBehavior"], "closeBehavior"> & {
          closeBehavior?: CloseBehavior | "minimize";
        })
      | undefined
  )?.closeBehavior;

  return {
    ...DEFAULT_APP_SETTINGS,
    ...value,
    schemaVersion: 4,
    appearance: { ...DEFAULT_APP_SETTINGS.appearance, ...value.appearance },
    interface: { ...DEFAULT_APP_SETTINGS.interface, ...value.interface },
    playback: {
      ...DEFAULT_APP_SETTINGS.playback,
      ...value.playback,
      startupVolume: Math.min(1, Math.max(0.05, value.playback?.startupVolume ?? 0.5)),
    },
    privacy: { ...DEFAULT_APP_SETTINGS.privacy, ...value.privacy },
    updates: { ...DEFAULT_APP_SETTINGS.updates, ...value.updates },
    windowBehavior: {
      ...DEFAULT_APP_SETTINGS.windowBehavior,
      ...storedWindow,
      closeBehavior:
        storedCloseBehavior === "minimize"
          ? "tray"
          : storedCloseBehavior ?? "exit",
    },
  };
}

async function loadStoredSettings(): Promise<AppSettings> {
  if (isTauriContext()) {
    return normalizeSettings(await invoke<AppSettings>("load_settings"));
  }

  const stored = window.localStorage.getItem(SETTINGS_FALLBACK_KEY);
  if (!stored) return DEFAULT_APP_SETTINGS;
  return normalizeSettings(JSON.parse(stored) as AppSettings);
}

async function persistSettings(settings: AppSettings): Promise<AppSettings> {
  if (isTauriContext()) {
    return normalizeSettings(await invoke<AppSettings>("save_settings", { settings }));
  }

  window.localStorage.setItem(SETTINGS_FALLBACK_KEY, JSON.stringify(settings));
  return settings;
}

async function persistDefaults(): Promise<AppSettings> {
  if (isTauriContext()) {
    return normalizeSettings(await invoke<AppSettings>("reset_settings"));
  }

  window.localStorage.setItem(SETTINGS_FALLBACK_KEY, JSON.stringify(DEFAULT_APP_SETTINGS));
  return DEFAULT_APP_SETTINGS;
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(DEFAULT_APP_SETTINGS);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const settingsRef = useRef(settings);
  const saveQueueRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadStoredSettings()
      .then((storedSettings) => {
        if (cancelled) return;
        settingsRef.current = storedSettings;
        setSettings(storedSettings);
        setStatus("saved");
        setIsLoaded(true);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setStatus("error");
        setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const nextTheme: ResolvedTheme =
        settings.appearance.theme === "system"
          ? systemTheme.matches
            ? "dark"
            : "light"
          : settings.appearance.theme;
      root.classList.toggle("dark", nextTheme === "dark");
      root.classList.toggle("light", nextTheme === "light");
      root.style.colorScheme = nextTheme;
      setResolvedTheme(nextTheme);
    };

    applyTheme();
    if (settings.appearance.theme === "system") {
      systemTheme.addEventListener("change", applyTheme);
    }

    root.toggleAttribute(
      "data-reduce-motion",
      settings.appearance.reduceMotion,
    );
    root.toggleAttribute(
      "data-reduce-transparency",
      settings.appearance.reduceTransparency,
    );

    return () => systemTheme.removeEventListener("change", applyTheme);
  }, [
    settings.appearance.reduceMotion,
    settings.appearance.reduceTransparency,
    settings.appearance.theme,
  ]);

  useEffect(() => {
    if (settings.privacy.savePlaybackState) return;
    window.localStorage.removeItem("spotify-rework-island-state:v1");
  }, [settings.privacy.savePlaybackState]);

  const updateSettings = useCallback<AppSettingsContextValue["updateSettings"]>(
    async (section, patch) => {
      const nextSettings = normalizeSettings({
        ...settingsRef.current,
        [section]: {
          ...settingsRef.current[section],
          ...patch,
        },
      });
      settingsRef.current = nextSettings;
      setSettings(nextSettings);
      setStatus("saving");
      setError(null);

      const request = (saveQueueRef.current ?? Promise.resolve())
        .then(() => persistSettings(nextSettings));
      saveQueueRef.current = request.then(() => undefined, () => undefined);
      try {
        const persisted = await request;
        if (settingsRef.current === nextSettings) {
          settingsRef.current = persisted;
          setSettings(persisted);
          setStatus("saved");
        }
      } catch (reason: unknown) {
        if (settingsRef.current === nextSettings) {
          setError(reason instanceof Error ? reason.message : String(reason));
          setStatus("error");
        }
        throw reason;
      }
    },
    [],
  );

  const resetSettings = useCallback(async () => {
    setStatus("saving");
    setError(null);
    try {
      const defaults = await persistDefaults();
      settingsRef.current = defaults;
      setSettings(defaults);
      setStatus("saved");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
      throw reason;
    }
  }, []);

  const value = useMemo<AppSettingsContextValue>(() => ({
    settings,
    status,
    error,
    isLoaded,
    isNativeStorage: isTauriContext(),
    resolvedTheme,
    updateSettings,
    resetSettings,
  }), [
    error,
    isLoaded,
    resetSettings,
    resolvedTheme,
    settings,
    status,
    updateSettings,
  ]);

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsContextValue {
  const value = useContext(AppSettingsContext);
  if (!value) throw new Error("useAppSettings must be used inside AppSettingsProvider");
  return value;
}
