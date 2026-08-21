# SecureFile — Free Vercel Preview

This mode is for publishing the product UI before Stripe/domain/provider accounts are ready.

## What works
- Vercel-hosted website/app
- Pricing and customer checkout page
- Signup workspace reservation
- Explicit billing preview page
- Stripe-ready recurring subscription code

## What is intentionally disabled until providers are connected
- Real card charging
- Workspace activation after payment
- Production email delivery
- Physical fax provider
- Cloud scanner bridge

Set `BILLING_MODE=preview` for the free preview. Never present preview mode as a paid production account.

## Later
Set `BILLING_MODE=stripe`, add live Stripe keys/webhook secret, configure Resend, Supabase Storage and the production database, then redeploy.
