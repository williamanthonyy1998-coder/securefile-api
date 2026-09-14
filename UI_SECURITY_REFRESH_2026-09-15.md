# SecureFile UI + Security Refresh — 2026-09-15

This update adds the premium workspace/dashboard refresh, authentication UI refresh, profile photos, and optional TOTP two-factor authentication.

## Database

Run the normal production migration command from `backend`:

```bash
npm run migrate:deploy
```

Migration added:
`backend/prisma/migrations/20260915210000_profile_avatar_2fa/migration.sql`

Do **not** reset or force-reset the production database.

## New profile/security fields

- `User.avatarUrl`
- `User.twoFactorEnabled`
- `User.twoFactorSecret`
- `User.twoFactorPendingSecret`

## 2FA flow

1. User opens Settings → Security.
2. Clicks Set up 2FA.
3. SecureFile generates a TOTP setup key.
4. User adds the key to an authenticator app and enters the 6-digit code.
5. After enabling, login requires the authenticator code after the normal password.
6. Disabling 2FA requires the current password and current authenticator code.

The setup key is shown directly in SecureFile; it is not sent to a third-party QR service.
