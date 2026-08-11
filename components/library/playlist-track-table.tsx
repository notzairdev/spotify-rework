"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Clock3, GripVertical, Music, Play } from "lucide-react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { TrackContextMenu } from "@/components/context";
import { reorderPlaylistItems, type SpotifyPlaylistTrack } from "@/lib/spotify/api";
import type { PlaylistSortDirection, PlaylistSortKey } from "@/lib/spotify/playlist-sort";
import { invalidateSpotifyQueryCache } from "@/lib/spotify/query-cache";
import { cn } from "@/lib/utils";

const ADDED_DATE_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface TrackEntry {
  key: string;
  originalIndex: number;
  item: SpotifyPlaylistTrack;
}

interface PlaylistTrackTableProps {
  items: SpotifyPlaylistTrack[];
  playlistId: string;
  canReorder: boolean;
  snapshotId?: string;
  sortKey: PlaylistSortKey;
  sortDirection: PlaylistSortDirection;
  onSortChange: (key: PlaylistSortKey, direction: PlaylistSortDirection) => void;
  onPlayTracks: (uris: string[]) => Promise<void>;
}

export function PlaylistTrackTable({
  items,
  playlistId,
  canReorder,
  snapshotId,
  sortKey,
  sortDirection,
  onSortChange,
  onPlayTracks,
}: PlaylistTrackTableProps) {
  const [entries, setEntries] = useState(() => createTrackEntries(items));
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const snapshotRef = useRef(snapshotId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const visibleEntries = useMemo(
    () => sortTrackEntries(entries, sortKey, sortDirection),
    [entries, sortDirection, sortKey],
  );
  const canDrag = canReorder && sortKey === "custom";

  const handleSort = (nextKey: PlaylistSortKey) => {
    if (nextKey === "custom") {
      onSortChange("custom", "asc");
    } else if (sortKey === nextKey) {
      onSortChange(nextKey, sortDirection === "asc" ? "desc" : "asc");
    } else {
      onSortChange(nextKey, nextKey === "addedAt" ? "desc" : "asc");
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (canDrag && !isSaving) setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    if (!canDrag || isSaving || !event.over || event.active.id === event.over.id) return;

    const oldIndex = entries.findIndex((entry) => entry.key === event.active.id);
    const newIndex = entries.findIndex((entry) => entry.key === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previousEntries = entries;
    setEntries(
      arrayMove(entries, oldIndex, newIndex).map((entry, originalIndex) => ({
        ...entry,
        originalIndex,
      })),
    );
    setIsSaving(true);
    const insertBefore = oldIndex < newIndex ? newIndex + 1 : newIndex;

    void reorderPlaylistItems(playlistId, oldIndex, insertBefore, snapshotRef.current)
      .then((result) => {
        snapshotRef.current = result.snapshot_id;
        invalidateSpotifyQueryCache(`playlist:${playlistId}`);
      })
      .catch(() => {
        setEntries(previousEntries);
        toast.error("Could not reorder this playlist", {
          description: "Spotify kept the previous track order.",
        });
      })
      .finally(() => setIsSaving(false));
  };

  const handlePlayFrom = (index: number) => {
    const uris = visibleEntries
      .slice(index)
      .flatMap((entry) => (entry.item.track?.uri ? [entry.item.track.uri] : []));
    if (uris.length > 0) void onPlayTracks(uris);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="mx-6 overflow-x-auto rounded-3xl border border-white/8 bg-card/20 backdrop-blur-xl">
        <div className="min-w-[760px]">
          <div
            role="row"
            className="grid grid-cols-[2rem_minmax(11rem,1.8fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_7.5rem_3.5rem] items-center gap-4 border-b border-white/8 px-4 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            <div role="columnheader" className="flex justify-center">
              <button
                type="button"
                onClick={() => handleSort("custom")}
                className={cn(
                  "rounded-md px-1.5 py-1 transition-colors hover:bg-white/7 hover:text-foreground",
                  sortKey === "custom" && "text-foreground",
                )}
                aria-label="Use playlist order"
                title="Playlist order"
              >
                #
              </button>
            </div>
            <SortHeader label="Title" sortKey="title" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
            <SortHeader label="Artist" sortKey="artist" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
            <SortHeader label="Album" sortKey="album" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
            <SortHeader label="Date added" sortKey="addedAt" activeKey={sortKey} direction={sortDirection} onSort={handleSort} />
            <div role="columnheader" className="flex justify-end pr-1">
              <Clock3 className="size-3.5" aria-label="Duration" />
            </div>
          </div>

          <SortableContext items={visibleEntries.map((entry) => entry.key)} strategy={verticalListSortingStrategy}>
            <div role="rowgroup" className="p-1.5">
              {visibleEntries.map((entry, index) => (
                <PlaylistTrackRow
                  key={entry.key}
                  entry={entry}
                  index={index}
                  canReorder={canDrag}
                  disabled={isSaving}
                  dragActive={activeId !== null}
                  onPlayTrack={handlePlayFrom}
                />
              ))}
            </div>
          </SortableContext>
        </div>
      </div>
    </DndContext>
  );
}

interface SortHeaderProps {
  label: string;
  sortKey: Exclude<PlaylistSortKey, "custom">;
  activeKey: PlaylistSortKey;
  direction: PlaylistSortDirection;
  onSort: (key: PlaylistSortKey) => void;
}

function SortHeader({ label, sortKey, activeKey, direction, onSort }: SortHeaderProps) {
  const active = activeKey === sortKey;
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <div role="columnheader" aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "flex items-center gap-1.5 rounded-md py-1 transition-colors hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3", !active && "opacity-45")} />
      </button>
    </div>
  );
}

interface PlaylistTrackRowProps {
  entry: TrackEntry;
  index: number;
  canReorder: boolean;
  disabled: boolean;
  dragActive: boolean;
  onPlayTrack: (offset: number) => void;
}

function PlaylistTrackRow({ entry, index, canReorder, disabled, dragActive, onPlayTrack }: PlaylistTrackRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.key,
    disabled: !canReorder || disabled,
  });
  const track = entry.item.track;
  const style = { transform: CSS.Transform.toString(transform), transition };

  const row = (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group grid grid-cols-[2rem_minmax(11rem,1.8fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_7.5rem_3.5rem] items-center gap-4 rounded-2xl px-4 py-2 transition-[background-color,box-shadow,opacity,filter] hover:bg-white/5",
        track && "cursor-pointer",
        dragActive && !isDragging && "opacity-25 saturate-50",
        isDragging && "z-50 bg-card opacity-100 shadow-2xl shadow-black/35",
      )}
      onClick={() => track && !isDragging && !disabled && onPlayTrack(index)}
      role="row"
      tabIndex={track ? 0 : undefined}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (track && !disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onPlayTrack(index);
        }
      }}
    >
      <div role="cell" className="flex w-8 items-center justify-center">
        {canReorder ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Move ${track?.name ?? "unavailable item"}`}
            className="cursor-grab rounded-lg p-1 text-muted-foreground/60 opacity-45 transition-[opacity,color,background-color] hover:bg-white/7 hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        ) : (
          <>
            <span className="text-sm text-muted-foreground group-hover:hidden">{index + 1}</span>
            {track && <Play className="hidden size-4 fill-current group-hover:block" />}
          </>
        )}
      </div>

      {track ? (
        <>
          <div role="cell" className="flex min-w-0 items-center gap-3">
            {track.album?.images?.[0]?.url ? (
              <Image src={track.album.images[0].url} alt="" width={40} height={40} className="size-10 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted"><Music className="size-4" /></div>
            )}
            <span className="truncate text-sm font-medium">{track.name}</span>
          </div>

          <div role="cell" className="truncate text-sm text-muted-foreground">
            {track.artists.map((artist, artistIndex) => (
              <span key={`${artist.id}:${artistIndex}`}>
                <Link href={`/app/artist?id=${artist.id}`} onClick={(event) => event.stopPropagation()} className="transition-colors hover:text-foreground hover:underline">
                  {artist.name}
                </Link>
                {artistIndex < track.artists.length - 1 && ", "}
              </span>
            ))}
          </div>

          <div role="cell" className="min-w-0">
            {track.album?.id ? (
              <Link href={`/app/album?id=${track.album.id}`} onClick={(event) => event.stopPropagation()} className="block truncate text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline">
                {track.album.name}
              </Link>
            ) : (
              <span className="block truncate text-sm text-muted-foreground">{track.album?.name}</span>
            )}
          </div>

          <span role="cell" className="text-sm text-muted-foreground">{formatAddedDate(entry.item.added_at)}</span>
          <span role="cell" className="text-right text-sm tabular-nums text-muted-foreground">{formatDuration(track.duration_ms)}</span>
        </>
      ) : (
        <div role="cell" className="col-span-5 flex items-center gap-3 text-sm text-muted-foreground">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted"><Music className="size-4" /></div>
          This item is no longer available
        </div>
      )}
    </div>
  );

  if (!track) return row;
  return (
    <TrackContextMenu
      trackId={track.id}
      trackUri={track.uri}
      trackName={track.name}
      artistId={track.artists[0]?.id}
      artistName={track.artists[0]?.name}
      albumId={track.album?.id}
      albumName={track.album?.name}
      spotifyUrl={track.external_urls?.spotify}
    >
      {row}
    </TrackContextMenu>
  );
}

function createTrackEntries(items: SpotifyPlaylistTrack[]): TrackEntry[] {
  const occurrences = new Map<string, number>();
  return items.map((item, originalIndex) => {
    const baseKey = [item.track?.uri ?? "unavailable", item.added_at ?? "unknown-date", item.added_by?.id ?? "unknown-user"].join(":");
    const occurrence = occurrences.get(baseKey) ?? 0;
    occurrences.set(baseKey, occurrence + 1);
    return { key: `${baseKey}:${occurrence}`, originalIndex, item };
  });
}

function sortTrackEntries(entries: TrackEntry[], sortKey: PlaylistSortKey, direction: PlaylistSortDirection): TrackEntry[] {
  if (sortKey === "custom") return entries;
  const factor = direction === "asc" ? 1 : -1;
  return [...entries].sort((left, right) => {
    let comparison = 0;
    if (sortKey === "addedAt") {
      comparison = (left.item.added_at ? Date.parse(left.item.added_at) : 0) - (right.item.added_at ? Date.parse(right.item.added_at) : 0);
    } else if (sortKey === "title") {
      comparison = compareText(left.item.track?.name, right.item.track?.name);
    } else if (sortKey === "artist") {
      comparison = compareText(left.item.track?.artists.map((artist) => artist.name).join(", "), right.item.track?.artists.map((artist) => artist.name).join(", "));
    } else {
      comparison = compareText(left.item.track?.album?.name, right.item.track?.album?.name);
    }
    return comparison === 0 ? left.originalIndex - right.originalIndex : comparison * factor;
  });
}

function compareText(left?: string, right?: string): number {
  return (left ?? "").localeCompare(right ?? "", undefined, { numeric: true, sensitivity: "base" });
}

function formatAddedDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getUTCDate()} ${ADDED_DATE_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
