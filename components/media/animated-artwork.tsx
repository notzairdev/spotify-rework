"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function AnimatedArtwork({
  streamUrl,
  fallbackUrl,
  alt,
  className,
  sizes = "320px",
}: {
  streamUrl?: string | null;
  fallbackUrl?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackState, setPlaybackState] = useState<{
    streamUrl: string | null;
    status: "loading" | "ready" | "failed";
  }>({ streamUrl: null, status: "loading" });

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    let hls: Hls | null = null;
    let networkRecoveryAttempts = 0;
    let mediaRecoveryAttempts = 0;

    const markReady = () => {
      setPlaybackState({ streamUrl, status: "ready" });
    };

    const markFailed = () => {
      setPlaybackState({ streamUrl, status: "failed" });
    };

    const startPlayback = () => {
      void video.play().then(markReady).catch((error: unknown) => {
        console.warn("Animated artwork autoplay was blocked:", error);
      });
    };

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        autoStartLoad: true,
        capLevelToPlayerSize: true,
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
      });

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls?.loadSource(streamUrl);
      });
      hls.on(Hls.Events.MANIFEST_PARSED, startPlayback);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;

        console.warn("Animated artwork HLS error:", {
          type: data.type,
          details: data.details,
          reason: data.reason,
        });

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRecoveryAttempts < 2) {
          networkRecoveryAttempts += 1;
          hls?.startLoad();
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveryAttempts < 1) {
          mediaRecoveryAttempts += 1;
          hls?.recoverMediaError();
          return;
        }

        markFailed();
      });
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      video.load();
    } else {
      queueMicrotask(markFailed);
    }

    return () => {
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [streamUrl]);

  const videoReady = playbackState.streamUrl === streamUrl && playbackState.status === "ready";
  const videoFailed = playbackState.streamUrl === streamUrl && playbackState.status === "failed";
  const showVideo = Boolean(streamUrl) && !videoFailed;

  return (
    <div className={cn("relative size-full overflow-hidden", className)}>
      {fallbackUrl && (
        <Image
          src={fallbackUrl}
          alt={alt}
          fill
          sizes={sizes}
          className={cn("object-cover transition-opacity duration-700", videoReady && "opacity-0")}
        />
      )}
      {showVideo && (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          autoPlay
          crossOrigin="anonymous"
          preload="auto"
          poster={fallbackUrl ?? undefined}
          aria-label={alt}
          onLoadedMetadata={() => {
            const video = videoRef.current;
            if (video) void video.play().catch(() => undefined);
          }}
          onPlaying={() => setPlaybackState({ streamUrl: streamUrl ?? null, status: "ready" })}
          onError={(event) => {
            const video = event.currentTarget;
            console.warn("Animated artwork media error:", {
              code: video.error?.code,
              message: video.error?.message,
              currentSrc: video.currentSrc,
            });
            setPlaybackState({ streamUrl: streamUrl ?? null, status: "failed" });
          }}
          className={cn(
            "absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-700",
            videoReady && "opacity-100"
          )}
        />
      )}
    </div>
  );
}
