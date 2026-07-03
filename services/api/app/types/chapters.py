from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class SamplingMode(StrEnum):
    """How keyframes are sampled from the source video."""

    INTERVAL = "interval"
    SCENE_CHANGE = "scene-change"


class Chapter(BaseModel):
    start_sec: float = Field(ge=0)
    end_sec: float = Field(ge=0)
    title: str
    summary: str = ""


class VideoChapters(BaseModel):
    """Full chapter metadata for one video — persisted as library/meta/<id>.json."""

    video_id: str
    source_key: str
    title: str
    duration_sec: float = 0.0
    model_id: str
    sampling: SamplingMode = SamplingMode.SCENE_CHANGE
    chapters: list[Chapter] = []
    summary: str = ""
    thumbnail_keys: list[str] = []
    generated_at: datetime


class LibraryVideo(BaseModel):
    """A single row in the scoped /library list."""

    video_id: str
    source_key: str
    title: str
    size_human: str
    chapter_count: int = 0
    has_meta: bool = False
    uploaded_at: datetime
    thumbnail_key: str | None = None


class ChapterizeRequest(BaseModel):
    """Inputs for a (re-)chapterize run. Either video_id or source_key resolves
    the source; sampling/max_chapters/model are finite-option knobs."""

    sampling: SamplingMode = SamplingMode.SCENE_CHANGE
    max_chapters: int = Field(default=8, ge=1, le=24)
    model_id: str | None = None


class ChapterEdit(BaseModel):
    """Human correction of AI output — replaces chapters + summary."""

    chapters: list[Chapter]
    summary: str = ""


class LibraryStats(BaseModel):
    """Dashboard metrics derived from the index manifest."""

    videos_in_library: int
    chapters_generated: int
    thumbnails_stored: int
    derived_size_bytes: int
    derived_size_human: str


class RecentChapterization(BaseModel):
    video_id: str
    title: str
    chapter_count: int
    duration_sec: float
    generated_at: datetime


class ChapterTimePoint(BaseModel):
    """One point in the dashboard chapters-over-time chart."""

    date: str
    chapters: int


class ChapterizeProgress(BaseModel):
    """Live progress report for an in-flight chapterize run."""

    stage: str
    detail: str
