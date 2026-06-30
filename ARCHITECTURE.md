<!-- last_verified: 2026-03-10 -->
# Architecture

## Components

- **apps/web/** — Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
  - Dashboard with chapterization metrics (videos, chapters, thumbnails, B2 size)
  - Scoped video **Library** (`/library`) + detail page (player, chapter
    timeline with jump-to, thumbnails, editable titles/summary)
  - Full-bucket file browser (`/files`) + generic upload (`/upload`) — kept
    starter surfaces
  - Dark mode via `next-themes`
- **services/api/** — FastAPI backend (layered architecture)
  - REST API for the library lifecycle (list / ingest / chapterize / edit /
    scoped delete) plus the kept file upload/listing/deletion
  - B2 S3 integration via boto3
  - ffmpeg keyframe extraction (bundled imageio-ffmpeg binary)
  - **Qwen2.5-VL local inference** for chapter generation (lazy-imported ML stack)
  - Health check endpoint with B2 connectivity verification
  - Structured JSON logging with request tracing
  - Prometheus-format metrics endpoint
- **packages/shared/** — TypeScript type definitions
  - Mirrors Pydantic models from the API (Chapter, VideoChapters, LibraryVideo, ...)
  - Consumed by `apps/web/` as workspace dependency

## Backend Layering

The API follows a strict layered architecture:

```
types/     Pydantic models — no logic, no imports from other layers
  |
config/    Settings (pydantic-settings) — depends only on types
  |
repo/      Data access (boto3 B2 client) — no business logic
  |
service/   Business logic — calls repo, returns types
  |
runtime/   FastAPI routes — calls service, never repo directly
```

### Layering Rules

1. Dependencies flow downward only: `types` -> `config` -> `repo` -> `service` -> `runtime`
2. No backward imports (e.g., service must not import from runtime)
3. `boto3` only allowed in `repo/` layer
4. All boundary data uses Pydantic models (no raw dicts across layers)
5. Each file stays under 300 lines

### Directory Structure

```
services/api/
  main.py                  App entrypoint, middleware, router registration
  requirements.txt         Core deps (fast install; keeps app/tests/lint green)
  requirements-ml.txt      Pinned heavy ML/media stack (torch, transformers,
                           qwen-vl-utils, accelerate, imageio-ffmpeg) — separate
  app/
    types/                 Pydantic models (chapters.py, files.py, ...)
    config/                Settings loaded from environment
    repo/                  Data access — boto3 (b2_client.py), ffmpeg
                           (keyframes.py), Qwen2.5-VL (qwen_chapters.py)
    service/               Business logic (library, chapters, index_manifest,
                           upload, files, metadata)
    runtime/               FastAPI route handlers (chapters.py = /library, ...)
  tests/                   pytest tests (structural + integration + lazy-import guard)
```

### ML lazy-import boundary

`repo/qwen_chapters.py` and `repo/keyframes.py` import torch / transformers /
qwen_vl_utils / imageio_ffmpeg **inside functions only**, never at module top.
This is a hard invariant: it keeps `from main import app`, structural tests,
ruff and the frontend build green WITHOUT the heavy `requirements-ml.txt` stack
installed. `tests/test_chapters_lazy.py` asserts no torch import at module load.

## Boundary Invariants

- **No external SDK leakage**: `boto3` is only imported in `app/repo/`. All other layers interact with B2 through the repo interface.
- **No raw dicts at boundaries**: All data crossing layer boundaries uses typed Pydantic models.
- **No mutable globals**: Configuration is read-only after init. No module-level mutable state shared between layers.
- **Validated inputs**: All HTTP inputs validated by FastAPI/Pydantic. All file keys validated against prefix allowlist.

## Deployment

- **Local dev** — `pnpm dev` runs both services via `concurrently`
  - Web: `localhost:3000`
  - API: `localhost:8000`
- **Railway** — two services from the same repo
  - See `infra/railway/README.md` for configuration

## Data Stores

- **Backblaze B2** — object storage (S3-compatible API). The sole data store —
  no application database.
  - Source video, transcript sidecars, keyframe thumbnails and chapter metadata
    all live under the `library/` prefix (see README for the prefix table).
  - `library/index.json` is a combined manifest used as the fast read path for
    both the front-end timeline list and the dashboard stats (avoids rescanning
    the bucket per request).
  - Listing/metadata via S3 `list_objects_v2` / `head_object`; playback +
    thumbnails via presigned `get_object` URLs.

## External Services

- **Backblaze B2 S3 API** — storage, retrieval, deletion, presigned URLs
- **Qwen2.5-VL** (Alibaba) via Hugging Face transformers — runs **locally /
  on-device**, not a hosted API. First run downloads model weights from the
  Hugging Face Hub; no inference API key.

## Trust Boundaries

See [docs/SECURITY.md](docs/SECURITY.md) for full security documentation.

- **Frontend -> API** — CORS-restricted to configured origins. `CORSMiddleware` is registered LAST in `main.py` (outermost) so it wraps **every** response, including uncaught-exception 500s — otherwise the browser would block error responses and the UI would only see an opaque "network error". See [docs/RELIABILITY.md](docs/RELIABILITY.md#error-handling).
- **API -> B2** — authenticated via application keys, signature v4
- **Client -> B2** — presigned URLs for download (10-min expiry, forced attachment)

## Data Flows

### Chapterization (the marquee flow)

```
B2 library/source/<id>.mp4
   |  download_to_path (stream to temp)
ffmpeg keyframes (interval | scene-change), capped to MAX_KEYFRAMES
   |  upload each frame -> B2 library/thumbs/<id>/NNN.jpg
Qwen2.5-VL (local) reads the timestamped frame sequence (+ optional transcript)
   |  -> JSON: chapters[{start,end,title,summary}] + summary
assemble VideoChapters -> B2 library/meta/<id>.json
   |  upsert -> B2 library/index.json (manifest)
response -> UI timeline + thumbnails + summary
```

Browser -> `POST /library/{id}/chapterize` -> `runtime/chapters.py` ->
`service/chapters.py` orchestrates -> `repo/keyframes.py` + `repo/qwen_chapters.py`
+ `repo/b2_client.py`. Synchronous + frame-capped for the demo; production would
use a job queue + GPU.

### Other library flows

- **Add (ingest)**: Browser -> `POST /library` (multipart) -> service writes the
  clip to `library/source/`. Large videos can also be dropped straight into B2.
- **Read**: `GET /library` (scoped list joined with the manifest) and
  `GET /library/{id}` (parsed `library/meta/<id>.json`).
- **Edit**: `PATCH /library/{id}` -> rewrite chapters/summary in meta + manifest.
- **Delete (scoped)**: `DELETE /library/{id}` -> `delete_prefix` across that
  video's `source|thumbs|meta` prefixes only, then drop its manifest entry.
- **Playback**: `GET /library/{id}/source-url` and `/library/thumb-url` return
  presigned `get_object` URLs for the `<video>` element and thumbnails.

### Kept starter flows

- **Upload / List / Download / Delete** for the full-bucket explorer go through
  the same `runtime -> service -> repo` layering (`/upload`, `/files`).

## Observability

- Structured JSON logging on all requests with `request_id`
- Request timing middleware (logs duration per request; also the catch-all that converts uncaught exceptions to a typed JSON 500)
- `/metrics` endpoint (Prometheus format: request count, latency, upload count)
- `/health` endpoint (B2 connectivity check)

## Canonical Files

- Library routes (runtime): `services/api/app/runtime/chapters.py`
- Chapterize orchestration (service): `services/api/app/service/chapters.py`
- Library list / ingest / scoped delete: `services/api/app/service/library.py`
- ffmpeg keyframe adapter (repo): `services/api/app/repo/keyframes.py`
- Qwen2.5-VL adapter (repo): `services/api/app/repo/qwen_chapters.py`
- B2 data access (repo): `services/api/app/repo/b2_client.py`
- Pydantic models: `services/api/app/types/chapters.py` (+ `files.py`, `stats.py`)
- Config (pydantic-settings): `services/api/app/config/settings.py`
- Structural + lazy-import tests: `services/api/tests/test_structure.py`, `tests/test_chapters_lazy.py`
- Frontend API client: `apps/web/src/lib/api-client.ts`
- Library UI: `apps/web/src/components/library/`
- Shared TypeScript types: `packages/shared/src/types.ts`

## Core Features

- [Keyframe Extraction](docs/features/keyframe-extraction.md)
- [Chapter Generation (Qwen2.5-VL, local)](docs/features/chapter-generation.md)
- [Chapter Library](docs/features/chapter-library.md)
- [Dashboard](docs/features/dashboard.md)
- [File Upload](docs/features/file-upload.md) (kept starter surface)
- [File Browser](docs/features/file-browser.md) (kept starter surface)

## References

- [docs/SECURITY.md](docs/SECURITY.md) — security principles and implementation
- [docs/RELIABILITY.md](docs/RELIABILITY.md) — reliability expectations
- [AGENTS.md](AGENTS.md) — architectural invariants and agent instructions
