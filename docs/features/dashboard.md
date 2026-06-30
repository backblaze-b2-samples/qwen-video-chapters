<!-- last_verified: 2026-06-30 -->
# Feature: Dashboard

## Purpose
Give an at-a-glance overview of chapterization activity across the B2-backed
video library, read from the combined index manifest.

## Used By
- UI: `/` page (dashboard home)
- API: `GET /library/stats`, `GET /library/recent`, `GET /library/activity`

## Core Functions
- `apps/web/src/components/dashboard/stats-cards.tsx` — 4 stat cards (videos in
  library, chapters generated, thumbnails stored, derived-artifact size in B2)
- `apps/web/src/components/dashboard/recent-uploads-table.tsx` — recent
  chapterizations, linking to each video detail
- `apps/web/src/components/dashboard/upload-chart.tsx` — bar chart of chapters
  generated per day
- `apps/web/src/lib/api-client.ts` — `getLibraryStats()`, `getLibraryRecent()`,
  `getLibraryActivity()`
- `services/api/app/runtime/chapters.py` — stats / recent / activity handlers
- `services/api/app/service/library.py` — `get_stats()`, `recent_chapterizations()`,
  `chapters_over_time()`
- `services/api/app/service/index_manifest.py` — manifest read + aggregation

## Canonical Files
- Stat cards: `apps/web/src/components/dashboard/stats-cards.tsx`
- Stats aggregation: `services/api/app/service/index_manifest.py`

## Inputs
- None (dashboard loads data automatically)

## Outputs
- `GET /library/stats` → `LibraryStats` (videos_in_library, chapters_generated,
  thumbnails_stored, derived_size_bytes, derived_size_human)
- `GET /library/recent?limit=10` → `RecentChapterization[]` (newest-first)
- `GET /library/activity` → `ChapterTimePoint[]` (chapters generated per day)

## Flow
- Page loads → three parallel API calls (stats, recent, activity)
- All three read `library/index.json` once rather than rescanning the bucket
- Stat cards, the per-day chapter chart, and the recent-chapterizations table render

## Edge Cases
- API unavailable → inline error states with retry; the chart does not show a
  false zero while loading
- No videos chapterized yet → empty chart + empty table messages, zeroed cards
- Missing/corrupt manifest → treated as empty (no crash)

## UX States
- Loading: skeleton placeholders for cards, chart, and table
- Empty: "No chapters yet" / "No chapterizations yet"
- Loaded: populated cards, chart, table

## Verification
- Test files: `services/api/tests/test_library_service.py`
- Required cases: stats from a manifest, empty manifest, list/manifest join
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [Chapter Library](chapter-library.md)
- [App Workflows](../app-workflows.md)
