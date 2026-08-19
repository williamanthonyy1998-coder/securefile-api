# SecureFile Email Setup

The Chat module has two separate channels:

- **Chat**: internal SecureFile messages stored in the company workspace.
- **Email**: actual outbound email sent to a real inbox through Resend.

## UI

Open **Chat** and use either:

- **Email** in the left panel to compose an email to any valid email address.
- **Email** in a direct conversation header to email that person.
- **Compose email** in the conversation empty state.

## Required server configuration

Set these in the project-root `.env`:

```env
EMAIL_PROVIDER=resend
EMAIL_FROM=no-reply@your-verified-domain.com
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
```

The `EMAIL_FROM` address/domain must be verified in Resend.

Restart the backend after changing `.env`:

```cmd
npm run dev
```

The Chat page shows whether email delivery is configured. The API endpoint is:

`GET /workspace/email/status`

## Important

If `EMAIL_PROVIDER=console` or the Resend key is missing, SecureFile cannot deliver an email to an external inbox. It will not pretend that an email was delivered.
