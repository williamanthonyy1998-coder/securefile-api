# SecureFile — Sharing Software

Docker-free, multi-tenant SaaS codebase for the Sharing Software requirements. The project is intentionally structured so the public purchase flow, isolated company workspaces and Super Admin platform are separate concerns.

## Locked product flow

Public website → Pricing → users/storage/months → Signup → email verification → payment checkout → subscription activation → company subdomain → Company Admin → Employees/Clients → files/folders/sharing/requests/approvals/tasks/chat/scan/fax/AI/notifications → subscription reminders/suspension → Super Admin management.

Pricing is `$10/month for the first/base user + $5/month for each additional user + $0.30/GB/month`. One purchased user allocation is the Company Admin; remaining purchased seats are available for Employees/Clients. Add-ons: Preview `$5/user`, Scanner `$5/user`, Fax `$5/user`, Re-sharing `$1/user`, Rename `$2/user`, Post-office mailing `$10/user`.

## Security rules implemented in the codebase

- Every company-owned record carries a tenant/company relationship.
- Authentication re-checks the current database user on every request.
- File/folder reads are permission-aware; private company resources are not exposed through public static uploads.
- File/folder mutations require an active subscription for normal company users.
- Super Admin is isolated from normal company roles.
- Public sharing uses random tokens stored hashed in the database and can have expiry/password protection.
- Passwords and verification/reset/invitation tokens are hashed.
- Upload size is bounded and filenames are sanitized.
- Storage quotas are checked before accepting uploads.
- Audit records are written for core file actions.
- Stripe webhook signatures are verified before activating a subscription.
- Subscription reminders are deduplicated and expiry changes the subscription to suspended/view-only state.

## External providers

The application contains real provider boundaries, but provider credentials are environment-specific and cannot be embedded in a ZIP. Configure:

- PostgreSQL
- Transactional email (Resend supported)
- Stripe Checkout + webhook
- Production object storage (recommended S3-compatible adapter; local filesystem is for development)
- Scanner integration/provider or workstation scanning bridge
- Fax provider/API
- AI provider using an OpenAI-compatible `/chat/completions` endpoint

No Docker is required.

## Local setup

1. Install Node.js 20+ and PostgreSQL 15+.
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL` and a random `JWT_SECRET` of at least 32 characters.
4. Install dependencies with `npm run install:all`.
5. Run `npm run db:generate`.
6. For a brand-new development database, use Prisma migrations from the migration history that belongs to that database.
7. For an existing database created by an earlier SecureFile archive, **do not run `prisma migrate reset`**. Preserve the data and use `npx prisma db push --schema prisma/schema.prisma` only when you have reviewed the schema change, then regenerate the client.
8. Set `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` (12+ characters) and run `npm run db:seed`.
9. Run `npm run dev`.

The source archive intentionally excludes `node_modules`; always install dependencies fresh before running the project.

Frontend: `http://localhost:5173`  
API: `http://localhost:4000`

## Production deployment — no Docker

- Build frontend and backend directly on the server.
- Run the API with a process manager such as PM2 or systemd.
- Put Nginx in front of the API and frontend.
- Configure wildcard DNS and TLS for `*.yourdomain.com`.
- Use S3-compatible object storage for production files.
- Keep PostgreSQL private and back it up automatically.
- Configure email, Stripe, scanner, fax and AI credentials through a secret manager/environment.
- Do not expose the upload directory as a public static web path.
- Run database migrations during controlled deployments.
- Add automated integration/e2e tests and monitoring before public launch.


## Prisma monorepo layout (fixed)
Prisma Client is intentionally installed at the project root because the Prisma schema lives at `prisma/schema.prisma` while the API lives at `backend/`. The backend resolves the root `@prisma/client` through Node's normal parent-directory module resolution. Run `npm install` at the root, then `npm run db:generate`, then `npm --prefix backend run dev`. Do not install a second `@prisma/client` inside `backend`.
"# securefile-api" 
