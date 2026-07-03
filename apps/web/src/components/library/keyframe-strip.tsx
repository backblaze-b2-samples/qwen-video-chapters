"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Thumbnail } from "./thumbnail";

interface KeyframeStripProps {
  /** All extracted keyframe thumbnail keys (VideoChapters.thumbnail_keys). */
  thumbnailKeys: string[];
}

/**
 * Browsable grid of every keyframe thumbnail extracted for a video. The video
 * player only surfaces the first frame as its poster; this strip exposes the
 * full set the backend stored in B2. Each frame presigns + paints via the same
 * <Thumbnail> primitive the library grid uses.
 */
export function KeyframeStrip({ thumbnailKeys }: KeyframeStripProps) {
  if (thumbnailKeys.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-4">
        <CardTitle className="card-title">Keyframes</CardTitle>
        <Badge variant="secondary">{thumbnailKeys.length}</Badge>
      </CardHeader>
      <CardContent className="p-5">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {thumbnailKeys.map((key, i) => (
            <div
              key={key}
              className="relative aspect-video overflow-hidden rounded-md border border-border bg-muted"
            >
              <Thumbnail thumbKey={key} alt={`Keyframe ${i + 1}`} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
