"use client";

import type { VideoChapters } from "@qwen-video-chapters/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTimestamp } from "@/lib/utils";

interface SummaryPanelProps {
  video: VideoChapters;
}

/** Renders the structured AI summary + run metadata for a chapterized video. */
export function SummaryPanel({ video }: SummaryPanelProps) {
  return (
    <Card>
      <CardHeader className="border-b border-border px-5 py-4">
        <CardTitle className="card-title">Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        {video.summary ? (
          <p className="text-sm leading-relaxed">{video.summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No summary generated.</p>
        )}
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">{video.chapters.length} chapters</Badge>
          {video.duration_sec > 0 && (
            <Badge variant="secondary">{formatTimestamp(video.duration_sec)}</Badge>
          )}
          <Badge variant="outline">{video.sampling}</Badge>
          <Badge variant="outline" className="font-mono">
            {video.model_id}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
