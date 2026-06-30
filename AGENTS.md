<!-- last_verified: 2026-06-25 -->
# AGENTS.md

This is the authoritative control surface for all coding agents. Read this first.

## 1. Repository Map

```
apps/web/          Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
  src/app/library/         Scoped video Library: list + [videoId] detail
  src/components/library/  library-grid, add-video-form, video-player,
                           chapter-timeline, chapter-editor, summary-panel,
                           run-chapters-form, thumbnail
services/api/      FastAPI backend (layered: types/config/repo/service/runtime)
  app/types/chapters.py        Pydantic models (Chapter, VideoChapters, ...)
  app/repo/keyframes.py        ffmpeg keyframe extraction (bundled imageio-ffmpeg)
  app/repo/qwen_chapters.py    Qwen2.5-VL adapter (lazy ML imports, real inference)
  app/service/library.py       Scoped library list / ingest / scoped delete
  app/service/chapters.py      Chapterize orchestration + edit
  app/service/index_manifest.py  Read/upsert library/index.json
  app/runtime/chapters.py      /library routes (CRUD + chapterize)
  requirements-ml.txt          Pinned heavy ML/media stack (separate install)
packages/shared/   Shared TypeScript types
docs/              System of record (features, workflows, security, reliability)
docs/exec-plans/   Execution plans and tech debt tracker
infra/railway/     Deployment config
```

## 2. App Surfaces (built on the starter scaffolding)

This app is `qwen-video-chapters`. It keeps the reusable starter scaffolding and
adds one app-specific surface (the scoped video **Library** + chapter browser).

**Kept starter scaffolding (do not strip, rename, or replace)**
- **UI kit / design system.** `apps/web/src/components/ui/` (shadcn primitives), the design tokens in `apps/web/src/app/globals.css`, and the `/design` reference page. Build new screens with these primitives; never edit the generated `components/ui/` files directly. Restyling happens through tokens in `globals.css`.
- **Full-bucket File Explorer.** `/files` route, `apps/web/src/app/files/`, and `apps/web/src/components/files/`. This is the unscoped, browse-everything view — it stays even though this app also adds its own scoped Library explorer. The Files sidebar entry stays.
- **Upload.** `/upload` route, `apps/web/src/app/upload/`, and `apps/web/src/components/upload/`. The reusable generic B2 ingest surface; the video-specific "Add to Library" ingest is additive, not a replacement. The Upload sidebar entry stays.
- The sidebar nav itself (Dashboard, Library, Upload, Files, Settings, plus the Design System utility link).

**App-specific surface**
- **Library.** `/library` (scoped to `library/source/`) + `/library/[videoId]` detail. Add / read / run (chapterize) / edit / delete a Library Video — all five verbs are user-accessible. New endpoints touch `runtime/chapters.py`, `lib/api-client.ts`, `lib/queries.ts`.
- **Dashboard.** `/` route and `apps/web/src/components/dashboard/` are adapted to chapterization metrics read from `library/index.json` via `/library/stats`, `/library/activity`, `/library/recent`. New aggregations flow through `runtime -> service -> repo` and TanStack Query hooks — no bare `useEffect + fetch`. Update `docs/features/dashboard.md` in the same PR as any dashboard change (see §9).

**Why the kept scaffolding matters**
- The UI kit, full-bucket Files explorer, and Upload pages are the reusable B2-backed scaffolding — stripping them defeats the purpose. The scoped Library is additive on top of, not a replacement for, the full-bucket explorer.

## 3. Architectural Invariants

**Backend layering**: `types` -> `config` -> `repo` -> `service` -> `runtime`

- No backward imports across layers
- No `boto3` outside `repo/`
- No business logic in route handlers (`runtime/`)
- All external APIs wrapped in `repo/` adapters
- All request/response data validated at boundary (Pydantic models)
- No shared mutable state across layers
- **ML stack is lazy-imported.** torch / transformers / qwen_vl_utils / imageio-ffmpeg are imported INSIDE functions in `repo/qwen_chapters.py` and `repo/keyframes.py`, never at module top. This keeps `from main import app`, structural tests, lint and the frontend build green WITHOUT the heavy stack installed (it lives in `requirements-ml.txt`). A test asserts no torch import at module load — do not move these imports to module scope.

**Frontend**: shadcn/ui components in `src/components/ui/` are generated — never modify them.

**Data fetching**: every API call flows through TanStack Query hooks in `apps/web/src/lib/queries.ts`. No bare `useEffect + fetch` patterns. New endpoints touch three files: `runtime/<router>.py`, `lib/api-client.ts`, `lib/queries.ts`.

## 4. Quality Expectations

- **DRY** — do not duplicate logic, types, or constants. Extract shared code only when used in 2+ places.
- Structured JSON logging only — no `print()` statements
- No raw SDK calls outside `repo/` layer
- Files stay under 300 lines
- Tests added or updated for every behavior change
- Docs updated in same PR as code changes
- Lint clean before merge
- Prefer boring, composable libraries over clever abstractions
- No implicit type assumptions — use typed models

## 5. Mechanical Enforcement

| Rule | Enforced by |
|------|-------------|
| No backward imports | `tests/test_structure.py::test_no_backward_imports` |
| No boto3 outside repo/ | `tests/test_structure.py::test_boto3_only_in_repo` |
| File size < 300 lines | `tests/test_structure.py::test_file_size_limits` |
| All layers exist | `tests/test_structure.py::test_all_layers_exist` |
| No bare print() | `ruff` rule T20 |
| Import ordering | `ruff` rule I001 |
| Frontend strict equality | `eslint` rule eqeqeq |
| No unused vars | `eslint` + `ruff` rules |

## 6. Commands

```bash
# Run
pnpm dev               # start both frontend and backend
pnpm dev:web           # frontend only
pnpm dev:api           # backend only

# Test & Lint
pnpm lint              # frontend lint (eslint)
pnpm build             # frontend type check + build
pnpm lint:api          # backend lint (ruff)
pnpm test:api          # backend tests (pytest)
pnpm check:structure   # structural boundary tests
pnpm test:e2e          # Playwright e2e tests
```

## 7. Agent Workflow

1. Read this file first.
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) before structural changes.
3. For non-trivial changes, create a plan in `docs/exec-plans/active/`.
4. Implement the smallest coherent change.
5. Run: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
6. Update docs in the same PR (see §9).
7. Move completed plans to `docs/exec-plans/completed/`.
8. Only change files relevant to the task. No drive-by improvements.

## 8. Frontend Conventions

See [docs/dev-workflows.md](docs/dev-workflows.md) for full details.

## 9. Doc Update Mapping

| Change Type | Update Location |
|-------------|-----------------|
| Feature logic, inputs, outputs, tests | `docs/features/<feature>.md` |
| User journeys | `docs/app-workflows.md` |
| System layout, deployments | `ARCHITECTURE.md` |
| Dev or testing process | `docs/dev-workflows.md` |
| Setup or scope changes | `README.md` |
| Security changes | `docs/SECURITY.md` |
| Reliability changes | `docs/RELIABILITY.md` |
| Active work plans | `docs/exec-plans/active/` |
| Known tech debt | `docs/exec-plans/tech-debt-tracker.md` |

If documentation and implementation conflict, update docs in the same PR. Documentation rot destroys agent reliability.

## 10. Doc Map

| Topic | Location |
|-------|----------|
| System layout, data flows, boundaries | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Feature docs | [docs/features/](docs/features/) |
| User journeys | [docs/app-workflows.md](docs/app-workflows.md) |
| Engineering workflows and testing | [docs/dev-workflows.md](docs/dev-workflows.md) |
| Security principles | [docs/SECURITY.md](docs/SECURITY.md) |
| Reliability expectations | [docs/RELIABILITY.md](docs/RELIABILITY.md) |
| Execution plans | [docs/exec-plans/](docs/exec-plans/) |
| Tech debt | [docs/exec-plans/tech-debt-tracker.md](docs/exec-plans/tech-debt-tracker.md) |

## 11. When Unsure

- Prefer boring, stable libraries
- Prefer small PRs over large changes
- Add tests with every change
- Never bypass lint rules without explicit instruction
- Ask before making destructive or irreversible changes
