import {
  ConversationType,
  PrismaClient,
  Role,
  UserStatus,
} from "@prisma/client";

import { db } from "../db";

export interface CreateDirectConversationInput {
  userId: string;
}

export interface CreateGroupConversationInput {
  name: string;
  participantIds: string[];
}

export interface UpdateConversationInput {
  name: string;
}

export interface AddParticipantInput {
  userId: string;
}

export interface GetConversationsOptions {
  limit?: number;
  cursor?: string;
}

class ConversationService {
  constructor(private readonly db: PrismaClient) {}

  private async getUserForChat(userId: string, companyId: string) {
    const user = await this.db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        companyId: true,
        uniqueName: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.role !== Role.SUPER_ADMIN) {
      if (user.companyId !== companyId) {
        throw new Error("User does not belong to this company");
      }
    }

    return user;
  }

  private async getCompanyUser(userId: string, companyId: string) {
    const user = await this.db.user.findFirst({
      where: {
        id: userId,
        companyId,
        role: {
          not: Role.SUPER_ADMIN,
        },
      },
      select: {
        id: true,
        companyId: true,
        uniqueName: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      throw new Error("Company user not found");
    }

    return user;
  }

  private canDirectChat(firstRole: Role, secondRole: Role): boolean {
    if (
      (firstRole === Role.SUPER_ADMIN && secondRole === Role.COMPANY_ADMIN) ||
      (firstRole === Role.COMPANY_ADMIN && secondRole === Role.SUPER_ADMIN)
    ) {
      return true;
    }

    if (
      (firstRole === Role.COMPANY_ADMIN && secondRole === Role.EMPLOYEE) ||
      (firstRole === Role.EMPLOYEE && secondRole === Role.COMPANY_ADMIN)
    ) {
      return true;
    }

    if (
      (firstRole === Role.COMPANY_ADMIN && secondRole === Role.CLIENT) ||
      (firstRole === Role.CLIENT && secondRole === Role.COMPANY_ADMIN)
    ) {
      return true;
    }

    if (firstRole === Role.EMPLOYEE && secondRole === Role.EMPLOYEE) {
      return true;
    }

    return false;
  }

  private async verifyConversationAccess(
    conversationId: string,
    userId: string,
    companyId: string | null,
  ) {
    const conversation = await this.db.conversation.findFirst({
      where: {
        id: conversationId,

        ...(companyId
          ? {
              companyId,
            }
          : {}),

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
        createdById: true,
      },
    });

    if (!conversation) {
      throw new Error("Conversation not found or access denied");
    }

    return conversation;
  }

  private async findExistingDirectConversation(
    companyId: string,
    firstUserId: string,
    secondUserId: string,
  ) {
    const conversations = await this.db.conversation.findMany({
      where: {
        companyId,
        type: ConversationType.DIRECT,
        participants: {
          some: {
            userId: firstUserId,
          },
        },
      },
      include: {
        participants: {
          select: {
            userId: true,
          },
        },
      },
    });

    for (const conversation of conversations) {
      if (conversation.participants.length !== 2) {
        continue;
      }

      const participantIds = conversation.participants.map(
        (participant) => participant.userId,
      );

      if (
        participantIds.includes(firstUserId) &&
        participantIds.includes(secondUserId)
      ) {
        return conversation;
      }
    }

    return null;
  }

  async createDirectConversation(
    currentUserId: string,
    companyId: string,
    input: CreateDirectConversationInput,
  ) {
    const targetUserId = input.userId?.trim();

    if (!targetUserId) {
      throw new Error("userId is required");
    }

    if (currentUserId === targetUserId) {
      throw new Error("You cannot create a direct conversation with yourself");
    }

    const currentUser = await this.getUserForChat(currentUserId, companyId);

    const targetUser = await this.getUserForChat(targetUserId, companyId);

    if (
      currentUser.status !== UserStatus.ACTIVE ||
      targetUser.status !== UserStatus.ACTIVE
    ) {
      throw new Error("Both users must be active to start a conversation");
    }

    if (!this.canDirectChat(currentUser.role, targetUser.role)) {
      throw new Error(
        "These users are not allowed to start a direct conversation",
      );
    }

    /**
     * If SUPER_ADMIN is involved, the other user
     * must be COMPANY_ADMIN.
     */
    if (
      currentUser.role === Role.SUPER_ADMIN ||
      targetUser.role === Role.SUPER_ADMIN
    ) {
      const otherUser =
        currentUser.role === Role.SUPER_ADMIN ? targetUser : currentUser;

      if (otherUser.role !== Role.COMPANY_ADMIN) {
        throw new Error(
          "SUPER_ADMIN can only chat directly with COMPANY_ADMIN",
        );
      }

      /**
       * The COMPANY_ADMIN must belong to the
       * company represented by companyId.
       */
      if (otherUser.companyId !== companyId) {
        throw new Error("Company admin does not belong to this company");
      }
    }

    /**
     * Find existing conversation first.
     */
    const existingConversation = await this.findExistingDirectConversation(
      companyId,
      currentUserId,
      targetUserId,
    );

    if (existingConversation) {
      return this.getConversationById(
        existingConversation.id,
        currentUserId,
        companyId,
      );
    }

    /**
     * Create new conversation.
     */
    const conversation = await this.db.conversation.create({
      data: {
        companyId,
        type: ConversationType.DIRECT,
        createdById: currentUserId,

        participants: {
          create: [
            {
              userId: currentUserId,
            },
            {
              userId: targetUserId,
            },
          ],
        },
      },

      include: {
        createdBy: {
          select: {
            id: true,
            uniqueName: true,
            email: true,
            role: true,
          },
        },

        participants: {
          orderBy: {
            joinedAt: "asc",
          },

          include: {
            user: {
              select: {
                id: true,
                uniqueName: true,
                email: true,
                role: true,
                status: true,
              },
            },
          },
        },
      },
    });

    return conversation;
  }

  async createGroupConversation(
    currentUserId: string,
    companyId: string,
    input: CreateGroupConversationInput,
  ) {
    const name = input.name?.trim();

    if (!name) {
      throw new Error("Conversation name is required");
    }

    if (name.length > 150) {
      throw new Error("Conversation name cannot exceed 150 characters");
    }

    if (!Array.isArray(input.participantIds)) {
      throw new Error("participantIds must be an array");
    }

    const currentUser = await this.getCompanyUser(currentUserId, companyId);

    if (currentUser.status !== UserStatus.ACTIVE) {
      throw new Error("Your account must be active");
    }

    if (currentUser.role !== Role.COMPANY_ADMIN) {
      throw new Error("Only COMPANY_ADMIN can create group conversations");
    }

    const participantIds = [currentUserId, ...input.participantIds]
      .filter((id): id is string => typeof id === "string")
      .map((id) => id.trim())
      .filter(Boolean);

    const uniqueParticipantIds = Array.from(new Set(participantIds));

    if (uniqueParticipantIds.length < 2) {
      throw new Error(
        "A group conversation requires at least two participants",
      );
    }

    const users = await this.db.user.findMany({
      where: {
        id: {
          in: uniqueParticipantIds,
        },
        companyId,
      },
      select: {
        id: true,
        companyId: true,
        uniqueName: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (users.length !== uniqueParticipantIds.length) {
      throw new Error("One or more participants do not belong to this company");
    }

    const invalidUser = users.find(
      (user) =>
        user.status !== UserStatus.ACTIVE || user.role === Role.SUPER_ADMIN,
    );

    if (invalidUser) {
      throw new Error("All participants must be active company users");
    }

    const conversation = await this.db.conversation.create({
      data: {
        companyId,
        type: ConversationType.GROUP,
        name,
        createdById: currentUserId,

        participants: {
          create: uniqueParticipantIds.map((userId) => ({
            userId,
          })),
        },
      },

      include: {
        createdBy: {
          select: {
            id: true,
            uniqueName: true,
            email: true,
            role: true,
          },
        },

        participants: {
          orderBy: {
            joinedAt: "asc",
          },

          include: {
            user: {
              select: {
                id: true,
                uniqueName: true,
                email: true,
                role: true,
                status: true,
              },
            },
          },
        },
      },
    });

    return conversation;
  }

  async getUserConversations(
    userId: string,
    companyId: string | null,
    options: GetConversationsOptions = {},
  ) {
    const requestedLimit = options.limit ?? 30;

    const limit = Math.min(Math.max(Math.trunc(requestedLimit), 1), 100);

    const conversations = await this.db.conversation.findMany({
      where: {
        ...(companyId
          ? {
              companyId,
            }
          : {}),

        participants: {
          some: {
            userId,
          },
        },
      },

      orderBy: {
        updatedAt: "desc",
      },

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
        participants: {
          orderBy: {
            joinedAt: "asc",
          },

          include: {
            user: {
              select: {
                id: true,
                uniqueName: true,
                email: true,
                role: true,
                status: true,
              },
            },
          },
        },

        messages: {
          where: {
            deletedAt: null,
          },

          orderBy: {
            createdAt: "desc",
          },

          take: 1,

          select: {
            id: true,
            senderId: true,
            body: true,
            createdAt: true,
          },
        },
      },
    });

    const hasMore = conversations.length > limit;

    if (hasMore) {
      conversations.pop();
    }

    return {
      conversations,

      pagination: {
        limit,
        hasMore,

        nextCursor: hasMore
          ? (conversations[conversations.length - 1]?.id ?? null)
          : null,
      },
    };
  }

  async getConversationById(
    conversationId: string,
    userId: string,
    companyId: string | null,
  ) {
    const conversation = await this.db.conversation.findFirst({
      where: {
        id: conversationId,

        ...(companyId
          ? {
              companyId,
            }
          : {}),

        participants: {
          some: {
            userId,
          },
        },
      },

      include: {
        createdBy: {
          select: {
            id: true,
            uniqueName: true,
            email: true,
            role: true,
          },
        },

        participants: {
          orderBy: {
            joinedAt: "asc",
          },

          include: {
            user: {
              select: {
                id: true,
                uniqueName: true,
                email: true,
                role: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new Error("Conversation not found or access denied");
    }

    return conversation;
  }

  async updateConversation(
    conversationId: string,
    userId: string,
    companyId: string,
    input: UpdateConversationInput,
  ) {
    const name = input.name?.trim();

    if (!name) {
      throw new Error("Conversation name is required");
    }

    if (name.length > 150) {
      throw new Error("Conversation name cannot exceed 150 characters");
    }

    const conversation = await this.db.conversation.findFirst({
      where: {
        id: conversationId,
        companyId,

        participants: {
          some: {
            userId,
          },
        },
      },

      select: {
        id: true,
        type: true,
        createdById: true,
      },
    });

    if (!conversation) {
      throw new Error("Conversation not found or access denied");
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new Error("Direct conversations cannot be renamed");
    }

    const user = await this.getCompanyUser(userId, companyId);

    if (
      user.role !== Role.COMPANY_ADMIN &&
      conversation.createdById !== userId
    ) {
      throw new Error("You are not allowed to rename this conversation");
    }

    return this.db.conversation.update({
      where: {
        id: conversationId,
      },

      data: {
        name,
        updatedAt: new Date(),
      },

      include: {
        participants: {
          orderBy: {
            joinedAt: "asc",
          },

          include: {
            user: {
              select: {
                id: true,
                uniqueName: true,
                email: true,
                role: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }

  async addParticipant(
    conversationId: string,
    currentUserId: string,
    companyId: string,
    input: AddParticipantInput,
  ) {
    const targetUserId = input.userId?.trim();

    if (!targetUserId) {
      throw new Error("userId is required");
    }

    const conversation = await this.db.conversation.findFirst({
      where: {
        id: conversationId,
        companyId,
        type: ConversationType.GROUP,

        participants: {
          some: {
            userId: currentUserId,
          },
        },
      },

      select: {
        id: true,
        createdById: true,
      },
    });

    if (!conversation) {
      throw new Error("Group conversation not found or access denied");
    }

    const currentUser = await this.getCompanyUser(currentUserId, companyId);

    if (
      currentUser.role !== Role.COMPANY_ADMIN &&
      conversation.createdById !== currentUserId
    ) {
      throw new Error("You are not allowed to add participants");
    }

    const targetUser = await this.getCompanyUser(targetUserId, companyId);

    if (targetUser.status !== UserStatus.ACTIVE) {
      throw new Error("Only active users can be added");
    }

    const existing = await this.db.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: targetUserId,
        },
      },
    });

    if (existing) {
      throw new Error("User is already a participant");
    }

    const participant = await this.db.conversationParticipant.create({
      data: {
        conversationId,
        userId: targetUserId,
      },

      include: {
        user: {
          select: {
            id: true,
            uniqueName: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });

    await this.db.conversation.update({
      where: {
        id: conversationId,
      },

      data: {
        updatedAt: new Date(),
      },
    });

    return participant;
  }

  async removeParticipant(
    conversationId: string,
    currentUserId: string,
    targetUserId: string,
    companyId: string,
  ) {
    const conversation = await this.db.conversation.findFirst({
      where: {
        id: conversationId,
        companyId,
        type: ConversationType.GROUP,

        participants: {
          some: {
            userId: currentUserId,
          },
        },
      },

      select: {
        id: true,
        createdById: true,
      },
    });

    if (!conversation) {
      throw new Error("Group conversation not found or access denied");
    }

    const currentUser = await this.getCompanyUser(currentUserId, companyId);

    const removingSelf = currentUserId === targetUserId;

    const canRemoveOthers =
      currentUser.role === Role.COMPANY_ADMIN ||
      conversation.createdById === currentUserId;

    if (!removingSelf && !canRemoveOthers) {
      throw new Error("You are not allowed to remove this participant");
    }

    const participant = await this.db.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: targetUserId,
        },
      },
    });

    if (!participant) {
      throw new Error("Participant not found");
    }

    await this.db.conversationParticipant.delete({
      where: {
        conversationId_userId: {
          conversationId,
          userId: targetUserId,
        },
      },
    });

    await this.db.conversation.update({
      where: {
        id: conversationId,
      },

      data: {
        updatedAt: new Date(),
      },
    });

    return {
      conversationId,
      userId: targetUserId,
      removed: true,
    };
  }

  async markConversationAsRead(
    conversationId: string,
    userId: string,
    companyId: string | null,
  ) {
    await this.verifyConversationAccess(conversationId, userId, companyId);

    const participant = await this.db.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },

      data: {
        lastReadAt: new Date(),
      },

      select: {
        conversationId: true,
        userId: true,
        lastReadAt: true,
      },
    });

    return participant;
  }

  async leaveConversation(
    conversationId: string,
    userId: string,
    companyId: string,
  ) {
    const conversation = await this.db.conversation.findFirst({
      where: {
        id: conversationId,
        companyId,
        type: ConversationType.GROUP,

        participants: {
          some: {
            userId,
          },
        },
      },

      select: {
        id: true,
      },
    });

    if (!conversation) {
      throw new Error("Group conversation not found or access denied");
    }

    await this.db.conversationParticipant.delete({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    return {
      conversationId,
      userId,
      left: true,
    };
  }

  async getUnreadCount(
    conversationId: string,
    userId: string,
    companyId: string | null,
  ) {
    const conversation = await this.db.conversation.findFirst({
      where: {
        id: conversationId,

        ...(companyId
          ? {
              companyId,
            }
          : {}),

        participants: {
          some: {
            userId,
          },
        },
      },

      select: {
        id: true,
        participants: {
          where: {
            userId,
          },
          select: {
            lastReadAt: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new Error("Conversation not found or access denied");
    }

    const participant = conversation.participants[0];

    if (!participant) {
      throw new Error("Conversation participant not found");
    }

    const unreadCount = await this.db.message.count({
      where: {
        conversationId,

        deletedAt: null,

        /**
         * Don't count the user's own messages
         * as unread.
         */
        senderId: {
          not: userId,
        },

        ...(participant.lastReadAt
          ? {
              createdAt: {
                gt: participant.lastReadAt,
              },
            }
          : {}),
      },
    });

    return {
      conversationId,
      unreadCount,
    };
  }

  async getUnreadCounts(userId: string, companyId: string | null) {
    const conversations = await this.db.conversation.findMany({
      where: {
        ...(companyId
          ? {
              companyId,
            }
          : {}),

        participants: {
          some: {
            userId,
          },
        },
      },

      select: {
        id: true,

        participants: {
          where: {
            userId,
          },

          select: {
            lastReadAt: true,
          },
        },

        messages: {
          where: {
            deletedAt: null,

            senderId: {
              not: userId,
            },
          },

          select: {
            createdAt: true,
          },
        },
      },
    });

    const result = conversations.map((conversation) => {
      const participant = conversation.participants[0];

      const lastReadAt = participant?.lastReadAt ?? null;

      const unreadCount = conversation.messages.filter((message) => {
        if (!lastReadAt) {
          return true;
        }

        return message.createdAt > lastReadAt;
      }).length;

      return {
        conversationId: conversation.id,
        unreadCount,
      };
    });

    const totalUnread = result.reduce(
      (total, conversation) => total + conversation.unreadCount,
      0,
    );

    return {
      totalUnread,
      conversations: result,
    };
  }
}

export const conversationService = new ConversationService(db);
