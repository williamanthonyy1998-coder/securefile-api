import { Server, Socket } from "socket.io";
import { Role } from "@prisma/client";

import { db } from "../db";
import { verifyAccess } from "../utils/security";
import { chatSocket } from "./chat.socket";

export interface SocketUser {
  id: string;
  companyId: string | null;
  email: string;
  uniqueName: string;
  role: Role;
}

export interface SocketData {
  user: SocketUser;
}

export const SOCKET_EVENTS = {
  CHAT: {
    JOIN_CONVERSATION: "chat:join_conversation",
    LEAVE_CONVERSATION: "chat:leave_conversation",
    SEND_MESSAGE: "chat:send_message",

    NEW_MESSAGE: "chat:new_message",
    MESSAGE_UPDATED: "chat:message_updated",
    MESSAGE_DELETED: "chat:message_deleted",

    TYPING: "chat:typing",
    STOP_TYPING: "chat:stop_typing",

    MESSAGE_READ: "chat:message_read",
    MESSAGE_DELIVERED: "chat:message_delivered",
    PRESENCE: "chat:presence",
    PRESENCE_SNAPSHOT: "chat:presence_snapshot",

    ERROR: "chat:error",
  },

  NOTIFICATION: {
    NEW: "notification:new",
    READ: "notification:read",
  },
} as const;

export interface JoinConversationPayload {
  conversationId: string;
}

export interface LeaveConversationPayload {
  conversationId: string;
}

export interface SendMessagePayload {
  conversationId: string;
  body: string;
}

export interface TypingPayload {
  conversationId: string;
}

export interface SocketCallback<T = unknown> {
  (response: T): void;
}

export interface SocketResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export class SocketServer {
  private readonly io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  initialize(): void {
    this.registerAuthentication();
    this.registerConnection();
  }

  private registerAuthentication(): void {
    this.io.use(async (socket, next) => {
      try {
        const token = this.extractToken(socket);

        if (!token) {
          return next(new Error("Authentication required"));
        }

        const user = await this.authenticateToken(token);

        socket.data.user = user;

        return next();
      } catch (error) {
        console.error("[Socket.IO] Authentication failed:", error);

        return next(new Error("Invalid or expired session"));
      }
    });
  }

  private extractToken(socket: Socket): string | null {
    const authToken = socket.handshake.auth?.token;

    if (typeof authToken === "string" && authToken.trim()) {
      return authToken.trim();
    }

    const authorization = socket.handshake.headers.authorization;

    if (
      typeof authorization === "string" &&
      authorization.startsWith("Bearer ")
    ) {
      return authorization.slice(7).trim();
    }

    return null;
  }

  private async authenticateToken(token: string): Promise<SocketUser> {
    const payload = verifyAccess(token);

    const user = await db.user.findUnique({
      where: {
        id: payload.id,
      },

      select: {
        id: true,
        uniqueName: true,
        role: true,
        companyId: true,
        email: true,
        status: true,
        emailVerifiedAt: true,
      },
    });

    /**
     * Same session validation rules as REST auth.
     */
    if (!user || user.status === "SUSPENDED" || !user.emailVerifiedAt) {
      throw new Error("Session is no longer valid");
    }

    return {
      id: user.id,
      companyId: user.companyId,
      email: user.email,
      uniqueName: user.uniqueName,
      role: user.role as Role,
    };
  }

  private registerConnection(): void {
    this.io.on("connection", (socket) => {
      const user = this.getSocketUser(socket);

      console.log(`[Socket.IO] Connected: ${user.id}`);

      /**
       * Every authenticated user gets a
       * private user room.
       *
       * Notifications will use this later.
       */
      if (user.companyId) {
        socket.join(this.getCompanyRoom(user.companyId));
      }

      socket.join(this.getUserRoom(user.id));

      // Tell the new client which company users are currently online.
      const onlineUserIds = [...this.io.sockets.sockets.values()]
        .map((s) => s.data.user as SocketUser | undefined)
        .filter((peer): peer is SocketUser => Boolean(peer?.id) && peer?.companyId === user.companyId)
        .map((peer) => peer.id);
      socket.emit(SOCKET_EVENTS.CHAT.PRESENCE_SNAPSHOT, {
        userIds: [...new Set(onlineUserIds)],
      });

      if (user.companyId) {
        socket.to(this.getCompanyRoom(user.companyId)).emit(
          SOCKET_EVENTS.CHAT.PRESENCE,
          { userId: user.id, online: true },
        );
      }

      /**
       * Register chat events.
       */
      chatSocket.register(this.io, socket);

      /**
       * Future:
       *
       * notificationSocket.register(
       *   this.io,
       *   socket
       * );
       */

      socket.on("disconnect", (reason) => {
        console.log(`[Socket.IO] Disconnected: ${user.id} (${reason})`);

        // A user may have multiple tabs/devices. Only broadcast offline when
        // the last authenticated socket for that user has gone away.
        const stillOnline = [...this.io.sockets.sockets.values()].some(
          (s) => (s.data.user as SocketUser | undefined)?.id === user.id,
        );
        if (!stillOnline && user.companyId) {
          this.io.to(this.getCompanyRoom(user.companyId)).emit(
            SOCKET_EVENTS.CHAT.PRESENCE,
            { userId: user.id, online: false },
          );
        }
      });
    });
  }

  getSocketUser(socket: Socket): SocketUser {
    const user = socket.data.user as SocketUser | undefined;

    if (!user) {
      throw new Error("Socket is not authenticated");
    }

    return user;
  }

  getConversationRoom(conversationId: string): string {
    return `conversation:${conversationId}`;
  }

  getCompanyRoom(companyId: string): string {
    return `company:${companyId}`;
  }

  getUserRoom(userId: string): string {
    return `user:${userId}`;
  }

  getIO(): Server {
    return this.io;
  }
}

export function createSocketServer(io: Server): SocketServer {
  const socketServer = new SocketServer(io);

  socketServer.initialize();

  return socketServer;
}
