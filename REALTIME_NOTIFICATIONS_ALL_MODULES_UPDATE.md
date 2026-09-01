# SecureFile — Realtime Notifications: All Modules

## Update

The realtime notification center now also notifies the user who performed a company-level action in-app, while keeping the existing company-admin broadcast and email behavior intact.

This fixes the common case where an action such as **Trash → Restore** succeeded but the actor saw no notification because they had been excluded from the admin broadcast.

## Covered existing module events

- Files: upload, rename/move, trash, restore, permanent delete
- Folders: create, update, trash, restore, permanent delete
- Sharing: share, permission changes, revoke
- Requests / Approvals: request, approval/rejection
- Tasks: assignment, status, completion
- Chat / Groups: messages and group changes
- Users: invitations, activation, suspension, updates, removal
- Scanner: scanned document events
- Fax: provisioning, queued, failed, received, delivered
- Subscriptions / payments: lifecycle and payment notifications
- Email integration: new email notifications
- Trash: restore and permanent deletion

The actor receives the notification in-app without an extra notification email. Existing recipient/admin emails remain unchanged.


## Read-state sync
- The notification center displays unread notifications only.
- Reading one notification or using Read all immediately removes it from the open notification list.
- Read/read-all events are pushed to other active sessions over the same realtime SSE channel, so multiple tabs stay synchronized.
