"use client";

import Image from "next/image";
import Link from "next/link";
import { Disc3, Music, Play, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startPlayback } from "@/lib/spotify";
import { cn } from "@/lib/utils";

interface SearchResultCardProps {
  title: string;
  subtitle: string;
  href: string;
  imageUrl?: string;
  imageAlt?: string;
  contextUri?: string;
  kind: "artist" | "album" | "playlist";
}

export function SearchResultCard({
  title,
  subtitle,
  href,
  imageUrl,
  imageAlt = "",
  contextUri,
  kind,
}: SearchResultCardProps) {
  const Icon = kind === "artist" ? UserRound : kind === "album" ? Disc3 : Music;

  const handlePlay = async () => {
    if (!contextUri) return;
    try {
      await startPlayback({ contextUri });
    } catch (error) {
      toast.error("Could not start playback", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <article className="group min-w-0 rounded-3xl border border-transparent p-2 transition-colors hover:border-white/8 hover:bg-white/4">
      <div
        className={cn(
          "relative aspect-square overflow-hidden bg-muted shadow-lg shadow-black/15",
          kind === "artist" ? "rounded-full" : "rounded-2xl",
        )}
      >
        <Link href={href} aria-label={`Open ${title}`} className="absolute inset-0">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt || title}
              fill
              sizes="(min-width: 1536px) 12vw, (min-width: 1024px) 16vw, (min-width: 640px) 25vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.035]"
            />
          ) : (
            <span className="flex size-full items-center justify-center bg-muted">
              <Icon className="size-10 text-muted-foreground/55" />
            </span>
          )}
        </Link>
        {contextUri && (
          <Button
            type="button"
            size="icon"
            aria-label={`Play ${title}`}
            onClick={() => void handlePlay()}
            className="absolute bottom-3 right-3 size-11 translate-y-2 rounded-full bg-foreground text-background opacity-0 shadow-xl transition-[opacity,transform] hover:scale-105 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100"
          >
            <Play className="size-5 fill-current" />
          </Button>
        )}
      </div>
      <Link href={href} className="block px-1 pb-1 pt-3">
        <h3 className="truncate text-sm font-semibold">{title}</h3>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">{subtitle}</p>
      </Link>
    </article>
  );
}
