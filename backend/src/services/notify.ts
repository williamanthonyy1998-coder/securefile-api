import { db } from '../db';
import { emitToUser } from './realtime';
import { sendUserEmail, emailTemplate } from './email';
import { NotificationType, Prisma } from '@prisma/client';

export type NotifyOptions = {
  email?: boolean;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

/** Create one notification. Email is best-effort and never blocks the business action. */
export async function notify(
  userId: string,
  title: string,
  body: string,
  companyId?: string,
  type: NotificationType = NotificationType.SYSTEM,
  email = false,
  options: Omit<NotifyOptions, 'email'> = {},
) {
  const notification = await db.notification.create({
    data: {
      userId,
      title,
      body,
      companyId,
      type,
      entityId: options.entityId,
      metadata: options.metadata
  ? (options.metadata as Prisma.InputJsonValue)
  : undefined,
    },
  });

  // Instant delivery to connected clients. DB polling in realtime.ts covers
  // multi-instance/serverless deployments where the in-memory map is different.
  emitToUser(userId, 'notification', notification);

  if (email) await emailNotification(userId, title, body);
  return notification;
}

/** Notify all active company users except the actor. */
export async function notifyCompanyUsers(
  companyId: string,
  title: string,
  body: string,
  type: NotificationType = NotificationType.SYSTEM,
  options: NotifyOptions & { excludeUserId?: string; roles?: string[]; notifyActor?: boolean } = {},
) {
  const users = await db.user.findMany({
    where: {
      companyId,
      status: 'ACTIVE',
      ...(options.excludeUserId ? { id: { not: options.excludeUserId } } : {}),
      ...(options.roles?.length ? { role: { in: options.roles as any } } : {}),
    },
    select: { id: true },
  });

  await Promise.allSettled(
    users.map(u => notify(u.id, title, body, companyId, type, Boolean(options.email), options)),
  );

  // The actor is intentionally excluded from the company broadcast above,
  // but still receives the in-app notification. This keeps every module
  // consistent: when a user performs an action, they can see it immediately
  // in the notification center without receiving a duplicate email.
  if (options.excludeUserId && options.notifyActor !== false) {
    await notify(
      options.excludeUserId,
      title,
      body,
      companyId,
      type,
      false,
      options,
    );
  }
}

export async function notifyCompanyAdmins(
  companyId: string,
  title: string,
  body: string,
  type: NotificationType = NotificationType.SYSTEM,
  options: NotifyOptions & { excludeUserId?: string } = {},
) {
  return notifyCompanyUsers(companyId, title, body, type, {
    ...options,
    roles: ['COMPANY_ADMIN', 'SUPER_ADMIN'],
  });
}

export async function emailNotification(userId: string, title: string, body: string) {
  try {
    const recipient = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, uniqueName: true },
    });
    if (!recipient?.email) return;
    await sendUserEmail(
      recipient.email,
      `SecureFile: ${title}`,
      emailTemplate(
        title,
        `<p>Hello ${escapeHtml(recipient.uniqueName)},</p><p>${escapeHtml(body).replace(/\n/g, '<br/>')}</p>`,
      ),
    );
  } catch (error) {
    console.error('NOTIFICATION_EMAIL_ERROR:', error);
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]!));
}
