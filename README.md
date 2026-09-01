# SecureFile — Production Workspace

SecureFile is a permission-first document workspace with files, folders, sharing, access requests/approvals, task management, chat, scanner/fax add-ons, subscriptions, Trash recovery and a separate public website.

## Project layout

- `backend/` — Express API + Prisma runtime
- `frontend/` — SecureFile software application
- `website/` — separate public/marketing website
- `prisma/` — canonical root database schema and migrations
- `scripts/` — database maintenance/backfill scripts
- `docs/` — architecture, security and deployment notes

## Local setup

1. Copy `.env.example` to `.env` and add your Supabase PostgreSQL URL and secrets.
2. Install everything:

```bat
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix website install
```

3. Start the complete platform:

```bat
npm run dev
```

The startup sequence is intentionally:

`Prisma generate → database sync → personal-folder normalization → backend + frontend + website`.

Frontend: `http://localhost:5173`
API health: `http://localhost:4000/healthz`
Website: `http://localhost:4173`

## Database

`npm run db:sync` uses Prisma `db push` to synchronize an existing development database safely with the current schema. For a controlled production migration pipeline use:

```bat
npm run db:migrate:deploy
```

## Pricing

- First user: `$10/user/month`
- Additional users: `$5/user/month`
- Storage: `$0.30/GB/month`
- File side-panel preview: `$5/user/month`
- Scanner: `$5/user/month`
- Fax: `$5/user/month`
- File/folder re-sharing: `$1/user/month`
- User file rename: `$2/user/month`
- Post-office mailing: `$10/user/month`

Packages are Starter, Business, Professional and Custom. Fixed packages lock their included users/storage/add-ons; Custom allows the customer to choose users, storage, months and add-ons.

## Workflow rules

### Requests / Approvals

A requester does **not** select a file they already have. They enter the requested file/folder name, request type, reason and the person who should fulfill it. The approver sees the incoming request, searches resources they can share, selects the actual resource, and approves or rejects. Approval automatically creates the internal share and notifies the requester.

### Task Management

Only Company Admins create tasks. A task can reference a file/folder, contain instructions, priority, due date and (for files) start/end page. Only the assigned employee/client can change status or submit a solution. Admins monitor status but cannot impersonate the assignee. Reminder emails/notifications are sent before the due time; overdue unfinished tasks are removed by the maintenance sweep.

### Trash

Files and folders are soft-deleted. They remain recoverable for 30 days, can be restored, or permanently deleted manually. The maintenance sweep permanently removes expired trash and releases storage.

## Production storage

Do not rely on local disk for Vercel/serverless deployments. Configure Supabase Storage using:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

The application falls back to local storage only for local development.

## Vercel backend maintenance

`backend/vercel.json` defines an hourly cron for `/api/maintenance/sweep`. Set `CRON_SECRET` in production if you want the endpoint protected.

## Collaboration / Trash update — 2026-08-20

This build keeps the existing `backend`, `frontend` (software), and `website` folders separate and adds/fixes:

- Shared resources now show owner/recipient and permission controls for View, Download, Upload, Edit, Delete and Re-share. Owners can revoke a share.
- Trash API is mounted correctly at `/api/trash`; deleted files/folders remain recoverable for 30 days and the hourly worker permanently purges expired items.
- Requests remain name-based: the requester does not select a file they already have. The approver selects the real resource and approval creates the share.
- Task status can only be changed by the assigned employee/client. The hourly worker sends reminders and removes tasks after their deadline.
- Chat now supports direct chats, company groups and an in-app Mail area with sent-message history. Group members receive notifications for group messages.
- User and admin account creation uses valid email syntax and invitation/email verification before activation.
- A safe database sync script repairs the legacy `AccessRequest.requestedType` text/enum mismatch without resetting the database.

For an existing local PostgreSQL database, run `npm run dev`; the project now runs the safe sync before the personal-folder normalization. Do not use `prisma db push --force-reset` unless you intentionally want to erase the database.

The in-app Mail area records emails sent through SecureFile. Receiving arbitrary external email into a SecureFile mailbox still requires an inbound email provider/domain webhook configuration; it is not possible from SMTP/Resend sending credentials alone.

## Collaboration, Mail & Trash

- Shared resources support View, Download, Upload, Edit, Delete and Re-share permissions. Owners and Company Admins can change or revoke permissions; a recipient can manage a share only when Re-share permission is granted and the re-share add-on is active.
- Requests are name-based: the requester describes the file/folder they need. The approver selects the real resource before approval. Self-approval is blocked.
- Tasks can be assigned from Task Management or directly from Files. Only the assignee can change status. Start/end page ranges, priority, due time, reminders and automatic post-deadline cleanup are supported.
- Deleted files/folders are soft-deleted into Trash for 30 days and can be restored. After 30 days the hourly worker permanently purges them.
- Chat includes direct messages and company groups. Group creators and Company Admins can rename/delete groups.
- SecureFile Mail stores sent and received messages per user. Outbound mail can be sent to a company user or any syntactically valid external email address. Incoming messages can be delivered through `POST /api/integrations/email/inbound` using `x-inbound-email-secret`.

### Inbound email provider payload

Send JSON such as:

```json
{
  "to": "user@example.com",
  "from": "sender@example.com",
  "subject": "Hello",
  "text": "Message body"
}
```

Set `INBOUND_EMAIL_SECRET` in the production environment and configure your inbound-email provider to POST to the endpoint with that secret. Messages addressed to a registered SecureFile user are stored in that user's Inbox and generate an in-app notification.

## Scanner workstation setup

For physical scanner support, run `scanner-bridge/start-windows.bat` on the Windows PC connected to the scanner, then set the frontend environment variable `VITE_SCANNER_BRIDGE_URL=http://127.0.0.1:8765`. The Universal Scanner Bridge supports WIA directly and WIA/TWAIN/eSCL through NAPS2, with device discovery, ADF/flatbed/duplex settings, multi-page collection, page reorder/remove, and private PDF saving. Install NAPS2 on Windows for the broadest scanner compatibility.

## Realtime notifications

SecureFile now persists notifications and pushes new notifications to active browser sessions through the authenticated `/api/realtime` SSE endpoint. The header bell shows unread notifications and new events appear immediately without a page refresh.
