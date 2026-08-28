# SecureFile Chat + Email Update

## Chat
- Professional two-column workspace chat UI
- Direct and group conversations
- People/group search
- Secure company-scoped messages
- Auto-refresh conversation
- Read-style sent indicators
- Email action from a direct conversation

## Email
SecureFile uses the configured email provider for:
- User invitations
- Email verification
- Password reset
- Subscription notifications
- "Send email" from Chat

### Configure Resend
In your project `.env`:

```env
EMAIL_PROVIDER=resend
EMAIL_FROM=no-reply@your-verified-domain.com
RESEND_API_KEY=re_xxxxxxxxx
```

The `EMAIL_FROM` domain/address must be verified with your email provider.

### Check configuration
After starting the backend:

`http://localhost:4000/healthz`

Expected example:

```json
{"ok":true,"emailConfigured":true,"emailProvider":"resend"}
```

If `emailConfigured` is false, invitation and verification delivery cannot reach a real mailbox.

## Database
New root scripts:

```text
npm run db:generate
npm run db:validate
npm run db:push
npm run db:seed
```

Do not run `prisma migrate reset` unless you intentionally want to delete development data.
