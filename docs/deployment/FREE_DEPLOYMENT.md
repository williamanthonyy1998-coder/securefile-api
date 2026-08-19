# SecureFile — $0 Testing Deployment

This project is prepared for a free testing deployment using:

- Render Free Web Service — backend
- Render Free Static Site — frontend
- Supabase Free — PostgreSQL + private file storage
- Resend Free — transactional email

## 1. Create Supabase

Create a Supabase project and copy:

- Project URL
- Project Settings → API → service_role key
- Database connection string

Create a Storage bucket named `securefile`. Keep it private.

Free Supabase currently includes 500 MB database, 1 GB file storage, and 5 GB egress. Free Storage has a 50 MB max file upload size, so this deployment intentionally sets `MAX_UPLOAD_MB=50`.

## 2. Database

Use the Supabase Postgres connection string as `DATABASE_URL`.

From the project root locally:

```cmd
npm run db:generate
npm run db:push
npm run db:seed
```

For the deployed database, the Render backend build runs `prisma generate`; run `prisma db push` against the Supabase database once before testing or use the same command locally with the production `DATABASE_URL`.

## 3. Render

Connect this Git repository to Render. The included `render.yaml` creates:

- `securefile-api` — free Node/Express backend
- `securefile-web` — free Vite static frontend

Set these Render environment variables:

### Backend

```text
DATABASE_URL=<Supabase Postgres URL>
JWT_SECRET=<32+ random characters>
APP_URL=https://<your-frontend>.onrender.com
CORS_ORIGINS=https://<your-frontend>.onrender.com
EMAIL_PROVIDER=resend
EMAIL_FROM=<verified sender address>
RESEND_API_KEY=<Resend API key>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
SUPABASE_STORAGE_BUCKET=securefile
MAX_UPLOAD_MB=50
```

### Frontend

```text
VITE_API_URL=https://<your-backend>.onrender.com/api
```

## 4. Email

Create a Resend account, verify a sending domain/address, and put the API key and sender in Render. The application already sends verification, password reset, invitations and direct email through its email service.

## 5. Important free-tier limits

Render Free web services sleep after 15 minutes without inbound traffic and their local filesystem is ephemeral. Therefore uploads are stored in Supabase Storage, not on Render's disk.

Supabase Free is suitable for testing, not large production storage. Stay within its free quotas to keep the test deployment at $0.

## 6. No Docker

This deployment does not use Docker.
