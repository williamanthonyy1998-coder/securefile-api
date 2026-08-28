# SecureFile Package + Notification Update

## Published package pricing
- Basic: $10/month for 1 user. Each additional user: $5/month.
- Advanced: $15/month for 1 user. Each additional user: $10/month.
- Premium: $25/month for 1 user. Each additional user: $12/month.
- Basic includes 5 GB.
- Advanced includes 2 GB.
- Premium includes 2 GB.
- Storage above the included allowance is $0.30/GB/month.

## Package entitlements
- Advanced: File side-panel Preview, Scanner, File/Folder Re-sharing, User File Rename.
- Premium: all SecureFile add-ons, including Fax and Post-office Mailing.
- Additional users inherit the exact feature entitlements of the selected package.

## Subscription expansion
Company Admin can use Settings to request more users or storage. A payment checkout is created using the selected package's rates. The existing subscription/company limits are NOT changed before payment. Stripe webhook payment approval is the source of truth; only after a paid checkout are purchased users and storage updated and a notification sent to the Company Admin.

## Notifications
The application header now contains a live notification bell. It refreshes every 2.5 seconds, shows unread counts, supports individual read state and Mark all as read. Existing server-side events (messages, access requests, tasks, invitations and payment approval) continue to create notifications.
