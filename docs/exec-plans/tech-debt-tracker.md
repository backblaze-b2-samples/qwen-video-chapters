<!-- last_verified: 2026-07-03 -->
# Tech Debt Tracker

Known tech debt items. Agents update this when they discover or create tech debt.

The Low-priority UX items at the bottom were logged from a 2026-07-03 first-time-user
verification pass. They are non-blocking polish; the two confirmed frictions from that
pass (only one keyframe thumbnail surfaced; the chapterize route blocking the event loop)
were fixed separately, so only these nits remain.

| Description | Impact | Proposed Resolution | Priority | Status |
|---|---|---|---|---|
| `datetime.utcnow()` deprecated in Python 3.12+ | Naive datetimes, future breakage | Replace with `datetime.now(UTC)` in `repo/b2_client.py`, `service/metadata.py` | High | Resolved |
| S3 client recreated on every API call | Connection pool wasted, added latency | Cache client as module-level singleton via `lru_cache` | High | Resolved |
| `get_upload_stats()` pagination broken at 1000 objects | Stats silently wrong for large buckets | Check `IsTruncated` + use `ContinuationToken` | High | Resolved |
| `record_upload()` never called | `/metrics` always reports 0 uploads | Call from `runtime/upload.py` after successful upload | Medium | Resolved |
| Metrics counters not thread-safe | Race conditions under concurrent requests | Use `threading.Lock` (matches `service/files.py` pattern) | Medium | Resolved |
| `_humanize_bytes` duplicated in Python (repo + service) | DRY violation, drift risk | Extract to `app/types/formatting.py` shared util | Medium | Resolved |
| `humanizeBytes` duplicated in TypeScript | DRY violation | Extract to `lib/utils.ts` | Low | Open |
| `formatDate` duplicated in TypeScript | DRY violation | Extract to `lib/utils.ts` | Low | Open |
| No test harness for feature specs | No automated verification | Add pytest fixtures + test files per feature | Medium | Resolved (partial — tests added for upload, files, activity, errors) |
| Add → Chapterize does not auto-chain | After "Add to library" the user lands back on `/library` and must find the new card → open it → Chapterize (2 extra clicks) | On successful add, navigate to the new video's detail, or give the success toast a "Chapterize now" action | Low | Open (UX verify 2026-07-03) |
| Model selector duplicated across Add + Chapterize dialogs | User picks a model when adding (before thinking about inference) and again when chapterizing; redundant | Choose the model only in the Chapterize dialog (drop it from Add), or share a single control | Low | Open (UX verify 2026-07-03) |
| Chapterize in-progress indicator is an indeterminate spinner | Satisfies feedback on a warm run, but a cold first run (multi-GB model download + slow CPU) gives no how-far-along signal for minutes | Surface backend stage (extract keyframes → run model → write B2) or a determinate progress where feasible | Low | Open (UX verify 2026-07-03) |
| Dashboard "Videos in Library" counts chaptered-only | Dashboard stat and the library grid disagree on library size by the number of un-chaptered videos | Count all videos under `library/source/` for the stat, or relabel it "Chaptered videos" | Low | Open (UX verify 2026-07-03) |
| Presigned media URLs use `response-content-disposition=attachment` | In-app playback/thumbnails are fine, but opening a raw presigned URL directly forces a download instead of rendering inline | Set `ResponseContentDisposition=inline` on the player/thumbnail presigns | Low | Open (UX verify 2026-07-03) |
| Add success toast name ≠ deduped library entry | On a name-collision upload the toast names the uploaded file while the created entry is deduped (e.g. `clip.mp4` vs `clip2.mp4`); "Open it" points at a slightly different name | Have the toast reflect the actual `video_id`/title returned by the ingest response | Low | Open (UX verify 2026-07-03) |
