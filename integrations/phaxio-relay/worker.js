/**
 * SecureFile Phaxio relay for Vercel deployments.
 *
 * Why this exists: Vercel Functions have a 4.5 MB request-body limit, while
 * Phaxio receive webhooks are multipart/form-data and include the received PDF.
 * The relay accepts the provider callback, forwards only metadata to SecureFile,
 * and SecureFile downloads the fax PDF directly from Phaxio using the fax id.
 */
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method Not Allowed', {status: 405});
    const form = await request.formData();
    const faxRaw = form.get('fax');
    const payload = new URLSearchParams();
    for (const [key, value] of form.entries()) {
      if (key === 'file') continue;
      if (typeof value === 'string') payload.set(key, value);
    }
    if (faxRaw && typeof faxRaw === 'string') payload.set('fax', faxRaw);
    const id = payload.get('id') || (() => {
      try { return JSON.parse(payload.get('fax') || '{}').id || ''; } catch { return ''; }
    })();
    if (!id) return new Response('Missing Phaxio fax id', {status: 400});
    const target = `${env.SECUREFILE_FAX_WEBHOOK_URL}?token=${encodeURIComponent(env.SECUREFILE_FAX_WEBHOOK_TOKEN)}`;
    const response = await fetch(target, {
      method: 'POST',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      body: payload.toString(),
    });
    return new Response(await response.text(), {status: response.status, headers: {'content-type': 'application/json'}});
  }
};
