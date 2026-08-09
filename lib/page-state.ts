"use client";

import {
  useCallback,
  useReducer,
  type Dispatch,
  type SetStateAction,
} from "react";
import { usePathname } from "next/navigation";

const MAX_PRESERVED_VALUES = 250;
const preservedPageState = new Map<string, unknown>();
const preservedScrollPositions = new Map<string, number>();

function writePreservedValue(key: string, value: unknown) {
  // Reinsert existing keys so the oldest entry is always first.
  preservedPageState.delete(key);
  preservedPageState.set(key, value);

  if (preservedPageState.size > MAX_PRESERVED_VALUES) {
    const oldestKey = preservedPageState.keys().next().value;
    if (oldestKey) preservedPageState.delete(oldestKey);
  }
}

/**
 * React state that survives route unmounts for the current app session.
 * Values are scoped by pathname, so dynamic artist/album/playlist pages do
 * not leak their controls into one another.
 */
export function usePreservedPageState<T>(
  stateKey: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const pathname = usePathname();
  const cacheKey = `${pathname}::${stateKey}`;
  const [, rerender] = useReducer((version: number) => version + 1, 0);

  const value = preservedPageState.has(cacheKey)
    ? preservedPageState.get(cacheKey) as T
    : initialValue;

  const setValue = useCallback<Dispatch<SetStateAction<T>>>((nextValue) => {
    const currentValue = preservedPageState.has(cacheKey)
      ? preservedPageState.get(cacheKey) as T
      : initialValue;
    const resolvedValue = typeof nextValue === "function"
      ? (nextValue as (previousValue: T) => T)(currentValue)
      : nextValue;

    if (Object.is(currentValue, resolvedValue)) return;
    writePreservedValue(cacheKey, resolvedValue);
    rerender();
  }, [cacheKey, initialValue]);

  return [value, setValue];
}

export function getPreservedScrollPosition(pathname: string): number | undefined {
  return preservedScrollPositions.get(pathname);
}

export function setPreservedScrollPosition(pathname: string, scrollTop: number) {
  preservedScrollPositions.set(pathname, scrollTop);
}

export function clearPreservedNavigationState() {
  preservedPageState.clear();
  preservedScrollPositions.clear();
}
