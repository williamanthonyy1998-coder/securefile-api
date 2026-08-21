# SecureFile — Subscription Settings / Prisma fix

## Root cause
The Settings UI was calling the subscription lifecycle endpoints correctly, but the **backend Prisma schema was older than the root/canonical Prisma schema**. The generated backend Prisma Client therefore did not know about fields already used by the subscription routes.

That is why clicking **Cancel Subscription** produced:

`Unknown argument cancelAtPeriodEnd`

and clicking **Pay & Increase Limits** produced:

`Unknown argument pendingPlanCode`

The root project schema already contains the subscription lifecycle fields and the root migrations already create them. The backend schema is now synchronized with that canonical schema in this ZIP.

## After replacing the project
If the database is the same local database you have been using, run:

```bash
npm run db:sync
npm run db:generate
```

Then restart the backend:

```bash
npm --prefix backend run dev
```

If you prefer to regenerate only the backend client:

```bash
npx prisma generate --schema backend/prisma/schema.prisma
npm --prefix backend run dev
```

## Production
Use the root Prisma schema/migrations for deployment:

```bash
npm run db:migrate:deploy
npm run db:generate
```

The existing root migration `20260821100000_production_billing_realtime_hardening` adds the Stripe/customer/billing fields, and `20260821110000_subscription_cancel_state` adds `cancelAtPeriodEnd`.

## Billing behavior kept in this version
- Option A = upfront, non-recurring billing.
- Customer chooses a paid duration.
- Successful signed Stripe webhook is the authority for activation/renewal.
- Expired workspaces remain available in view-only mode.
- Company Admin can renew from Settings after expiry.
- Company Admin can purchase additional users/storage from Settings.
- Limits are not applied before successful payment.
- Cancel schedules the end of the already-paid period; it does not delete the workspace/data.
- Reactivate removes a pending cancellation while the paid period is still active.
- If a legacy Stripe recurring subscription exists, its Stripe cancellation-at-period-end flag is also updated safely.
