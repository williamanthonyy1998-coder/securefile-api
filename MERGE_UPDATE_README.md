# SecureFile – Merge Update

This package is designed to be merged directly into the existing `securefile-production` folder.

It preserves the existing public `website/` project and existing root startup workflow, while updating the software source with the latest Requests, Approvals, Task Management, Trash/30-day recovery, Personal Folder and Prisma fixes.

## Important
- Do NOT delete your existing `website/` folder.
- Do NOT copy `.env` from another project. Keep your existing `.env`.
- Do NOT copy `node_modules`, `dist`, `.vite`, uploads or storage from this package.
- After merging, regenerate Prisma Client and synchronize the database before starting the app.

Commands:

```bat
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix website install
npm run db:generate
npm run db:sync
npm run db:backfill-personal
npm run dev
```

The existing root `package.json` website startup/build commands are intentionally preserved.
