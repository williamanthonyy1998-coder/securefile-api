import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../lib/axios";

export type ConversationType = "DIRECT" | "GROUP";

export type ChatUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: string;
  uniqueName?: string;
  status?: string;
};

export type ConversationParticipant = {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  lastReadAt?: string | null;
  user: ChatUser;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  companyId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  sender?: ChatUser;
};

export type Conversation = {
  id: string;
  companyId: string;
  type: ConversationType;
  name?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  participants: ConversationParticipant[];
  lastMessage?: Message | null;
  unreadCount?: number;
};

export type CursorPagination = {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
};

export type ConversationsResponse = {
  conversations: Conversation[];
  pagination?: CursorPagination;
};

export type ConversationResponse = {
  conversation: Conversation;
};

export type MessagesResponse = {
  messages: Message[];
  pagination?: CursorPagination;
};

export type UnreadConversation = {
  conversationId: string;
  unreadCount: number;
};

export type UnreadConversationsResponse = {
  conversations: UnreadConversation[];
  totalUnread: number;
};

export type ConversationUnreadResponse = {
  conversationId: string;
  unreadCount: number;
};

export type GetConversationsParams = {
  limit?: number;
  cursor?: string;
};

export type GetConversationMessagesParams = {
  limit?: number;
  cursor?: string;
};

export type CreateDirectConversationPayload = {
  userId: string;
};

export type CreateGroupConversationPayload = {
  name: string;
  participantIds: string[];
};

export type UpdateConversationPayload = {
  name?: string;
};

export type AddParticipantPayload = {
  userId: string;
};

export type SendMessagePayload = {
  conversationId: string;
  body: string;
};

export type UpdateMessagePayload = {
  body: string;
};

export type AddParticipantMutation = {
  conversationId: string;
  payload: AddParticipantPayload;
};

export type RemoveParticipantMutation = {
  conversationId: string;
  userId: string;
};

export type UpdateConversationMutation = {
  conversationId: string;
  payload: UpdateConversationPayload;
};

export type UpdateMessageMutation = {
  messageId: string;
  payload: UpdateMessagePayload;
};

function lastMessageFrom(conversation: any): Message | null {
  if (conversation?.lastMessage) return conversation.lastMessage;
  const rows = conversation?.messages;
  if (Array.isArray(rows) && rows[0]) return rows[0];
  return null;
}

export function normalizeConversation(conversation: any): Conversation {
  return {
    ...conversation,
    lastMessage: lastMessageFrom(conversation),
    participants: Array.isArray(conversation?.participants)
      ? conversation.participants
      : [],
  };
}

export const chatKeys = {
  all: ["chat"] as const,

  conversations: ["chat", "conversations"] as const,

  conversation: (conversationId: string) =>
    ["chat", "conversation", conversationId] as const,

  unreadConversations: ["chat", "conversations", "unread"] as const,

  conversationUnread: (conversationId: string) =>
    ["chat", "conversation", conversationId, "unread"] as const,

  messages: (conversationId: string, params?: GetConversationMessagesParams) =>
    ["chat", "messages", conversationId, params] as const,

  message: (messageId: string) => ["chat", "message", messageId] as const,
};

/* -------------------------------------------------------------------------- */
/* Conversations                                                              */
/* -------------------------------------------------------------------------- */

export function useConversations(params?: GetConversationsParams) {
  return useQuery({
    queryKey: [...chatKeys.conversations, params],
    queryFn: async (): Promise<ConversationsResponse> => {
      const response = await api.get<ConversationsResponse>("/conversations", {
        params,
      });

      return {
        ...response.data,
        conversations: (response.data.conversations || []).map(
          normalizeConversation,
        ),
      };
    },
  });
}

export function useConversation(conversationId?: string) {
  return useQuery({
    queryKey: chatKeys.conversation(conversationId || ""),
    enabled: Boolean(conversationId),
    queryFn: async (): Promise<ConversationResponse> => {
      const response = await api.get<ConversationResponse>(
        `/conversations/${encodeURIComponent(conversationId!)}`,
      );

      return {
        conversation: normalizeConversation(response.data.conversation),
      };
    },
  });
}

export function useCreateDirectConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: CreateDirectConversationPayload,
    ): Promise<ConversationResponse> => {
      const response = await api.post<ConversationResponse>(
        "/conversations/direct",
        payload,
      );

      return {
        conversation: normalizeConversation(response.data.conversation),
      };
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations,
      });

      queryClient.setQueryData(
        chatKeys.conversation(data.conversation.id),
        data,
      );
    },
  });
}

export function useCreateGroupConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: CreateGroupConversationPayload,
    ): Promise<ConversationResponse> => {
      const response = await api.post<ConversationResponse>(
        "/conversations/group",
        payload,
      );

      return {
        conversation: normalizeConversation(response.data.conversation),
      };
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations,
      });

      queryClient.setQueryData(
        chatKeys.conversation(data.conversation.id),
        data,
      );
    },
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      payload,
    }: UpdateConversationMutation): Promise<ConversationResponse> => {
      const response = await api.patch<ConversationResponse>(
        `/conversations/${encodeURIComponent(conversationId)}`,
        payload,
      );

      return {
        conversation: normalizeConversation(response.data.conversation),
      };
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations,
      });

      queryClient.setQueryData(
        chatKeys.conversation(data.conversation.id),
        data,
      );
    },
  });
}

export function useAddConversationParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      payload,
    }: AddParticipantMutation): Promise<ConversationResponse> => {
      const response = await api.post<ConversationResponse>(
        `/conversations/${encodeURIComponent(conversationId)}/participants`,
        payload,
      );

      return response.data;
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations,
      });

      queryClient.setQueryData(
        chatKeys.conversation(data.conversation.id),
        data,
      );
    },
  });
}

export function useRemoveConversationParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      userId,
    }: RemoveParticipantMutation): Promise<ConversationResponse> => {
      const response = await api.delete<ConversationResponse>(
        `/conversations/${encodeURIComponent(
          conversationId,
        )}/participants/${encodeURIComponent(userId)}`,
      );

      return response.data;
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations,
      });

      queryClient.setQueryData(
        chatKeys.conversation(data.conversation.id),
        data,
      );
    },
  });
}

export function useLeaveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string): Promise<void> => {
      await api.delete(
        `/conversations/${encodeURIComponent(conversationId)}/leave`,
      );
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations,
      });
    },
  });
}

export function useUnreadConversations() {
  return useQuery({
    queryKey: chatKeys.unreadConversations,

    queryFn: async (): Promise<UnreadConversationsResponse> => {
      const response = await api.get<UnreadConversationsResponse>(
        "/conversations/unread",
      );

      return response.data;
    },
  });
}

export function useConversationUnread(conversationId?: string) {
  return useQuery({
    queryKey: chatKeys.conversationUnread(conversationId || ""),

    enabled: Boolean(conversationId),

    queryFn: async (): Promise<ConversationUnreadResponse> => {
      const response = await api.get<ConversationUnreadResponse>(
        `/conversations/unread/${encodeURIComponent(conversationId!)}`,
      );

      return response.data;
    },
  });
}

export function useMarkConversationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string): Promise<void> => {
      await api.patch(
        `/conversations/${encodeURIComponent(conversationId)}/read`,
      );
    },

    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations,
      });

      queryClient.invalidateQueries({
        queryKey: chatKeys.unreadConversations,
      });

      queryClient.invalidateQueries({
        queryKey: chatKeys.conversationUnread(conversationId),
      });
    },
  });
}

export function useConversationMessages(
  conversationId?: string,
  params?: GetConversationMessagesParams,
) {
  return useQuery({
    queryKey: chatKeys.messages(conversationId || "", params),

    enabled: Boolean(conversationId),

    queryFn: async (): Promise<MessagesResponse> => {
      const response = await api.get<MessagesResponse>(
        `/messages/conversation/${encodeURIComponent(conversationId!)}`,
        {
          params,
        },
      );

      return response.data;
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: SendMessagePayload,
    ): Promise<{ message: Message }> => {
      const response = await api.post<{ message: Message }>(
        "/messages",
        payload,
      );

      return response.data;
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["chat", "messages", data.message.conversationId],
      });

      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations,
      });
    },
  });
}

export function useMessage(messageId?: string) {
  return useQuery({
    queryKey: chatKeys.message(messageId || ""),
    enabled: Boolean(messageId),

    queryFn: async (): Promise<{ message: Message }> => {
      const response = await api.get<{ message: Message }>(
        `/messages/${encodeURIComponent(messageId!)}`,
      );

      return response.data;
    },
  });
}

export function useUpdateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      payload,
    }: UpdateMessageMutation): Promise<{
      message: Message;
    }> => {
      const response = await api.patch<{ message: Message }>(
        `/messages/${encodeURIComponent(messageId)}`,
        payload,
      );

      return response.data;
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["chat", "messages", data.message.conversationId],
      });

      queryClient.setQueryData(chatKeys.message(data.message.id), data);
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string): Promise<void> => {
      await api.delete(`/messages/${encodeURIComponent(messageId)}`);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["chat", "messages"],
      });

      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations,
      });
    },
  });
}
