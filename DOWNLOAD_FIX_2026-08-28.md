# SecureFile Download Fix — 2026-08-28

## What changed

Private file downloads in the web app now use the authenticated SecureFile API download endpoint and download the returned response as a browser Blob.

Updated:
- `frontend/src/lib/api.ts`
  - Added `downloadPrivateFile()`.
  - Sends the existing JWT and tenant header.
  - Uses `/api/files/:id/download`.
  - Preserves the filename from `Content-Disposition` when available.
- `frontend/src/pages/Files.tsx`
  - File-list Download button now uses `downloadPrivateFile()`.
- `frontend/src/pages/FileViewer.tsx`
  - Viewer Download buttons now use `downloadPrivateFile()`.

## Why

The previous UI opened a Supabase signed URL directly. That could result in a storage `requested path is invalid` page instead of downloading the file. The backend already has an authenticated `/files/:id/download` endpoint which checks permissions and streams the private object, so the UI now uses that reliable path.

No database schema, authentication, invitation flow, pricing, sharing, notification, or existing storage data was changed by this fix.
