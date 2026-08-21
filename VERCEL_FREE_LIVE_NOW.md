# SecureFile — Free Vercel Preview

Current mode: `BILLING_MODE=preview`.

This mode is intentionally not a fake payment. Customers see the checkout preview, no card is charged, and a verified workspace is available as a free preview. When Stripe is ready, change `BILLING_MODE` to `stripe` and add the Stripe secret/webhook values in Vercel Production environment variables.

## Local

In `backend/.env` set:

```env
BILLING_MODE=preview
```

Restart backend after changing env.

## Vercel

Deploy the `frontend` and `backend` apps from the repository. The backend requires a real PostgreSQL database (Supabase/Neon/etc.) and production `DATABASE_URL`; Vercel itself does not provide the application's PostgreSQL database.

Do not upload `.env` files or secrets to GitHub.
