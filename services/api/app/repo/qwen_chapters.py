"""Qwen2.5-VL chapter-generation adapter (local, on-device).

ALL heavy deps (torch, transformers, qwen_vl_utils) are imported lazily INSIDE
functions — never at module top — so the app stays importable and structural
tests / lint / build run without the ML stack installed. Real inference only:
the model reads the keyframe sequence (+ optional transcript) and emits chapter
boundaries, titles and a summary as JSON. No simulation / mock / placeholder.
"""

import functools
import json
import logging
import re

from app.config import settings

logger = logging.getLogger(__name__)

_PROMPT = (
    "You are a video-chaptering assistant. You are given an ordered sequence of "
    "keyframes sampled from a single video; each frame is labelled with its "
    "timestamp in seconds. {transcript_note}Divide the video into at most "
    "{max_chapters} coherent chapters that follow the visual narrative. "
    "Respond with ONLY a JSON object (no prose, no markdown fences) of the form:\n"
    '{{"chapters": [{{"start_sec": <number>, "end_sec": <number>, '
    '"title": "<short title>", "summary": "<one sentence>"}}], '
    '"summary": "<2-3 sentence overall summary>"}}\n'
    "Timestamps must be within the video duration of {duration} seconds and "
    "non-overlapping in order."
)


def select_device(override: str = "") -> str:
    """Return the inference device. Autodetect order: CUDA -> Apple MPS -> CPU.

    An explicit override (env QWEN_DEVICE) wins. Never hard-requires a GPU.
    """
    if override:
        return override
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        # Qwen2.5-VL MPS support is partial; we still prefer it over CPU when
        # present and fall back to CPU automatically if loading raises.
        return "mps"
    return "cpu"


def dtype_name_for_device(device: str) -> str:
    """Pick the torch dtype (by name) for a device.

    float16 on GPU-class backends (CUDA / Apple MPS) to halve weight +
    activation memory and avoid OOM; float32 on CPU where fp16 is slow and many
    ops are unsupported. Pure + unit-testable without torch installed.
    """
    return "float16" if device in ("cuda", "mps") else "float32"


@functools.lru_cache(maxsize=1)
def _load_model(model_id: str, device: str):
    """Load + cache the model and processor once. Heavy imports live here."""
    import torch
    from transformers import AutoProcessor, Qwen2_5_VLForConditionalGeneration

    dtype = getattr(torch, dtype_name_for_device(device))
    logger.info("Loading Qwen2.5-VL model=%s device=%s dtype=%s", model_id, device, dtype)
    model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        model_id, torch_dtype=dtype
    )
    model = model.to(device)
    model.eval()
    # Cap per-frame resolution so a full-res keyframe sequence can't explode the
    # vision-token count (and MPS/GPU memory). See settings.qwen_max_pixels.
    processor = AutoProcessor.from_pretrained(
        model_id, max_pixels=settings.qwen_max_pixels
    )
    return model, processor


def _build_messages(
    frames: list[tuple[float, str]], transcript: str | None, max_chapters: int,
    duration: float,
) -> list[dict]:
    content: list[dict] = []
    for ts, path in frames:
        content.append({"type": "text", "text": f"[frame @ {ts:.1f}s]"})
        content.append({"type": "image", "image": f"file://{path}"})
    transcript_note = ""
    if transcript:
        snippet = transcript.strip()[:4000]
        transcript_note = (
            "A transcript of the audio is also provided for context. "
        )
        content.append({"type": "text", "text": f"Transcript:\n{snippet}"})
    content.append({
        "type": "text",
        "text": _PROMPT.format(
            transcript_note=transcript_note,
            max_chapters=max_chapters,
            duration=round(duration, 1),
        ),
    })
    return [{"role": "user", "content": content}]


def parse_model_json(text: str) -> dict:
    """Defensively parse the model's JSON output (may be fenced / have prose)."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        cleaned = cleaned[start : end + 1]
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"Model did not return valid JSON: {e}") from e
    if not isinstance(data, dict) or "chapters" not in data:
        raise ValueError("Model JSON missing 'chapters' field")
    return data


def generate(
    frames: list[tuple[float, str]],
    *,
    duration_sec: float,
    transcript: str | None = None,
    max_chapters: int = 8,
    model_id: str | None = None,
) -> dict:
    """Run real Qwen2.5-VL inference over the keyframes and return parsed JSON
    of {"chapters": [...], "summary": "..."}. Raises on inference/parse failure.
    """
    import torch
    from qwen_vl_utils import process_vision_info

    mid = model_id or settings.qwen_model_id
    device = select_device(settings.qwen_device)
    try:
        model, processor = _load_model(mid, device)
    except (RuntimeError, NotImplementedError) as e:
        if device != "cpu":
            logger.warning("Load on %s failed (%s); retrying on CPU", device, e)
            device = "cpu"
            model, processor = _load_model(mid, device)
        else:
            raise

    messages = _build_messages(frames, transcript, max_chapters, duration_sec)
    text = processor.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    image_inputs, video_inputs = process_vision_info(messages)
    inputs = processor(
        text=[text],
        images=image_inputs,
        videos=video_inputs,
        padding=True,
        return_tensors="pt",
    ).to(device)

    # Release any pool retained from a prior run so a re-run starts from a clean
    # MPS allocation ceiling rather than accumulating toward OOM.
    if device == "mps":
        torch.mps.empty_cache()
    with torch.no_grad():
        generated = model.generate(**inputs, max_new_tokens=1024, do_sample=False)
    trimmed = [
        out[len(inp):] for inp, out in zip(inputs.input_ids, generated, strict=False)
    ]
    decoded = processor.batch_decode(
        trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
    )[0]
    logger.info("Qwen output (%d chars)", len(decoded))
    return parse_model_json(decoded)
