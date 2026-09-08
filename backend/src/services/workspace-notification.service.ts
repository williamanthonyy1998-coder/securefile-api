import { PrismaClient } from "@prisma/client";

import { db } from "../db";
import {
  emitNotificationRead,
  emitNotificationsReadAll,
} from "./realtime";

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
      emitNotificationRead(userId, notificationId);
    }

    return result;
  }

  async markAllRead(userId: string) {
    const result = await this.db.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    if (result.count) {
      emitNotificationsReadAll(userId);
    }

    return result;
  }
}

export const workspaceNotificationService = new WorkspaceNotificationService(
  db,
);
