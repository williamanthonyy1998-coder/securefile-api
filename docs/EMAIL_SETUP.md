# SecureFile Email Setup

SecureFile does not have a mail server by itself. Invitations, email verification and password-reset messages require a transactional email provider or SMTP account.

## Resend

1. Create a Resend account.
2. Verify the sending domain/address.
3. Put these values in the root `.env`:

```env
EMAIL_PROVIDER=resend
EMAIL_FROM=no-reply@your-verified-domain.com
RESEND_API_KEY=re_xxxxxxxxx
```

Restart `npm run dev`.

## Gmail SMTP

For a Gmail/Google Workspace mailbox, enable 2-Step Verification and create an App Password.

```env
EMAIL_PROVIDER=smtp
EMAIL_FROM=your-mailbox@yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-mailbox@yourdomain.com
SMTP_PASS=your-16-character-app-password
SMTP_SECURE=false
```

Do not put the normal Google account password in `SMTP_PASS`.

## Auto mode

```env
EMAIL_PROVIDER=auto
```

Auto chooses Resend if `RESEND_API_KEY` is present, otherwise SMTP if all SMTP credentials are present. If neither is configured, email is logged to the backend console and is not delivered.

## Test

Open:

`http://localhost:4000/healthz`

You should see:

```json
{
  "ok": true,
  "emailConfigured": true,
  "emailProvider": "resend"
}
```

Then create/resend an invitation or verification email and check the recipient mailbox and provider logs.
