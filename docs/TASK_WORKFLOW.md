# SecureFile Requests, Approvals & Task Management

## Requests
A user can request access to a file/folder from an authorized owner or user with `Share` permission. The API rejects self-requests, duplicate pending requests, and requests to unauthorized approvers.

The requester sees only their own requests. Pending requests can be canceled. Requesters never receive approval actions.

## Approvals
The approval queue contains requests assigned to the current user. The API re-checks the approver's `Share` permission at approval time and blocks self-approval.

When approved:
1. The request is marked `APPROVED`.
2. An internal Share is created/updated for the requester.
3. The requester receives an in-app notification.
4. If Resend is configured, the requester receives an email with a link to SecureFile Shared.
5. Direct file shares are also included in the Files list; shared folders are visible through folder access rules.

When rejected, the requester receives an in-app notification and, when configured, an email.

## Task Management
`Assigning Works` is now `Task Management`.

Company Admins can create tasks from Task Management or directly from a file's action menu/preview panel.

Tasks support:
- assignee
- title
- instructions
- file/folder
- start page
- end page
- priority
- due date
- status
- solution upload

For file tasks, the file preview side panel displays all tasks visible to the current user and their page ranges.

## Database upgrade
Run:

```bash
npm run db:migrate:deploy
npm run db:backfill-personal
```

The migration adds `TaskPriority`, task page fields/indexes, and the `CANCELED` request status.
