"use client";

import { useState } from "react";
import Link from "next/link";
import { Clapperboard, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
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
import { useLibrary, useDeleteVideo } from "@/lib/queries";
import { AddVideoForm } from "./add-video-form";
import { Thumbnail } from "./thumbnail";

export function LibraryGrid() {
  const { data: videos = [], isLoading, error, refetch } = useLibrary();
  const deleteVideo = useDeleteVideo();
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete;
    setPendingDelete(null);
    try {
      const res = await deleteVideo.mutateAsync(id);
      toast.success(`Deleted "${id}" (${res.objects_removed} objects removed)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      toast.error(`Couldn't delete: ${message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" className="h-8" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add video
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : videos.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="No videos in your library yet"
          description="Add a clip, or drop a video into B2 under library/source/, then run Chapterize."
          action={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add your first video
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <Card
              key={video.video_id}
              className="card-hover overflow-hidden p-0"
            >
              <Link href={`/library/${encodeURIComponent(video.video_id)}`}>
                <div className="relative aspect-video w-full overflow-hidden border-b border-border">
                  <Thumbnail thumbKey={video.thumbnail_key} alt={video.title} />
                  <div className="absolute right-2 top-2">
                    {video.chapter_count > 0 ? (
                      <Badge>{video.chapter_count} chapters</Badge>
                    ) : (
                      <Badge variant="secondary">Not chapterized</Badge>
                    )}
                  </div>
                </div>
              </Link>
              <div className="flex items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <Link
                    href={`/library/${encodeURIComponent(video.video_id)}`}
                    className="block truncate text-sm font-semibold hover:underline"
                  >
                    {video.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{video.size_human}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${video.title}`}
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setPendingDelete(video.video_id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddVideoForm open={addOpen} onOpenChange={setAddOpen} />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this video?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the source video, all keyframe thumbnails
              and chapter metadata under{" "}
              <code className="font-mono text-xs">library/.../{pendingDelete}</code>{" "}
              from B2. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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
