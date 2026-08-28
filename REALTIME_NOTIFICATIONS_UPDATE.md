# SecureFile — Realtime Notifications Update

This update keeps the existing notification system and expands event coverage without changing the database schema or resetting data.

## In-app realtime
- Notification SSE remains enabled for instant delivery on the current API instance.
- Database polling on the realtime endpoint provides multi-instance/serverless fallback.
- Frontend notification polling is 2 seconds and refreshes immediately when the browser tab becomes visible.
- Unread badge, notification popover, toast and browser notifications remain supported.

## Covered events
- File upload / scanned document / fax document saved
- File rename / move / trash / restore / permanent delete
- Folder create / rename / move / trash / restore / permanent delete
- Resource share / permission update / share revoke
- Access request / approval / rejection
- User invitation / resend / activation / suspension / account update / removal
- Task assignment / status / completion
- Direct and group messages
- Group create / rename / delete / membership notification
- Subscription expiry / suspension
- Incoming and outgoing fax events

## Email
Important notifications continue to be mirrored to email where configured. Email failures are best-effort and never break the underlying SecureFile action.

No Docker requirement and no database reset are introduced by this update.
