<!-- last_verified: 2026-06-30 -->
# Feature: Keyframe Extraction

## Purpose
Sample a small, representative set of frames from a source video so the vision
model can reason about the whole clip from a few images.

## Used By
- API: invoked inside `POST /library/{id}/chapterize`
- Service: `service/chapters.py` (the chapterize orchestration)

## Core Functions
- `services/api/app/repo/keyframes.py`
  - `extract(video_path, out_dir, mode, max_keyframes)` → `[(timestamp_sec, frame_path)]`
  - `probe_duration(video_path)` → seconds (ffmpeg banner parse)
  - `parse_duration_from_stderr(stderr)` — pure, unit-testable
  - `timestamps_for_interval(duration, count)` — pure, unit-testable

## Canonical Files
- `services/api/app/repo/keyframes.py`

## Inputs
- video_path: str (a temp file streamed down from B2)
- mode: `interval` | `scene-change`
- max_keyframes: int (default `MAX_KEYFRAMES` = 16)

## Outputs
- A list of `(timestamp_sec, frame_path)` JPEGs in a temp dir
- Side effect: the caller uploads each kept frame to `library/thumbs/<id>/NNN.jpg`

## Flow
- Resolve the **bundled** ffmpeg binary via `imageio_ffmpeg.get_ffmpeg_exe()`
  (never bare `ffmpeg` — Homebrew's is slim). Keyframe extraction needs no libass.
- `interval`: evenly spaced timestamps via `-ss` single-frame grabs
- `scene-change`: `select='gt(scene,0.4)'`, capped to `max_keyframes`; falls back
  to interval sampling when too few scene cuts are detected

## Edge Cases
- Slim/bare ffmpeg → avoided by using the bundled binary
- Very short clip with no scene cuts → interval fallback
- Duration unparseable → 0.0 (timestamps degrade gracefully)

## UX States (if applicable)
- Surfaced indirectly through the chapterize run (the `generating-loader`)

## Verification
- Test files: `services/api/tests/test_chapters_lazy.py`
- Required cases: duration parse from fabricated stderr (no real binary),
  duration-absent → None, interval timestamps ordered + capped
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: parsing tests green without ffmpeg installed

## Related Docs
- [Chapter Generation](chapter-generation.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [Dev Workflows](../dev-workflows.md)
