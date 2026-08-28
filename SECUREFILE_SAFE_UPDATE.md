# SecureFile Safe Update

This package is based on the supplied securefile-production archive.

Changes are intentionally limited to deployment/database safety: 
- Source remains TypeScript/TSX; no source JS conversion.
- backend/api/index.ts is the Vercel entrypoint.
- backend is CommonJS-compiled and does not declare package type=module.
- Prisma schema does not require DIRECT_URL. DATABASE_URL remains the Prisma CLI datasource.
- Added a non-destructive NotificationType/Notification.type repair to safe-db-sync.
- Added migration 20260828000000_notification_type_safe_fix.
- Existing data is not reset or deleted.

Secrets, .git metadata, node_modules, and generated build artifacts are excluded from this archive. Keep your existing .env separately.
