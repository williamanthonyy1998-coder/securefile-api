# SecureFile Fax Workflow — 2026-09-01

## What is now supported
- Each SecureFile user can provision one personal receiving fax number.
- External senders can fax directly to that number.
- Inbound fax PDFs are stored as private SecureFile files owned by that user.
- The same user can send a fax to any E.164 destination from the Fax Documents module.
- A SecureFile file can be selected directly, or a browser file can be sent directly to the fax API.
- Direct browser uploads are stored as private FAX files after the provider accepts the fax, so the sent copy remains in history.
- Outbound status is updated by the provider webhook (QUEUED/SENT/FAILED).
- Inbound and outbound fax notifications are delivered through the existing SecureFile realtime SSE channel. The Fax page reloads only when a fax notification arrives; there is no polling interval.
- Received/sent documents can be opened or downloaded from fax history.

## Provider
The implementation uses the existing Phaxio v2.1 adapter. Phaxio supports provisioning receiving numbers, direct multipart fax sending, receiving callbacks, and send-completion webhooks.

## Required production environment
```env
PHAXIO_API_KEY=...
PHAXIO_API_SECRET=...
PHAXIO_BASE_URL=https://api.phaxio.com/v2.1
PHAXIO_CALLBACK_URL=https://YOUR_PUBLIC_API_DOMAIN/api/integrations/fax/webhook
PHAXIO_CALLBACK_TOKEN=...
```

`PHAXIO_CALLBACK_URL` must be publicly reachable over HTTPS in production. The callback token must be the webhook token configured in the Phaxio account.

## Local receive testing
A localhost callback cannot be reached by Phaxio. Use a public HTTPS tunnel/domain for `/api/integrations/fax/webhook` and set that URL in `PHAXIO_CALLBACK_URL`.

## User flow
1. Open **Fax Documents**.
2. Enter country code and 3-digit area code.
3. Click **Get my fax number**.
4. Give the displayed number to any fax sender.
5. Incoming faxes appear in **My fax history** and are saved privately.
6. To send, enter recipient E.164 number, select a SecureFile file or upload a document, and click **Send fax**.
7. Provider callbacks update delivery status automatically.
