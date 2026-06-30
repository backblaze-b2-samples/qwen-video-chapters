"""Read/upsert the combined library/index.json manifest.

The manifest is the single fast source for both the front-end timeline list and
the dashboard stats — it avoids scanning the bucket on every request. Each
entry is a compact per-video summary.
"""

import json
import logging
from datetime import UTC, datetime

from app.repo import get_bytes, put_bytes
from app.types.formatting import humanize_bytes

logger = logging.getLogger(__name__)

INDEX_KEY = "library/index.json"


def read_index() -> dict[str, dict]:
    """Return the manifest as {video_id: entry}. Empty dict if absent/corrupt."""
    raw = get_bytes(INDEX_KEY)
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("library/index.json is corrupt; treating as empty")
        return {}
    entries = data.get("videos", []) if isinstance(data, dict) else []
    return {e["video_id"]: e for e in entries if "video_id" in e}


def _write_index(entries: dict[str, dict]) -> None:
    ordered = sorted(
        entries.values(),
        key=lambda e: e.get("generated_at") or "",
        reverse=True,
    )
    body = json.dumps(
        {"updated_at": datetime.now(UTC).isoformat(), "videos": ordered},
        default=str,
    ).encode("utf-8")
    put_bytes(INDEX_KEY, body, "application/json")


def upsert(entry: dict) -> None:
    """Insert or replace a single video's manifest entry."""
    entries = read_index()
    entries[entry["video_id"]] = entry
    _write_index(entries)


def remove(video_id: str) -> None:
    entries = read_index()
    if entries.pop(video_id, None) is not None:
        _write_index(entries)


def derived_stats(entries: dict[str, dict]) -> dict:
    """Aggregate dashboard metrics from manifest entries."""
    videos = len(entries)
    chapters = sum(int(e.get("chapter_count", 0)) for e in entries.values())
    thumbs = sum(int(e.get("thumbnail_count", 0)) for e in entries.values())
    size = sum(int(e.get("derived_size_bytes", 0)) for e in entries.values())
    return {
        "videos_in_library": videos,
        "chapters_generated": chapters,
        "thumbnails_stored": thumbs,
        "derived_size_bytes": size,
        "derived_size_human": humanize_bytes(size),
    }
