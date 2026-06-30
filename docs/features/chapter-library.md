<!-- last_verified: 2026-06-30 -->
# Feature: Chapter Library

## Purpose
A scoped, B2-backed browser for the app's own video assets, with a detail page
that plays the video, lists the chapter timeline with jump-to controls, and lets
content-ops users correct the AI output.

## Used By
- UI: `/library` (scoped grid) and `/library/[videoId]` (detail)
- API: `/library` CRUD + chapterize + presigned-url endpoints

## Core Functions
- `apps/web/src/components/library/library-grid.tsx` — scoped explorer + create + delete
- `apps/web/src/components/library/add-video-form.tsx` — create form (selectors + guidance)
- `apps/web/src/components/library/video-player.tsx` — `<video>` fed a presigned URL
- `apps/web/src/components/library/chapter-timeline.tsx` — jump-to chapter list
- `apps/web/src/components/library/chapter-editor.tsx` — edit titles + summary (PATCH)
- `apps/web/src/components/library/run-chapters-form.tsx` — run/re-run with selectors
- `apps/web/src/components/library/summary-panel.tsx` — structured summary + run metadata
- `services/api/app/service/library.py`, `service/chapters.py`, `service/index_manifest.py`
- `services/api/app/runtime/chapters.py`

## Canonical Files
- `apps/web/src/components/library/library-grid.tsx`
- `services/api/app/service/library.py`

## Primary entity — Library Video (all five verbs in the UI)
| Verb | UI surface | Endpoint |
|------|-----------|----------|
| create | "Add Video" form on `/library` (or drop into B2 `library/source/`) | `POST /library` |
| read | `/library` list + `/library/[videoId]` detail | `GET /library`, `GET /library/{id}` |
| run | "Chapterize / Re-run chapters" button | `POST /library/{id}/chapterize` |
| edit | Inline chapter-title + summary editor | `PATCH /library/{id}` |
| delete | Per-card / detail delete with confirm (scoped) | `DELETE /library/{id}` |

## Inputs
- create: a video file (multipart)
- run: `ChapterizeRequest` (sampling, max_chapters, model_id) — all selectors
- edit: `ChapterEdit` (chapters, summary)

## Outputs
- `LibraryVideo[]` (list), `VideoChapters` (detail/run/edit), presigned `{url}`
- Side effects in B2: source ingest, thumbnails, meta JSON, manifest upsert/remove

## Flow
- List joins `library/source/` objects with the manifest (chapter count + first
  thumbnail) without rescanning per-video meta
- Detail loads the meta JSON; if a 404 ("not chapterized yet") it shows a
  Chapterize CTA instead of an error
- Clicking a chapter seeks the player (`video.currentTime = start`)
- Delete is **scoped** — `delete_prefix` only under that video's prefixes

## Edge Cases
- Video present but never chapterized → 404 surfaced as a friendly empty state
- Non-video upload → 415 rejected by the ingest service
- Path-traversal video_id → rejected by `validate_video_id`
- Delete never targets the bucket root

## UX States
- Empty: "No videos in your library yet" with an Add CTA
- Loading: skeletons for the grid and the timeline
- Error: inline `ErrorState` with retry
- Running: blaze `generating-loader`

## Verification
- Test files: `services/api/tests/test_library_service.py`
- Required cases: video_id derivation/validation, scoped delete prefixes,
  list/manifest join, non-video rejection
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure && pnpm build`
- Pass criteria: tests green; `/library` and `/library/[videoId]` build as routes

## Related Docs
- [Chapter Generation](chapter-generation.md)
- [App Workflows](../app-workflows.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
