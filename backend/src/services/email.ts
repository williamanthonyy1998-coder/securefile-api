import { env } from '../config/env';

function esc(value: string) {
  return value.replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]!));
}

export function emailConfigured() {
  return env.EMAIL_PROVIDER === 'resend' && Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export function emailTemplate(title: string, body: string, action?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#172033"><div style="max-width:620px;margin:40px auto;background:#fff;border:1px solid #e5e9f0;border-radius:16px;overflow:hidden"><div style="padding:24px 28px;border-bottom:1px solid #edf0f4"><div style="font-size:22px;font-weight:800">Secure<span style="color:#2463eb">File</span></div></div><div style="padding:30px 28px"><h1 style="font-size:24px;margin:0 0 16px">${esc(title)}</h1>${body}${action ? `<p style="margin:24px 0"><a href="${action.url}" style="display:inline-block;background:#2463eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">${esc(action.label)}</a></p>` : ''}<p style="color:#7b8799;font-size:13px;margin-top:28px">This message was sent by SecureFile.</p></div></div></body></html>`;
}

export async function sendEmail(to: string, subject: string, html: string) {
  if (env.EMAIL_PROVIDER === 'console') {
    console.log(`[EMAIL:console] to=${to} subject=${subject}\n${html}`);
    return { delivered: false, provider: 'console' };
  }
  if (env.EMAIL_PROVIDER === 'resend') {
    if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER=resend');
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html })
    });
    const data: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.message || data?.error || `Email provider error: ${r.status}`);
    return { delivered: true, provider: 'resend', id: data?.id };
  }
  throw new Error('Unsupported email provider');
}
