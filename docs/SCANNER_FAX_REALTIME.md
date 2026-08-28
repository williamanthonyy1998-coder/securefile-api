# SecureFile Scanner, Fax & Realtime Notifications — production workflow

## Scanner

The Scanner module is enabled only when the customer's subscription contains the `scanner` feature.

The production physical-scanner workflow is:

1. The user runs `scanner-bridge` on the Windows PC where the physical WIA-compatible scanner is installed.
2. Chrome opens SecureFile on that same workstation and connects to `http://127.0.0.1:8765`.
3. The user chooses ADF or Flatbed, DPI, color mode and optional duplex.
4. ADF scans up to 100 pages per batch. The user can press **Scan More Pages** for additional batches, so the final PDF can contain as many pages as needed within the server/browser resource limits.
5. SecureFile shows page thumbnails and lets the user remove or reorder pages before saving.
6. The user enters the final PDF name and selects a destination folder.
7. SecureFile sends the selected JPEG pages to the backend, builds one PDF server-side, stores it as a `SCAN` file and applies the normal file/folder access rules.
8. Other non-admin company users cannot see the saved file unless the owner/admin shares it or grants permission. Company Admins retain their normal administrative access.

A browser cannot directly control arbitrary USB/TWAIN/WIA scanners. The local Windows bridge is the native integration layer.

### Scanner workstation

```text
cd scanner-bridge
npm install
npm start
```

Default bridge URL:

`http://127.0.0.1:8765`

Frontend configuration:

`VITE_SCANNER_BRIDGE_URL=http://127.0.0.1:8765`

## File and folder move

The Files module now supports moving both files and folders. The destination can be another visible folder or the root. Folder moves are validated server-side so a folder cannot be moved into itself or any descendant, and personal folders cannot be moved.

## Realtime notifications

Notifications are persisted in PostgreSQL and pushed to active browser sessions through Server-Sent Events (SSE) at:

`/api/realtime?token=<session-token>`

The header notification bell shows unread notifications and opens the notification history. New events appear immediately without a page refresh and also show a short toast. If a user is offline, the notification remains stored and appears when the workspace is opened again.

Existing notification producers (access requests, approvals, tasks, chat, email, invitations, subscription events, sharing and relevant file/scan events) use the same notification service, so they automatically receive realtime delivery when the user is online.
