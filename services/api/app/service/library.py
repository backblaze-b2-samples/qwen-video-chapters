"""Scoped video-library service.

Lists videos under library/source/, joins each with its meta JSON + first
thumbnail to build LibraryVideo rows, reads a single video's VideoChapters,
ingests a small uploaded clip, and deletes a video (scoped prefix delete across
source/thumbs/meta + manifest rebuild). All B2 access goes through repo/.
"""

import logging
import os
import re

from app.config import settings
from app.repo import (
    delete_prefix,
    get_bytes,
    list_files,
    put_bytes,
)
from app.service import index_manifest
from app.types import LibraryVideo, VideoChapters
from app.types.chapters import (
    ChapterTimePoint,
    LibraryStats,
    RecentChapterization,
)

logger = logging.getLogger(__name__)

SOURCE_PREFIX = "library/source/"
THUMBS_PREFIX = "library/thumbs/"
META_PREFIX = "library/meta/"

# Video extensions we treat as source clips (sidecar transcripts are skipped).
VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}
_SAFE_ID_RE = re.compile(r"[^a-zA-Z0-9_-]")
_DANGEROUS_ID_RE = re.compile(r"(\.\.|/|\\|%2e|%00)")


class LibraryError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


def validate_video_id(video_id: str) -> None:
    if not video_id or _DANGEROUS_ID_RE.search(video_id.lower()):
        raise LibraryError("Invalid video id")


def derive_video_id(filename: str) -> str:
    base = filename.replace("\\", "/").split("/")[-1]
    base = base.rsplit(".", 1)[0]
    cleaned = _SAFE_ID_RE.sub("-", base).strip("-")
    return cleaned or "video"


def source_key(video_id: str, ext: str) -> str:
    return f"{SOURCE_PREFIX}{video_id}{ext}"


def _ext_of(key: str) -> str:
    return key[key.rfind(".") :].lower() if "." in key else ""


def _meta_key(video_id: str) -> str:
    return f"{META_PREFIX}{video_id}.json"


def read_meta(video_id: str) -> VideoChapters | None:
    validate_video_id(video_id)
    raw = get_bytes(_meta_key(video_id))
    if not raw:
        return None
    return VideoChapters.model_validate_json(raw)


def write_meta(meta: VideoChapters) -> None:
    body = meta.model_dump_json().encode("utf-8")
    put_bytes(_meta_key(meta.video_id), body, "application/json")


def list_videos() -> list[LibraryVideo]:
    """List source videos joined with meta presence + first thumbnail."""
    sources = [f for f in list_files(prefix=SOURCE_PREFIX) if _ext_of(f.key) in VIDEO_EXTS]
    index = index_manifest.read_index()
    rows: list[LibraryVideo] = []
    for f in sources:
        vid = derive_video_id(f.filename)
        entry = index.get(vid, {})
        rows.append(
            LibraryVideo(
                video_id=vid,
                source_key=f.key,
                title=entry.get("title") or f.filename,
                size_human=f.size_human,
                chapter_count=int(entry.get("chapter_count", 0)),
                has_meta=bool(entry),
                uploaded_at=f.uploaded_at,
                thumbnail_key=entry.get("thumbnail_key"),
            )
        )
    rows.sort(key=lambda r: r.uploaded_at, reverse=True)
    return rows


def find_source_key(video_id: str) -> str | None:
    validate_video_id(video_id)
    for f in list_files(prefix=SOURCE_PREFIX):
        if _ext_of(f.key) in VIDEO_EXTS and derive_video_id(f.filename) == video_id:
            return f.key
    return None


def read_transcript(video_id: str) -> str | None:
    """Read an optional transcript sidecar library/source/<id>.txt|.srt."""
    for ext in (".txt", ".srt"):
        raw = get_bytes(f"{SOURCE_PREFIX}{video_id}{ext}")
        if raw:
            return raw.decode("utf-8", errors="replace")
    return None


def ingest_video(file_data: bytes, filename: str, content_type: str) -> LibraryVideo:
    """Ingest a small uploaded clip to library/source/. Raises LibraryError."""
    if not filename:
        raise LibraryError("No filename provided")
    ext = _ext_of(filename)
    if ext not in VIDEO_EXTS:
        raise LibraryError(f"Unsupported video type '{ext}'", status_code=415)
    if len(file_data) == 0:
        raise LibraryError("Empty file")
    if len(file_data) > settings.max_file_size:
        raise LibraryError("File too large for browser ingest", status_code=413)
    video_id = derive_video_id(filename)
    existing_key = find_source_key(video_id)
    was_replaced = existing_key is not None
    key = source_key(video_id, ext)
    put_bytes(key, file_data, content_type or "video/mp4")
    logger.info(
        "Ingested library video: key=%s size=%d replaced=%s",
        key, len(file_data), was_replaced,
    )
    rows = list_videos()
    stored_title = os.path.basename(key)
    for r in rows:
        if r.video_id == video_id:
            # Always use the actual stored B2 filename so the caller gets the
            # canonical name — manifest title may be stale from a prior
            # chapterization run and would produce a misleading toast.
            return LibraryVideo(
                video_id=r.video_id,
                source_key=r.source_key,
                title=stored_title,
                size_human=r.size_human,
                chapter_count=r.chapter_count,
                has_meta=r.has_meta,
                uploaded_at=r.uploaded_at,
                thumbnail_key=r.thumbnail_key,
            )
    raise LibraryError("Ingest succeeded but video not found in listing", 500)


def delete_video(video_id: str) -> int:
    """Scoped delete of ALL artifacts for one video. Never the bucket root."""
    validate_video_id(video_id)
    deleted = 0
    # Scoped strictly to this video's prefixes.
    deleted += delete_prefix(f"{THUMBS_PREFIX}{video_id}/")
    deleted += delete_prefix(f"{META_PREFIX}{video_id}.json")
    for f in list_files(prefix=SOURCE_PREFIX):
        if derive_video_id(f.filename) == video_id:
            deleted += delete_prefix(f.key)
    index_manifest.remove(video_id)
    logger.info("Deleted library video %s (%d objects)", video_id, deleted)
    return deleted


def get_stats() -> LibraryStats:
    return LibraryStats(**index_manifest.derived_stats(index_manifest.read_index()))


def recent_chapterizations(limit: int = 8) -> list[RecentChapterization]:
    entries = list(index_manifest.read_index().values())
    entries.sort(key=lambda e: e.get("generated_at") or "", reverse=True)
    out: list[RecentChapterization] = []
    for e in entries[:limit]:
        if not e.get("generated_at"):
            continue
        out.append(
            RecentChapterization(
                video_id=e["video_id"],
                title=e.get("title", e["video_id"]),
                chapter_count=int(e.get("chapter_count", 0)),
                duration_sec=float(e.get("duration_sec", 0.0)),
                generated_at=e["generated_at"],
            )
        )
    return out


def chapters_over_time() -> list[ChapterTimePoint]:
    """Chapters generated per day, from manifest generated_at dates."""
    counts: dict[str, int] = {}
    for e in index_manifest.read_index().values():
        ts = e.get("generated_at")
        if not ts:
            continue
        day = str(ts)[:10]
        counts[day] = counts.get(day, 0) + int(e.get("chapter_count", 0))
    return [
        ChapterTimePoint(date=d, chapters=c)
        for d, c in sorted(counts.items())
    ]


def manifest_entry_from_meta(meta: VideoChapters, derived_size: int) -> dict:
    """Build the compact index-manifest entry for a freshly chapterized video."""
    return {
        "video_id": meta.video_id,
        "source_key": meta.source_key,
        "title": meta.title,
        "duration_sec": meta.duration_sec,
        "chapter_count": len(meta.chapters),
        "thumbnail_count": len(meta.thumbnail_keys),
        "thumbnail_key": meta.thumbnail_keys[0] if meta.thumbnail_keys else None,
        "derived_size_bytes": derived_size,
        "generated_at": meta.generated_at.isoformat()
        if hasattr(meta.generated_at, "isoformat")
        else str(meta.generated_at),
    }
