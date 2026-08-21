# SecureFile Fax Setup

SecureFile supports outbound and inbound fax through Phaxio.

## Outbound
Activate Fax on the subscription, configure `PHAXIO_API_KEY` and `PHAXIO_API_SECRET`, then open **Fax Documents**. Select a stored file, enter an E.164 recipient number such as `+14155551234`, and send. SecureFile stores the provider fax ID and status.

## Inbound
Each company needs its own provider-assigned fax number. Save that number under **Settings → Company fax number**. Configure the provider receive callback as:
`https://YOUR-SECUREFILE-API/api/integrations/fax/webhook?secret=YOUR_FAX_WEBHOOK_SECRET`

When a completed inbound fax arrives, SecureFile matches the destination number to the company, downloads the provider PDF, stores it in Files as a FAX document, records the inbound fax, updates storage usage, and notifies the Company Admin.
