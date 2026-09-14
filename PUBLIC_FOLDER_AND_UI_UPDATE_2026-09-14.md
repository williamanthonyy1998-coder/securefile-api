# SecureFile — Public Folder Sharing + Workspace UI Polish

## Included
- Compact portal action menus for file/folder 3-dot actions.
- Folder menu is smaller; long file menus are vertically scrollable.
- Folder sidebar heading stays fixed while the folder tree scrolls.
- Clean create-folder bar and folder context/navigation header.
- Long filenames are ellipsized so the files table does not force page-level horizontal scrolling.
- Consistent select/input/modal styling and light entrance animations.
- Public file sharing continues to enforce View/Download permissions server-side.
- Public folder links are now supported as authenticated SecureFile links.
- Public folder links never expose folder contents anonymously; the user must sign in.
- Authenticated users in the same SecureFile workspace can use the folder permissions granted by the owner.
- Public folder shares can carry View/Download/Upload/Edit/Delete/Re-share permissions; normal authenticated APIs enforce them.
- Public folder links provide a SecureFile sign-in path and account-creation path.
- Password protection remains available for public file links; public folder links use authenticated access rather than an anonymous password gate.
- CORS already permits `X-Share-Password` for protected public file preview/download.

## Data safety
No database reset, destructive migration, or storage reset is included in this update.
