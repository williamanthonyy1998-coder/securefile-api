import { Request, Response } from 'express';
import { verifyAccess } from '../utils/security';
import { db } from '../db';

type Client = Response & { __sfSentNotificationIds?: Set<string> };
const clients = new Map<string, Set<Client>>();

function writeEvent(res: Client, event: string, payload: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  res.flush?.();
  const id = payload && typeof payload === 'object' && 'id' in payload ? String((payload as any).id) : '';
  if (id) {
    if (!res.__sfSentNotificationIds) res.__sfSentNotificationIds = new Set<string>();
    res.__sfSentNotificationIds.add(id);
    if (res.__sfSentNotificationIds.size > 500) {
      const first = res.__sfSentNotificationIds.values().next().value;
      if (first) res.__sfSentNotificationIds.delete(first);
    }
  }
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  const set = clients.get(userId);
  if (!set?.size) return;
  for (const res of [...set]) {
    try { writeEvent(res, event, payload); }
    catch { try { res.end(); } catch {} set.delete(res); }
  }
  if (!set.size) clients.delete(userId);
}

export function emitToUsers(userIds: string[], event: string, payload: unknown) {
  for (const id of userIds) emitToUser(id, event, payload);
}

export function emitNotificationRead(userId: string, notificationId: string) {
  emitToUser(userId, 'notification-read', { id: notificationId });
}

export function emitNotificationsReadAll(userId: string) {
  emitToUser(userId, 'notifications-read-all', { at: new Date().toISOString() });
}

/**
 * One SSE connection per browser tab. There is deliberately NO 2-second/3-second
 * database polling here. Same-instance notifications are pushed immediately by
 * notify(). On reconnect we send the current unread state once, which also gives
 * a safe fallback when a serverless instance changes.
 */
export async function realtimeEvents(req: Request, res: Response) {
  const accessToken = String(req.query.token || '');
  if (!accessToken) return res.status(401).json({ error: 'Realtime token required' });

  try {
    const payload = verifyAccess(accessToken);
    const userId = payload.id;
    if (!userId) return res.status(401).json({ error: 'Invalid realtime session' });

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const client = res as Client;
    const unread = await db.notification.findMany({
      where: { userId, readAt: null },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    client.__sfSentNotificationIds = new Set(unread.map(n => n.id));
    writeEvent(client, 'notification-sync', unread);
    writeEvent(client, 'ready', { ok: true, at: new Date().toISOString(), unreadCount: unread.length });

    let set = clients.get(userId);
    if (!set) { set = new Set<Client>(); clients.set(userId, set); }
    set.add(client);

    const heartbeat = setInterval(() => {
      try { client.write(`: heartbeat ${Date.now()}\n\n`); client.flush?.(); }
      catch { clearInterval(heartbeat); set?.delete(client); }
    }, 20000);

    const cleanup = () => {
      clearInterval(heartbeat);
      const current = clients.get(userId);
      current?.delete(client);
      if (current && current.size === 0) clients.delete(userId);
    };
    req.once('close', cleanup);
    res.once('close', cleanup);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired realtime session' });
  }
}
