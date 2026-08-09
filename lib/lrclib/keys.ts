import type { SyncedLyricLine } from "./api";

export interface KeyedSyncedLyricLine {
  key: string;
  line: SyncedLyricLine;
}

export function keySyncedLyrics(lines: SyncedLyricLine[]): KeyedSyncedLyricLine[] {
  const occurrences = new Map<string, number>();

  return lines.map((line) => {
    const baseKey = `${line.time}:${line.text}`;
    const occurrence = occurrences.get(baseKey) ?? 0;
    occurrences.set(baseKey, occurrence + 1);
    return { key: `${baseKey}:${occurrence}`, line };
  });
}
