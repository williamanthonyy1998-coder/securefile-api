import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { db } from '../db';
import { auth, AuthedRequest, role } from '../middleware/auth';
import { activeSubscription } from '../middleware/subscription';
import { randomToken, hashToken } from '../utils/security';
import { notify, notifyCompanyUsers } from '../services/notify';
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
      password: z.string().min(10, 'Password must be at least 10 characters').max(128),
      role: z.enum(['EMPLOYEE', 'CLIENT']).default('EMPLOYEE'),
      folderIds: z.array(z.string()).optional().default([]),
      personalFolderAllowed: z.boolean().default(true),
    }).safeParse(req.body);
    if (!input.success) return res.status(400).json({ error: input.error.issues[0]?.message || 'Valid name, email, password and role are required' });

    const { email, name, password, role: userRole, folderIds, personalFolderAllowed } = input.data;
    const sub = await db.subscription.findUnique({ where: { companyId } });
    const count = await db.user.count({ where: { companyId } });
    if (!sub || count >= sub.users) return res.status(409).json({ error: 'Purchased user limit reached' });

    const normalizedEmail = email.toLowerCase().trim();
    if (await db.user.findUnique({ where: { email: normalizedEmail } })) return res.status(409).json({ error: 'Email already exists' });

    const bcrypt = (await import('bcryptjs')).default;
    const passwordHash = await bcrypt.hash(password, 12);

    const u = await db.user.create({
      data: {
        companyId,
        email: normalizedEmail,
        uniqueName: name.trim(),
        passwordHash,
        role: userRole,
        // New company users remain invited until they accept the invitation.
        // The supplied temporary password is still usable for login; accepting
        // the invitation upgrades the account to ACTIVE and lets the user set
        // their own password.
        status: 'INVITED',
        emailVerifiedAt: new Date(),
        personalFolderAllowed,
      }
    });

    if (personalFolderAllowed) {
      await db.folder.create({ data: { companyId, ownerId: u.id, name: 'Personal Folder', isPersonal: true } });
    }

    // Grant access to any company folders selected during user creation.
    for (const folderId of folderIds) {
      const folder = await db.folder.findFirst({ where: { id: String(folderId), companyId, deletedAt: null, isPersonal: false } });
      if (!folder) continue;
      await db.share.create({
        data: {
          companyId, folderId: folder.id, ownerId: req.user!.id, recipientId: u.id,
          canView: true, canDownload: true, canUpload: false, canEdit: false, canDelete: false, canShare: false
        }
      });
    }

    // Revoke any older pending invitation/reset tokens, then create a fresh
    // 24-hour invitation and password-reset link.
    await db.verificationToken.updateMany({
      where: { userId: u.id, usedAt: null, type: { in: ['INVITATION', 'PASSWORD_RESET'] } },
      data: { usedAt: new Date() },
    });
    const invitationToken = randomToken();
    await db.verificationToken.create({
      data: {
        userId: u.id,
        tokenHash: hashToken(invitationToken),
        type: 'INVITATION',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    const resetToken = randomToken();
    await db.verificationToken.create({
      data: {
        userId: u.id,
        tokenHash: hashToken(resetToken),
        type: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    const invitationUrl = `${env.APP_URL}/accept-invitation?token=${encodeURIComponent(invitationToken)}`;
    const resetUrl = `${env.APP_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;

    await notify(u.id, 'Invitation sent', 'Your SecureFile account invitation has been sent. Accept it to activate your account and set your own password.', companyId, 'USER_INVITED', false);
    let emailDelivered = false;
    try {
      await sendUserEmail(
        u.email,
        'Your SecureFile account is ready',
        `<p>Hello <strong>${u.uniqueName}</strong>,</p>
         <p>Your SecureFile account has been created and an invitation is waiting for you.</p>
         <p><strong>Email:</strong> ${u.email}<br/><strong>Temporary password:</strong> ${escapeHtml(password)}</p>
         <p><a href="${invitationUrl}">Accept invitation &amp; set a new password</a></p>
         <p>You may also sign in with the email and temporary password above. The invitation/password links expire in <strong>24 hours</strong>.</p>
         <p><a href="${resetUrl}">Reset / change your password</a></p>`
      );
      emailDelivered = true;
    } catch (mailError) {
      console.error('USER_ACCOUNT_EMAIL_ERROR:', mailError);
    }

    res.status(201).json({
      id: u.id, email: u.email, name: u.uniqueName, role: u.role, status: u.status,
      personalFolderAllowed: u.personalFolderAllowed,
      emailDelivered,
      invitationUrl: env.NODE_ENV === 'development' ? invitationUrl : undefined,
    });
  } catch (e) { next(e); }
});

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]!));
}

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
    await notify(user.id, 'Account updated', 'Your SecureFile account details or role were updated by your Company Admin.', user.companyId!, 'USER_ACTIVATED', true, { entityId: user.id });
    res.json(updated);
  } catch (e) { next(e); }
});

r.patch('/:id/status', auth, activeSubscription, role('COMPANY_ADMIN'), async (req: AuthedRequest, res, next) => {
  try {
    const u = await db.user.findFirst({ where: companyUserWhere(req, String(req.params.id)) });
    if (!u) return res.status(404).json({ error: 'User not found' });
    const status = req.body.status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED';
    const updated = await db.user.update({ where: { id: u.id }, data: { status } });
    await notify(u.id, status === 'ACTIVE' ? 'Account activated' : 'Account suspended', status === 'ACTIVE' ? 'Your SecureFile account has been activated.' : 'Your SecureFile account has been suspended. Contact your Company Admin if you need access restored.', u.companyId!, status === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_SUSPENDED', true, { entityId: u.id });
    res.json(updated);
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
      data: { userId: u.id, tokenHash: hashToken(token), type: 'INVITATION', expiresAt: new Date(Date.now() + 24 * 3600 * 1000) }
    });
    const url = `${env.APP_URL}/accept-invitation?token=${encodeURIComponent(token)}`;
    await sendUserEmail(u.email, 'Your SecureFile invitation', `<p><a href="${url}">Accept invitation</a></p><p>This invitation expires in 24 hours.</p>`);
    await notify(u.id, 'Invitation resent', 'Your SecureFile invitation has been resent. The new invitation expires in 24 hours.', u.companyId!, 'USER_INVITED', false, { entityId: u.id });
    res.json({ ok: true, invitationUrl: env.NODE_ENV === 'development' ? url : undefined });
  } catch (e) { next(e); }
});

r.delete('/:id', auth, activeSubscription, role('COMPANY_ADMIN'), async (req: AuthedRequest, res, next) => {
  try {
    const u = await db.user.findFirst({ where: companyUserWhere(req, String(req.params.id)) });
    if (!u) return res.status(404).json({ error: 'User not found' });
    await db.user.delete({ where: { id: u.id } });
    await notifyCompanyUsers(u.companyId!, 'User removed', `${u.uniqueName || u.email} was removed from the company workspace.`, 'USER_SUSPENDED', { excludeUserId: req.user!.id });
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
    const activated = await db.user.update({ where: { id: row.userId }, data: { passwordHash, status: 'ACTIVE', emailVerifiedAt: new Date() } });
    await db.verificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    await notifyCompanyUsers(activated.companyId!, 'User activated', `${activated.uniqueName || activated.email} has activated their SecureFile account.`, 'USER_ACTIVATED', { excludeUserId: activated.id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
