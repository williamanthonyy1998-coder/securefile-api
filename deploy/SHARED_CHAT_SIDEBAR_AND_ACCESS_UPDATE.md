# Shared + Chat UI Fix

## Chat
- Fixed the nested chat sidebar being treated as the application's fixed navigation sidebar.
- The main SecureFile navigation now remains visible on Chat pages.
- Chat's People/Groups panel remains inside the content area.
- Responsive behavior keeps the application navigation separate from the chat contact list.

## Shared
- Added an access-management action for each share.
- Owners can change View, Download, Upload, Edit, Delete and Share permissions.
- View is always retained so an existing share cannot be accidentally made unusable from the management dialog.
- Added optional expiration editing.
- Added revoke-access action with confirmation.
- Existing backend PATCH /api/sharing/:id endpoint is used; no new database migration is required.
