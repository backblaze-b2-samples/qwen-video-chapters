"""Library + chapterization routes. Thin handlers; logic lives in services."""

import logging

from fastapi import APIRouter, HTTPException, UploadFile

from app.config import settings
from app.service import chapters as chapters_service
from app.service import library as library_service
from app.service.library import LibraryError
from app.types import (
    ChapterEdit,
    ChapterizeRequest,
    ChapterTimePoint,
    LibraryStats,
    LibraryVideo,
    RecentChapterization,
    VideoChapters,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _raise(e: LibraryError) -> None:
    raise HTTPException(status_code=e.status_code, detail=e.detail) from None


@router.get("/library", response_model=list[LibraryVideo])
async def list_library():
    return library_service.list_videos()


@router.get("/library/stats", response_model=LibraryStats)
async def library_stats():
    return library_service.get_stats()


@router.get("/library/recent", response_model=list[RecentChapterization])
async def library_recent(limit: int = 8):
    return library_service.recent_chapterizations(limit=limit)


@router.get("/library/activity", response_model=list[ChapterTimePoint])
async def library_activity():
    return library_service.chapters_over_time()


@router.get("/library/thumb-url")
async def thumb_url(key: str):
    try:
        return {"url": chapters_service.thumb_url(key)}
    except LibraryError as e:
        _raise(e)


@router.post("/library", response_model=LibraryVideo)
async def ingest_library_video(file: UploadFile):
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > settings.max_file_size:
            raise HTTPException(status_code=413, detail="File too large")
        chunks.append(chunk)
    try:
        return library_service.ingest_video(
            b"".join(chunks),
            file.filename or "",
            file.content_type or "video/mp4",
        )
    except LibraryError as e:
        _raise(e)


@router.get("/library/{video_id}", response_model=VideoChapters)
async def get_video(video_id: str):
    try:
        meta = library_service.read_meta(video_id)
    except LibraryError as e:
        _raise(e)
    if not meta:
        raise HTTPException(status_code=404, detail="No chapters generated yet")
    return meta


@router.get("/library/{video_id}/run-defaults", response_model=ChapterizeRequest)
async def run_defaults(video_id: str):
    return chapters_service.default_request_for(video_id)


@router.post("/library/{video_id}/chapterize", response_model=VideoChapters)
async def chapterize_video(video_id: str, req: ChapterizeRequest):
    try:
        return chapters_service.chapterize(video_id, req)
    except LibraryError as e:
        _raise(e)
    except RuntimeError as e:
        logger.warning("Chapterize failed for %s: %s", video_id, e)
        raise HTTPException(status_code=500, detail=str(e)) from None


@router.patch("/library/{video_id}", response_model=VideoChapters)
async def edit_video_chapters(video_id: str, edit: ChapterEdit):
    try:
        return chapters_service.edit_chapters(video_id, edit)
    except LibraryError as e:
        _raise(e)


@router.delete("/library/{video_id}")
async def delete_video(video_id: str):
    try:
        deleted = library_service.delete_video(video_id)
    except LibraryError as e:
        _raise(e)
    return {"deleted": True, "video_id": video_id, "objects_removed": deleted}


@router.get("/library/{video_id}/source-url")
async def video_source_url(video_id: str):
    try:
        return {"url": chapters_service.source_url(video_id)}
    except LibraryError as e:
        _raise(e)
