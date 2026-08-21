# SecureFile Production Build Fixes — 2026-08-22

This source package contains the production build fixes applied after the Vercel build reported TypeScript errors.

## Fixed

- Prisma CLI is a production dependency of `backend` so Vercel can execute `prisma generate` during production builds.
- `companies.ts`: JSON `addons` is safely normalized before object spreading.
- `middleware/auth.ts`: authenticated user context now includes the user's email, required by workspace email filtering.
- `files.ts`: scanner routes use authenticated-user narrowing/non-null assertions consistently after the `auth` middleware.
- `subscriptions.ts`: nullable Prisma JSON field `pendingAddons` is cleared with `Prisma.JsonNull` instead of JavaScript `null`.

## Expected backend build

```text
prisma generate --schema prisma/schema.prisma && tsc
```

The previous Prisma `command not found` failure is addressed by moving Prisma from `devDependencies` to `dependencies`.

## Before production deployment

Set the production environment variables in Vercel. Do not commit `.env` or production secrets.

Stripe can remain disabled with `BILLING_MODE=preview` until Stripe credentials are available.
