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

export type ConversationsResponse = {
    conversations: Conversation[];
    total?: number;
    page?: number;
    limit?: number;
};

export type ConversationResponse = {
    conversation: Conversation;
};

export type MessagesResponse = {
    messages: Message[];
    total?: number;
    page?: number;
    limit?: number;
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
    page?: number;
    search?: string;
    type?: ConversationType;
};

export type GetConversationMessagesParams = {
    page?: number;
    limit?: number;
    before?: string;
    after?: string;
};

export type CreateDirectConversationPayload = {
    userId: string;
};

export type CreateGroupConversationPayload = {
    name: string;
    userIds: string[];
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

export async function getConversations(
    params?: GetConversationsParams,
): Promise<ConversationsResponse> {
    const response = await api.get<ConversationsResponse>("/conversations", {
        params,
    });

    return response.data;
}

export async function getConversation(
    conversationId: string,
): Promise<ConversationResponse> {
    const response = await api.get<ConversationResponse>(
        `/conversations/${encodeURIComponent(conversationId)}`,
    );

    return response.data;
}

export async function createDirectConversation(
    payload: CreateDirectConversationPayload,
): Promise<ConversationResponse> {
    const response = await api.post<ConversationResponse>(
        "/conversations/direct",
        payload,
    );

    return response.data;
}

export async function createGroupConversation(
    payload: CreateGroupConversationPayload,
): Promise<ConversationResponse> {
    const response = await api.post<ConversationResponse>(
        "/conversations/group",
        payload,
    );

    return response.data;
}

export async function updateConversation(
    conversationId: string,
    payload: UpdateConversationPayload,
): Promise<ConversationResponse> {
    const response = await api.patch<ConversationResponse>(
        `/conversations/${encodeURIComponent(conversationId)}`,
        payload,
    );

    return response.data;
}

export async function addConversationParticipant(
    conversationId: string,
    payload: AddParticipantPayload,
): Promise<ConversationResponse> {
    const response = await api.post<ConversationResponse>(
        `/conversations/${encodeURIComponent(conversationId)}/participants`,
        payload,
    );

    return response.data;
}

export async function removeConversationParticipant(
    conversationId: string,
    userId: string,
): Promise<ConversationResponse> {
    const response = await api.delete<ConversationResponse>(
        `/conversations/${encodeURIComponent(conversationId)}/participants/${encodeURIComponent(userId)}`,
    );

    return response.data;
}

export async function leaveConversation(conversationId: string): Promise<void> {
    await api.delete(
        `/conversations/${encodeURIComponent(conversationId)}/leave`,
    );
}

export async function getUnreadConversations(): Promise<UnreadConversationsResponse> {
    const response = await api.get<UnreadConversationsResponse>(
        "/conversations/unread",
    );

    return response.data;
}

export async function getConversationUnread(
    conversationId: string,
): Promise<ConversationUnreadResponse> {
    const response = await api.get<ConversationUnreadResponse>(
        `/conversations/${encodeURIComponent(conversationId)}/unread`,
    );

    return response.data;
}

export async function markConversationAsRead(
    conversationId: string,
): Promise<void> {
    await api.patch(`/conversations/${encodeURIComponent(conversationId)}/read`);
}

export async function sendMessage(
    payload: SendMessagePayload,
): Promise<{ message: Message }> {
    const response = await api.post<{ message: Message }>("/messages", payload);

    return response.data;
}

export async function getConversationMessages(
    conversationId: string,
    params?: GetConversationMessagesParams,
): Promise<MessagesResponse> {
    const response = await api.get<MessagesResponse>(
        `/messages/conversation/${encodeURIComponent(conversationId)}`,
        {
            params,
        },
    );

    return response.data;
}

export async function getMessage(
    messageId: string,
): Promise<{ message: Message }> {
    const response = await api.get<{ message: Message }>(
        `/messages/${encodeURIComponent(messageId)}`,
    );

    return response.data;
}

export async function updateMessage(
    messageId: string,
    payload: UpdateMessagePayload,
): Promise<{ message: Message }> {
    const response = await api.patch<{ message: Message }>(
        `/messages/${encodeURIComponent(messageId)}`,
        payload,
    );

    return response.data;
}

export async function deleteMessage(messageId: string): Promise<void> {
    await api.delete(`/messages/${encodeURIComponent(messageId)}`);
}
