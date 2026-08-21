# SecureFile — Production Go-Live (manual hand setup)

This release removes the development payment activation bypass. Production activation is now controlled by Stripe's signed webhook. The app/API/frontend are designed for Vercel + PostgreSQL + Supabase Storage + Resend + Stripe. The Windows scanner remains a local bridge.

## 0) Accounts you must create

- GitHub — source repository
- Vercel — website, app and API deployments
- Supabase — production PostgreSQL + private Storage bucket
- Stripe — live recurring subscriptions + webhook
- Resend — verified sending domain + email API
- Phaxio — live fax account + receiving numbers/webhooks if Fax add-on is sold
- Cloudflare Worker — recommended Phaxio receive relay when the API is on Vercel
- Your DNS provider — app/api/www records

Do not paste live secrets into GitHub or chat.

## 1) Supabase production project

Create a NEW production Supabase project.

1. Open Project Settings → Database and copy the PostgreSQL connection string.
2. Open Storage and create a PRIVATE bucket named `securefile`.
3. Open Project Settings → API and copy:
   - Project URL
   - service-role key (server only; never put this in VITE_ variables)
4. Put these into the Vercel API project's Production environment variables:

`DATABASE_URL`
`SUPABASE_URL`
`SUPABASE_SERVICE_ROLE_KEY`
`SUPABASE_STORAGE_BUCKET=securefile`

The bucket must remain private. SecureFile signs URLs only after checking the user's permissions.

## 2) Stripe live billing

1. Create/activate a Stripe account.
2. Switch to LIVE mode.
3. Get the live Secret key (`sk_live_...`).
4. Create a webhook endpoint:

`https://api.YOURDOMAIN.com/api/subscriptions/stripe-webhook`

5. Subscribe the webhook to:
   - checkout.session.completed
   - invoice.paid
   - invoice.payment_failed
   - customer.subscription.updated
   - customer.subscription.deleted
6. Copy the webhook signing secret (`whsec_...`).
7. Add to Vercel API Production:

`STRIPE_SECRET_KEY=sk_live_...`
`STRIPE_WEBHOOK_SECRET=whsec_...`
`STRIPE_SUCCESS_URL=https://app.YOURDOMAIN.com/payment/success`
`STRIPE_CANCEL_URL=https://app.YOURDOMAIN.com/payment/cancel`

The code creates monthly recurring Checkout prices server-side, so you do not need to hard-code Stripe Price IDs for the standard plans.

## 3) Resend production email

1. Create a Resend account.
2. Add your sending domain.
3. Add the DNS records Resend gives you.
4. Wait until the domain is verified.
5. Create an API key.
6. Add to Vercel API Production:

`EMAIL_PROVIDER=resend`
`RESEND_API_KEY=re_...`
`EMAIL_FROM=SecureFile <no-reply@YOURDOMAIN.com>`

Signup verification, password reset and system email use this provider.

## 4) Domains / DNS

Recommended production split:

- `www.YOURDOMAIN.com` → marketing website Vercel project
- `app.YOURDOMAIN.com` → SecureFile frontend Vercel project
- `api.YOURDOMAIN.com` → SecureFile backend Vercel project

After adding domains in Vercel, copy the DNS records Vercel shows into your DNS provider.

Set API Production:

`APP_URL=https://app.YOURDOMAIN.com`
`PUBLIC_APP_DOMAIN=YOURDOMAIN.com`
`CORS_ORIGINS=https://app.YOURDOMAIN.com`

## 5) Phaxio

1. Create/activate your Phaxio account.
2. Use live API credentials for production.
3. Add:

`PHAXIO_API_KEY=...`
`PHAXIO_API_SECRET=...`
`PHAXIO_BASE_URL=https://api.phaxio.com/v2.1`
`PHAXIO_CALLBACK_URL=https://api.YOURDOMAIN.com/api/integrations/fax/webhook`
`FAX_WEBHOOK_SECRET=<long random secret>`

4. Enable Phaxio webhook signing and generate its webhook token.
5. Put that token into `PHAXIO_CALLBACK_TOKEN`.
6. When a user provisions a personal fax number, SecureFile assigns that number to that SecureFile user and configures the receive callback.

### Vercel fax receive limitation

Vercel Functions have a 4.5 MB request/response body limit. Phaxio receive webhooks include the received PDF as multipart/form-data. Therefore, for reliable production fax receiving, deploy the included `integrations/phaxio-relay` Cloudflare Worker and use its URL as the Phaxio receive callback. The relay forwards metadata only; SecureFile downloads the PDF directly from Phaxio using the fax id.

Cloudflare currently allows up to 100 MB request bodies on Free/Pro Workers, with higher limits on Business/Enterprise. See the included relay README for setup.

## 6) Vercel — create THREE projects from the same GitHub repo

### Project A — Marketing website

Vercel → Add New → Project → import repository.

Root Directory:

`website`

Framework: Vite.

Production environment:

`VITE_APP_URL=https://app.YOURDOMAIN.com`

Build command:

`npm run build`

Output directory:

`dist`

### Project B — SecureFile app

Import the same repository again.

Root Directory:

`frontend`

Framework: Vite.

Production variables:

`VITE_API_URL=https://api.YOURDOMAIN.com/api`
`VITE_SCANNER_BRIDGE_URL=http://127.0.0.1:8765`
`VITE_DIRECT_UPLOAD=true`

Build:

`npm run build`

Output:

`dist`

The included `frontend/vercel.json` provides SPA fallback so `/login`, `/files`, `/module/...`, etc. work on direct navigation.

### Project C — SecureFile API

Import the same repository a third time.

Root Directory:

`backend`

Build command:

`npm run build`

Install command:

`npm install`

The included `backend/vercel.json` configures the API function and hourly maintenance cron.

Add Production variables:

`NODE_ENV=production`
`DATABASE_URL=...`
`JWT_SECRET=<32+ random characters>`
`APP_URL=https://app.YOURDOMAIN.com`
`PUBLIC_APP_DOMAIN=YOURDOMAIN.com`
`CORS_ORIGINS=https://app.YOURDOMAIN.com`
`MAX_UPLOAD_MB=250`
`EMAIL_PROVIDER=resend`
`EMAIL_FROM=SecureFile <no-reply@YOURDOMAIN.com>`
`RESEND_API_KEY=...`
`STRIPE_SECRET_KEY=sk_live_...`
`STRIPE_WEBHOOK_SECRET=whsec_...`
`STRIPE_SUCCESS_URL=https://app.YOURDOMAIN.com/payment/success`
`STRIPE_CANCEL_URL=https://app.YOURDOMAIN.com/payment/cancel`
`SUPABASE_URL=...`
`SUPABASE_SERVICE_ROLE_KEY=...`
`SUPABASE_STORAGE_BUCKET=securefile`
`PHAXIO_API_KEY=...`
`PHAXIO_API_SECRET=...`
`PHAXIO_BASE_URL=https://api.phaxio.com/v2.1`
`PHAXIO_CALLBACK_URL=https://api.YOURDOMAIN.com/api/integrations/fax/webhook`
`PHAXIO_CALLBACK_TOKEN=...`
`FAX_WEBHOOK_SECRET=...`
`INBOUND_EMAIL_SECRET=<long random secret>`
`CRON_SECRET=<long random secret>`

Optional:

`AI_API_KEY`
`AI_BASE_URL`
`AI_MODEL`
`POSTAL_API_KEY`
`POSTAL_API_URL`

## 7) Database migration

After the API project has its Production DATABASE_URL, deploy once and run the Prisma migrations from a machine that has the repository and the production DATABASE_URL available:

`npm install`
`npm run db:generate`
`npm run db:migrate:deploy`
`npm run db:backfill-personal`

Never use `prisma migrate reset` against production.

## 8) GitHub → Vercel automatic production deploys

Push the final repository to GitHub.

For each of the three Vercel projects:

Settings → Git → Production Branch → `main`

Now a push to `main` deploys the corresponding project. Vercel also creates preview deployments for other branches.

## 9) Test before launch

1. Open `https://app.YOURDOMAIN.com`.
2. Create a new workspace.
3. Confirm Stripe Checkout opens.
4. Pay with a real card only after Stripe live mode/account activation is complete.
5. Confirm Stripe webhook shows 2xx delivery.
6. Confirm email verification arrives from your verified domain.
7. Verify email.
8. Login only after payment webhook activates the subscription.
9. Upload a file larger than 4.5 MB — it should go directly to private Supabase Storage rather than through Vercel's API body.
10. Single-click a file → side preview. Download only from the Download button.
11. Share a file and verify a second user cannot access it before permission.
12. Move a file/folder and verify the destination.
13. Enable browser notifications and create a notification-triggering action.
14. On the Windows scanner PC, install the official WIA driver, run `scanner-bridge/start-windows.bat`, open SecureFile in Chrome on the same PC, and use Check connection.
15. Scan multiple pages, reorder/remove pages, name the PDF, save it, and verify it is private.
16. Provision a personal fax number for a test user.
17. Send a test fax and verify queued → delivered/failed notifications.
18. Receive a test fax and verify it lands only in the intended user's Files area.
19. Cancel at period end from Settings and verify Stripe + SecureFile status.
20. Reactivate before the period ends and verify Stripe + SecureFile status.

## 10) Important security rules

- Never commit `.env`, live Stripe keys, Resend keys, Phaxio credentials or Supabase service-role key.
- Keep the Supabase bucket PRIVATE.
- Keep all `SUPABASE_SERVICE_ROLE_KEY` values server-side only.
- Never put secrets in `VITE_*` variables.
- Use Stripe's webhook signing secret; do not trust the browser redirect as proof of payment.
- Keep the Phaxio callback token/signature enabled.
- Use HTTPS for all public SecureFile domains.
- Keep backups of the production database.
- Configure Vercel production environment variables and redeploy after changing them.


## Free Vercel phase (no domain / no Stripe yet)

Set `BILLING_MODE=preview`. This publishes a clearly labeled checkout preview page. It does **not** charge cards or activate subscriptions. When Stripe is ready, change `BILLING_MODE=stripe`, add the live Stripe secrets/webhook secret, configure Resend and Supabase, then redeploy.
