<!-- last_verified: 2026-06-30 -->
# App Workflows

User journeys inside the application.

## Chapterize a Video (primary journey)

- User navigates to `/library` (the scoped video explorer)
- **Add a video**: clicks "Add video", picks a short clip, submits. It uploads
  to B2 under `library/source/` and appears as a card. (Large production videos
  can be dropped directly into B2 under `library/source/` and show up too.)
- Opens the video detail page `/library/[videoId]`
- Clicks **Chapterize**, picks sampling (`scene-change` | `interval`), max
  chapters (4 / 8 / 12) and model — all selectors, pre-filled with the last-used
  settings on a re-run
- The blaze `generating-loader` runs while ffmpeg samples keyframes and
  Qwen2.5-VL generates chapters locally (first run downloads the model)
- On success: the video player, a chapter timeline, keyframe thumbnails and a
  summary appear; thumbnails + chapter JSON are now in B2
- **Browse + jump-to**: clicking any chapter seeks the player to its start
- **Edit**: opens the inline editor to correct titles + summary → `PATCH`
  rewrites the meta JSON in B2
- **Delete**: per-card or detail delete (with confirm) removes the source,
  thumbnails and meta — scoped to that video's prefixes only
- See: [Chapter Library](features/chapter-library.md),
  [Chapter Generation](features/chapter-generation.md)

## Upload Files

- User navigates to `/upload`
- Drops or selects files in the dropzone
- Client validates file size (max 100MB) and type
- Progress bar shows per-file upload status
- On success: toast notification, green checkmark
- On failure: red status icon with error message
- User can clear completed uploads
- See: [File Upload](features/file-upload.md)

## Browse and Manage Files

- User navigates to `/files`
- Page loads file list from API (sorted most recent first)
- Files displayed in tree view with folders and type-specific icons
- Top-level folders auto-expand on load
- Hover a file row to see action buttons (preview / download / delete)
- **Preview**: opens dialog with image/PDF preview + metadata panel
- **Download**: fetches presigned URL, browser downloads file
- **Delete**: removes file from B2, row removed from tree, toast confirms
- Empty bucket shows "No files found" with upload prompt
- See: [File Browser](features/file-browser.md)

## View Dashboard

- User navigates to `/` (home)
- Three parallel API calls load from the index manifest: stats, recent
  chapterizations, per-day chapter activity
- Stats cards show: videos in library, chapters generated, thumbnails stored,
  derived-artifact size in B2
- The chart shows chapters generated per day as a bar chart
- The recent-chapterizations table links to each video's detail page
- Empty state: "No chapters yet" messages
- See: [Dashboard](features/dashboard.md)
