"""ffmpeg keyframe-extraction adapter.

Uses the imageio-ffmpeg *bundled* binary (Homebrew's ffmpeg ships slim and may
lack filters), never a bare `ffmpeg` on PATH. Keyframe extraction needs no
libass. Heavy deps (imageio_ffmpeg) are imported lazily inside functions so the
module stays importable without the ML/extra stack installed.
"""

import logging
import re
import subprocess

logger = logging.getLogger(__name__)

# ffmpeg writes "Duration: HH:MM:SS.ss," to stderr; parse it as a fallback when
# ffprobe isn't available.
_DURATION_RE = re.compile(r"Duration:\s*(\d+):(\d{2}):(\d{2})\.(\d+)")


def _ffmpeg_exe() -> str:
    import imageio_ffmpeg

    return imageio_ffmpeg.get_ffmpeg_exe()


def parse_duration_from_stderr(stderr: str) -> float | None:
    """Parse a video duration (seconds) from ffmpeg's stderr banner.

    Pure function — unit-testable against fabricated ffmpeg output without
    invoking a real binary.
    """
    match = _DURATION_RE.search(stderr)
    if not match:
        return None
    hours, minutes, seconds, frac = match.groups()
    return (
        int(hours) * 3600
        + int(minutes) * 60
        + int(seconds)
        + float(f"0.{frac}")
    )


def timestamps_for_interval(duration_sec: float, count: int) -> list[float]:
    """Evenly spaced timestamps across the video for interval sampling.

    Pure function — testable without ffmpeg. Returns at most `count` points,
    skipping the exact 0 and end to avoid black intro/outro frames.
    """
    if duration_sec <= 0 or count <= 0:
        return []
    step = duration_sec / (count + 1)
    return [round(step * (i + 1), 3) for i in range(count)]


def probe_duration(video_path: str) -> float:
    """Return the source duration in seconds (0.0 if it can't be determined)."""
    try:
        proc = subprocess.run(  # bundled binary, fixed args
            [_ffmpeg_exe(), "-i", video_path],
            capture_output=True,
            text=True,
            timeout=120,
        )
    except (OSError, subprocess.SubprocessError) as e:
        logger.warning("ffmpeg probe failed for %s: %s", video_path, e)
        return 0.0
    return parse_duration_from_stderr(proc.stderr) or 0.0


def _run_ffmpeg(args: list[str]) -> None:
    proc = subprocess.run(  # bundled binary, fixed args
        [_ffmpeg_exe(), *args],
        capture_output=True,
        text=True,
        timeout=600,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {proc.stderr[-500:]}")


def extract(
    video_path: str,
    out_dir: str,
    *,
    mode: str = "scene-change",
    max_keyframes: int = 16,
) -> list[tuple[float, str]]:
    """Extract keyframes to `out_dir`. Returns (timestamp_sec, frame_path) pairs,
    capped to `max_keyframes`.

    - "interval": evenly sample `max_keyframes` frames across the duration.
    - "scene-change": pick frames where the scene score exceeds a threshold,
      capped to `max_keyframes`.
    """
    import os

    os.makedirs(out_dir, exist_ok=True)
    duration = probe_duration(video_path)

    if mode == "interval":
        return _extract_interval(video_path, out_dir, duration, max_keyframes)
    return _extract_scene(video_path, out_dir, duration, max_keyframes)


def _extract_interval(
    video_path: str, out_dir: str, duration: float, max_keyframes: int
) -> list[tuple[float, str]]:
    import os

    stamps = timestamps_for_interval(duration, max_keyframes) or [0.0]
    pairs: list[tuple[float, str]] = []
    for i, ts in enumerate(stamps):
        frame_path = os.path.join(out_dir, f"{i:03d}.jpg")
        _run_ffmpeg(
            ["-ss", str(ts), "-i", video_path, "-frames:v", "1",
             "-q:v", "3", "-y", frame_path]
        )
        if os.path.exists(frame_path):
            pairs.append((round(ts, 3), frame_path))
    return pairs


def _extract_scene(
    video_path: str, out_dir: str, duration: float, max_keyframes: int
) -> list[tuple[float, str]]:
    """Scene-change frames via the select filter. Falls back to interval
    sampling when the source has too few detectable scene cuts."""
    import os

    pattern = os.path.join(out_dir, "scene_%03d.jpg")
    _run_ffmpeg(
        ["-i", video_path, "-vf", "select='gt(scene,0.4)',showinfo",
         "-vsync", "vfr", "-frames:v", str(max_keyframes), "-q:v", "3",
         "-y", pattern]
    )
    frames = sorted(f for f in os.listdir(out_dir) if f.startswith("scene_"))
    if len(frames) < 2:
        # Not enough scene cuts — fall back to even interval sampling.
        for f in frames:
            os.remove(os.path.join(out_dir, f))
        return _extract_interval(video_path, out_dir, duration, max_keyframes)

    frames = frames[:max_keyframes]
    pairs: list[tuple[float, str]] = []
    # Approximate timestamps by even spacing across the duration — the scene
    # frames are in temporal order, so this preserves their ordering for the
    # model prompt while staying robust to showinfo-parse fragility.
    stamps = timestamps_for_interval(duration, len(frames)) or [
        0.0 for _ in frames
    ]
    for ts, f in zip(stamps, frames, strict=False):
        pairs.append((round(ts, 3), os.path.join(out_dir, f)))
    return pairs
