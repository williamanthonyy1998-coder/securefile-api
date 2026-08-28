# SecureFile deployment recovery / current baseline

This archive is based on the supplied `securefile-production.zip`. Source code remains TypeScript (`.ts`/`.tsx`); no source files are renamed to `.js`.

## Database safety
- Do not run `prisma db pull` against the production schema.
- Do not run `prisma db push --force-reset` or `prisma migrate reset`.
- The notification repair migration adds the missing `Notification.type` enum column without deleting existing rows.
- Local `npm run db:sync` also repairs the known legacy Notification mismatch before Prisma schema sync.

## Production backend
The backend uses a Vercel TypeScript function at `backend/api/index.ts`. `backend/package.json` is CommonJS-compatible and `backend/tsconfig.json` uses CommonJS/Node resolution.

Vercel build runs `prisma migrate deploy` before compiling, so unapplied safe migrations are applied without a reset. `DATABASE_URL` is used by Prisma Client and `DIRECT_URL` is used for migrations.

## Tenant URLs
No custom domain is required. Customer workspaces use the deployed frontend URL plus `/t/<company-slug>`, for example `https://<frontend-host>/t/test2`. The tenant slug is preserved through login, dashboard, files, users, reset and invitation routes.

## Email
Super Admin company creation can use the company contact email as the Company Admin email. If no admin password is supplied, a secure temporary password is generated and emailed with a one-time password-change link valid for 24 hours.

User invitations provide an activation link where the user creates their own password. Forgot-password creates a one-time reset token valid for 30 minutes.

Resend still controls actual delivery. `onboarding@resend.dev` is a testing sender and Resend may restrict recipients until a verified sending domain is configured. No application code can bypass that provider restriction.

## File preview/download
Authenticated preview/download now fetches the backend file endpoints as blobs instead of depending on a browser to access a Supabase signed URL directly. This keeps the private bucket private and avoids browser-side signed-path issues.
