# External integrations

## Payments
Stripe (or an approved equivalent) should create Checkout/PaymentIntent sessions. The webhook, not the browser, must be the source of truth for successful payment and subscription activation.

## Email
Use Resend, AWS SES, SMTP or an equivalent transactional provider for verification codes, invitations, password resets, billing reminders and important notifications.

## Storage
Use S3-compatible storage in production. Keep objects private and issue short-lived signed URLs after authorization.

## Fax / scanner
Select a provider/hardware SDK for the target environment. Scanner access is workstation/device dependent; browsers cannot silently control arbitrary local scanners without a supported integration layer.

## AI
Connect an approved AI provider through `AI_API_KEY`. Do not send tenant files to an AI provider until data retention, access control and consent rules are defined.
