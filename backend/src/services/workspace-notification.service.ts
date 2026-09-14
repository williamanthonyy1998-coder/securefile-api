import { PrismaClient } from "@prisma/client";

import { db } from "../db";
import { emitNotificationToUser } from "../sockets/socket.server";

class WorkspaceNotificationService {
  constructor(private readonly db: PrismaClient) {}

  async listUnread(userId: string) {
    return this.db.notification.findMany({
      where: { userId, readAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async markRead(notificationId: string, userId: string) {
    const result = await this.db.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });

    if (result.count) {
      emitNotificationToUser(userId, "notification:read", { id: notificationId });
    }

    return result;
  }

  async markAllRead(userId: string) {
    const result = await this.db.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    if (result.count) {
      emitNotificationToUser(userId, "notifications:read-all", { at: new Date().toISOString() });
    }

    return result;
  }
}

export const workspaceNotificationService = new WorkspaceNotificationService(
  db,
);
