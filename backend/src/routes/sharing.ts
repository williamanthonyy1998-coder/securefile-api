import { Router } from 'express';
import { db } from '../db';
import { auth, AuthedRequest } from '../middleware/auth';
import { hashPassword, hashToken, randomToken } from '../utils/security';
import { getFileAccess, getFolderAccess } from '../services/access';
import { activeSubscription } from '../middleware/subscription';
import { requireAddon } from '../services/entitlements';
import { notify, notifyCompanyAdmins } from '../services/notify';

const r = Router();
const permissionKeys = ['canView', 'canDownload', 'canUpload', 'canEdit', 'canDelete', 'canShare'] as const;

function validType(t: string) { return t === 'PUBLIC' || t === 'INTERNAL' ? t : 'INTERNAL'; }

async function canManageShare(req: AuthedRequest, share: any) {
  if (req.user!.role === 'COMPANY_ADMIN' || req.user!.role === 'SUPER_ADMIN') return true;
  if (share.ownerId === req.user!.id) return true;
  return Boolean(share.recipientId === req.user!.id && share.canShare);
}

r.post('/', auth, activeSubscription, async (req: AuthedRequest, res, next) => {
  try {
    const companyId = req.user!.companyId!;
    const { fileId, folderId, recipientId, permissions = {}, password, expiresAt } = req.body;
    const type = validType(String(req.body.type || 'INTERNAL'));
    if ((!fileId && !folderId) || (fileId && folderId)) return res.status(400).json({ error: 'Exactly one resource is required' });

    const source = fileId
      ? await getFileAccess(req.user!.id, req.user!.role, companyId, String(fileId), 'share')
      : await getFolderAccess(req.user!.id, req.user!.role, companyId, String(folderId), 'share');
    if (!source) return res.status(403).json({ error: 'Share permission denied' });
    if (Boolean(permissions.share)) await requireAddon(companyId, 'reshare');

    // Initial owner/admin sharing is part of the core workflow. The paid re-share
    // add-on is required only when a non-owner is sharing onward.
    const sourceOwnerId = (source as any).ownerId;
    if (req.user!.role !== 'COMPANY_ADMIN' && req.user!.role !== 'SUPER_ADMIN' && sourceOwnerId !== req.user!.id) {
      await requireAddon(companyId, 'reshare');
    }

    let recipient = null;
    if (type === 'INTERNAL') {
      if (!recipientId) return res.status(400).json({ error: 'Recipient required' });
      if (String(recipientId) === req.user!.id) return res.status(400).json({ error: 'You cannot share a resource with yourself' });
      recipient = await db.user.findFirst({ where: { id: String(recipientId), companyId, status: 'ACTIVE' } });
      if (!recipient) return res.status(404).json({ error: 'Recipient not found or not active' });
    }

    const rawPublic = type === 'PUBLIC' ? randomToken() : null;
    const s = await db.share.create({
      data: {
        companyId,
        fileId: fileId ? String(fileId) : undefined,
        folderId: folderId ? String(folderId) : undefined,
        ownerId: req.user!.id,
        recipientId: type === 'INTERNAL' ? String(recipientId) : undefined,
        type,
        publicTokenHash: rawPublic ? hashToken(rawPublic) : undefined,
        canView: permissions.view !== false,
        canDownload: Boolean(permissions.download),
        canUpload: Boolean(permissions.upload),
        canEdit: Boolean(permissions.edit),
        canDelete: Boolean(permissions.delete),
        canShare: Boolean(permissions.share),
        passwordHash: password ? await hashPassword(String(password)) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined
      }
    });
    if (recipient) {
      const resourceName = fileId ? (await db.file.findUnique({where:{id:String(fileId)},select:{name:true}}))?.name : (await db.folder.findUnique({where:{id:String(folderId)},select:{name:true}}))?.name;
      const sharer = await db.user.findUnique({where:{id:req.user!.id},select:{uniqueName:true,email:true}});
      await notify(recipient.id,'Resource shared with you',`${resourceName||'A resource'} was shared with you by ${sharer?.uniqueName||sharer?.email||'a SecureFile user'}.`,companyId, undefined, true);
    }
    await notifyCompanyAdmins(companyId,'Resource shared',`${fileId ? 'A file' : 'A folder'} was shared by ${req.user!.email || 'a user'}.`,'FILE_SHARED',{excludeUserId:req.user!.id,entityId:s.id});
    res.status(201).json({ ...s, publicToken: rawPublic });
  } catch (e) { next(e); }
});

r.get('/', auth, async (req: AuthedRequest, res, next) => {
  try {
    const shares = await db.share.findMany({
      where: { companyId: req.user!.companyId!, OR: [{ ownerId: req.user!.id }, { recipientId: req.user!.id }] },
      include: {
        file: { select: { id: true, name: true } },
        folder: { select: { id: true, name: true } },
        recipient: { select: { id: true, email: true, uniqueName: true } },
        owner: { select: { id: true, email: true, uniqueName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(shares.map(s => ({ ...s, manageable: s.ownerId === req.user!.id || req.user!.role === 'COMPANY_ADMIN' || req.user!.role === 'SUPER_ADMIN' || (s.recipientId === req.user!.id && s.canShare) })));
  } catch (e) { next(e); }
});

r.patch('/:id', auth, activeSubscription, async (req: AuthedRequest, res, next) => {
  try {
    const s = await db.share.findFirst({ where: { id: String(req.params.id), companyId: req.user!.companyId! } });
    if (!s || !(await canManageShare(req, s))) return res.status(403).json({ error: 'You do not have permission to manage this share' });
    const data: any = {};
    for (const key of permissionKeys) if (req.body[key] !== undefined) data[key] = Boolean(req.body[key]);
    if (data.canShare === true) await requireAddon(s.companyId, 'reshare');
    if (req.body.expiresAt === null) data.expiresAt = null;
    else if (req.body.expiresAt) data.expiresAt = new Date(req.body.expiresAt);
    const updated = await db.share.update({ where: { id: s.id }, data });
    if (s.recipientId) await notify(s.recipientId,'Share permissions updated','The permissions for a shared resource were updated.',s.companyId,'FILE_SHARED',true,{entityId:s.id});
    res.json(updated);
  } catch (e) { next(e); }
});

r.delete('/:id', auth, activeSubscription, async (req: AuthedRequest, res, next) => {
  try {
    const s = await db.share.findFirst({ where: { id: String(req.params.id), companyId: req.user!.companyId! } });
    if (!s || !(await canManageShare(req, s))) return res.status(403).json({ error: 'You do not have permission to revoke this share' });
    await db.share.delete({ where: { id: s.id } });
    if (s.recipientId) await notify(s.recipientId,'Share revoked','A shared resource is no longer available to you.',s.companyId,'FILE_SHARED',true,{entityId:s.id});
    res.status(204).end();
  } catch (e) { next(e); }
});

export default r;
