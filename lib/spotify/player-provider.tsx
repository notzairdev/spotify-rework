"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { devError, devLog, isTauriContext } from "@/lib/env";
import { useAuth } from "@/lib/auth";
import { useAppSettings } from "@/lib/settings";
import type { SpotifyDevice } from "@/lib/spotify/api";

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
    uri?: string;
    name: string;
    artists: string[];
    artistIds?: string[];
    album: {
      id?: string;
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
  /** Whether a playback command is currently being processed */
  isControlling: boolean;
  /** Whether playback is currently assigned to this Web Playback SDK device */
  isPlaybackLocal: boolean;
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
  transferPlayback: (play?: boolean) => Promise<void>;
  /** Toggle shuffle mode */
  toggleShuffle: () => Promise<void>;
  /** Set repeat mode (cycles: off -> context -> track -> off) */
  cycleRepeatMode: () => Promise<void>;
  /** Retry initialization */
  retry: () => void;
}

const SpotifyPlayerContext = createContext<SpotifyPlayerContextValue | null>(null);

const SPOTIFY_PLAYER_SDK_URL = "https://sdk.scdn.co/spotify-player.js";
const ISLAND_STATE_STORAGE_KEY = "spotify-rework-island-state:v1";
const LOCAL_DEVICE_CONFIRMATION_TTL = 8_000;

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function assertSpotifyResponse(response: Response, action: string) {
  if (response.ok) return;
  const details = await response.text().catch(() => "");
  let reason = details;
  try {
    const parsed = JSON.parse(details) as { error?: { message?: string } };
    reason = parsed.error?.message ?? details;
  } catch {
    // Spotify occasionally returns an empty or non-JSON response.
  }
  throw new Error(
    `${action} failed (${response.status})${reason ? `: ${reason}` : ""}`,
  );
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

interface PlayerRuntimeState {
  player: Spotify.Player | null;
  deviceId: string | null;
  playbackState: PlaybackState | null;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  isControlling: boolean;
  isPlaybackLocal: boolean;
  sdkLoaded: boolean;
  emeSupported: boolean | null;
  retryCount: number;
}

type PlayerRuntimeAction =
  | { type: "patch"; patch: Partial<PlayerRuntimeState> }
  | {
      type: "update-playback";
      update:
        | PlaybackState
        | null
        | ((current: PlaybackState | null) => PlaybackState | null);
    }
  | { type: "retry" };

const INITIAL_PLAYER_RUNTIME: PlayerRuntimeState = {
  player: null,
  deviceId: null,
  playbackState: null,
  isReady: false,
  isLoading: false,
  error: null,
  isControlling: false,
  isPlaybackLocal: false,
  sdkLoaded: false,
  emeSupported: null,
  retryCount: 0,
};

function playerRuntimeReducer(
  current: PlayerRuntimeState,
  action: PlayerRuntimeAction,
): PlayerRuntimeState {
  if (action.type === "patch") {
    return { ...current, ...action.patch };
  }

  if (action.type === "retry") {
    return {
      ...current,
      player: null,
      deviceId: null,
      isReady: false,
      isLoading: false,
      isPlaybackLocal: false,
      error: null,
      retryCount: current.retryCount + 1,
    };
  }

  return {
    ...current,
    playbackState:
      typeof action.update === "function"
        ? action.update(current.playbackState)
        : action.update,
  };
}

interface SpotifyPlayerListeners {
  initializationError: Spotify.ErrorListener;
  authenticationError: Spotify.ErrorListener;
  accountError: Spotify.ErrorListener;
  playbackError: Spotify.ErrorListener;
  ready: Spotify.PlaybackInstanceListener;
  notReady: Spotify.PlaybackInstanceListener;
  stateChanged: Spotify.PlaybackStateListener;
}

function attachSpotifyPlayerListeners(
  player: Spotify.Player,
  listeners: SpotifyPlayerListeners,
) {
  player.addListener("initialization_error", listeners.initializationError);
  player.addListener("authentication_error", listeners.authenticationError);
  player.addListener("account_error", listeners.accountError);
  player.addListener("playback_error", listeners.playbackError);
  player.addListener("ready", listeners.ready);
  player.addListener("not_ready", listeners.notReady);
  player.addListener("player_state_changed", listeners.stateChanged);

  return () => {
    player.removeListener("initialization_error", listeners.initializationError);
    player.removeListener("authentication_error", listeners.authenticationError);
    player.removeListener("account_error", listeners.accountError);
    player.removeListener("playback_error", listeners.playbackError);
    player.removeListener("ready", listeners.ready);
    player.removeListener("not_ready", listeners.notReady);
    player.removeListener("player_state_changed", listeners.stateChanged);
  };
}

function disposeSpotifyPlayer(
  player: Spotify.Player,
  detachListeners?: () => void,
) {
  detachListeners?.();
  player.disconnect();
}

function useSpotifyPlayerController(playerName: string): SpotifyPlayerContextValue {
  const { isAuthenticated, isPremium, accessToken } = useAuth();
  const { settings, isLoaded: settingsLoaded, updateSettings } = useAppSettings();
  const hasAccessToken = Boolean(accessToken);
  const [runtime, dispatch] = useReducer(
    playerRuntimeReducer,
    INITIAL_PLAYER_RUNTIME,
  );
  const {
    player,
    deviceId,
    playbackState: state,
    isReady,
    isLoading,
    error,
    isControlling,
    isPlaybackLocal,
    sdkLoaded,
    emeSupported,
    retryCount,
  } = runtime;
  const patchRuntime = useCallback(
    (patch: Partial<PlayerRuntimeState>) => dispatch({ type: "patch", patch }),
    [],
  );
  const setState = useCallback(
    (
      update:
        | PlaybackState
        | null
        | ((current: PlaybackState | null) => PlaybackState | null),
    ) => dispatch({ type: "update-playback", update }),
    [],
  );
  
  const playerRef = useRef<Spotify.Player | null>(null);
  const detachPlayerListenersRef = useRef<(() => void) | null>(null);
  const stateRef = useRef<PlaybackState | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const hasAutoTransferredRef = useRef(false);
  const controlInFlightRef = useRef<Promise<void> | null>(null);
  const localPlaybackConfirmedAtRef = useRef(0);
  const startupVolumeRef = useRef(settings.playback.startupVolume);
  const autoTransferPlaybackRef = useRef(settings.playback.autoTransferPlayback);
  const savePlaybackStateRef = useRef(settings.privacy.savePlaybackState);

  const disposeCurrentPlayer = useCallback(() => {
    const currentPlayer = playerRef.current;
    if (!currentPlayer) return;

    disposeSpotifyPlayer(
      currentPlayer,
      detachPlayerListenersRef.current ?? undefined,
    );
    detachPlayerListenersRef.current = null;
    playerRef.current = null;
  }, []);

  // Keep token ref updated
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    startupVolumeRef.current = settings.playback.startupVolume;
    autoTransferPlaybackRef.current = settings.playback.autoTransferPlayback;
    savePlaybackStateRef.current = settings.privacy.savePlaybackState;
  }, [
    settings.playback.autoTransferPlayback,
    settings.playback.startupVolume,
    settings.privacy.savePlaybackState,
  ]);

  // Check EME support on mount
  useEffect(() => {
    checkEMESupport().then((supported) => {
      patchRuntime({ emeSupported: supported });
      if (!supported) {
        devLog("EME/Widevine not supported on this platform");
        patchRuntime({
          error:
            "Playback not available: This platform doesn't support DRM (Widevine). Use Spotify Connect from another device instead.",
        });
      }
    });
  }, [patchRuntime]);

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
          if (!cancelled) patchRuntime({ sdkLoaded: true });
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
      patchRuntime({ error: "Failed to load Spotify SDK" });
    };

    window.onSpotifyWebPlaybackSDKReady = () => {
      devLog("Spotify Web Playback SDK Ready");
      patchRuntime({ sdkLoaded: true });
    };

    document.body.appendChild(script);

    return () => {
      // Don't remove script on cleanup - it should persist
    };
  }, [emeSupported, patchRuntime]);

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

  const getAvailableDevices = useCallback(async () => {
    const token = await getAccessToken();
    const response = await fetch("https://api.spotify.com/v1/me/player/devices", {
      headers: { Authorization: `Bearer ${token}` },
    });
    await assertSpotifyResponse(response, "Load playback devices");
    return response.json() as Promise<{ devices: SpotifyDevice[] }>;
  }, [getAccessToken]);

  const transferToDevice = useCallback(
    async (targetDeviceId: string, shouldPlay = false) => {
      const token = await getAccessToken();
      const response = await fetch("https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_ids: [targetDeviceId],
          play: shouldPlay,
        }),
      });
      await assertSpotifyResponse(response, "Transfer playback");
    },
    [getAccessToken],
  );

  const initializePlayer = useEffectEvent(async () => {
    if (!window.Spotify) {
      devError("Spotify SDK not available");
      patchRuntime({ error: "Spotify SDK not loaded" });
      return;
    }

    // Don't initialize if already initialized
    if (playerRef.current) {
      devLog("Player already initialized");
      return;
    }

    patchRuntime({ isLoading: true, error: null });
    let waitsForReadyEvent = false;

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
        volume: startupVolumeRef.current,
      });

      const detachListeners = attachSpotifyPlayerListeners(newPlayer, {
        initializationError: ({ message }) => {
          devError("Player initialization error:", message);
          patchRuntime({
            error: `Player initialization failed: ${message}`,
            isLoading: false,
          });
        },
        authenticationError: ({ message }) => {
          devError("Player authentication error:", message);
          patchRuntime({
            error: `Authentication failed: ${message}`,
            isLoading: false,
          });
        },
        accountError: ({ message }) => {
          devError("Player account error:", message);
          patchRuntime({
            error: `Account error: ${message}. Premium required.`,
            isLoading: false,
          });
        },
        playbackError: ({ message }) => {
          devError("Playback error:", message);
        },
        ready: async ({ device_id }) => {
          devLog("Player ready with device ID:", device_id);
          patchRuntime({
            deviceId: device_id,
            isReady: true,
            isLoading: false,
            error: null,
          });

          if (
            autoTransferPlaybackRef.current &&
            !hasAutoTransferredRef.current
          ) {
            hasAutoTransferredRef.current = true;
            try {
              devLog("Auto-transferring playback to this device...");
              await transferToDevice(device_id, false);
              localPlaybackConfirmedAtRef.current = Date.now();
              patchRuntime({ isPlaybackLocal: true });
              devLog("Playback transferred successfully");
            } catch (autoTransferError) {
              devError(
                "Failed to auto-transfer playback:",
                autoTransferError,
              );
              patchRuntime({ isPlaybackLocal: false });
            }
          }
        },
        notReady: ({ device_id }) => {
          devLog("Player not ready, device ID:", device_id);
          patchRuntime({ isReady: false, isPlaybackLocal: false });
        },
        stateChanged: (sdkState) => {
          if (!sdkState) {
            setState(null);
            return;
          }

          localPlaybackConfirmedAtRef.current = Date.now();
          patchRuntime({ isPlaybackLocal: true });

          const currentTrack = sdkState.track_window.current_track;
          const nextState: PlaybackState = {
            isPlaying: !sdkState.paused,
            isPaused: sdkState.paused,
            duration: sdkState.duration,
            position: sdkState.position,
            track: currentTrack
              ? {
                  id: currentTrack.id ?? "",
                  uri: currentTrack.uri,
                  name: currentTrack.name,
                  artists: currentTrack.artists.map((artist) => artist.name),
                  artistIds: currentTrack.artists.map((artist) =>
                    spotifyEntityId(artist.uri, "artist"),
                  ),
                  album: {
                    id: spotifyEntityId(currentTrack.album.uri, "album"),
                    name: currentTrack.album.name,
                    images: currentTrack.album.images.map((image) => ({
                      url: image.url,
                      width: image.width ?? 0,
                      height: image.height ?? 0,
                    })),
                  },
                }
              : null,
            volume: stateRef.current?.volume ?? startupVolumeRef.current,
            shuffle: sdkState.shuffle,
            repeatMode:
              sdkState.repeat_mode === 0
                ? "off"
                : sdkState.repeat_mode === 1
                  ? "track"
                  : "context",
          };
          stateRef.current = nextState;
          setState(nextState);

          if (isTauriContext()) {
            void emit("spotify-player-state", nextState).catch(console.error);
            if (savePlaybackStateRef.current) {
              localStorage.setItem(
                ISLAND_STATE_STORAGE_KEY,
                JSON.stringify(nextState),
              );
            }
          }
        },
      });

      // Connect to Spotify
      devLog("Connecting player to Spotify...");
      detachPlayerListenersRef.current = detachListeners;
      playerRef.current = newPlayer;
      const connected = await newPlayer.connect();

      // Initialization may have been cancelled while connect() was pending.
      if (playerRef.current !== newPlayer) {
        disposeSpotifyPlayer(newPlayer, detachListeners);
        return;
      }
      
      if (connected) {
        devLog("Player connected successfully");
        waitsForReadyEvent = true;
        patchRuntime({ player: newPlayer });
      } else {
        disposeCurrentPlayer();
        playerRef.current = null;
        devError("Failed to connect player");
        patchRuntime({
          error: "Failed to connect to Spotify. Please try again.",
        });
      }
    } catch (initializationError) {
      disposeCurrentPlayer();
      devError("Failed to initialize player:", initializationError);
      patchRuntime({
        error:
          initializationError instanceof Error
            ? initializationError.message
            : "Failed to initialize player",
      });
    } finally {
      if (!waitsForReadyEvent) {
        patchRuntime({ isLoading: false });
      }
    }
  });

  // Initialize player when SDK is loaded and user is authenticated with Premium
  useEffect(() => {
    if (!settingsLoaded || !sdkLoaded || !isAuthenticated) {
      return;
    }

    if (!isPremium) {
      devLog("User does not have Premium, skipping player initialization");
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) {
          patchRuntime({ error: "Spotify Premium required for playback" });
        }
      });
      return () => {
        cancelled = true;
      };
    }

    if (!hasAccessToken) {
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
        disposeCurrentPlayer();
        patchRuntime({
          player: null,
          deviceId: null,
          isReady: false,
          isPlaybackLocal: false,
        });
        localPlaybackConfirmedAtRef.current = 0;
        hasAutoTransferredRef.current = false;
      }
    };
  }, [
    sdkLoaded,
    settingsLoaded,
    isAuthenticated,
    isPremium,
    hasAccessToken,
    retryCount,
    disposeCurrentPlayer,
    patchRuntime,
  ]);

  // Retry initialization
  const retry = useCallback(() => {
    disposeCurrentPlayer();
    localPlaybackConfirmedAtRef.current = 0;
    hasAutoTransferredRef.current = false;
    dispatch({ type: "retry" });
  }, [disposeCurrentPlayer]);

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
  }, [player, setState, state?.isPlaying]);

  // Playback controls
  const playbackPosition = state?.position ?? 0;
  const shuffleEnabled = state?.shuffle ?? false;
  const currentRepeatMode = state?.repeatMode ?? "off";

  const ensurePlaybackHere = useCallback(async () => {
    if (!deviceId) throw new Error("This playback device is not ready yet");

    if (
      Date.now() - localPlaybackConfirmedAtRef.current <
      LOCAL_DEVICE_CONFIRMATION_TTL
    ) {
      return;
    }

    const { devices } = await getAvailableDevices();
    const localDevice = devices.find((device) => device.id === deviceId);
    if (localDevice?.is_active) {
      localPlaybackConfirmedAtRef.current = Date.now();
      patchRuntime({ isPlaybackLocal: true });
      return;
    }

    await transferToDevice(deviceId, false);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (attempt > 0) await wait(250);
      const refreshed = await getAvailableDevices();
      if (
        refreshed.devices.some(
          (device) => device.id === deviceId && device.is_active,
        )
      ) {
        localPlaybackConfirmedAtRef.current = Date.now();
        patchRuntime({ isPlaybackLocal: true });
        return;
      }
    }

    patchRuntime({ isPlaybackLocal: false });
    throw new Error("Spotify did not activate this playback device");
  }, [deviceId, getAvailableDevices, patchRuntime, transferToDevice]);

  const runControl = useCallback(
    async (
      actionName: string,
      action: () => Promise<void>,
      options?: { ensureLocal?: boolean },
    ) => {
      if (controlInFlightRef.current) return controlInFlightRef.current;

      const request = (async () => {
        patchRuntime({ isControlling: true });
        try {
          if (options?.ensureLocal !== false) await ensurePlaybackHere();
          await action();
        } catch (actionError) {
          devError(`Failed to ${actionName}:`, actionError);
          throw actionError;
        } finally {
          patchRuntime({ isControlling: false });
        }
      })();

      controlInFlightRef.current = request;
      try {
        await request;
      } finally {
        if (controlInFlightRef.current === request) {
          controlInFlightRef.current = null;
        }
      }
    },
    [ensurePlaybackHere, patchRuntime],
  );

  const play = useCallback(
    async (uris?: string[], contextUri?: string, offset?: number) => {
      if (!deviceId) {
        throw new Error("No device ID available");
      }

      await runControl(
        "start playback",
        async () => {
          const token = await getAccessToken();
          const body: Record<string, unknown> = {};
          if (uris) body.uris = uris;
          if (contextUri) body.context_uri = contextUri;
          if (offset !== undefined) body.offset = { position: offset };

          const response = await fetch(
            `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body:
                Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
            },
          );
          await assertSpotifyResponse(response, "Start playback");
          localPlaybackConfirmedAtRef.current = Date.now();
          patchRuntime({ isPlaybackLocal: true });
        },
        { ensureLocal: false },
      );
    },
    [deviceId, getAccessToken, patchRuntime, runControl],
  );

  const pause = useCallback(async () => {
    if (!player) throw new Error("Playback is not ready");
    await runControl("pause playback", () => player.pause());
  }, [player, runControl]);

  const togglePlay = useCallback(async () => {
    if (!player) throw new Error("Playback is not ready");
    await runControl("toggle playback", () => player.togglePlay());
  }, [player, runControl]);

  const nextTrack = useCallback(async () => {
    if (!player) throw new Error("Playback is not ready");
    await runControl("skip to the next track", () => player.nextTrack());
  }, [player, runControl]);

  const previousTrack = useCallback(async () => {
    if (!player) throw new Error("Playback is not ready");
    await runControl("go to the previous track", () =>
      settings.playback.previousButtonBehavior === "smart" &&
      playbackPosition > 3000
        ? player.seek(0)
        : player.previousTrack(),
    );
  }, [
    player,
    playbackPosition,
    runControl,
    settings.playback.previousButtonBehavior,
  ]);

  const seek = useCallback(
    async (positionMs: number) => {
      if (!player) throw new Error("Playback is not ready");
      await runControl("seek", () => player.seek(positionMs));
    },
    [player, runControl],
  );

  const setVolume = useCallback(
    async (volume: number) => {
      if (!player) throw new Error("Playback is not ready");
      const nextVolume = Math.min(1, Math.max(0, volume));
      await runControl("change volume", async () => {
        await player.setVolume(nextVolume);
        const currentState = stateRef.current;
        if (currentState) {
          const nextState = { ...currentState, volume: nextVolume };
          stateRef.current = nextState;
          setState(nextState);
        }
        if (nextVolume > 0 && settings.playback.rememberVolume) {
          void updateSettings("playback", { startupVolume: nextVolume }).catch(
            () => {},
          );
        }
      });
    },
    [
      player,
      runControl,
      setState,
      settings.playback.rememberVolume,
      updateSettings,
    ],
  );

  const transferPlayback = useCallback(async (shouldPlay = false) => {
    if (!deviceId) {
      throw new Error("No device ID available");
    }

    await runControl(
      "reconnect playback",
      async () => {
        await transferToDevice(deviceId, shouldPlay);
        for (let attempt = 0; attempt < 4; attempt += 1) {
          if (attempt > 0) await wait(250);
          const refreshed = await getAvailableDevices();
          if (
            refreshed.devices.some(
              (device) => device.id === deviceId && device.is_active,
            )
          ) {
            localPlaybackConfirmedAtRef.current = Date.now();
            patchRuntime({ isPlaybackLocal: true });
            return;
          }
        }
        patchRuntime({ isPlaybackLocal: false });
        throw new Error("Spotify did not activate this playback device");
      },
      { ensureLocal: false },
    );
  }, [
    deviceId,
    getAvailableDevices,
    patchRuntime,
    runControl,
    transferToDevice,
  ]);

  const toggleShuffle = useCallback(async () => {
    if (!deviceId) throw new Error("No device ID available");
    await runControl("change shuffle mode", async () => {
      const token = await getAccessToken();
      const nextShuffle = !shuffleEnabled;
      const params = new URLSearchParams({
        state: String(nextShuffle),
        device_id: deviceId,
      });
      const response = await fetch(
        `https://api.spotify.com/v1/me/player/shuffle?${params}`,
        { method: "PUT", headers: { Authorization: `Bearer ${token}` } },
      );
      await assertSpotifyResponse(response, "Shuffle change");
      setState((previous) =>
        previous ? { ...previous, shuffle: nextShuffle } : null,
      );
    });
  }, [deviceId, getAccessToken, runControl, setState, shuffleEnabled]);

  const cycleRepeatMode = useCallback(async () => {
    if (!deviceId) throw new Error("No device ID available");
    await runControl("change repeat mode", async () => {
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
      setState((previous) =>
        previous ? { ...previous, repeatMode: nextMode } : null,
      );
    });
  }, [currentRepeatMode, deviceId, getAccessToken, runControl, setState]);

  const value = useMemo<SpotifyPlayerContextValue>(
    () => ({
      player,
      deviceId,
      state,
      isReady,
      isLoading,
      error,
      isControlling,
      isPlaybackLocal,
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
      isControlling,
      isPlaybackLocal,
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
    ],
  );

  return value;
}

function spotifyEntityId(uri: string | undefined, entity: string): string {
  const prefix = `spotify:${entity}:`;
  return uri?.startsWith(prefix) ? uri.slice(prefix.length) : "";
}

export function SpotifyPlayerProvider({
  children,
  playerName = "Spotify Rework",
}: SpotifyPlayerProviderProps) {
  const value = useSpotifyPlayerController(playerName);

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
