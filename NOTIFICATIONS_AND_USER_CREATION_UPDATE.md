# SecureFile — Notifications & Company User Creation Update

## Notifications
- In-app notifications remain stored in `Notification` and delivered through the existing realtime/polling UI.
- Important operational notifications now also email the affected user/admin.
- Email delivery is non-blocking: a provider failure is logged and does not undo the underlying action.
- Existing flows that already send a dedicated email are not duplicated.

## Company-created users
- Company Admin can create an Employee or Client with a required password (10+ chars).
- New users are activated immediately and can log in with the supplied credentials.
- Company Admin can allow/disable the user's Personal Folder at creation time.
- Company Admin can select existing company folders to grant at creation time.
- A 24-hour password-reset/change token is generated.
- The new user receives an email containing their email, initial password, and the 24-hour reset link.
- The password is never stored in plaintext.

## Data safety
- No database reset/drop was added.
- No existing files or user records are deleted by this update.
