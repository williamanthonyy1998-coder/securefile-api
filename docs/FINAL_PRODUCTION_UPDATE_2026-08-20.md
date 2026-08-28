# SecureFile Production Update — 2026-08-20

This build keeps the existing `backend`, `frontend`, `website`, `prisma` and deployment structure.

## Included

- Basic: $10/month, 1 user, 5 GB included.
- Advanced: $95/month, 5 users, 2 GB included; Preview, Scanner, Re-share and Rename included.
- Premium: $135/month, 5 users, 2 GB included; all add-ons included.
- Enterprise: custom users/storage/months/add-ons using the transparent custom calculator.
- Business/industry and business description captured at signup and visible to Super Admin.
- Super Admin sees purchased plan, plan price, users, storage and industry.
- Valid email syntax required for customer and employee/client accounts; account activation uses email verification/invitation.
- One Personal Folder per user with backfill normalization.
- Requests are name-based; requester does not select a resource it already owns.
- Approvals are isolated to the assigned approver; self-approval is blocked.
- Approval requires selecting an actual resource the approver can share.
- Shared permissions: View, Download, Upload, Edit, Delete, Re-share; owners/Admins can manage/revoke; re-share is add-on controlled.
- Task Management replaces Assigning Works; tasks can also be assigned directly from Files with start/end pages.
- Only the assignee can update task status; due tasks are reminded and removed after deadline.
- 30-day soft-delete Trash with Restore and permanent delete; hourly purge worker.
- Direct chat, group chat and SecureFile Mail in one module.
- System emails to registered users are mirrored into their SecureFile mailbox.
- Outbound mail supports company users or valid external email addresses.
- Provider-agnostic inbound email webhook stores mail addressed to registered SecureFile users.
- Trash route is mounted at both `/api/trash` and `/api/workspace/trash` for compatibility.
- Safe database sync repairs legacy `AccessRequest.requestedName/requestedType` differences without `--force-reset`.

## Production notes

Do not use `prisma db push --force-reset` on an existing production database. Use the safe sync for local upgrades and `prisma migrate deploy` for a migration-managed production database.
