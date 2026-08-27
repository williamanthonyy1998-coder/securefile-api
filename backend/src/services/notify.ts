import { db } from '../db';
import { emitToUser } from './realtime';
import { NotificationType } from '@prisma/client';

export async function notify(
  userId: string,
  title: string,
  body: string,
  companyId?: string,
  type: NotificationType = NotificationType.SYSTEM
) {
  const notification = await db.notification.create({
    data: {
      userId,
      title,
      body,
      companyId,
      type,
    },
  });

  emitToUser(userId, 'notification', notification);

  return notification;
}