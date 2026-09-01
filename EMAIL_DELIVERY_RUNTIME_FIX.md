# Email delivery runtime fix

## What changed
- Email provider failures no longer turn SecureFile business actions into HTTP 500 errors.
- Notification emails are fire-and-forget, so chat/task/request actions do not wait several seconds for Resend.
- The explicit `/api/workspace/email` endpoint stores the SecureFile mail first and returns immediately; external delivery runs asynchronously.
- Resend failures are logged as `EMAIL_DELIVERY_FAILED` instead of crashing the request.
- Duplicate recipient notification in the workspace email route was removed.

## Resend testing restriction
Resend's test sender (`onboarding@resend.dev`) only permits delivery to the Resend account owner's address. For real users/clients, verify a sending domain in Resend and set:

EMAIL_PROVIDER=resend
EMAIL_FROM=no-reply@your-verified-domain.com
RESEND_API_KEY=re_...

This provider restriction cannot be bypassed by application code. The application now keeps the SecureFile action successful even when the external provider rejects a test-mode recipient.
