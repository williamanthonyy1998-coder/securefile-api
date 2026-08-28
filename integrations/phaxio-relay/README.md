# SecureFile Phaxio Relay

Use this small Cloudflare Worker when SecureFile's API is deployed on Vercel.
Vercel Functions have a 4.5 MB request-body limit, while Phaxio receive
webhooks include the received PDF as a multipart file. The relay accepts that
provider request, discards the binary PDF, and forwards only the fax metadata.
SecureFile then retrieves the PDF directly from Phaxio by fax id.

## Cloudflare setup

1. Create a Cloudflare Worker.
2. Deploy this folder with Wrangler.
3. Add these Worker secrets/variables:

- `SECUREFILE_FAX_WEBHOOK_URL` = `https://api.YOURDOMAIN.com/api/integrations/fax/webhook`
- `SECUREFILE_FAX_WEBHOOK_TOKEN` = the same long random value used by SecureFile `FAX_WEBHOOK_SECRET`

4. Give Phaxio the Worker URL as the receive webhook URL.
5. Enable Phaxio webhook signing and keep the provider token configured in SecureFile if you want direct signature verification on the Vercel endpoint; the relay path uses the SecureFile token fallback.

Cloudflare Workers currently allow request bodies up to 100 MB on Free/Pro plans, 200 MB on Business and 500 MB by default on Enterprise. Keep the relay streaming/metadata-only as shown; do not buffer the PDF in application memory unnecessarily.
