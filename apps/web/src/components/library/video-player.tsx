"use client";

import { forwardRef } from "react";
import { useVideoSourceUrl, useThumbUrl } from "@/lib/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";

interface VideoPlayerProps {
  videoId: string;
  posterKey?: string | null;
}

/**
 * <video> fed a presigned B2 source URL. The poster is the first keyframe
 * thumbnail. Exposes the underlying element via ref so the chapter timeline can
 * seek it (video.currentTime = start). Must actually paint once the URL loads.
 */
export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  function VideoPlayer({ videoId, posterKey }, ref) {
    const { data, isLoading, error, refetch } = useVideoSourceUrl(videoId, true);
    const { data: poster } = useThumbUrl(posterKey ?? undefined, !!posterKey);

    if (isLoading) return <Skeleton className="aspect-video w-full rounded-md" />;
    if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

    return (
      <div className="overflow-hidden rounded-md border border-border bg-black">
        <video
          ref={ref}
          src={data?.url}
          poster={poster?.url}
          controls
          preload="metadata"
          className="aspect-video w-full"
        >
          Your browser does not support the video element.
        </video>
      </div>
    );
  },
);
