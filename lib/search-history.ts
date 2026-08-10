"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export interface SearchHistoryEntry {
  query: string;
  searchedAt: number;
}

const STORAGE_KEY = "spotify-rework.search-history.v1";
const CHANGE_EVENT = "spotify-rework:search-history-changed";
const EMPTY_HISTORY = "[]";
const MAX_HISTORY_ITEMS = 8;

function getHistorySnapshot(): string {
  if (typeof window === "undefined") return EMPTY_HISTORY;

  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? EMPTY_HISTORY;
  } catch {
    return EMPTY_HISTORY;
  }
}

function parseHistory(snapshot: string): SearchHistoryEntry[] {
  try {
    const value: unknown = JSON.parse(snapshot);
    if (!Array.isArray(value)) return [];

    return value.filter((entry): entry is SearchHistoryEntry => (
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as SearchHistoryEntry).query === "string" &&
      typeof (entry as SearchHistoryEntry).searchedAt === "number"
    ));
  } catch {
    return [];
  }
}

function subscribeToHistory(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function writeHistory(entries: SearchHistoryEntry[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Search remains fully usable when storage is unavailable.
  }
}

export function useSearchHistory() {
  const snapshot = useSyncExternalStore(
    subscribeToHistory,
    getHistorySnapshot,
    () => EMPTY_HISTORY,
  );
  const history = useMemo(() => parseHistory(snapshot), [snapshot]);

  const addSearch = useCallback((query: string) => {
    const normalizedQuery = query.trim().replace(/\s+/g, " ");
    if (!normalizedQuery) return;

    const remainingHistory = parseHistory(getHistorySnapshot()).filter(
      (entry) => entry.query.toLocaleLowerCase() !== normalizedQuery.toLocaleLowerCase(),
    );
    writeHistory([
      { query: normalizedQuery, searchedAt: Date.now() },
      ...remainingHistory,
    ].slice(0, MAX_HISTORY_ITEMS));
  }, []);

  const removeSearch = useCallback((query: string) => {
    writeHistory(parseHistory(getHistorySnapshot()).filter(
      (entry) => entry.query.toLocaleLowerCase() !== query.toLocaleLowerCase(),
    ));
  }, []);

  const clearHistory = useCallback(() => writeHistory([]), []);

  return { history, addSearch, removeSearch, clearHistory };
}
