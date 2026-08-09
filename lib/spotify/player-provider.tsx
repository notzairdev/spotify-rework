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
import { emit, listen } from "@tauri-apps/api/event";
import { devError, devLog, isTauriContext } from "@/lib/env";
import { useAuth } from "@/lib/auth";

// Spotify Web Playback SDK types
declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: typeof Spotify;
  }
}

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  duration: number;
  position: number;
  track: {
    id: string;
    name: string;
    artists: string[];
    album: {
      name: string;
      images: { url: string; width: number; height: number }[];
    };
  } | null;
  volume: number;
  shuffle: boolean;
  repeatMode: "off" | "track" | "context";
}

export interface SpotifyPlayerContextValue {
  /** Player instance */
  player: Spotify.Player | null;
  /** Current device ID (for transferring playback) */
  deviceId: string | null;
  /** Current playback state */
  state: PlaybackState | null;
  /** Whether SDK is loaded and ready */
  isReady: boolean;
  /** Whether player is currently loading */
  isLoading: boolean;
  /** Whether player is in an error state */
  error: string | null;
  /** Play/Resume playback */
  play: (uris?: string[], contextUri?: string, offset?: number) => Promise<void>;
  /** Pause playback */
  pause: () => Promise<void>;
  /** Toggle play/pause */
  togglePlay: () => Promise<void>;
  /** Skip to next track */
  nextTrack: () => Promise<void>;
  /** Skip to previous track */
  previousTrack: () => Promise<void>;
  /** Seek to position in ms */
  seek: (positionMs: number) => Promise<void>;
  /** Set volume (0-1) */
  setVolume: (volume: number) => Promise<void>;
  /** Transfer playback to this device */
  transferPlayback: () => Promise<void>;
  /** Toggle shuffle mode */
  toggleShuffle: () => Promise<void>;
  /** Set repeat mode (cycles: off -> context -> track -> off) */
  cycleRepeatMode: () => Promise<void>;
  /** Retry initialization */
  retry: () => void;
}

const SpotifyPlayerContext = createContext<SpotifyPlayerContextValue | null>(null);

const SPOTIFY_PLAYER_SDK_URL = "https://sdk.scdn.co/spotify-player.js";
const VOLUME_STORAGE_KEY = "spotify-rework-volume:v1";
const ISLAND_STATE_STORAGE_KEY = "spotify-rework-island-state:v1";

/**
 * Get saved volume from localStorage
 */
function getSavedVolume(): number {
  if (typeof window === "undefined") return 0.5;
  try {
    const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (saved) {
      const vol = parseFloat(saved);
      if (!isNaN(vol) && vol >= 0 && vol <= 1) return vol;
    }
  } catch {}
  return 0.5;
}

/**
 * Save volume to localStorage
 */
function saveVolume(volume: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY, volume.toString());
  } catch {}
}

interface SpotifyPlayerProviderProps {
  children: ReactNode;
  /** Player name shown in Spotify Connect */
  playerName?: string;
}

/**
 * Check if the platform supports EME (Encrypted Media Extensions)
 * Required for Spotify Web Playback SDK (Widevine DRM)
 */
async function checkEMESupport(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  if (!navigator.requestMediaKeySystemAccess) return false;
  
  try {
    // Try to access Widevine (used by Spotify)
    await navigator.requestMediaKeySystemAccess("com.widevine.alpha", [
      {
        initDataTypes: ["cenc"],
        audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
        videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }],
      },
    ]);
    return true;
  } catch {
    return false;
  }
}

function disposeSpotifyPlayer(player: Spotify.Player) {
  player.removeListener("initialization_error");
  player.removeListener("authentication_error");
  player.removeListener("account_error");
  player.removeListener("playback_error");
  player.removeListener("ready");
  player.removeListener("not_ready");
  player.removeListener("player_state_changed");
  player.disconnect();
}

export function SpotifyPlayerProvider({
  children,
  playerName = "Spotify Rework",
}: SpotifyPlayerProviderProps) {
  const { isAuthenticated, isPremium, accessToken } = useAuth();
  const [player, setPlayer] = useState<Spotify.Player | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [state, setState] = useState<PlaybackState | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [emeSupported, setEmeSupported] = useState<boolean | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Use saved volume or default
  const initialVolume = useMemo(() => getSavedVolume(), []);

  const playerRef = useRef<Spotify.Player | null>(null);
  const stateRef = useRef<PlaybackState | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const hasAutoTransferredRef = useRef(false);
  const repeatRequestInFlightRef = useRef(false);

  // Keep token ref updated
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Check EME support on mount
  useEffect(() => {
    checkEMESupport().then((supported) => {
      setEmeSupported(supported);
      if (!supported) {
        devLog("EME/Widevine not supported on this platform");
        setError("Playback not available: This platform doesn't support DRM (Widevine). Use Spotify Connect from another device instead.");
      }
    });
  }, []);

  // Load Spotify Web Playback SDK script (only if EME is supported)
  useEffect(() => {
    // Wait for EME check
    if (emeSupported === null) return;
    
    // Don't load SDK if EME not supported
    if (!emeSupported) {
      devLog("Skipping SDK load - EME not supported");
      return;
    }
    
    // Don't load if already loaded or loading
    if (window.Spotify || document.querySelector(`script[src="${SPOTIFY_PLAYER_SDK_URL}"]`)) {
      if (window.Spotify) {
        let cancelled = false;
        queueMicrotask(() => {
          if (!cancelled) setSdkLoaded(true);
        });
        return () => {
          cancelled = true;
        };
      }
      return;
    }

    devLog("Loading Spotify Web Playback SDK...");
    const script = document.createElement("script");
    script.src = SPOTIFY_PLAYER_SDK_URL;
    script.async = true;

    script.onerror = () => {
      devError("Failed to load Spotify SDK script");
      setError("Failed to load Spotify SDK");
    };

    window.onSpotifyWebPlaybackSDKReady = () => {
      devLog("Spotify Web Playback SDK Ready");
      setSdkLoaded(true);
    };

    document.body.appendChild(script);

    return () => {
      // Don't remove script on cleanup - it should persist
    };
  }, [emeSupported]);

  const getAccessToken = useCallback(async (): Promise<string> => {
    // Try fresh token from Tauri backend first
    if (isTauriContext()) {
      try {
        const token = await invoke<string>("get_access_token");
        return token;
      } catch (e) {
        devError("Failed to get access token from backend:", e);
      }
    }

    // Fall back to current token
    if (accessTokenRef.current) {
      return accessTokenRef.current;
    }

    throw new Error("No access token available");
  }, []);

  const initializePlayer = useCallback(async () => {
    if (!window.Spotify) {
      devError("Spotify SDK not available");
      setError("Spotify SDK not loaded");
      return;
    }

    // Don't initialize if already initialized
    if (playerRef.current) {
      devLog("Player already initialized");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      devLog("Initializing Spotify player...");
      await getAccessToken();
      devLog("Got access token for player initialization");

      const newPlayer = new window.Spotify.Player({
        name: playerName,
        getOAuthToken: async (cb) => {
          try {
            const freshToken = await getAccessToken();
            cb(freshToken);
          } catch (e) {
            devError("Failed to get OAuth token for player:", e);
            // Still call cb with empty string to prevent hanging
            cb("");
          }
        },
        volume: initialVolume,
      });

      // Error handling
      newPlayer.addListener("initialization_error", ({ message }) => {
        devError("Player initialization error:", message);
        setError(`Player initialization failed: ${message}`);
        setIsLoading(false);
      });

      newPlayer.addListener("authentication_error", ({ message }) => {
        devError("Player authentication error:", message);
        setError(`Authentication failed: ${message}`);
        setIsLoading(false);
      });

      newPlayer.addListener("account_error", ({ message }) => {
        devError("Player account error:", message);
        setError(`Account error: ${message}. Premium required.`);
        setIsLoading(false);
      });

      newPlayer.addListener("playback_error", ({ message }) => {
        devError("Playback error:", message);
        // Don't set error state for playback errors, just log
      });

      // Ready
      newPlayer.addListener("ready", async ({ device_id }) => {
        devLog("Player ready with device ID:", device_id);
        setDeviceId(device_id);
        setIsReady(true);
        setIsLoading(false);
        setError(null);
        
        // Auto-transfer playback to this device on first ready
        if (!hasAutoTransferredRef.current) {
          hasAutoTransferredRef.current = true;
          try {
            devLog("Auto-transferring playback to this device...");
            const token = await getAccessToken();
            await fetch("https://api.spotify.com/v1/me/player", {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                device_ids: [device_id],
                play: false, // Don't auto-play, just transfer
              }),
            });
            devLog("Playback transferred successfully");
          } catch (e) {
            devError("Failed to auto-transfer playback:", e);
            // Don't set error - this is not critical
          }
        }
      });

      // Not ready
      newPlayer.addListener("not_ready", ({ device_id }) => {
        devLog("Player not ready, device ID:", device_id);
        setIsReady(false);
      });

      // State changes
      newPlayer.addListener("player_state_changed", (sdkState) => {
        if (!sdkState) {
          setState(null);
          return;
        }

        const currentTrack = sdkState.track_window.current_track;
        const newState = {
          isPlaying: !sdkState.paused,
          isPaused: sdkState.paused,
          duration: sdkState.duration,
          position: sdkState.position,
          track: currentTrack
            ? {
                id: currentTrack.id ?? "",
                name: currentTrack.name,
                artists: currentTrack.artists.map((a) => a.name),
                album: {
                  name: currentTrack.album.name,
                  images: currentTrack.album.images.map((img) => ({
                    url: img.url,
                    width: img.width ?? 0,
                    height: img.height ?? 0,
                  })),
                },
              }
            : null,
          shuffle: sdkState.shuffle,
          repeatMode: (sdkState.repeat_mode === 0
            ? "off"
            : sdkState.repeat_mode === 1
              ? "track"
              : "context") as "off" | "context" | "track",
        };
        
        const nextState = {
          ...newState,
          volume: stateRef.current?.volume ?? initialVolume,
        };
        stateRef.current = nextState;
        setState(nextState);

        if (isTauriContext()) {
          void emit("spotify-player-state", nextState).catch(console.error);
          localStorage.setItem(ISLAND_STATE_STORAGE_KEY, JSON.stringify(nextState));
        }
      });

      // Connect to Spotify
      devLog("Connecting player to Spotify...");
      playerRef.current = newPlayer;
      const connected = await newPlayer.connect();

      // Initialization may have been cancelled while connect() was pending.
      if (playerRef.current !== newPlayer) {
        disposeSpotifyPlayer(newPlayer);
        return;
      }
      
      if (connected) {
        devLog("Player connected successfully");
        setPlayer(newPlayer);
      } else {
        disposeSpotifyPlayer(newPlayer);
        playerRef.current = null;
        devError("Failed to connect player");
        setError("Failed to connect to Spotify. Please try again.");
        setIsLoading(false);
      }
    } catch (e) {
      if (playerRef.current) {
        disposeSpotifyPlayer(playerRef.current);
        playerRef.current = null;
      }
      devError("Failed to initialize player:", e);
      setError(e instanceof Error ? e.message : "Failed to initialize player");
      setIsLoading(false);
    }
  }, [playerName, initialVolume, getAccessToken]);

  // Initialize player when SDK is loaded and user is authenticated with Premium
  useEffect(() => {
    if (!sdkLoaded || !isAuthenticated) {
      return;
    }

    if (!isPremium) {
      devLog("User does not have Premium, skipping player initialization");
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) setError("Spotify Premium required for playback");
      });
      return () => {
        cancelled = true;
      };
    }

    if (!accessToken) {
      devLog("No access token available, waiting...");
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void initializePlayer();
    });

    return () => {
      cancelled = true;
      if (playerRef.current) {
        devLog("Disconnecting player...");
        disposeSpotifyPlayer(playerRef.current);
        playerRef.current = null;
        setPlayer(null);
        setIsReady(false);
      }
    };
  }, [
    sdkLoaded,
    isAuthenticated,
    isPremium,
    accessToken,
    retryCount,
    initializePlayer,
  ]);

  // Retry initialization
  const retry = useCallback(() => {
    if (playerRef.current) {
      disposeSpotifyPlayer(playerRef.current);
      playerRef.current = null;
    }
    setPlayer(null);
    setIsReady(false);
    setError(null);
    setRetryCount((c) => c + 1);
  }, []);

  // Set up listeners for remote commands (e.g. from Island)
  useEffect(() => {
    if (!isTauriContext() || !player) return;

    const unlistens: (() => void)[] = [];
    let disposed = false;
    const setupListeners = async () => {
      try {
        const listeners = await Promise.all([
          listen("island-play-pause", () => player.togglePlay()),
          listen("island-next", () => player.nextTrack()),
          listen("island-prev", () => player.previousTrack()),
        ]);

        if (disposed) {
          listeners.forEach((unlisten) => unlisten());
        } else {
          unlistens.push(...listeners);
        }
      } catch (err) {
        console.error(err);
      }
    };
    void setupListeners();

    return () => {
      disposed = true;
      unlistens.forEach((u) => u());
    };
  }, [player]);

  // Update position periodically while playing
  useEffect(() => {
    if (!player || !state?.isPlaying) return;

    const interval = setInterval(async () => {
      try {
        const currentState = await player.getCurrentState();
        if (currentState && !currentState.paused) {
          setState((prev) =>
            prev
              ? {
                  ...prev,
                  position: currentState.position,
                }
              : null
          );
        }
      } catch {
        // Ignore errors during position polling
      }
    }, 250); // Update every 250ms for smoother lyrics sync

    return () => clearInterval(interval);
  }, [player, state?.isPlaying]);

  // Playback controls
  const playbackPosition = state?.position ?? 0;
  const shuffleEnabled = state?.shuffle ?? false;
  const currentRepeatMode = state?.repeatMode ?? "off";

  const play = useCallback(
    async (uris?: string[], contextUri?: string, offset?: number) => {
      if (!deviceId) {
        throw new Error("No device ID available");
      }

      const token = await getAccessToken();

      const body: Record<string, unknown> = {};
      if (uris) body.uris = uris;
      if (contextUri) body.context_uri = contextUri;
      if (offset !== undefined) body.offset = { position: offset };

      await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
        }
      );
    },
    [deviceId, getAccessToken]
  );

  const pause = useCallback(async () => {
    await player?.pause();
  }, [player]);

  const togglePlay = useCallback(async () => {
    await player?.togglePlay();
  }, [player]);

  const nextTrack = useCallback(async () => {
    await player?.nextTrack();
  }, [player]);

  const previousTrack = useCallback(async () => {
    // If position > 3 seconds, restart the current track instead
    if (playbackPosition > 3000) {
      await player?.seek(0);
    } else {
      await player?.previousTrack();
    }
  }, [player, playbackPosition]);

  const seek = useCallback(
    async (positionMs: number) => {
      await player?.seek(positionMs);
    },
    [player]
  );

  const setVolume = useCallback(
    async (volume: number) => {
      await player?.setVolume(volume);
      const currentState = stateRef.current;
      if (currentState) {
        const nextState = { ...currentState, volume };
        stateRef.current = nextState;
        setState(nextState);
      }
      saveVolume(volume);
    },
    [player]
  );

  const transferPlayback = useCallback(async () => {
    if (!deviceId) {
      throw new Error("No device ID available");
    }

    const token = await getAccessToken();

    await fetch("https://api.spotify.com/v1/me/player", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_ids: [deviceId],
        play: true,
      }),
    });
  }, [deviceId, getAccessToken]);

  const toggleShuffle = useCallback(async () => {
    if (!deviceId) return;
    const token = await getAccessToken();
    const newState = !shuffleEnabled;
    await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${newState}&device_id=${deviceId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    // Update local state optimistically
    setState(prev => prev ? { ...prev, shuffle: newState } : null);
  }, [deviceId, getAccessToken, shuffleEnabled]);

  const cycleRepeatMode = useCallback(async () => {
    if (!deviceId || repeatRequestInFlightRef.current) return;
    repeatRequestInFlightRef.current = true;

    try {
      const token = await getAccessToken();
      // Cycle: off -> context -> track -> off
      const modes: Array<"off" | "context" | "track"> = ["off", "context", "track"];
      const currentIndex = modes.indexOf(currentRepeatMode);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      const params = new URLSearchParams({
        state: nextMode,
        device_id: deviceId,
      });
      const response = await fetch(
        `https://api.spotify.com/v1/me/player/repeat?${params}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Spotify rejected repeat mode change (${response.status})`);
      }

      // Reflect the new mode only after Spotify accepts the request.
      setState((prev) => prev ? { ...prev, repeatMode: nextMode } : null);
    } catch (e) {
      devError("Failed to change repeat mode:", e);
    } finally {
      repeatRequestInFlightRef.current = false;
    }
  }, [deviceId, getAccessToken, currentRepeatMode]);

  const value = useMemo<SpotifyPlayerContextValue>(
    () => ({
      player,
      deviceId,
      state,
      isReady,
      isLoading,
      error,
      play,
      pause,
      togglePlay,
      nextTrack,
      previousTrack,
      seek,
      setVolume,
      transferPlayback,
      toggleShuffle,
      cycleRepeatMode,
      retry,
    }),
    [
      player,
      deviceId,
      state,
      isReady,
      isLoading,
      error,
      play,
      pause,
      togglePlay,
      nextTrack,
      previousTrack,
      seek,
      setVolume,
      transferPlayback,
      toggleShuffle,
      cycleRepeatMode,
      retry,
    ]
  );

  return (
    <SpotifyPlayerContext.Provider value={value}>
      {children}
    </SpotifyPlayerContext.Provider>
  );
}

/**
 * Hook to access Spotify player
 */
export function useSpotifyPlayer(): SpotifyPlayerContextValue {
  const context = useContext(SpotifyPlayerContext);
  if (!context) {
    throw new Error("useSpotifyPlayer must be used within a SpotifyPlayerProvider");
  }
  return context;
}
