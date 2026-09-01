# SecureFile Fast API / Realtime Update — 2026-09-01

## What changed
- Normal authenticated API requests no longer perform a database User lookup just to validate the signed 7-day JWT. This removes one DB round-trip from essentially every request.
- JWT now contains the user's email as well as id/role/companyId.
- Login returns subscription plan/add-on metadata, so a fresh session does not need an extra `/companies/me` request just to build the navigation.
- Notification polling is removed from the browser. Notifications use one SSE connection and server push. Reconnect performs one unread synchronization.
- Notification SSE server has no database polling loop. It only sends a heartbeat to keep the stream alive.
- Browser GET requests are briefly deduplicated/cached; write requests invalidate that cache.
- Dashboard stats were reduced from five independent database queries to one company query with relation counts plus one unread count.
- Files/folders use short private cache headers; frontend writes invalidate its GET cache.

## Session behavior
- Access token lifetime: 7 days.
- When the token expires or an authenticated API returns 401, the frontend clears the session and redirects to `/login`.

## Security trade-off
Stateless JWT validation means a user's suspension/status change is not reflected until the token expires or a server-side token-revocation mechanism is added. If immediate revocation is required later, add a sessionVersion/revocation store (Redis/database) without returning to a User DB query on every request.

## Existing mobile/desktop scanner changes
This package is based on the latest mobile scanner/mobile navigation project and retains those changes.
