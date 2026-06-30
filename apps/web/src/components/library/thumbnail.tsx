"use client";

import { Film } from "lucide-react";
import { useThumbUrl } from "@/lib/queries";

interface ThumbnailProps {
  thumbKey: string | null | undefined;
  alt: string;
  className?: string;
}

/**
 * Renders a B2 keyframe thumbnail via a presigned URL. Falls back to a film
 * icon when the video has no thumbnails yet (not chapterized). The <img> must
 * actually paint once a URL resolves.
 */
export function Thumbnail({ thumbKey, alt, className }: ThumbnailProps) {
  const { data } = useThumbUrl(thumbKey ?? undefined, !!thumbKey);

  if (thumbKey && data?.url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- presigned B2 URL, not a static asset
      <img
        src={data.url}
        alt={alt}
        className={className ?? "h-full w-full object-cover"}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center bg-muted text-muted-foreground ${className ?? "h-full w-full"}`}
    >
      <Film className="h-6 w-6" aria-hidden />
    </div>
  );
}
