/**
 * Environment configuration
 * Detects if running in Tauri context and environment mode
 */

/**
 * Check if we're running inside Tauri
 * Safe to call on both server and client
 * Tauri v2 uses __TAURI_INTERNALS__
 */
export function isTauriContext(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

export const ENV = {
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
  get isTauri() {
    return isTauriContext();
  },
} as const;

/**
 * Development-only logging
 */
export function devLog(...args: unknown[]): void {
  if (ENV.isDevelopment) {
    console.log("[DEV]", ...args);
  }
}

/**
 * Development-only warning
 */
export function devWarn(...args: unknown[]): void {
  if (ENV.isDevelopment) {
    console.warn("[DEV]", ...args);
  }
}

/**
 * Development-only error logging
 */
export function devError(...args: unknown[]): void {
  if (ENV.isDevelopment) {
    console.error("[DEV]", ...args);
  }
}
