"""Guards for the ML-stack lazy-import boundary and the pure parsing helpers.

These tests must pass WITHOUT torch/transformers/imageio-ffmpeg installed — the
whole point of the lazy-import design. They exercise the deterministic, binary-
free parts of the keyframe + Qwen adapters.
"""

import importlib
import sys

import pytest


def test_no_torch_imported_at_module_load():
    """Importing the Qwen adapter must NOT pull in torch/transformers."""
    # Drop any cached import so we measure a fresh load.
    for mod in ("app.repo.qwen_chapters", "app.repo.keyframes"):
        sys.modules.pop(mod, None)
    importlib.import_module("app.repo.qwen_chapters")
    importlib.import_module("app.repo.keyframes")
    assert "torch" not in sys.modules
    assert "transformers" not in sys.modules
    assert "qwen_vl_utils" not in sys.modules
    assert "imageio_ffmpeg" not in sys.modules


def test_parse_duration_from_fabricated_ffmpeg_stderr():
    from app.repo.keyframes import parse_duration_from_stderr

    stderr = (
        "Input #0, mov,mp4, from 'clip.mp4':\n"
        "  Duration: 00:03:25.40, start: 0.000000, bitrate: 1200 kb/s\n"
        "  Stream #0:0: Video: h264\n"
    )
    assert parse_duration_from_stderr(stderr) == pytest.approx(205.4, abs=0.05)


def test_parse_duration_returns_none_when_absent():
    from app.repo.keyframes import parse_duration_from_stderr

    assert parse_duration_from_stderr("no duration banner here") is None


def test_timestamps_for_interval_are_ordered_and_capped():
    from app.repo.keyframes import timestamps_for_interval

    stamps = timestamps_for_interval(100.0, 4)
    assert len(stamps) == 4
    assert stamps == sorted(stamps)
    assert all(0 < t < 100 for t in stamps)
    assert timestamps_for_interval(0, 4) == []


def test_parse_model_json_handles_fenced_output():
    from app.repo.qwen_chapters import parse_model_json

    raw = (
        "Here are the chapters:\n```json\n"
        '{"chapters": [{"start_sec": 0, "end_sec": 30, "title": "Intro", '
        '"summary": "Opening"}], "summary": "A short clip."}\n```'
    )
    data = parse_model_json(raw)
    assert data["chapters"][0]["title"] == "Intro"
    assert data["summary"] == "A short clip."


def test_parse_model_json_rejects_garbage():
    from app.repo.qwen_chapters import parse_model_json

    with pytest.raises(ValueError):
        parse_model_json("not json at all")


def test_dtype_name_is_fp16_on_gpu_backends_fp32_on_cpu():
    """GPU-class backends load in float16 to halve memory (avoids MPS OOM);
    CPU stays float32. Pure — no torch required."""
    from app.repo.qwen_chapters import dtype_name_for_device

    assert dtype_name_for_device("cuda") == "float16"
    assert dtype_name_for_device("mps") == "float16"
    assert dtype_name_for_device("cpu") == "float32"
    assert dtype_name_for_device("") == "float32"
