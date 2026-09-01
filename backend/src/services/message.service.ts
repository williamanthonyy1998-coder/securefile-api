import { PrismaClient } from "@prisma/client";
import { db } from "../db";

export interface SendMessageInput {
  conversationId: string;
  body: string;
}

export interface UpdateMessageInput {
  body: string;
}

export interface GetConversationMessagesOptions {
  limit?: number;
  cursor?: string;
}

class MessageService {
  constructor(private readonly db: PrismaClient) {}

  private async verifyConversationAccess(
    conversationId: string,
    userId: string,
  ) {
    const conversation = await this.db.conversation.findFirst({
      where: {
        id: conversationId,

        participants: {
          some: {
            userId,
          },
        },
      },

      select: {
        id: true,
        companyId: true,
        type: true,
        name: true,
      },
    });

    if (!conversation) {
      throw new Error("Conversation not found or access denied");
    }

    const user = await this.db.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        companyId: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    /**
     * SUPER_ADMIN does not need companyId.
     *
     * Their participant record is enough to authorize
     * access to this conversation.
     */
    if (user.role === "SUPER_ADMIN") {
      return {
        conversation,
        user,
      };
    }

    /**
     * Normal company users must belong to the same company.
     */
    if (user.companyId !== conversation.companyId) {
      throw new Error("Access denied");
    }

    return {
      conversation,
      user,
    };
  }

  async createMessage(userId: string, input: SendMessageInput) {
    const conversationId = input.conversationId?.trim();

    const body = input.body?.trim();

    if (!conversationId) {
      throw new Error("conversationId is required");
    }

    if (!body) {
      throw new Error("Message body is required");
    }

    if (body.length > 10000) {
      throw new Error("Message body cannot exceed 10,000 characters");
    }

    const { conversation, user } = await this.verifyConversationAccess(
      conversationId,
      userId,
    );

    if (user.status !== "ACTIVE") {
      throw new Error("Your account is not active");
    }

    const message = await this.db.$transaction(async (tx) => {
      const createdMessage = await tx.message.create({
        data: {
          companyId: conversation.companyId,

          conversationId: conversation.id,

          senderId: userId,

          body,
        },

        include: {
          sender: {
            select: {
              id: true,
              uniqueName: true,
              email: true,
              role: true,
            },
          },
        },
      });

      /**
       * Touch conversation updatedAt so the
       * conversation moves to the top of the
       * conversation list.
       */
      await tx.conversation.update({
        where: {
          id: conversation.id,
        },

        data: {
          updatedAt: new Date(),
        },
      });

      return createdMessage;
    });

    return message;
  }

  async getMessage(messageId: string, userId: string) {
    const message = await this.db.message.findFirst({
      where: {
        id: messageId,

        conversation: {
          participants: {
            some: {
              userId,
            },
          },
        },
      },

      include: {
        sender: {
          select: {
            id: true,
            uniqueName: true,
            email: true,
            role: true,
          },
        },

        conversation: {
          select: {
            id: true,
            companyId: true,
            type: true,
            name: true,
          },
        },
      },
    });

    if (!message) {
      throw new Error("Message not found or access denied");
    }

    /**
     * Extra company authorization for normal users.
     */
    const user = await this.db.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        companyId: true,
        role: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (
      user.role !== "SUPER_ADMIN" &&
      user.companyId !== message.conversation.companyId
    ) {
      throw new Error("Access denied");
    }

    return message;
  }

  async getConversationMessages(
    conversationId: string,
    userId: string,
    options: GetConversationMessagesOptions = {},
  ) {
    await this.verifyConversationAccess(conversationId, userId);

    const requestedLimit = options.limit ?? 50;

    const limit = Math.min(Math.max(Math.trunc(requestedLimit), 1), 100);

    const messages = await this.db.message.findMany({
      where: {
        conversationId,

        deletedAt: null,
      },

      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],

      take: limit + 1,

      ...(options.cursor
        ? {
            cursor: {
              id: options.cursor,
            },

            skip: 1,
          }
        : {}),

      include: {
        sender: {
          select: {
            id: true,
            uniqueName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    const hasMore = messages.length > limit;

    if (hasMore) {
      messages.pop();
    }

    return {
      messages,

      pagination: {
        limit,
        hasMore,

        nextCursor: hasMore
          ? (messages[messages.length - 1]?.id ?? null)
          : null,
      },
    };
  }

  async updateMessage(
    messageId: string,
    userId: string,
    input: UpdateMessageInput,
  ) {
    const body = input.body?.trim();

    if (!body) {
      throw new Error("Message body is required");
    }

    if (body.length > 10000) {
      throw new Error("Message body cannot exceed 10,000 characters");
    }

    const existingMessage = await this.db.message.findFirst({
      where: {
        id: messageId,

        senderId: userId,

        deletedAt: null,

        conversation: {
          participants: {
            some: {
              userId,
            },
          },
        },
      },

      select: {
        id: true,
        conversation: {
          select: {
            companyId: true,
          },
        },
      },
    });

    if (!existingMessage) {
      throw new Error("Message not found or you cannot edit this message");
    }

    const user = await this.db.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        companyId: true,
        role: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (
      user.role !== "SUPER_ADMIN" &&
      user.companyId !== existingMessage.conversation.companyId
    ) {
      throw new Error("Access denied");
    }

    return this.db.message.update({
      where: {
        id: messageId,
      },

      data: {
        body,
      },

      include: {
        sender: {
          select: {
            id: true,
            uniqueName: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async deleteMessage(messageId: string, userId: string) {
    const existingMessage = await this.db.message.findFirst({
      where: {
        id: messageId,

        senderId: userId,

        deletedAt: null,

        conversation: {
          participants: {
            some: {
              userId,
            },
          },
        },
      },

      select: {
        id: true,

        conversation: {
          select: {
            companyId: true,
          },
        },
      },
    });

    if (!existingMessage) {
      throw new Error("Message not found or you cannot delete this message");
    }

    const user = await this.db.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        companyId: true,
        role: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (
      user.role !== "SUPER_ADMIN" &&
      user.companyId !== existingMessage.conversation.companyId
    ) {
      throw new Error("Access denied");
    }

    return this.db.message.update({
      where: {
        id: messageId,
      },

      data: {
        deletedAt: new Date(),
      },

      select: {
        id: true,
        deletedAt: true,
      },
    });
  }
}

export const messageService = new MessageService(db);
