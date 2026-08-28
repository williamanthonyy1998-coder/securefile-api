import { Request, Response } from 'express';
import { verifyAccess } from '../utils/security';
import { db } from '../db';

type Client = Response & { __sfSentNotificationIds?: Set<string> };
const clients = new Map<string, Set<Client>>();

function writeEvent(res: Client, event: string, payload: unknown) {
  const packet = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  res.write(packet);
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
  for (const res of set) {
    try { writeEvent(res, event, payload); } catch { set.delete(res); }
  }
}

export function emitToUsers(userIds: string[], event: string, payload: unknown) {
  for (const id of userIds) emitToUser(id, event, payload);
}

export async function realtimeEvents(req: Request, res: Response) {
  const token = String(req.query.token || '');
  if (!token) return res.status(401).json({ error: 'Realtime token required' });

  try {
    const payload = verifyAccess(token);
    const user = await db.user.findUnique({
      where: { id: payload.id },
      select: { id: true, status: true, emailVerifiedAt: true }
    });
    if (!user || user.status === 'SUSPENDED' || !user.emailVerifiedAt) {
      return res.status(401).json({ error: 'Session is no longer valid' });
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const client = res as Client;
    const existing = await db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true }
    });
    client.__sfSentNotificationIds = new Set(existing.map(n => n.id));
    writeEvent(client, 'ready', { ok: true, at: new Date().toISOString() });

    let set = clients.get(user.id);
    if (!set) { set = new Set(); clients.set(user.id, set); }
    set.add(client);

    // In-memory emitToUser gives instant delivery on the current API process.
    // This lightweight polling fallback also catches notifications when the app
    // is running behind multiple Node instances without requiring Redis/Docker.
    const poll = setInterval(async () => {
      try {
        const latest = await db.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 25
        });
        const sent = client.__sfSentNotificationIds || new Set<string>();
        const fresh = latest.filter(n => !sent.has(n.id)).reverse();
        for (const notification of fresh) writeEvent(client, 'notification', notification);
      } catch { /* heartbeat/connection cleanup handles dead clients */ }
    }, 2000);

    const heartbeat = setInterval(() => {
      try { client.write(`: heartbeat ${Date.now()}\n\n`); client.flush?.(); } catch { /* close handler removes it */ }
    }, 25000);

    const cleanup = () => {
      clearInterval(poll);
      clearInterval(heartbeat);
      set?.delete(client);
      if (set && set.size === 0) clients.delete(user.id);
    };
    req.on('close', cleanup);
  } catch {
    return res.status(401).json({ error: 'Invalid realtime session' });
  }
}
