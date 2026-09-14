# SecureFile Public Sharing + UI/UX Fix — 2026-09-14

## Fixed
- Public file preview/download requests now support `X-Share-Password` through the API CORS allow-list. This fixes browser `Failed to fetch` errors on password-protected public shares.
- Public file download remains server-side permission checked by `canDownload`.
- Public file preview remains server-side permission checked by `canView`.
- Public sharing is restricted to files; crafted public-folder creation requests are rejected by the backend.
- Public shares cannot grant anonymous upload/edit/delete/re-share permissions; those remain internal workspace capabilities.
- Public share preview/download responses use private/no-store cache headers and `nosniff`.
- Passwordless public file links open automatically; protected links fall back to the password gate.
- Public share UI only exposes View/Download permission badges for file shares.
- Folder public-share links remain a sign-in gate and provide the SecureFile login link.
- File/folder action menus are rendered in a body portal so sidebar/table overflow cannot clip them; the menu auto-positions above/below the trigger.
- Files table uses fixed responsive columns and long filenames/types cannot create page-wide horizontal scrolling.
- Folder sidebar heading/root area stays fixed while the folder list receives its own vertical scrollbar.
- Global select/input/modal overflow styling was tightened for consistent responsive UX.
- Existing professional confirmation/prompt/alert system remains in place; native browser dialog calls were checked and none remain in frontend source.
