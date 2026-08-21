import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { db } from '../db';
import { auth, AuthedRequest, role } from '../middleware/auth';
import { activeSubscription } from '../middleware/subscription';
import { randomToken, hashToken } from '../utils/security';
import { notify } from '../services/notify';
import { sendUserEmail } from '../services/email';
import { env } from '../config/env';
import { z } from 'zod';

const r = Router();

function companyUserWhere(req: AuthedRequest, id?: string) {
  return { ...(id ? { id } : {}), companyId: req.user!.companyId!, role: { in: ['EMPLOYEE', 'CLIENT'] as any[] } };
}

r.get('/', auth, async (req: AuthedRequest, res, next) => {
  try {
    if (!req.user?.companyId) return res.status(400).json({ error: 'No company' });
    const users = await db.user.findMany({
      where: { companyId: req.user.companyId },
      select: {
        id: true, email: true, uniqueName: true, role: true, status: true,
        emailVerifiedAt: true, personalFolderAllowed: true, createdAt: true,
        _count: { select: { ownedFiles: true, ownedFolders: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (e) { next(e); }
});

r.get('/meta', auth, role('COMPANY_ADMIN'), async (req: AuthedRequest, res, next) => {
  try {
    const companyId = req.user!.companyId!;
    const [subscription, count] = await Promise.all([
      db.subscription.findUnique({ where: { companyId }, select: { users: true, storageGb: true, status: true, expiresAt: true, addons: true } }),
      db.user.count({ where: { companyId } })
    ]);
    res.json({
      purchasedSeats: subscription?.users ?? 0,
      usedSeats: count,
      remainingSeats: Math.max(0, (subscription?.users ?? 0) - count),
      storageGb: subscription?.storageGb ?? 0,
      status: subscription?.status ?? 'NONE',
      expiresAt: subscription?.expiresAt ?? null,
      addons: subscription?.addons ?? {}
    });
  } catch (e) { next(e); }
});

r.post('/', auth, activeSubscription, role('COMPANY_ADMIN'), async (req: AuthedRequest, res, next) => {
  try {
    const companyId = req.user!.companyId!;
    const input = z.object({
      email: z.string().trim().email('Enter a valid email address').max(320),
      name: z.string().trim().min(2, 'Name is required').max(120),
      role: z.enum(['EMPLOYEE', 'CLIENT']).default('EMPLOYEE'),
      folderIds: z.array(z.string()).optional().default([])
    }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: input.error.issues[0]?.message || 'Valid email, name and role are required' });
    const { email, name, role: userRole, folderIds } = input.data;

    const sub = await db.subscription.findUnique({ where: { companyId } });
    const count = await db.user.count({ where: { companyId } });
    if (!sub || count >= sub.users) return res.status(409).json({ error: 'Purchased user limit reached' });

    const normalizedEmail = String(email).toLowerCase().trim();
    if (await db.user.findUnique({ where: { email: normalizedEmail } })) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const u = await db.user.create({
      data: {
        companyId,
        email: normalizedEmail,
        uniqueName: String(name).trim(),
        role: userRole,
        status: 'INVITED',
        personalFolderAllowed: true
      }
    });

    await db.folder.create({ data: { companyId, ownerId: u.id, name: 'Personal Folder', isPersonal: true } });

    if (Array.isArray(folderIds)) {
      for (const folderId of folderIds) {
        const folder = await db.folder.findFirst({ where: { id: String(folderId), companyId } });
        if (folder) {
          await db.share.create({
            data: {
              companyId, folderId: folder.id, ownerId: req.user!.id, recipientId: u.id,
              canView: true, canDownload: true, canUpload: false, canEdit: false, canDelete: false, canShare: false
            }
          });
        }
      }
    }

    const token = randomToken();
    await db.verificationToken.create({
      data: {
        userId: u.id, tokenHash: hashToken(token), type: 'INVITATION',
        expiresAt: new Date(Date.now() + 72 * 3600 * 1000)
      }
    });

    const url = `${env.APP_URL}/accept-invitation?token=${encodeURIComponent(token)}`;
    await notify(u.id, 'You were invited', 'You were invited to your SecureFile company workspace.', companyId);
    await sendUserEmail(u.email, 'Your SecureFile invitation',
      `<p>You have been invited to a SecureFile workspace.</p><p><a href="${url}">Accept invitation</a></p><p>This invitation expires in 72 hours.</p>`
    );

    res.status(201).json({
      id: u.id, email: u.email, name: u.uniqueName,
      invitationUrl: env.NODE_ENV === 'development' ? url : undefined
    });
  } catch (e) { next(e); }
});

r.get('/:id/permissions', auth, role('COMPANY_ADMIN'), async (req: AuthedRequest, res, next) => {
  try {
    const user = await db.user.findFirst({ where: companyUserWhere(req, String(req.params.id)) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const shares = await db.share.findMany({
      where: { companyId: req.user!.companyId!, recipientId: user.id, folderId: { not: null } },
      include: { folder: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(shares);
  } catch (e) { next(e); }
});

r.put('/:id/permissions', auth, activeSubscription, role('COMPANY_ADMIN'), async (req: AuthedRequest, res, next) => {
  try {
    const companyId = req.user!.companyId!;
    const user = await db.user.findFirst({ where: companyUserWhere(req, String(req.params.id)) });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const folderPermissions = Array.isArray(req.body.folders) ? req.body.folders : [];
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.share.deleteMany({ where: { companyId, recipientId: user.id, folderId: { not: null }, ownerId: req.user!.id } });
      for (const item of folderPermissions) {
        const folder = await tx.folder.findFirst({ where: { id: String(item.folderId), companyId } });
        if (!folder) continue;
        await tx.share.create({
          data: {
            companyId, folderId: folder.id, ownerId: req.user!.id, recipientId: user.id,
            canView: item.canView !== false,
            canDownload: item.canDownload !== false,
            canUpload: Boolean(item.canUpload),
            canEdit: Boolean(item.canEdit),
            canDelete: Boolean(item.canDelete),
            canShare: Boolean(item.canShare)
          }
        });
      }
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.patch('/:id', auth, activeSubscription, role('COMPANY_ADMIN'), async (req: AuthedRequest, res, next) => {
  try {
    const user = await db.user.findFirst({ where: companyUserWhere(req, String(req.params.id)) });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const data: any = {};
    if (req.body.name !== undefined) data.uniqueName = String(req.body.name).trim();
    if (req.body.role !== undefined && ['EMPLOYEE', 'CLIENT'].includes(req.body.role)) data.role = req.body.role;
    data.personalFolderAllowed = true;
    const updated = await db.user.update({ where: { id: user.id }, data });
    if (data.personalFolderAllowed === true) {
      const existing = await db.folder.findFirst({ where: { companyId: user.companyId!, ownerId: user.id, isPersonal: true } });
      if (!existing) await db.folder.create({ data: { companyId: user.companyId!, ownerId: user.id, name: 'Personal Folder', isPersonal: true } });
    }
    res.json(updated);
  } catch (e) { next(e); }
});

r.patch('/:id/status', auth, activeSubscription, role('COMPANY_ADMIN'), async (req: AuthedRequest, res, next) => {
  try {
    const u = await db.user.findFirst({ where: companyUserWhere(req, String(req.params.id)) });
    if (!u) return res.status(404).json({ error: 'User not found' });
    const status = req.body.status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED';
    res.json(await db.user.update({ where: { id: u.id }, data: { status } }));
  } catch (e) { next(e); }
});

r.post('/:id/resend-invitation', auth, activeSubscription, role('COMPANY_ADMIN'), async (req: AuthedRequest, res, next) => {
  try {
    const u = await db.user.findFirst({ where: companyUserWhere(req, String(req.params.id)) });
    if (!u) return res.status(404).json({ error: 'User not found' });

    await db.verificationToken.updateMany({
      where: { userId: u.id, type: 'INVITATION', usedAt: null },
      data: { usedAt: new Date() }
    });
    const token = randomToken();
    await db.verificationToken.create({
      data: { userId: u.id, tokenHash: hashToken(token), type: 'INVITATION', expiresAt: new Date(Date.now() + 72 * 3600 * 1000) }
    });
    const url = `${env.APP_URL}/accept-invitation?token=${encodeURIComponent(token)}`;
    await sendUserEmail(u.email, 'Your SecureFile invitation', `<p><a href="${url}">Accept invitation</a></p><p>This invitation expires in 72 hours.</p>`);
    res.json({ ok: true, invitationUrl: env.NODE_ENV === 'development' ? url : undefined });
  } catch (e) { next(e); }
});

r.delete('/:id', auth, activeSubscription, role('COMPANY_ADMIN'), async (req: AuthedRequest, res, next) => {
  try {
    const u = await db.user.findFirst({ where: companyUserWhere(req, String(req.params.id)) });
    if (!u) return res.status(404).json({ error: 'User not found' });
    await db.user.delete({ where: { id: u.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

r.post('/accept-invitation', async (req, res, next) => {
  try {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (password.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters' });
    const row = await db.verificationToken.findFirst({
      where: { tokenHash: hashToken(token), type: 'INVITATION', usedAt: null, expiresAt: { gt: new Date() } }
    });
    if (!row) return res.status(400).json({ error: 'Invalid or expired invitation' });
    const bcrypt = (await import('bcryptjs')).default;
    const passwordHash = await bcrypt.hash(password, 12);
    await db.$transaction([
      db.user.update({ where: { id: row.userId }, data: { passwordHash, status: 'ACTIVE', emailVerifiedAt: new Date() } }),
      db.verificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } })
    ]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
