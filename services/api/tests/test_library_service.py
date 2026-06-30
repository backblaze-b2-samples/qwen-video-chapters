"""Tests for the scoped library service — video_id derivation, scoped delete
(never the bucket root), and the list/manifest join. B2 repo calls are
monkeypatched, so no network or real bucket is touched."""

from datetime import UTC, datetime

import pytest

from app.service import index_manifest
from app.service import library as lib
from app.service.library import LibraryError
from app.types import FileMetadata


def _src(key: str) -> FileMetadata:
    return FileMetadata(
        key=key,
        filename=key.split("/")[-1],
        folder="library/source/",
        size_bytes=2048,
        size_human="2.0 KB",
        content_type="video/mp4",
        uploaded_at=datetime.now(UTC),
        url=None,
    )


def test_derive_video_id_sanitizes():
    assert lib.derive_video_id("My Lecture 01.mp4") == "My-Lecture-01"
    assert lib.derive_video_id("../../etc/passwd.mov") == "passwd"


def test_validate_video_id_rejects_traversal():
    for bad in ("", "../x", "a/b", "x%2e%2e"):
        with pytest.raises(LibraryError):
            lib.validate_video_id(bad)


def test_delete_video_is_scoped_to_prefixes(monkeypatch):
    """The scoped delete must only ever target this video's library prefixes,
    never the bucket root."""
    called: list[str] = []
    monkeypatch.setattr(lib, "delete_prefix", lambda p: called.append(p) or 1)
    monkeypatch.setattr(lib, "list_files", lambda prefix="": [_src("library/source/lec1.mp4")])
    monkeypatch.setattr(index_manifest, "remove", lambda vid: None)

    lib.delete_video("lec1")

    assert called, "delete_prefix was never called"
    assert all(p.startswith("library/") for p in called)
    assert all(p not in ("", "/", "library/") for p in called)
    assert "library/thumbs/lec1/" in called
    assert "library/meta/lec1.json" in called
    assert "library/source/lec1.mp4" in called


def test_list_videos_joins_manifest(monkeypatch):
    monkeypatch.setattr(
        lib, "list_files", lambda prefix="": [_src("library/source/lec1.mp4")]
    )
    monkeypatch.setattr(
        index_manifest,
        "read_index",
        lambda: {"lec1": {"video_id": "lec1", "title": "Lecture 1",
                          "chapter_count": 3, "thumbnail_key": "library/thumbs/lec1/000.jpg"}},
    )
    rows = lib.list_videos()
    assert len(rows) == 1
    assert rows[0].video_id == "lec1"
    assert rows[0].chapter_count == 3
    assert rows[0].has_meta is True
    assert rows[0].title == "Lecture 1"


def test_ingest_rejects_non_video(monkeypatch):
    with pytest.raises(LibraryError):
        lib.ingest_video(b"data", "notes.txt", "text/plain")
