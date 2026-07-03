export type FileStatus = "uploading" | "complete" | "error";

export interface FileMetadata {
  key: string;
  filename: string;
  folder: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
}

export interface FileMetadataDetail {
  filename: string;
  size_bytes: number;
  size_human: string;
  mime_type: string;
  extension: string;
  md5: string;
  sha256: string;
  uploaded_at: string;
  // Image-specific
  image_width: number | null;
  image_height: number | null;
  exif: Record<string, string> | null;
  // PDF-specific
  pdf_pages: number | null;
  pdf_author: string | null;
  pdf_title: string | null;
  // Audio/Video
  duration_seconds: number | null;
  codec: string | null;
  bitrate: number | null;
}

export interface FileUploadResponse {
  key: string;
  filename: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
  url: string | null;
  metadata: FileMetadataDetail | null;
}

export interface DailyUploadCount {
  date: string;
  uploads: number;
}

export interface UploadStats {
  total_files: number;
  total_size_bytes: number;
  total_size_human: string;
  uploads_today: number;
  total_downloads: number;
}

// --- Qwen Video Chapters ---

export type SamplingMode = "interval" | "scene-change";

export interface Chapter {
  start_sec: number;
  end_sec: number;
  title: string;
  summary: string;
}

export interface VideoChapters {
  video_id: string;
  source_key: string;
  title: string;
  duration_sec: number;
  model_id: string;
  sampling: SamplingMode;
  chapters: Chapter[];
  summary: string;
  thumbnail_keys: string[];
  generated_at: string;
}

export interface LibraryVideo {
  video_id: string;
  source_key: string;
  title: string;
  size_human: string;
  chapter_count: number;
  has_meta: boolean;
  uploaded_at: string;
  thumbnail_key: string | null;
}

export interface ChapterizeRequest {
  sampling: SamplingMode;
  max_chapters: number;
  model_id?: string | null;
}

export interface ChapterEdit {
  chapters: Chapter[];
  summary: string;
}

export interface LibraryStats {
  videos_in_library: number;
  chapters_generated: number;
  thumbnails_stored: number;
  derived_size_bytes: number;
  derived_size_human: string;
}

export interface RecentChapterization {
  video_id: string;
  title: string;
  chapter_count: number;
  duration_sec: number;
  generated_at: string;
}

export interface ChapterTimePoint {
  date: string;
  chapters: number;
}

export interface ChapterizeProgress {
  stage: string;
  detail: string;
}
