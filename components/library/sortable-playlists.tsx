"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Play, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SpotifyPlaylist } from "@/lib/spotify/api";

const STORAGE_KEY = "playlist-order:v1";

interface SortablePlaylistsProps {
  playlists: SpotifyPlaylist[];
  viewMode: "grid" | "list";
  onPlay: (e: React.MouseEvent, uri: string) => void;
}

function getStoredOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveOrder(order: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

export function SortablePlaylists({ playlists, viewMode, onPlay }: SortablePlaylistsProps) {
  const [playlistOrder, setPlaylistOrder] = useState<string[]>(getStoredOrder);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const orderedPlaylists = useMemo(() => {
    if (playlistOrder.length === 0) return playlists;

    return [...playlists].sort((a, b) => {
      const aIndex = playlistOrder.indexOf(a.id);
      const bIndex = playlistOrder.indexOf(b.id);
      
      // If neither is in stored order, maintain original order
      if (aIndex === -1 && bIndex === -1) return 0;
      // If only a is not in stored order, put it at the end
      if (aIndex === -1) return 1;
      // If only b is not in stored order, put it at the end
      if (bIndex === -1) return -1;
      // Both are in stored order, sort by their positions
      return aIndex - bIndex;
    });
  }, [playlists, playlistOrder]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = orderedPlaylists.findIndex((item) => item.id === active.id);
      const newIndex = orderedPlaylists.findIndex((item) => item.id === over.id);
      const newItems = arrayMove(orderedPlaylists, oldIndex, newIndex);

      const nextOrder = newItems.map((playlist) => playlist.id);
      setPlaylistOrder(nextOrder);
      saveOrder(nextOrder);
    }
  };

  const strategy = viewMode === "grid" ? rectSortingStrategy : verticalListSortingStrategy;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={orderedPlaylists.map((p) => p.id)} strategy={strategy}>
        {viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {orderedPlaylists.map((playlist) => (
              <SortablePlaylistGridItem
                key={playlist.id}
                playlist={playlist}
                onPlay={onPlay}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-1 rounded-3xl border border-white/8 bg-card/25 p-2 backdrop-blur-xl">
            {orderedPlaylists.map((playlist) => (
              <SortablePlaylistListItem
                key={playlist.id}
                playlist={playlist}
              />
            ))}
          </div>
        )}
      </SortableContext>
    </DndContext>
  );
}

interface SortablePlaylistItemProps {
  playlist: SpotifyPlaylist;
  onPlay?: (e: React.MouseEvent, uri: string) => void;
}

function SortablePlaylistGridItem({ playlist, onPlay }: SortablePlaylistItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: playlist.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative min-w-0 rounded-3xl border border-transparent p-2 transition-colors hover:border-white/8 hover:bg-white/4",
        isDragging && "z-50 border-white/10 bg-card opacity-90 shadow-2xl"
      )}
    >
      {/* Drag handle overlay */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-4 top-4 z-20 cursor-grab rounded-full bg-black/70 p-1.5 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4 text-white" />
      </div>
      
      <Link href={`/app/playlist/${playlist.id}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted shadow-lg shadow-black/15">
          {playlist.images?.[0]?.url ? (
            <Image
              src={playlist.images[0].url}
              alt={playlist.name}
              fill
              sizes="(min-width: 1024px) 12.5vw, (min-width: 640px) 20vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted">
              <span className="text-4xl text-muted-foreground">♪</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="icon"
              className="pointer-events-auto absolute bottom-3 right-3 size-11 translate-y-2 rounded-full bg-foreground text-background opacity-0 shadow-xl transition-[opacity,transform] group-hover:translate-y-0 group-hover:opacity-100"
              onClick={(e) => onPlay?.(e, playlist.uri)}
            >
              <Play className="size-5 fill-current" />
            </Button>
          </div>
        </div>
        <h3 className="mt-3 truncate px-1 text-sm font-semibold">{playlist.name}</h3>
        <p className="mt-1 truncate px-1 text-[11px] text-muted-foreground">
          Playlist · {playlist.owner.display_name}
        </p>
      </Link>
    </div>
  );
}

function SortablePlaylistListItem({ playlist }: { playlist: SpotifyPlaylist }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: playlist.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-white/5",
        isDragging && "z-50 bg-muted opacity-90 shadow-xl"
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/7 hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      
      <Link
        href={`/app/playlist/${playlist.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <div className="relative size-13 shrink-0 overflow-hidden rounded-xl bg-muted shadow-md">
          {playlist.images?.[0]?.url ? (
            <Image
              src={playlist.images[0].url}
              alt={playlist.name}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted">
              <span className="text-xl text-muted-foreground">♪</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{playlist.name}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            Playlist · {playlist.owner.display_name}
          </p>
        </div>
      </Link>
    </div>
  );
}
