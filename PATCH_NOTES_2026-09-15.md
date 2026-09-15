# SecureFile UI / Notifications / Trash Patch

Based on the uploaded `securefile-production.zip`.

## Changes
- Removed transient green in-page success/error banners from authenticated workspace pages where the global side feedback system is used.
- Kept the existing professional global side alert system for API/action feedback.
- Removed duplicate success feedback for file/folder actions that already produce Socket.IO notifications, so delete/rename/move actions do not show two competing messages.
- Axios API errors now feed the same global side alert system.
- Kept Socket.IO as the only live notification transport; removed the unused legacy SSE realtime notification service.
- Hardened Trash loading with a forced fresh read so newly deleted items are not hidden by cached data.
- Hardened Trash restore type parsing and added singular/plural restore route aliases.
- Trash restore/permanent-delete requests are silent to the generic success alert so the Socket.IO notification remains the action feedback.
- Reworked Shared into a compact, professional single-row layout with `Shared with me` / `Shared by me` tabs and clear resource/sender-recipient/access information.
- File sharing exposes only View / Download / Re-share; folder sharing exposes View / Download / Upload / Delete / Re-share (no Edit).
- Added local `qrcode.d.ts` so the existing 2FA QR implementation passes strict TypeScript without requiring an extra package download.
- Added the explicit QR-code `string` callback type in Settings.

## Merge / run
The archive intentionally excludes `.git`, `node_modules`, generated build output, and real `.env` files. Keep your existing environment files.

After merging:

```bash
cd frontend
npm install
npm run build
```

For backend, run your normal install/build/deployment commands.
