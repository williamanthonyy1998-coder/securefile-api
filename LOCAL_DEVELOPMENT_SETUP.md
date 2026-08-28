# SecureFile Local Development Setup

The application no longer has a development payment-activation bypass. Local testing should use Stripe test mode and a real email provider configuration so the local flow behaves like production.

## Local payment flow

1. Create a Stripe account and use **Test mode**.
2. Put the Stripe test secret key and webhook signing secret in the local `.env`.
3. Configure `STRIPE_SUCCESS_URL=http://localhost:5173/payment/success` and `STRIPE_CANCEL_URL=http://localhost:5173/payment/cancel`.
4. Configure Resend (or your verified development sending domain) for email verification.
5. Create the workspace from `/signup`.
6. SecureFile redirects to Stripe Checkout.
7. Complete the Stripe test payment.
8. Open the verification email and click the verification link.
9. The signed Stripe webhook changes the subscription to ACTIVE.
10. Return to `/login` and sign in.

Do not add a local bypass to the production code.

## Scanner

The physical scanner requires the Windows bridge to be running on the same Windows PC as the scanner:

```bat
cd scanner-bridge
npm install
npm start
```

Or double-click:

```text
scanner-bridge/start-windows.bat
```

Keep the bridge terminal open. Then open SecureFile in Chrome on that same PC and go to **Scan Documents** → **Check connection**.

Test the bridge directly in Chrome:

```text
http://127.0.0.1:8765/health
```

Expected response is JSON with `ok: true` and `platform: "win32"` on Windows.

The bridge uses Windows WIA. The scanner's official Windows WIA driver must be installed and Windows must be able to see the physical scanner.
