# SecureFile Production Setup

## Project structure

- `frontend/` = authenticated SecureFile software application
- `backend/` = Express API (standalone deployable service)
- `website/` = public marketing/pricing website
- `prisma/` = canonical local development database schema
- `backend/prisma/` = deployment copy of the Prisma schema/migrations so the API can build independently on Vercel

## Existing database upgrade

The current application adds:

- `Company.businessIndustry`
- `Company.businessDescription`
- `Folder.isPersonal`
- `Subscription.planCode`
- the personal-folder lookup index

For an existing database, run once from the project root:

```bash
npm run db:migrate:deploy
npm run db:backfill-personal
```

For local development, `npm run dev` also runs `prisma db push` and the idempotent personal-folder backfill before starting the three applications.

## Install and run

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix website install
npm run db:generate
npm run dev
```

Do not commit `.env`, uploaded files, `node_modules`, or build output.

## Pricing

Base pricing:

- first user: `$10/user/month`
- each additional user: `$5/user/month`
- storage: `$0.30/GB/month`

Add-ons:

- File side-panel preview: `$5/user/month`
- Scanner: `$5/user/month`
- Fax: `$5/user/month`
- File/folder re-sharing: `$1/user/month`
- User file rename: `$2/user/month`
- Post-office mailing: `$10/user/month`

Packages:

- Starter: 1 user, 15 GB, preview + rename
- Business: 5 users, 250 GB, preview + scanner + re-sharing + rename
- Professional: 10 users, 500 GB, all add-ons
- Custom: customer chooses users, storage, months and add-ons

Every purchased package is stored on the company subscription and server-side entitlements enforce its enabled add-ons and purchased seat/storage limits.

## Vercel

The repository is organized for three Vercel services:

- `frontend/` — Vite software app
- `backend/` — Express API through `api/index.ts`
- `website/` — public Vite website

Backend environment variables must be configured in Vercel. Never place production secrets in Git.

For an existing production database, apply the migration before using features that read the new fields.
