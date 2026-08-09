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
import { devError, devLog, isTauriContext } from "@/lib/env";
import { clearSpotifyQueryCache } from "@/lib/spotify/query-cache";
import type { AuthContextValue, AuthSession, SpotifyUser } from "./types";

const AuthContext = createContext<AuthContextValue | null>(null);

// Internal context for updating session from callback
const AuthUpdateContext = createContext<((session: AuthSession) => void) | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

// Module-level cache to prevent repeated get_session calls across remounts
let authInitPromise: Promise<AuthSession | null> | null = null;
let authInitResult: { session: AuthSession | null; error: unknown } | null = null;

/** Clear the auth init cache (called on logout) */
export function clearAuthCache() {
  authInitPromise = null;
  authInitResult = null;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasInitializedRef = useRef(false);

  // Initialize - check for existing session on mount
  useEffect(() => {
    // Prevent double-initialization (React StrictMode or remounts)
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    if (!isTauriContext()) {
      devLog("Not in Tauri context, skipping auth initialization");
      setIsLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        // Reuse cached result if AuthProvider remounted
        if (authInitResult) {
          devLog("Using cached auth init result");
          if (authInitResult.session) {
            setSession(authInitResult.session);
          }
          if (authInitResult.error && authInitResult.error !== "Not authenticated") {
            setError(authInitResult.error instanceof Error ? authInitResult.error : new Error(String(authInitResult.error)));
          }
          setIsLoading(false);
          return;
        }

        // Deduplicate concurrent calls
        if (!authInitPromise) {
          devLog("Initializing auth...");
          authInitPromise = invoke<AuthSession | null>("get_session");
        } else {
          devLog("Reusing in-flight auth init promise");
        }

        const existingSession = await authInitPromise;
        authInitResult = { session: existingSession, error: null };

        if (existingSession) {
          devLog("Found existing session for:", existingSession.user.display_name);
          setSession(existingSession);
        } else {
          devLog("No existing session found");
        }
      } catch (err) {
        devError("Failed to initialize auth:", err);
        authInitResult = { session: null, error: err };
        // Don't set error for "not authenticated" - that's expected
        if (err !== "Not authenticated") {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Login - start Spotify OAuth flow with auth window
  const login = useCallback(async () => {
    if (!isTauriContext()) {
      throw new Error("Login only available in Tauri context");
    }

    try {
      setError(null);
      setIsLoading(true);
      devLog("Starting login flow...");

      // This opens a browser, handles OAuth, and returns the session
      const newSession = await invoke<AuthSession>("start_auth_flow");

      devLog("Login successful:", newSession.user.display_name);
      setSession(newSession);
    } catch (err) {
      devError("Login failed:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle OAuth callback
  const handleCallback = useCallback(async (code: string, state: string) => {
    if (!isTauriContext()) {
      throw new Error("Callback only available in Tauri context");
    }

    try {
      setIsLoading(true);
      setError(null);
      devLog("Exchanging code for tokens...");

      const newSession = await invoke<AuthSession>("exchange_code", {
        code,
        returnedState: state,
      });

      devLog("Login successful:", newSession.user.display_name);
      setSession(newSession);
      return newSession;
    } catch (err) {
      devError("Callback failed:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh token
  const refreshToken = useCallback(async () => {
    if (!isTauriContext()) {
      throw new Error("Refresh only available in Tauri context");
    }

    try {
      devLog("Refreshing token...");
      const refreshedSession = await invoke<AuthSession>("refresh_token");
      devLog("Token refreshed");
      setSession(refreshedSession);
    } catch (err) {
      devError("Token refresh failed:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    if (!isTauriContext()) {
      setSession(null);
      clearAuthCache();
      clearSpotifyQueryCache();
      return;
    }

    try {
      devLog("Logging out...");
      await invoke("logout");
      setSession(null);
      setError(null);
      clearAuthCache();
      clearSpotifyQueryCache();
      devLog("Logged out successfully");
    } catch (err) {
      devError("Logout failed:", err);
      // Still clear session on frontend even if backend fails
      setSession(null);
      clearAuthCache();
      clearSpotifyQueryCache();
      throw err;
    }
  }, []);


  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      isAuthenticated: session !== null,
      isPremium: session?.is_premium ?? false,
      user: session?.user ?? null,
      accessToken: session?.access_token ?? null,
      error,
      login,
      logout,
      refreshToken,
    }),
    [session, isLoading, error, login, logout, refreshToken]
  );

  const updateSession = useCallback((newSession: AuthSession) => {
    setSession(newSession);
  }, []);

  return (
    <AuthContext.Provider value={value}>
      <AuthUpdateContext.Provider value={updateSession}>
        {children}
      </AuthUpdateContext.Provider>
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Hook to handle OAuth callback
 */
export function useAuthCallback() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const updateSession = useContext(AuthUpdateContext);

  const processCallback = useCallback(async (code: string, state: string) => {
    if (!isTauriContext()) {
      throw new Error("Callback only available in Tauri context");
    }

    setIsProcessing(true);
    setError(null);

    try {
      const session = await invoke<AuthSession>("exchange_code", {
        code,
        returnedState: state,
      });

      // Update the auth context with the new session
      if (updateSession) {
        updateSession(session);
      }

      return session;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [updateSession]);

  return { processCallback, isProcessing, error };
}
