"use client";

import { useState, useEffect } from "react";
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

const STORAGE_KEY = "playlist-order";

interface SortablePlaylistsProps {
  playlists: SpotifyPlaylist[];
  viewMode: "grid" | "list";
  onPlay: (e: React.MouseEvent, uri: string) => void;
}

function getStoredOrder(): string[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveOrder(order: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

export function SortablePlaylists({ playlists, viewMode, onPlay }: SortablePlaylistsProps) {
  const [orderedPlaylists, setOrderedPlaylists] = useState<SpotifyPlaylist[]>(playlists);

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

  // Apply stored order when playlists change
  useEffect(() => {
    const storedOrder = getStoredOrder();
    if (storedOrder.length === 0) {
      setOrderedPlaylists(playlists);
      return;
    }

    // Sort playlists based on stored order
    const sorted = [...playlists].sort((a, b) => {
      const aIndex = storedOrder.indexOf(a.id);
      const bIndex = storedOrder.indexOf(b.id);
      
      // If neither is in stored order, maintain original order
      if (aIndex === -1 && bIndex === -1) return 0;
      // If only a is not in stored order, put it at the end
      if (aIndex === -1) return 1;
      // If only b is not in stored order, put it at the end
      if (bIndex === -1) return -1;
      // Both are in stored order, sort by their positions
      return aIndex - bIndex;
    });

    setOrderedPlaylists(sorted);
  }, [playlists]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedPlaylists((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Save the new order
        saveOrder(newItems.map((p) => p.id));
        
        return newItems;
      });
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
            {orderedPlaylists.map((playlist) => (
              <SortablePlaylistGridItem
                key={playlist.id}
                playlist={playlist}
                onPlay={onPlay}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
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
        "group relative",
        isDragging && "z-50 opacity-90"
      )}
    >
      {/* Drag handle overlay */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 p-1.5 rounded-md bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4 text-white" />
      </div>
      
      <Link href={`/playlist/${playlist.id}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-lg">
          {playlist.images?.[0]?.url ? (
            <Image
              src={playlist.images[0].url}
              alt={playlist.name}
              fill
              className="object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted">
              <span className="text-4xl text-muted-foreground">♪</span>
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="icon"
              className="size-12 rounded-full"
              onClick={(e) => onPlay?.(e, playlist.uri)}
            >
              <Play className="size-5 fill-current" />
            </Button>
          </div>
        </div>
        <h3 className="mt-2 truncate font-medium">{playlist.name}</h3>
        <p className="truncate text-sm text-muted-foreground">
          Playlist • {playlist.owner.display_name}
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
        "flex items-center gap-4 p-3 transition-colors hover:bg-muted/50",
        isDragging && "z-50 opacity-90 bg-muted"
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="p-1 rounded cursor-grab active:cursor-grabbing hover:bg-muted"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      
      <Link
        href={`/playlist/${playlist.id}`}
        className="flex items-center gap-4 flex-1 min-w-0"
      >
        <div className="relative size-14 shrink-0 overflow-hidden rounded-lg">
          {playlist.images?.[0]?.url ? (
            <Image
              src={playlist.images[0].url}
              alt={playlist.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted">
              <span className="text-xl text-muted-foreground">♪</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{playlist.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            Playlist • {playlist.owner.display_name}
          </p>
        </div>
      </Link>
    </div>
  );
}
