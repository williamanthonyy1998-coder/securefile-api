import { db } from '../db';
import { emitToUser } from './realtime';

export async function notify(userId: string, title: string, body: string, companyId?: string) {
  const notification = await db.notification.create({
    data: { userId, title, body, companyId },
  });

  // Persist first, then push the exact database record to every active browser
  // session for this user. If the user is offline, the record remains available
  // through GET /workspace/notifications.
  emitToUser(userId, 'notification', notification);
  return notification;
}
