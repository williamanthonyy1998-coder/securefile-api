# SecureFile — Workflow Update (20 Aug 2026)

## Requests & Approvals
- A requester does **not** need the requested file/folder in their own workspace.
- The requester enters the resource name, selects File/Folder, selects the person to ask, and submits the request.
- The request appears only in the selected approver's Approvals queue.
- The approver selects the actual file/folder that will fulfill the request.
- Approve creates a controlled Share for the requester and sends an in-app notification/email.
- Reject sends a rejection notification/email.
- A requester can delete only their own **pending** request.
- Self-approval is blocked server-side.

## Task Management
- Sidebar label is **Task Management**.
- Only Company Admin assigns tasks.
- Only the assigned employee/client can change task status.
- Tasks can include file, instructions, priority, start page, end page and due date/time.
- File page ranges are validated server-side.
- Assignees receive an assignment notification/email.
- Reminder notifications/email are sent approximately every 24 hours while a task is open.
- At the due time the task is automatically removed by the maintenance worker.
- The same maintenance worker also purges expired Trash items.
- Company Admin can assign a task directly from Files.
- A file preview side panel shows its assigned tasks and page ranges.

## Trash
- File/folder Delete is now a soft delete.
- Deleted files/folders remain in Trash for 30 days.
- Restore is available during the retention period.
- Permanent delete removes the database record and stored object.
- Folder trash/restore handles the complete child folder/file tree.
- A maintenance sweep permanently deletes items older than 30 days.
- Personal folders are private and each user has one personal folder when enabled.

## Database / Prisma
- `Folder.isPersonal` and personal-folder backfill are included.
- Task priority/page-range fields and relations are included.
- Approval resource relations are included.
- Prisma generates both the root client and backend-local client so the stale `@prisma/client did not initialize` problem is avoided.

## Local setup
```bat
npm install
npm --prefix backend install
npm --prefix frontend install
npm run db:generate
npm run db:sync
npm run db:backfill-personal
npm run dev
```

Do not manually run a Prisma generate command against a different schema. The root `prisma/schema.prisma` is canonical.

## Production maintenance
Set `CRON_SECRET` in the deployment environment. The project includes `/api/cron/maintenance` and a Vercel hourly cron entry. Render/non-Vercel deployments also run the maintenance worker from the server process.
