# SecureFile – Task Management / Prisma Sync Fix

This package fixes the production error where the API reported:
- `Unknown field file for include statement on model Task`
- `Unknown argument priority`
- stale `@prisma/client did not initialize yet`
- personal-folder backfill/schema drift

## Important architecture change

`backend/prisma/schema.prisma` is the canonical backend Prisma schema. Root scripts now explicitly use that schema, and backend scripts use the local canonical schema. The old duplicated Company `tasks` relation was removed.

The Task model contains:
- file / folder relations
- priority
- startPage / endPage
- dueAt
- task status

## Fresh local setup

```bat
npm install
npm --prefix backend install
npm --prefix frontend install
npm run db:generate
npm run db:migrate:deploy
npm run db:backfill-personal
npm run dev
```

## Existing database

Do NOT use `prisma db push` as the normal production workflow.

Use:

```bat
npm run db:generate
npm run db:migrate:deploy
npm run db:backfill-personal
npm run dev
```

If an old database has not received the migrations, `db:migrate:deploy` applies:
- business industry / description
- personal folder support
- plan code
- Task priority
- Task page ranges
- request cancellation
- task indexes

## Vercel backend

The backend service root should be:

```text
backend
```

Build command:

```text
npm run build
```

Install command:

```text
npm install
```

The backend build generates Prisma from:

```text
backend/prisma/schema.prisma
```

Do not point the backend build at a stale root-only Prisma client.

## Task Management behavior

- Only Company Admin creates tasks.
- Employees/clients see only tasks assigned to themselves.
- Company Admin sees the company task queue.
- Company Admin can assign a file from Files → Assign task.
- A task can target a file, folder, or no resource.
- Page ranges are allowed only for files.
- Start/end pages are validated server-side.
- Assignee must be an active employee/client in the same company.
- Task assignment creates an in-app notification and email when email delivery is configured.
- File preview side panel lists tasks and page ranges.
- Assignees can update their task status and submit a solution file.
