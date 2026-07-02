<!-- last_verified: 2026-07-02 -->
# Feature: Chapter Generation (Qwen2.5-VL, local)

## Purpose
Turn a sampled keyframe sequence (plus an optional transcript) into chapter
boundaries, titles, and a summary — the marquee capability of this app.

## Used By
- UI: "Chapterize / Re-run chapters" on `/library/[videoId]`
- API: `POST /library/{id}/chapterize`
- Service: `service/chapters.py`

## Core Functions
- `services/api/app/repo/qwen_chapters.py`
  - `generate(frames, duration_sec, transcript, max_chapters, model_id)` → JSON dict
  - `select_device(override)` — CUDA → MPS → CPU autodetect
  - `parse_model_json(text)` — defensive JSON parse (pure, unit-testable)
  - `_load_model(model_id, device)` — cached once (`lru_cache`)
- `services/api/app/service/chapters.py` — orchestrates the full pipeline

## Canonical Files
- `services/api/app/repo/qwen_chapters.py`

## Inputs
- frames: `[(timestamp_sec, frame_path)]` from keyframe extraction
- duration_sec: float
- transcript: optional text (from `library/source/<id>.txt|.srt`)
- max_chapters: int (Select-bound to 4 / 8 / 12 in the UI)
- model_id: str (default `Qwen/Qwen2.5-VL-3B-Instruct`, ungated)

## Outputs
- `{"chapters": [{start_sec, end_sec, title, summary}], "summary": "..."}`
- Side effects (via the service): thumbnails + `library/meta/<id>.json` +
  `library/index.json` written to B2

## Flow
- The ML stack (torch / transformers / qwen_vl_utils) is **lazy-imported inside
  the function** so the app stays importable without it.
- Device autodetect (override with `QWEN_DEVICE`); `torch_dtype` is float16 on
  GPU-class backends (CUDA **and** Apple MPS) to halve memory, float32 on CPU.
  Loading on MPS that fails falls back to CPU.
- Per-frame resolution is capped at `QWEN_MAX_PIXELS` (default `256*28*28`,
  ~448px) before the vision encoder — a full-res 16-frame prompt would
  otherwise explode the vision-token count and OOM on MPS/GPU. On MPS the
  allocation pool is released (`torch.mps.empty_cache()`) before each run so
  re-runs don't accumulate toward the memory ceiling.
- A single multi-image chat message is built (each frame tagged with its
  timestamp) + the optional transcript; the model is asked for a JSON object.
- The output JSON is parsed defensively and coerced into `Chapter` models.
- **Real inference only** — no simulated, mock, or random chapters.

## Edge Cases
- Model returns fenced / prose-wrapped JSON → stripped before parsing
- Invalid JSON / missing `chapters` → `ValueError` → 500 with a clear message
- No GPU → runs on CPU (slower); never hard-requires CUDA
- First run → downloads model weights (a few GB) from the Hugging Face Hub

## UX States
- Running: blaze `generating-loader` with a "model download on first run" note
- Error: toast with the failure detail
- Done: the timeline, thumbnails and summary populate

## Verification
- Test files: `services/api/tests/test_chapters_lazy.py`
- Required cases: no torch at module load (lazy guard), JSON parse of fenced
  output, garbage input rejected
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- End-to-end (real model): install `requirements-ml.txt`, add a short clip, and
  run Chapterize from the UI — expect real chapter titles + thumbnails in B2.
- Pass criteria: lazy-import + parse tests green without the ML stack; a real run
  produces non-empty chapters and artifacts under `library/`

## Related Docs
- [Keyframe Extraction](keyframe-extraction.md)
- [Chapter Library](chapter-library.md)
- [Dev Workflows](../dev-workflows.md)
