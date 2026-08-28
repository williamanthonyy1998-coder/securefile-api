# Requests & Approvals Prisma Fix

This update fixes the Prisma relation mismatch that caused `Unknown field file` and `Unknown field accessRequest` errors.

## Correct flow
- A requester sees only their own Requests.
- The selected approver sees only approvals assigned to them.
- A requester can never approve their own request.
- Approval/rejection is server-authorized.
- Approved requests create/update the corresponding Shared permission.
- File/folder names are resolved separately so the API is resilient to older generated Prisma clients while the canonical schema remains fully relational.

## Fresh install / update
```cmd
npm run install:all
npm run db:validate
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Do not copy only individual folders from an older build. Replace the project with this complete archive, then run the commands above.
