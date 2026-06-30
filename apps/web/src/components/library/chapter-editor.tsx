"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Chapter, VideoChapters } from "@qwen-video-chapters/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEditChapters } from "@/lib/queries";
import { formatTimestamp } from "@/lib/utils";

interface ChapterEditorProps {
  video: VideoChapters;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Inline edit of AI-generated chapter titles + overall summary (the "edit"
 * verb). Submits via the PATCH mutation. Timestamps are not editable here —
 * those come from the model run. */
export function ChapterEditor({ video, open, onOpenChange }: ChapterEditorProps) {
  const [titles, setTitles] = useState<string[]>(video.chapters.map((c) => c.title));
  const [summary, setSummary] = useState(video.summary);
  const edit = useEditChapters(video.video_id);

  const onSubmit = async () => {
    const chapters: Chapter[] = video.chapters.map((c, i) => ({
      ...c,
      title: titles[i]?.trim() || c.title,
    }));
    try {
      await edit.mutateAsync({ chapters, summary });
      toast.success("Chapters updated");
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update failed";
      toast.error(`Couldn't save: ${message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit chapters</DialogTitle>
          <DialogDescription>
            Correct the AI-generated titles and summary. Saved back to the
            chapter metadata in B2.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {video.chapters.map((chapter, i) => (
            <div key={`${chapter.start_sec}-${i}`} className="space-y-1">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="font-mono tabular-nums">
                  {formatTimestamp(chapter.start_sec)}
                </span>
                Chapter {i + 1}
              </label>
              <Input
                value={titles[i] ?? ""}
                onChange={(e) =>
                  setTitles((prev) => {
                    const next = [...prev];
                    next[i] = e.target.value;
                    return next;
                  })
                }
              />
            </div>
          ))}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Overall summary
            </label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="resize-none"
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={edit.isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={onSubmit} disabled={edit.isPending}>
              {edit.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
