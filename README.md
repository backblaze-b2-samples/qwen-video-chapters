<!-- last_verified: 2026-06-30 -->
# Qwen Video Chapters

Make long-form video navigable without manual editing. Drop a source video into
**[Backblaze B2](https://www.backblaze.com/sign-up/ai-cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-qwen-video-chapters)**,
and this app extracts keyframes with ffmpeg, runs **Qwen2.5-VL locally** over the
sampled frame sequence (optionally augmented by a transcript sidecar), and
produces chapter boundary timestamps, chapter titles, keyframe thumbnails, and a
structured summary — every derived artifact stored back in B2. A chapter-timeline
browser with jump-to controls turns a flat clip into a navigable asset.

It is built for e-learning platforms, documentary distributors, and enterprise
training teams. **The vision model runs on-device — there is no second API key.
Backblaze B2 credentials are the only secret you need.**

## What it demonstrates

**B2 is the storage layer for source video, extracted keyframes, and every
derived artifact**, accessed through the S3-compatible API with a custom user
agent and the standard `B2_*` env vars.

A single long-form video fans out into dozens of thumbnails plus a chapter JSON.
A 5,000-video library becomes tens of thousands of derived objects and many GB
in B2 — exactly the data-heavy, AI-generated workload object storage is for.

| Prefix | Contents |
|--------|----------|
| `library/source/<video_id>.<ext>` | Source video |
| `library/source/<video_id>.txt` / `.srt` | Optional transcript sidecar (read-only input) |
| `library/thumbs/<video_id>/NNN.jpg` | Keyframe thumbnails |
| `library/meta/<video_id>.json` | Chapter metadata + summary |
| `library/index.json` | Combined manifest (powers the timeline list + dashboard stats) |

S3 operations exercised: `PutObject`, `GetObject`, `ListObjectsV2`,
`HeadObject`, `DeleteObject`, and `generate_presigned_url` (video playback +
thumbnail display). **No b2-native API.**

## Features

- **[Keyframe extraction](docs/features/keyframe-extraction.md)** — interval and
  scene-change sampling via the bundled imageio-ffmpeg binary, capped for demo
  feasibility.
- **[Chapter generation with Qwen2.5-VL (local)](docs/features/chapter-generation.md)**
  — the marquee capability. The vision model reads the keyframe sequence (plus an
  optional transcript) and emits chapter boundaries, titles and a summary as
  JSON. Runs on-device; **$0 per run, no API key**.
- **[B2-backed chapter library + browser](docs/features/chapter-library.md)** —
  the scoped `/library` explorer plus a detail page with a video player, chapter
  timeline, jump-to controls and thumbnails.
- **Editable AI output** — content-ops users correct chapter titles and the
  summary; the change is written back to the meta JSON in B2.
- **Combined index manifest** — one `library/index.json` powers both the
  front-end timeline and the dashboard stats, so neither rescans the bucket.
- **[Full-bucket explorer](docs/features/file-browser.md) + [generic upload](docs/features/file-upload.md)**
  — the reusable B2-backed surfaces kept from the starter scaffolding.

## Model setup (local, on-device)

Chapter generation runs **Qwen2.5-VL via Hugging Face transformers on your own
machine** — no inference API, no per-call cost.

- **Default model:** `Qwen/Qwen2.5-VL-3B-Instruct` (ungated; no HF token needed).
  A larger variant can be selected per run; gated/large variants would require a
  Hugging Face token.
- **Device autodetect:** CUDA → Apple MPS → CPU, in that order, with a
  **CPU default**. Override with `QWEN_DEVICE` (`cpu` / `cuda` / `mps`). Qwen2.5-VL
  MPS support is partial — the app automatically falls back to CPU if loading on
  MPS fails.
- **First run downloads the model** (a few GB) from Hugging Face; subsequent runs
  reuse the cache. On CPU a demo run takes a while — keep the clip short.

> **Demo vs production.** The chapterize endpoint is synchronous and caps the
> keyframes fed to the model (`MAX_KEYFRAMES`, default 16) for a short clip. A
> production deployment would use a job queue and a GPU for multi-hour videos.

## Quick Start

You need: Node.js >= 20, pnpm >= 9, Python >= 3.11, and a free
**[Backblaze B2 account](https://www.backblaze.com/sign-up/ai-cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-qwen-video-chapters)**.

**1. Install dependencies**

```bash
pnpm install
```

**2. Set up the backend**

```bash
cd services/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# The heavy ML/media stack is separate (kept out of the core install so the
# app, tests and lint stay fast). Install it before your first chapterize:
pip install -r requirements-ml.txt
cd ../..
```

**3. Add your B2 credentials**

```bash
cp .env.example .env
```

Open `.env`, then head to the
[Backblaze B2 dashboard](https://secure.backblaze.com/b2_buckets.htm?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-qwen-video-chapters)
and:

1. **Create a bucket.** Paste each value into `.env`:
   - **Bucket Unique Name** → `B2_BUCKET_NAME`
   - The region segment of the **Endpoint** (e.g. `us-west-004`) → `B2_REGION`
     (the app derives the endpoint URL `https://s3.{B2_REGION}.backblazeb2.com`).
2. **Create an application key** with `Read and Write` permission. Paste each
   value into `.env`:
   - **keyID** → `B2_APPLICATION_KEY_ID`
   - **applicationKey** → `B2_APPLICATION_KEY` *(only shown once — paste it now)*

> Walkthroughs: [creating a bucket](https://www.backblaze.com/docs/cloud-storage-create-and-manage-buckets?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-qwen-video-chapters)
> and [creating app keys](https://www.backblaze.com/docs/cloud-storage-create-and-manage-app-keys?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-qwen-video-chapters).

**4. Run it**

```bash
pnpm dev
```

Frontend at `localhost:3000`, API at `localhost:8000`. Open **Library**, add a
short clip (or drop one into B2 under `library/source/`), then **Chapterize** it.

`pnpm dev` runs `pnpm doctor` first — a preflight check that catches the common
setup gotchas (wrong Node/Python version, missing venv, missing or placeholder
`.env`, ports already taken). Run it standalone any time with `pnpm doctor`.

## Architecture at a glance

```
apps/web/          Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
services/api/      FastAPI backend (layered: types/config/repo/service/runtime)
packages/shared/   Shared TypeScript types
docs/              System of record (features, workflows, security, reliability)
```

The backend keeps a strict layering — `types -> config -> repo -> service ->
runtime` — verified by structural tests. `boto3` lives only in `repo/`. The ML
stack (torch / transformers / qwen-vl-utils / imageio-ffmpeg) is **lazy-imported
inside functions** in `repo/qwen_chapters.py` and `repo/keyframes.py`, so the app
imports, lint, structural tests and the frontend build all pass without it
installed. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Tech Stack

- TypeScript, Next.js 16, React 19, Tailwind v4, shadcn/ui, Recharts
- TanStack Query — caching, dedup, retry for every fetch
- Python 3.11+, FastAPI, boto3, Pydantic v2
- **Qwen2.5-VL** (Alibaba) via Hugging Face transformers — local, on-device
- ffmpeg via the bundled `imageio-ffmpeg` binary
- Backblaze B2 (S3-compatible object storage)
- pnpm workspaces (monorepo)

## Commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start frontend + backend |
| `pnpm dev:web` | Frontend only |
| `pnpm dev:api` | Backend only |
| `pnpm build` | Build frontend |
| `pnpm lint` | Lint frontend |
| `pnpm lint:api` | Lint backend (ruff) |
| `pnpm test:api` | Run backend tests |
| `pnpm check:structure` | Verify layering rules |
| `pnpm test:e2e` | Playwright e2e tests (run `pnpm --filter @qwen-video-chapters/web exec playwright install chromium` once first) |

## Documentation Map

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](AGENTS.md) | Agent table of contents — start here |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System layout, layering, data flows |
| [docs/features/](docs/features/) | Feature docs (keyframes, chapters, library, upload, browser) |
| [docs/design-system.md](docs/design-system.md) | Design tokens, primitives, loader, error/empty states |
| [docs/app-workflows.md](docs/app-workflows.md) | User journeys |
| [docs/dev-workflows.md](docs/dev-workflows.md) | Engineering workflows, ML install, device knobs |
| [docs/SECURITY.md](docs/SECURITY.md) | Security principles |
| [docs/RELIABILITY.md](docs/RELIABILITY.md) | Reliability expectations |

## License

MIT License - see [LICENSE](LICENSE) for details.

## Claude Agent B2 Skill

Manage Backblaze B2 from your terminal using natural language (list/search,
audits, stale or large file detection, security checks, safe cleanup).

Repo: [https://github.com/backblaze-b2-samples/claude-skill-b2-cloud-storage](https://github.com/backblaze-b2-samples/claude-skill-b2-cloud-storage)
