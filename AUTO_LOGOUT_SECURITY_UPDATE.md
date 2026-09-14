# SecureFile — Automatic Session Logout

Implemented live account validation for authenticated sessions.

## Behavior
- Deleted users are immediately rejected on their next authenticated API request.
- Suspended users are immediately rejected on their next authenticated API request.
- Any non-ACTIVE user status is rejected.
- Unverified users with an existing token are rejected.
- The backend now uses the current database role/company/email instead of stale JWT role claims.
- Frontend clears the authenticated session and redirects to `/login` when the API returns 401 for an existing session.
- Active sessions are revalidated every 30 seconds and whenever the browser window regains focus, so an idle suspended/deleted user is automatically logged out.
- Existing subscription behavior is unchanged: inactive subscriptions continue to use the existing view-only flow rather than forcibly logging users out.

## Files changed
- `backend/src/middleware/auth.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/axios.ts`
- `frontend/src/components/Layout.tsx`
