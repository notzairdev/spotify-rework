/**
 * Simple in-memory cache for Tauri command responses
 * Helps avoid duplicate requests and provides stale-while-revalidate behavior
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface PendingRequest<T> {
  promise: Promise<T>;
  abortController?: AbortController;
}

class TauriCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private pendingRequests = new Map<string, PendingRequest<unknown>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  /**
   * Generate a cache key from command name and arguments
   */
  generateKey(command: string, args?: Record<string, unknown>): string {
    const argsString = args ? JSON.stringify(args, Object.keys(args).sort()) : "";
    return `${command}:${argsString}`;
  }

  /**
   * Get cached data if valid
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cache data with optional TTL
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  /**
   * Check if there's a pending request for this key
   */
  hasPendingRequest(key: string): boolean {
    return this.pendingRequests.has(key);
  }

  /**
   * Get pending request promise (for deduplication)
   */
  getPendingRequest<T>(key: string): Promise<T> | null {
    const pending = this.pendingRequests.get(key);
    return pending ? (pending.promise as Promise<T>) : null;
  }

  /**
   * Register a pending request
   */
  setPendingRequest<T>(key: string, promise: Promise<T>): void {
    this.pendingRequests.set(key, { promise });

    // Clean up when done
    promise.finally(() => {
      this.pendingRequests.delete(key);
    });
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all entries matching a pattern (command prefix)
   */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats (useful for debugging)
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const tauriCache = new TauriCache();
