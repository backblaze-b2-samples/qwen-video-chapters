"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Clapperboard } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ApiError } from "@/lib/api-client";
import { useDeleteVideo, useVideo } from "@/lib/queries";
import { VideoPlayer } from "./video-player";
import { ChapterTimeline } from "./chapter-timeline";
import { SummaryPanel } from "./summary-panel";
import { ChapterEditor } from "./chapter-editor";
import { RunChaptersForm } from "./run-chapters-form";

export function VideoDetail({ videoId }: { videoId: string }) {
  const { data: video, isLoading, error, refetch } = useVideo(videoId);
  const deleteVideo = useDeleteVideo();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const seek = (seconds: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = seconds;
    void el.play().catch(() => {});
  };

  const onDelete = async () => {
    setDeleteOpen(false);
    try {
      await deleteVideo.mutateAsync(videoId);
      toast.success("Video deleted");
      router.push("/library");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      toast.error(`Couldn't delete: ${message}`);
    }
  };

  // A 404 here means the source video exists but hasn't been chapterized yet.
  const notChapterized = error instanceof ApiError && error.status === 404;
  const hasChapters = !!video && video.chapters.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link href="/library" aria-label="Back to library">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="page-title break-all">{video?.title ?? videoId}</h1>
        </div>
        <div className="flex items-center gap-2">
          {hasChapters && (
            <Button variant="outline" size="sm" className="h-8" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          <Button size="sm" className="h-8" onClick={() => setRunOpen(true)}>
            <Sparkles className="h-3.5 w-3.5" />
            {hasChapters ? "Re-run chapters" : "Chapterize"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete video"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <VideoPlayer
            ref={videoRef}
            videoId={videoId}
            posterKey={video?.thumbnail_keys?.[0]}
          />
          {video && <SummaryPanel video={video} />}
        </div>
        <div>
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : notChapterized ? (
            <EmptyState
              icon={Clapperboard}
              title="Not chapterized yet"
              description="Run Chapterize to generate the timeline, thumbnails and summary."
              action={
                <Button size="sm" onClick={() => setRunOpen(true)}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Chapterize now
                </Button>
              }
            />
          ) : error ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : video ? (
            <ChapterTimeline chapters={video.chapters} onSeek={seek} />
          ) : null}
        </div>
      </div>

      <RunChaptersForm videoId={videoId} open={runOpen} onOpenChange={setRunOpen} />
      {video && (
        <ChapterEditor video={video} open={editOpen} onOpenChange={setEditOpen} />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this video?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently removes the source video, all keyframe thumbnails and
              chapter metadata for{" "}
              <code className="font-mono text-xs">{videoId}</code> from B2.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
