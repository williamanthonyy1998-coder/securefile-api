# Database + File Upload Fix

- `npm run dev` no longer attempts a destructive Prisma reset when the existing Message table contains rows.
- `backend/scripts/safe-db-sync.ts` now migrates legacy `Message.recipientId` / `Message.groupId` data into `Conversation` / `ConversationParticipant` before making `conversationId` and `updatedAt` required. Existing rows are preserved.
- The conversation migration SQL was made data-preserving for `prisma migrate deploy` as well.
- Company/Super Admin file listing now includes files stored at the visible root (`folderId IS NULL`). Previously root uploads could succeed but were excluded by the admin visibility filter.
- Folder uploads continue to appear in their selected folder and in All visible files.
- No `prisma db push --force-reset` is used.
