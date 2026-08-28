# Role Sidebar + Original Filename Download Fix

- SUPER_ADMIN sidebar: Companies + Logout only.
- SUPER_ADMIN is redirected away from tenant pages.
- COMPANY_ADMIN: full company administration workspace.
- EMPLOYEE: company workspace without User Management.
- CLIENT: client-facing workspace only.
- Downloads use the file record name as the authoritative browser filename.
- Content-Disposition is exposed for cross-origin API clients.
- Root .env overrides stale backend/.env values.
