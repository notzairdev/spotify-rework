"use client";

import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AudioDbTrackInfo } from "@/lib/music-data";

interface TrackInformationDialogProps {
  artists: string[];
  info: AudioDbTrackInfo;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  trackName: string;
}

export function TrackInformationDialog({
  artists,
  info,
  onOpenChange,
  open,
  trackName,
}: TrackInformationDialogProps) {
  const tags = [
    { key: "genre", value: info.genre },
    { key: "style", value: info.style },
    { key: "mood", value: info.mood },
    { key: "theme", value: info.theme },
  ].filter((item): item is { key: string; value: string } => Boolean(item.value));

  const hasProductionDetails = Boolean(
    info.albumName || info.musicVideoDirector || info.musicVideoCompany,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(46rem,calc(100vw-2rem))] grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader className="px-7 py-6 pr-16">
          <DialogDescription className="text-xs font-medium uppercase tracking-[0.18em]">
            About the track
          </DialogDescription>
          <DialogTitle className="truncate text-2xl">{trackName}</DialogTitle>
          <p className="truncate text-sm text-muted-foreground">
            {artists.join(", ")}
          </p>
        </DialogHeader>

        <div className="scrollbar-thin overflow-y-auto px-7 pb-6">
          {tags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {tags.map((item) => (
                <span
                  key={item.key}
                  className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                >
                  {item.value}
                </span>
              ))}
            </div>
          )}

          {info.description && (
            <p className="whitespace-pre-line text-[15px] leading-7 text-muted-foreground">
              {info.description}
            </p>
          )}

          {hasProductionDetails && (
            <dl className="mt-7 grid gap-4 border-t border-border/60 pt-6 sm:grid-cols-2">
              {info.albumName && (
                <div>
                  <dt className="text-xs uppercase tracking-[0.15em] text-muted-foreground/70">Album</dt>
                  <dd className="mt-1 text-sm">{info.albumName}</dd>
                </div>
              )}
              {info.musicVideoDirector && (
                <div>
                  <dt className="text-xs uppercase tracking-[0.15em] text-muted-foreground/70">Video director</dt>
                  <dd className="mt-1 text-sm">{info.musicVideoDirector}</dd>
                </div>
              )}
              {info.musicVideoCompany && (
                <div>
                  <dt className="text-xs uppercase tracking-[0.15em] text-muted-foreground/70">Video production</dt>
                  <dd className="mt-1 text-sm">{info.musicVideoCompany}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <DialogFooter className="justify-between px-7 py-4">
          <a
            href={info.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Information from TheAudioDB
            <ExternalLink className="size-3" />
          </a>
          {info.musicVideoUrl && (
            <a
              href={info.musicVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Music video
              <ExternalLink className="size-3" />
            </a>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
