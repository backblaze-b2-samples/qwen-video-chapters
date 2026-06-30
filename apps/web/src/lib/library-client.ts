import type {
  ChapterEdit,
  ChapterizeRequest,
  ChapterTimePoint,
  LibraryStats,
  LibraryVideo,
  RecentChapterization,
  VideoChapters,
} from "@qwen-video-chapters/shared";
import { API_BASE, ApiError, apiFetch, networkError } from "@/lib/api-client";

// Typed client functions for the Qwen Video Chapters library endpoints. Kept in
// its own module so api-client.ts stays under the 300-line file cap.

export async function getLibrary() {
  return apiFetch<LibraryVideo[]>("/library");
}

export async function getLibraryStats() {
  return apiFetch<LibraryStats>("/library/stats");
}

export async function getLibraryRecent(limit = 8) {
  return apiFetch<RecentChapterization[]>(`/library/recent?limit=${limit}`);
}

export async function getLibraryActivity() {
  return apiFetch<ChapterTimePoint[]>("/library/activity");
}

export async function getVideo(videoId: string) {
  return apiFetch<VideoChapters>(`/library/${encodeURIComponent(videoId)}`);
}

export async function getRunDefaults(videoId: string) {
  return apiFetch<ChapterizeRequest>(
    `/library/${encodeURIComponent(videoId)}/run-defaults`,
  );
}

export async function chapterizeVideo(videoId: string, req: ChapterizeRequest) {
  return apiFetch<VideoChapters>(
    `/library/${encodeURIComponent(videoId)}/chapterize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    },
  );
}

export async function editChapters(videoId: string, edit: ChapterEdit) {
  return apiFetch<VideoChapters>(`/library/${encodeURIComponent(videoId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(edit),
  });
}

export async function deleteVideo(videoId: string) {
  return apiFetch<{ deleted: boolean; video_id: string; objects_removed: number }>(
    `/library/${encodeURIComponent(videoId)}`,
    { method: "DELETE" },
  );
}

export async function getVideoSourceUrl(videoId: string) {
  return apiFetch<{ url: string }>(
    `/library/${encodeURIComponent(videoId)}/source-url`,
  );
}

export async function getThumbUrl(key: string) {
  return apiFetch<{ url: string }>(
    `/library/thumb-url?key=${encodeURIComponent(key)}`,
  );
}

export function ingestVideo(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<LibraryVideo> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          const body = JSON.parse(xhr.responseText);
          reject(new ApiError(body.detail || `Ingest failed: ${xhr.status}`, xhr.status));
        } catch {
          reject(new ApiError(`Ingest failed: ${xhr.status}`, xhr.status));
        }
      }
    });

    xhr.addEventListener("error", () => reject(networkError()));
    xhr.addEventListener("abort", () => reject(new ApiError("Ingest aborted", 0)));

    xhr.open("POST", `${API_BASE}/library`);
    xhr.send(formData);
  });
}
