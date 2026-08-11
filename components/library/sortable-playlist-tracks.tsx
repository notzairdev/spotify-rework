"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { GripVertical, Music, Play } from "lucide-react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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
import {
  reorderPlaylistItems,
  type SpotifyPlaylistTrack,
} from "@/lib/spotify/api";
import { invalidateSpotifyQueryCache } from "@/lib/spotify/query-cache";
import { cn } from "@/lib/utils";

interface SortableTrackEntry {
  key: string;
  item: SpotifyPlaylistTrack;
}

interface SortablePlaylistTracksProps {
  items: SpotifyPlaylistTrack[];
  playlistId: string;
  canReorder: boolean;
  snapshotId?: string;
  onPlayTrack: (offset: number) => Promise<void>;
}

export function SortablePlaylistTracks({
  items,
  playlistId,
  canReorder,
  snapshotId,
  onPlayTrack,
}: SortablePlaylistTracksProps) {
  const [entries, setEntries] = useState(() => createTrackEntries(items));
  const [isSaving, setIsSaving] = useState(false);
  const snapshotRef = useRef(snapshotId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canReorder || isSaving || !event.over || event.active.id === event.over.id) {
      return;
    }

    const oldIndex = entries.findIndex((entry) => entry.key === event.active.id);
    const newIndex = entries.findIndex((entry) => entry.key === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previousEntries = entries;
    setEntries(arrayMove(entries, oldIndex, newIndex));
    setIsSaving(true);

    // Spotify calculates insert_before against the list before removing the
    // selected range, so downward moves need the following position.
    const insertBefore = oldIndex < newIndex ? newIndex + 1 : newIndex;

    void reorderPlaylistItems(
      playlistId,
      oldIndex,
      insertBefore,
      snapshotRef.current,
    )
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={entries.map((entry) => entry.key)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col">
          {entries.map((entry, index) => (
            <SortablePlaylistTrack
              key={entry.key}
              entry={entry}
              index={index}
              canReorder={canReorder}
              disabled={isSaving}
              onPlayTrack={onPlayTrack}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface SortablePlaylistTrackProps {
  entry: SortableTrackEntry;
  index: number;
  canReorder: boolean;
  disabled: boolean;
  onPlayTrack: (offset: number) => Promise<void>;
}

function SortablePlaylistTrack({
  entry,
  index,
  canReorder,
  disabled,
  onPlayTrack,
}: SortablePlaylistTrackProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.key, disabled: !canReorder || disabled });
  const track = entry.item.track;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const row = (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group grid grid-cols-[auto_1fr_1fr_auto] items-center gap-4 rounded-2xl px-6 py-4 transition-[background-color,box-shadow,opacity] hover:bg-muted/50",
        track && "cursor-pointer",
        isDragging && "z-50 bg-card/95 opacity-90 shadow-2xl shadow-black/35",
      )}
      onClick={() => track && !isDragging && !disabled && void onPlayTrack(index)}
      role={track ? "button" : undefined}
      tabIndex={track ? 0 : undefined}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (track && !disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          void onPlayTrack(index);
        }
      }}
    >
      <div className="flex w-8 items-center justify-center">
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
            <span className="text-sm text-muted-foreground group-hover:hidden">
              {index + 1}
            </span>
            {track && <Play className="hidden size-4 fill-current group-hover:block" />}
          </>
        )}
      </div>

      {track ? (
        <>
          <div className="flex min-w-0 items-center gap-3">
            {track.album?.images?.[0]?.url && track.album.id && (
              <Link
                href={`/app/album?id=${track.album.id}`}
                onClick={(event) => event.stopPropagation()}
              >
                <Image
                  src={track.album.images[0].url}
                  alt={track.album.name}
                  width={40}
                  height={40}
                  className="rounded object-cover transition-opacity hover:opacity-80"
                />
              </Link>
            )}
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{track.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {track.artists.map((artist, artistIndex) => (
                  <span key={artist.id}>
                    <Link
                      href={`/app/artist?id=${artist.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="transition-colors hover:text-foreground hover:underline"
                    >
                      {artist.name}
                    </Link>
                    {artistIndex < track.artists.length - 1 && ", "}
                  </span>
                ))}
              </span>
            </div>
          </div>

          {track.album?.id ? (
            <Link
              href={`/app/album?id=${track.album.id}`}
              onClick={(event) => event.stopPropagation()}
              className="hidden truncate pr-5 text-end text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline md:block"
            >
              {track.album.name}
            </Link>
          ) : (
            <span className="hidden truncate pr-5 text-end text-sm text-muted-foreground md:block">
              {track.album?.name}
            </span>
          )}

          <span className="pr-4 text-sm text-muted-foreground">
            {formatDuration(track.duration_ms)}
          </span>
        </>
      ) : (
        <div className="col-span-3 flex items-center gap-3 text-sm text-muted-foreground">
          <div className="flex size-10 items-center justify-center rounded bg-muted">
            <Music className="size-4" />
          </div>
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

function createTrackEntries(items: SpotifyPlaylistTrack[]): SortableTrackEntry[] {
  const occurrences = new Map<string, number>();

  return items.map((item) => {
    const baseKey = [
      item.track?.uri ?? "unavailable",
      item.added_at ?? "unknown-date",
      item.added_by?.id ?? "unknown-user",
    ].join(":");
    const occurrence = occurrences.get(baseKey) ?? 0;
    occurrences.set(baseKey, occurrence + 1);

    return { key: `${baseKey}:${occurrence}`, item };
  });
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
