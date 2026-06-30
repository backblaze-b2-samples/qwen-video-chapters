"""Chapterize orchestration: B2 source -> ffmpeg keyframes -> Qwen2.5-VL ->
B2 artifacts (thumbs + meta) -> index manifest. Also human edit of AI output.

This is the marquee flow. Real Qwen inference, real artifacts to B2 — no
simulated or mock chapters. The run is synchronous with a frame cap for the
demo; production would use a job queue + GPU for multi-hour videos.
"""

import logging
import os
import tempfile
from datetime import UTC, datetime

from app.config import settings
from app.repo import (
    download_to_path,
    get_presigned_url,
    keyframes,
    put_bytes,
    qwen_chapters,
)
from app.service import index_manifest, library
from app.service.library import LibraryError
from app.types import (
    Chapter,
    ChapterEdit,
    ChapterizeRequest,
    SamplingMode,
    VideoChapters,
)

logger = logging.getLogger(__name__)


def _thumb_key(video_id: str, idx: int) -> str:
    return f"{library.THUMBS_PREFIX}{video_id}/{idx:03d}.jpg"


def _coerce_chapters(raw: dict, duration: float) -> tuple[list[Chapter], str]:
    chapters: list[Chapter] = []
    for item in raw.get("chapters", []):
        try:
            start = float(item.get("start_sec", 0))
            end = float(item.get("end_sec", start))
            chapters.append(
                Chapter(
                    start_sec=max(0.0, start),
                    end_sec=max(start, end) if end >= start else start,
                    title=str(item.get("title", "Untitled")).strip() or "Untitled",
                    summary=str(item.get("summary", "")).strip(),
                )
            )
        except (TypeError, ValueError):
            continue
    chapters.sort(key=lambda c: c.start_sec)
    return chapters, str(raw.get("summary", "")).strip()


def chapterize(video_id: str, req: ChapterizeRequest) -> VideoChapters:
    """Run (or re-run) the full pipeline for one video. Raises LibraryError /
    RuntimeError on failure."""
    src_key = library.find_source_key(video_id)
    if not src_key:
        raise LibraryError(f"No source video for id '{video_id}'", status_code=404)

    ext = src_key[src_key.rfind(".") :]
    with tempfile.TemporaryDirectory(prefix=f"qvc-{video_id}-") as tmp:
        local_video = os.path.join(tmp, f"source{ext}")
        download_to_path(src_key, local_video)

        frame_dir = os.path.join(tmp, "frames")
        pairs = keyframes.extract(
            local_video,
            frame_dir,
            mode=req.sampling.value,
            max_keyframes=settings.max_keyframes,
        )
        if not pairs:
            raise RuntimeError("No keyframes could be extracted from the video")
        duration = keyframes.probe_duration(local_video)

        thumb_keys: list[str] = []
        derived_size = 0
        for idx, (_, path) in enumerate(pairs):
            with open(path, "rb") as fh:
                data = fh.read()
            key = _thumb_key(video_id, idx)
            put_bytes(key, data, "image/jpeg")
            thumb_keys.append(key)
            derived_size += len(data)

        transcript = library.read_transcript(video_id)
        raw = qwen_chapters.generate(
            pairs,
            duration_sec=duration,
            transcript=transcript,
            max_chapters=req.max_chapters,
            model_id=req.model_id,
        )

    chapters, summary = _coerce_chapters(raw, duration)
    meta = VideoChapters(
        video_id=video_id,
        source_key=src_key,
        title=os.path.basename(src_key),
        duration_sec=duration,
        model_id=req.model_id or settings.qwen_model_id,
        sampling=req.sampling,
        chapters=chapters,
        summary=summary,
        thumbnail_keys=thumb_keys,
        generated_at=datetime.now(UTC),
    )
    _persist(meta, derived_size)
    logger.info("Chapterized %s: %d chapters, %d thumbs", video_id, len(chapters), len(thumb_keys))
    return meta


def edit_chapters(video_id: str, edit: ChapterEdit) -> VideoChapters:
    """Replace chapters + summary on an existing video (human correction)."""
    meta = library.read_meta(video_id)
    if not meta:
        raise LibraryError(f"No chapter metadata for '{video_id}'", status_code=404)
    meta.chapters = sorted(edit.chapters, key=lambda c: c.start_sec)
    meta.summary = edit.summary
    derived = index_manifest.read_index().get(video_id, {})
    _persist(meta, int(derived.get("derived_size_bytes", 0)))
    return meta


def _persist(meta: VideoChapters, derived_size: int) -> None:
    library.write_meta(meta)
    index_manifest.upsert(library.manifest_entry_from_meta(meta, derived_size))


def source_url(video_id: str) -> str:
    src_key = library.find_source_key(video_id)
    if not src_key:
        raise LibraryError(f"No source video for id '{video_id}'", status_code=404)
    return get_presigned_url(src_key)


def thumb_url(key: str) -> str:
    if not key.startswith(library.THUMBS_PREFIX):
        raise LibraryError("Thumbnail key must be under the library prefix")
    return get_presigned_url(key)


def default_request_for(video_id: str) -> ChapterizeRequest:
    """Pre-fill the run form with the video's last-used settings, or defaults."""
    meta = library.read_meta(video_id)
    if meta:
        return ChapterizeRequest(
            sampling=meta.sampling,
            max_chapters=min(24, max(1, len(meta.chapters) or 8)),
            model_id=meta.model_id,
        )
    return ChapterizeRequest(sampling=SamplingMode.SCENE_CHANGE, max_chapters=8)
