# SecureFile — Personal Fax Numbers / Send + Receive

## What changed
- Every SecureFile user can have one personal fax line (`FaxLine`).
- Incoming faxes are routed by the provider's `to_number` to the matching SecureFile user.
- Incoming PDFs are stored as `FAX` files owned by that user and are therefore subject to normal SecureFile sharing/permission rules.
- Users can send a fax from an existing SecureFile file or upload a document for a one-off fax.
- The user's personal fax number is used as caller ID when the provider supports it.
- Each user's fax history is private to that user.
- Phaxio completion callbacks update SENT/FAILED status and create realtime notifications.
- Phaxio receive callbacks create a private file, fax job, and realtime notification.
- Duplicate inbound callbacks are ignored using the provider fax ID.

## Provider setup
1. Configure `PHAXIO_API_KEY` and `PHAXIO_API_SECRET`.
2. Set `PHAXIO_CALLBACK_URL` to the public HTTPS URL for `/api/integrations/fax/webhook`.
3. Set a strong random `FAX_WEBHOOK_SECRET`.
4. A user's "Get my fax number" action provisions a real receiving number with a per-number callback URL containing the webhook token.
5. The user enters a 3-digit area code when provisioning a number.

Phaxio phone-number provisioning and receive callbacks are provider operations and may create provider charges. Do not expose provider API credentials in the frontend.
