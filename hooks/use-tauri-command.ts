"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { tauriCache } from "@/lib/tauri/cache";
import { devError, devLog, isTauriContext } from "@/lib/env";

/**
 * Options for useTauriCommand hook
 */
export interface UseTauriCommandOptions<TArgs> {
  /** Arguments to pass to the Tauri command */
  args?: TArgs;
  /** Time-to-live for cache in milliseconds (default: 5 minutes) */
  cacheTTL?: number;
  /** Skip cache and always fetch fresh data */
  skipCache?: boolean;
  /** Don't execute automatically, wait for manual trigger */
  manual?: boolean;
  /** Callback when command succeeds */
  onSuccess?: (data: unknown) => void;
  /** Callback when command fails */
  onError?: (error: Error) => void;
  /** Enable/disable the query (useful for conditional fetching) */
  enabled?: boolean;
}

/**
 * Return type for useTauriCommand hook
 */
export interface UseTauriCommandResult<TData> {
  /** The response data */
  data: TData | null;
  /** Loading state */
  isLoading: boolean;
  /** Error if command failed */
  error: Error | null;
  /** Execute the command manually */
  execute: (overrideArgs?: Record<string, unknown>) => Promise<TData>;
  /** Refetch with same args (bypasses cache) */
  refetch: () => Promise<TData>;
  /** Invalidate cache for this command */
  invalidate: () => void;
  /** Check if running in Tauri context */
  isTauri: boolean;
}

/**
 * Hook for safely calling Tauri commands with caching and deduplication
 *
 * Features:
 * - Automatic caching with configurable TTL
 * - Request deduplication (prevents duplicate in-flight requests)
 * - Development/Production environment awareness
 * - Graceful fallback when not in Tauri context
 * - Manual or automatic execution modes
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, execute } = useTauriCommand<UserData>("get_user", {
 *   args: { userId: "123" },
 *   cacheTTL: 60000, // 1 minute
 * });
 * ```
 */
export function useTauriCommand<TData = unknown, TArgs = Record<string, unknown>>(
  command: string,
  options: UseTauriCommandOptions<TArgs> = {}
): UseTauriCommandResult<TData> {
  const {
    args,
    cacheTTL = 5 * 60 * 1000,
    skipCache = false,
    manual = false,
    onSuccess,
    onError,
    enabled = true,
  } = options;

  const [data, setData] = useState<TData | null>(null);
  const [isLoading, setIsLoading] = useState(!manual && enabled);
  const [error, setError] = useState<Error | null>(null);

  const isTauri = isTauriContext();
  const mountedRef = useRef(true);
  const argsRef = useRef(args);

  // Update args ref when args change
  useEffect(() => {
    argsRef.current = args;
  }, [args]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const executeCommand = useCallback(
    async (overrideArgs?: Record<string, unknown>): Promise<TData> => {
      const currentArgs = overrideArgs ?? argsRef.current;
      const cacheKey = tauriCache.generateKey(command, currentArgs as Record<string, unknown>);

      // Check if not in Tauri context
      if (!isTauriContext()) {
        const notTauriError = new Error(
          `Cannot execute Tauri command "${command}": Not running in Tauri context`
        );
        devError(notTauriError.message);

        if (mountedRef.current) {
          setError(notTauriError);
          setIsLoading(false);
        }
        throw notTauriError;
      }

      // Check cache first (unless skipCache)
      if (!skipCache) {
        const cached = tauriCache.get<TData>(cacheKey);
        if (cached !== null) {
          devLog(`[Cache HIT] ${command}`, cached);
          if (mountedRef.current) {
            setData(cached);
            setError(null);
            setIsLoading(false);
          }
          onSuccess?.(cached);
          return cached;
        }
      }

      // Check for pending request (deduplication)
      const pending = tauriCache.getPendingRequest<TData>(cacheKey);
      if (pending) {
        devLog(`[Dedupe] Reusing pending request for ${command}`);
        return pending;
      }

      if (mountedRef.current) {
        setIsLoading(true);
        setError(null);
      }

      // Create the request promise
      const requestPromise = (async () => {
        try {
          devLog(`[Invoke] ${command}`, currentArgs);

          const result = await invoke<TData>(command, currentArgs as Record<string, unknown>);

          // Cache the result
          if (!skipCache) {
            tauriCache.set(cacheKey, result, cacheTTL);
          }

          if (mountedRef.current) {
            setData(result);
            setError(null);
            setIsLoading(false);
          }

          devLog(`[Success] ${command}`, result);
          onSuccess?.(result);
          return result;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          devError(`[Error] ${command}:`, error);

          if (mountedRef.current) {
            setError(error);
            setIsLoading(false);
          }

          onError?.(error);
          throw error;
        }
      })();

      // Register for deduplication
      tauriCache.setPendingRequest(cacheKey, requestPromise);

      return requestPromise;
    },
    [command, cacheTTL, skipCache, onSuccess, onError]
  );

  const refetch = useCallback(async (): Promise<TData> => {
    // Invalidate cache before refetching
    const cacheKey = tauriCache.generateKey(command, argsRef.current as Record<string, unknown>);
    tauriCache.invalidate(cacheKey);
    return executeCommand();
  }, [command, executeCommand]);

  const invalidate = useCallback(() => {
    const cacheKey = tauriCache.generateKey(command, argsRef.current as Record<string, unknown>);
    tauriCache.invalidate(cacheKey);
    devLog(`[Invalidate] ${command}`);
  }, [command]);

  // Auto-execute on mount if not manual
  useEffect(() => {
    if (!manual && enabled && isTauri) {
      executeCommand().catch(() => {
        // Error already handled in executeCommand
      });
    }
  }, [manual, enabled, isTauri, executeCommand]);

  return {
    data,
    isLoading,
    error,
    execute: executeCommand,
    refetch,
    invalidate,
    isTauri,
  };
}

/**
 * Hook for mutations (commands that modify state)
 * Does not use caching, designed for one-off operations
 *
 * @example
 * ```tsx
 * const { mutate, isLoading } = useTauriMutation("save_settings");
 * await mutate({ theme: "dark" });
 * ```
 */
export function useTauriMutation<TData = unknown, TArgs = Record<string, unknown>>(
  command: string,
  options: {
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
    /** Invalidate these cache prefixes after successful mutation */
    invalidates?: string[];
  } = {}
) {
  const { onSuccess, onError, invalidates } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<TData | null>(null);

  const isTauri = isTauriContext();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const mutate = useCallback(
    async (args?: TArgs): Promise<TData> => {
      if (!isTauriContext()) {
        const notTauriError = new Error(
          `Cannot execute Tauri command "${command}": Not running in Tauri context`
        );
        throw notTauriError;
      }

      if (mountedRef.current) {
        setIsLoading(true);
        setError(null);
      }

      try {
        devLog(`[Mutation] ${command}`, args);
        const result = await invoke<TData>(command, args as Record<string, unknown>);

        // Invalidate related caches
        if (invalidates) {
          invalidates.forEach((prefix) => {
            tauriCache.invalidateByPrefix(prefix);
            devLog(`[Invalidate] ${prefix}`);
          });
        }

        if (mountedRef.current) {
          setData(result);
          setIsLoading(false);
        }

        devLog(`[Mutation Success] ${command}`, result);
        onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        devError(`[Mutation Error] ${command}:`, error);

        if (mountedRef.current) {
          setError(error);
          setIsLoading(false);
        }

        onError?.(error);
        throw error;
      }
    },
    [command, invalidates, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    mutate,
    isLoading,
    error,
    data,
    reset,
    isTauri,
  };
}
