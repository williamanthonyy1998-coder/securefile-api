# Request & Approval Flow Update

The access-request workflow is now separated correctly:

- **Requests** shows only requests sent by the logged-in user.
- A requester cannot approve or reject their own request.
- Every access request must select the user who should approve it.
- The selected approver must have `share` authority for the requested file/folder (or be Company Admin/Super Admin).
- A matching Approval record is created automatically for the selected approver.
- **Approvals** shows incoming requests assigned to the logged-in user.
- Only the assigned approver can approve/reject an incoming request.
- Approving an access request creates/updates an internal Share for the requester.
- The requested download permission is preserved.
- The requester receives an in-app notification when the request is approved or rejected.
- All checks are enforced server-side and remain company/tenant scoped.

## Database update

The Prisma schema adds:

- `AccessRequest.canDownload`
- `Approval.accessRequestId`
- relations between access requests and their approval record

For an existing development database, use:

```cmd
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

`db:push` is intentionally recommended for this development database because the existing migration history in the supplied project was already out of sync with the database.
