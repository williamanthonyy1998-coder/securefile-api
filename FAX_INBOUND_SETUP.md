# SecureFile Incoming Fax

## Incoming fax flow

When a fax is received by the company's real fax number/provider, the provider sends the received PDF to:

`POST /api/integrations/fax/inbound`

The generic webhook accepts:

- `recipientEmail` (recommended) or `userId`
- `companyId` when using `userId`
- `fromNumber` (optional)
- multipart `file`
- header `x-fax-webhook-secret`

SecureFile then:

1. Verifies the webhook secret.
2. Finds the SecureFile recipient.
3. Verifies the workspace has an ACTIVE subscription with the Fax feature.
4. Checks available storage.
5. Stores the fax as a `FAX` file owned by the recipient.
6. Counts its size against workspace storage.
7. Creates an in-app notification.
8. Shows it in **Fax Documents → Received faxes**.

## Important

SecureFile does not itself provide a telephone/fax-network number. A real inbound fax number and provider are still required. Configure that provider to POST the received fax to the SecureFile webhook.

The provider's exact webhook field names vary. Map them to the generic fields above, or adapt `backend/src/routes/integrations.ts`.

For local development, a provider cannot reach `localhost` directly; use a public HTTPS tunnel or deploy the API.

If storage is full, the incoming fax is rejected and the company must increase storage after the storage/payment approval workflow completes.
