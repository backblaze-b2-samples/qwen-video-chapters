"use client";

import { Play } from "lucide-react";
import type { Chapter } from "@qwen-video-chapters/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListVideo } from "lucide-react";
import { formatTimestamp } from "@/lib/utils";

interface ChapterTimelineProps {
  chapters: Chapter[];
  onSeek: (seconds: number) => void;
}

/** Chapter list with jump-to controls. Clicking a chapter seeks the player. */
export function ChapterTimeline({ chapters, onSeek }: ChapterTimelineProps) {
  return (
    <Card>
      <CardHeader className="border-b border-border px-5 py-4">
        <CardTitle className="card-title">Chapters</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {chapters.length === 0 ? (
          <EmptyState
            icon={ListVideo}
            title="No chapters yet"
            description="Run Chapterize to generate the chapter timeline."
          />
        ) : (
          <ol className="divide-y divide-border">
            {chapters.map((chapter, i) => (
              <li key={`${chapter.start_sec}-${i}`}>
                <button
                  type="button"
                  onClick={() => onSeek(chapter.start_sec)}
                  className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-accent-subtle"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Play className="h-3 w-3" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {chapter.title}
                      </span>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {formatTimestamp(chapter.start_sec)}
                      </span>
                    </span>
                    {chapter.summary && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {chapter.summary}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
