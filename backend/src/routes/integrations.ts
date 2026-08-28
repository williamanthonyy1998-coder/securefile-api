import { activeSubscription } from '../middleware/subscription';
import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import { db } from '../db';
import { auth, AuthedRequest } from '../middleware/auth';
import { env } from '../config/env';
import { requireAddon } from '../services/entitlements';
import { safeFilename } from '../utils/security';
import { putObject, deleteObject } from '../services/storage';
import { notify } from '../services/notify';
import { getPhaxioFaxFile } from '../services/fax';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 } });
const r = Router();

function phaxioCallbackValid(req:any): boolean {
  const signature=String(req.headers['x-phaxio-signature']||'').trim();
  const token=env.PHAXIO_CALLBACK_TOKEN||env.FAX_WEBHOOK_SECRET;
  if(!token) return false;
  if(!signature) return false;
  const callbackUrl=String(env.PHAXIO_CALLBACK_URL||`${req.protocol}://${req.get('host')}/api/integrations/fax/webhook`);
  const params:any={...req.body};
  const fileParts:any={};
  if(req.file) fileParts[req.file.fieldname]=req.file;
  const names=Object.keys(params).sort();
  let base=callbackUrl;
  for(const name of names) base+=name+String(params[name]);
  for(const name of Object.keys(fileParts).sort()){
    const f=fileParts[name];
    base+=name+crypto.createHash('sha1').update(f.buffer).digest('hex');
  }
  const expected=crypto.createHmac('sha1',token).update(base).digest('hex');
  const a=Buffer.from(expected),b=Buffer.from(signature);
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function parseProviderObject(value:any){
  if(!value)return {};
  if(typeof value==='object')return value;
  try{return JSON.parse(String(value))||{}}catch{return {}}
}

/**
 * Provider-agnostic inbound email endpoint.
 * Configure your mail provider to POST received messages here with x-inbound-email-secret.
 * It stores the message in the recipient user's SecureFile mailbox.
 */
r.post('/email/inbound', async (req, res, next) => {
  try {
    const secret = env.INBOUND_EMAIL_SECRET;
    if (!secret || req.headers['x-inbound-email-secret'] !== secret) {
      return res.status(401).json({ error: 'Invalid inbound email webhook secret' });
    }

    const to = String(req.body.to || req.body.recipientEmail || '').trim().toLowerCase();
    const from = String(req.body.from || req.body.senderEmail || '').trim().toLowerCase();
    const subject = String(req.body.subject || '(No subject)').trim().slice(0, 180);
    const body = String(req.body.text || req.body.body || req.body.html || '').trim().slice(0, 50000);
    if (!to || !from || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
      return res.status(400).json({ error: 'Valid from and to email addresses are required' });
    }

    const recipient = await db.user.findUnique({ where: { email: to }, select: { id: true, companyId: true, email: true } });
    if (!recipient?.companyId) return res.status(404).json({ error: 'SecureFile recipient mailbox not found' });

    const sender = await db.user.findFirst({ where: { companyId: recipient.companyId, email: from }, select: { id: true } });
    const id = crypto.randomUUID();
    await db.$executeRaw`
      INSERT INTO "EmailMessage" ("id","companyId","senderId","recipientId","recipientEmail","subject","body","direction","createdAt")
      VALUES (${id},${recipient.companyId},${sender?.id||null},${recipient.id},${recipient.email},${subject},${body},'RECEIVED',NOW())`;
    await notify(recipient.id, 'New email', subject, recipient.companyId);
    res.status(201).json({ ok: true, id });
  } catch (e) { next(e); }
});

r.post('/fax/inbound', upload.single('file'), async (req, res) => {
  // Legacy/manual inbound endpoint. Production Phaxio callbacks should use /fax/webhook.
  if (!env.FAX_WEBHOOK_SECRET || req.headers['x-fax-webhook-secret'] !== env.FAX_WEBHOOK_SECRET) return res.status(401).json({ error: 'Invalid fax webhook' });
  const companyId = String(req.body.companyId || ''); const userId = String(req.body.userId || '');
  const user = await db.user.findFirst({ where: { id: userId, companyId } });
  if (!user || !req.file) return res.status(400).json({ error: 'Valid user and fax file required' });
  const sub = await db.subscription.findUnique({ where: { companyId }, select: { addons: true, status: true } });
  if (sub?.status !== 'ACTIVE' || !(sub.addons as any)?.fax) return res.status(402).json({ error: 'Fax add-on is not active' });
  const key = `fax-${crypto.randomUUID()}`; await putObject(key, req.file.buffer, req.file.mimetype || 'application/pdf');
  const f = await db.file.create({ data: { companyId, ownerId: userId, name: safeFilename(req.file.originalname || 'Incoming Fax.pdf'), storageKey: key, mimeType: req.file.mimetype || 'application/pdf', sizeBytes: req.file.size, source: 'FAX' } });
  await db.company.update({ where: { id: companyId }, data: { storageUsedBytes: { increment: req.file.size } } });
  await db.faxJob.create({ data: { companyId, userId, direction: 'INBOUND', status: 'RECEIVED', senderNumber: String(req.body.from_number || ''), recipientNumber: String(req.body.to_number || ''), fileId: f.id, provider: 'PHAXIO', providerRef: req.body.id ? String(req.body.id) : null, pages: req.body.num_pages ? Number(req.body.num_pages) : null } });
  await notify(userId, 'New fax received', `A new fax was received on your personal fax number.`, companyId, undefined, true);
  res.status(201).json({ id: f.id });
});

/**
 * Real Phaxio callback endpoint for both inbound and outbound fax events.
 * Phaxio sends multipart/form-data and includes the received PDF as `file` for inbound faxes.
 * The callback URL can contain ?token=<FAX_WEBHOOK_SECRET> for an additional shared-secret check.
 */
r.post('/fax/webhook', upload.single('file'), async (req, res) => {
  try {
    const legacyToken=env.FAX_WEBHOOK_SECRET;
    const signed=phaxioCallbackValid(req);
    const legacy=Boolean(legacyToken && req.query.token===legacyToken);
    if(!signed && !legacy) return res.status(401).json({ error: 'Invalid fax webhook signature' });

    const providerFax=parseProviderObject(req.body.fax);
    const eventType=String(req.body.event_type||'').toLowerCase();
    const direction = String(req.body.direction || providerFax.direction || '').toLowerCase();
    const faxId = String(req.body.id || req.body.fax_id || providerFax.id || '').trim();
    const status = String(req.body.status || providerFax.status || '').toLowerCase();
    const success = String(req.body.success || '').toLowerCase() === 'true' || status === 'success';

    if (direction === 'received' || req.file) {
      const toNumber = String(req.body.to_number || providerFax.to_number || providerFax.recipient_phone_number || '').trim();
      const line = await db.faxLine.findUnique({ where: { phoneNumber: toNumber } });
      if (!line?.active) return res.status(404).json({ error: 'Receiving fax number is not assigned to a SecureFile user' });
      const sub = await db.subscription.findUnique({ where: { companyId: line.companyId }, select: { addons: true, status: true } });
      if (sub?.status !== 'ACTIVE' || !(sub.addons as any)?.fax) return res.status(402).json({ error: 'Fax add-on is not active' });

      // Idempotency: Phaxio retries failed callbacks, so do not create duplicate files/jobs.
      if (faxId) {
        const existing = await db.faxJob.findFirst({ where: { provider: 'PHAXIO', providerRef: faxId, direction: 'INBOUND' } });
        if (existing) return res.json({ ok: true, duplicate: true, jobId: existing.id });
      }

      let buffer = req.file?.buffer;
      if (!buffer && faxId) buffer = await getPhaxioFaxFile(faxId);
      if (!buffer) return res.status(400).json({ error: 'Received fax PDF was not provided by the fax provider' });
      const name = safeFilename(String(req.file?.originalname || `Incoming Fax ${new Date().toISOString().slice(0,10)}.pdf`));
      const key = `fax-${crypto.randomUUID()}`;
      await putObject(key, buffer, 'application/pdf');
      try {
        const f = await db.file.create({ data: { companyId: line.companyId, ownerId: line.userId, name, storageKey: key, mimeType: 'application/pdf', sizeBytes: buffer.length, source: 'FAX' } });
        await db.company.update({ where: { id: line.companyId }, data: { storageUsedBytes: { increment: buffer.length } } });
        const job = await db.faxJob.create({ data: { companyId: line.companyId, userId: line.userId, direction: 'INBOUND', status: 'RECEIVED', senderNumber: String(req.body.from_number || providerFax.from_number || '').trim() || null, recipientNumber: toNumber || null, fileId: f.id, provider: 'PHAXIO', providerRef: faxId || null, pages: req.body.num_pages ? Number(req.body.num_pages) : (providerFax.num_pages ? Number(providerFax.num_pages) : null) } });
        await notify(line.userId, 'New fax received', `${name} was received on your personal fax number.`, line.companyId, undefined, true);
        return res.status(201).json({ ok: true, jobId: job.id, fileId: f.id });
      } catch (e) { await deleteObject(key); throw e; }
    }

    // Outbound completion callback. Match by provider fax id first, then by SecureFile tag.
    let job = faxId ? await db.faxJob.findFirst({ where: { provider: 'PHAXIO', providerRef: faxId, direction: 'OUTBOUND' } }) : null;
    const tagJobId = String(req.body['tag[securefile_job_id]'] || req.body.securefile_job_id || '').trim();
    if (!job && tagJobId) job = await db.faxJob.findFirst({ where: { id: tagJobId, direction: 'OUTBOUND' } });
    if (!job) return res.json({ ok: true, ignored: true });

    const failed = (!success && eventType !== 'fax_completed') || ['failure','failed','error','error_state'].includes(status) || (eventType==='fax_completed' && status!=='success');
    const updated = await db.faxJob.update({ where: { id: job.id }, data: { status: failed ? 'FAILED' : 'SENT', errorMessage: failed ? (String(req.body.error_message || providerFax.error_message || req.body.error_type || providerFax.error_type || 'Fax transmission failed').slice(0,500)) : null, pages: req.body.num_pages ? Number(req.body.num_pages) : job.pages } });
    await notify(job.userId, failed ? 'Fax delivery failed' : 'Fax delivered', failed ? `Your fax to ${job.recipientNumber || 'the recipient'} could not be delivered.` : `Your fax to ${job.recipientNumber || 'the recipient'} was delivered successfully.`, job.companyId, undefined, true);
    res.json({ ok: true, jobId: updated.id, status: updated.status });
  } catch (e:any) {
    res.status(500).json({ error: e.message || 'Fax webhook processing failed' });
  }
});

r.post('/postal/send', auth, activeSubscription, async (req: AuthedRequest, res) => {
  await requireAddon(req.user!.companyId!, 'postal');
  if (!env.POSTAL_API_KEY || !env.POSTAL_API_URL) return res.status(503).json({ error: 'Postal provider is not configured' });
  res.status(501).json({ error: 'Postal provider adapter is configured but requires provider-specific payload mapping.' });
});
export default r;
