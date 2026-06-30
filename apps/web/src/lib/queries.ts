"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  deleteFile,
  getFiles,
  getFileStats,
  getPreviewUrl,
  getUploadActivity,
} from "@/lib/api-client";
import {
  chapterizeVideo,
  deleteVideo,
  editChapters,
  getLibrary,
  getLibraryActivity,
  getLibraryRecent,
  getLibraryStats,
  getRunDefaults,
  getThumbUrl,
  getVideo,
  getVideoSourceUrl,
  ingestVideo,
} from "@/lib/library-client";
import type {
  ChapterEdit,
  ChapterizeRequest,
  FileMetadata,
} from "@qwen-video-chapters/shared";

// Single source of truth for query keys. Keep these tightly scoped so that
// invalidating "files" doesn't blow away unrelated caches, and so an IDE
// "find usages" of `qk.files` reveals every consumer.
export const qk = {
  all: ["b2"] as const,
  files: (prefix?: string, limit?: number) =>
    [...qk.all, "files", prefix ?? "", limit ?? 100] as const,
  stats: () => [...qk.all, "stats"] as const,
  uploadActivity: (days: number) =>
    [...qk.all, "stats", "activity", days] as const,
  preview: (key: string) => [...qk.all, "preview", key] as const,
  // Library (Qwen Video Chapters) — scoped under "library" so chapterize/edit/
  // delete mutations can invalidate just this subtree.
  library: () => [...qk.all, "library"] as const,
  video: (id: string) => [...qk.all, "library", "video", id] as const,
  runDefaults: (id: string) => [...qk.all, "library", "run-defaults", id] as const,
  libraryStats: () => [...qk.all, "library", "stats"] as const,
  libraryRecent: () => [...qk.all, "library", "recent"] as const,
  libraryActivity: () => [...qk.all, "library", "activity"] as const,
  videoSourceUrl: (id: string) => [...qk.all, "library", "source-url", id] as const,
  thumbUrl: (key: string) => [...qk.all, "library", "thumb-url", key] as const,
};

export function useFiles(prefix = "", limit = 100) {
  return useQuery<FileMetadata[], ApiError>({
    queryKey: qk.files(prefix, limit),
    queryFn: () => getFiles(prefix, limit),
  });
}

export function useFileStats() {
  return useQuery({
    queryKey: qk.stats(),
    queryFn: getFileStats,
  });
}

export function useUploadActivity(days = 7) {
  return useQuery({
    queryKey: qk.uploadActivity(days),
    queryFn: () => getUploadActivity(days),
  });
}

// Presigned preview URL — only fetched when `enabled` is true (e.g., when
// the dialog opens for a specific file). Kept short-lived (60s) because
// the URL itself has a presigned expiry and is cheap to regenerate.
export function usePreviewUrl(key: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.preview(key ?? ""),
    queryFn: () => getPreviewUrl(key as string),
    enabled: enabled && !!key,
    staleTime: 60_000,
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileKey: string) => deleteFile(fileKey),
    // After delete, blow away every cached file list + stats. Cheap and
    // correct — the dashboard re-fetches lazily as components remount.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.all });
    },
  });
}

// --- Library (Qwen Video Chapters) ---

export function useLibrary() {
  return useQuery({ queryKey: qk.library(), queryFn: getLibrary });
}

export function useVideo(id: string) {
  return useQuery({
    queryKey: qk.video(id),
    queryFn: () => getVideo(id),
    // 404 means "no chapters generated yet" — don't retry that into oblivion.
    retry: (count, err) =>
      !(err instanceof ApiError && err.status === 404) && count < 2,
  });
}

export function useRunDefaults(id: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.runDefaults(id),
    queryFn: () => getRunDefaults(id),
    enabled,
  });
}

export function useLibraryStats() {
  return useQuery({ queryKey: qk.libraryStats(), queryFn: getLibraryStats });
}

export function useLibraryRecent(limit = 8) {
  return useQuery({
    queryKey: qk.libraryRecent(),
    queryFn: () => getLibraryRecent(limit),
  });
}

export function useLibraryActivity() {
  return useQuery({ queryKey: qk.libraryActivity(), queryFn: getLibraryActivity });
}

export function useVideoSourceUrl(id: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.videoSourceUrl(id),
    queryFn: () => getVideoSourceUrl(id),
    enabled,
    staleTime: 60_000,
  });
}

export function useThumbUrl(key: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.thumbUrl(key ?? ""),
    queryFn: () => getThumbUrl(key as string),
    enabled: enabled && !!key,
    staleTime: 60_000,
  });
}

export function useChapterize(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: ChapterizeRequest) => chapterizeVideo(id, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.library() }),
  });
}

export function useEditChapters(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (edit: ChapterEdit) => editChapters(id, edit),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.library() }),
  });
}

export function useDeleteVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteVideo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.library() }),
  });
}

export function useIngestVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { file: File; onProgress?: (p: number) => void }) =>
      ingestVideo(vars.file, vars.onProgress),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.library() }),
  });
}
