# SecureFile Production Go-Live Checklist

This build is the application code. External provider accounts, domains, credentials and hardware still have to be configured in the production environment.

## 1. Required infrastructure

- PostgreSQL database with automated backups.
- HTTPS for `app.<domain>` and `api.<domain>`.
- One stable backend origin for webhooks and SSE.
- Private object storage (Supabase Storage is supported by this build).
- DNS records for the website/app/API and verified email domain.

## 2. Environment

Copy `.env.production.example` to the secret manager/environment used by the backend. Never commit real keys.

Required core values:

- `DATABASE_URL`
- `JWT_SECRET` (32+ random characters)
- `APP_URL`
- `CORS_ORIGINS`

Email:

- `EMAIL_PROVIDER=resend`
- `EMAIL_FROM`
- `RESEND_API_KEY`
- `INBOUND_EMAIL_SECRET` for the generic inbound-email webhook

Stripe recurring billing:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`

Fax:

- `PHAXIO_API_KEY`
- `PHAXIO_API_SECRET`
- `PHAXIO_BASE_URL=https://api.phaxio.com/v2.1`
- `PHAXIO_CALLBACK_URL=https://api.<domain>/api/integrations/fax/webhook`
- `PHAXIO_CALLBACK_TOKEN`
- `FAX_WEBHOOK_SECRET` only as legacy fallback

Storage:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

## 3. Database

Run on the production backend release:

```bash
npm run migrate:deploy
npm run build
npm start
```

Do not run `prisma migrate reset` against production.

## 4. Stripe

Create the Stripe webhook endpoint:

`https://api.<domain>/api/subscriptions/stripe-webhook`

Enable at least:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

The application now creates a real monthly recurring Checkout subscription instead of a one-time payment. Subscription state is changed from signed Stripe webhooks, not from the browser redirect.

## 5. Resend

Verify the sending domain and use a `from` address on that verified domain. Configure the inbound provider to call:

`https://api.<domain>/api/integrations/email/inbound`

with `x-inbound-email-secret` equal to `INBOUND_EMAIL_SECRET`.

## 6. Phaxio

Use a live Phaxio account for production. Set the receive callback URL on the account/number to:

`https://api.<domain>/api/integrations/fax/webhook`

Set the Phaxio callback token in `PHAXIO_CALLBACK_TOKEN`. The application verifies `X-Phaxio-Signature` using HMAC-SHA1 and also supports the older shared query-token fallback.

For sensitive/PHI workflows, configure Phaxio's storage settings and contractual/BAA requirements according to your compliance obligations.

## 7. Scanner

The physical scanner remains a local-device workflow:

Chrome -> SecureFile -> Windows scanner bridge -> WIA scanner.

The bridge must run on the Windows machine physically connected to the scanner. The web app cannot directly control arbitrary USB scanners from a normal browser.

## 8. Realtime and alerts

- SSE `/api/realtime` provides instant notification delivery.
- Database polling fallback checks for missed notifications.
- The frontend now also displays global success/error toasts for mutating API operations.
- Server notifications appear in the bell and as a right-side toast.

For horizontal scaling beyond a single backend process, add a shared pub/sub layer (managed Redis or equivalent) rather than relying only on process memory.

## 9. Storage

Use the private Supabase bucket in production. Keep service-role credentials backend-only. Files should be accessed through SecureFile permission checks; do not expose the bucket publicly.

## 10. Operational requirements

Before opening sales:

- Test backup restore.
- Configure uptime/error monitoring.
- Rotate secrets periodically.
- Configure provider billing limits/alerts.
- Test failed payments and canceled subscriptions.
- Test fax send, fax receive, webhook retry and duplicate callback handling.
- Test email delivery/bounce handling.
- Test scanner reconnect and multi-page PDF creation.
- Test file permission boundaries with two separate users.
- Test storage-limit enforcement.
