import { create } from "zustand";

export type ConversationType = "DIRECT" | "GROUP";

export type ChatUser = {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    role?: string;
};

export type ConversationParticipant = {
    id: string;
    userId: string;
    joinedAt: string;
    lastReadAt?: string | null;
    user: ChatUser;
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

type ChatState = {
    conversations: Conversation[];
    activeConversationId: string | null;

    messages: Record<string, Message[]>;

    unreadCounts: Record<string, number>;

    typingUsers: Record<string, string[]>;

    isLoadingConversations: boolean;
    isLoadingMessages: boolean;

    setConversations: (conversations: Conversation[]) => void;
    addConversation: (conversation: Conversation) => void;
    updateConversation: (
        conversationId: string,
        updates: Partial<Conversation>,
    ) => void;
    removeConversation: (conversationId: string) => void;

    setActiveConversation: (conversationId: string | null) => void;

    setMessages: (conversationId: string, messages: Message[]) => void;
    addMessage: (message: Message) => void;
    updateMessage: (
        conversationId: string,
        messageId: string,
        updates: Partial<Message>,
    ) => void;
    removeMessage: (conversationId: string, messageId: string) => void;

    setUnreadCount: (conversationId: string, count: number) => void;
    incrementUnread: (conversationId: string) => void;
    clearUnread: (conversationId: string) => void;

    setTyping: (
        conversationId: string,
        userId: string,
        isTyping: boolean,
    ) => void;

    setLoadingConversations: (loading: boolean) => void;
    setLoadingMessages: (loading: boolean) => void;

    clearChat: () => void;
};

export const useChatStore = create<ChatState>((set) => ({
    conversations: [],
    activeConversationId: null,

    messages: {},

    unreadCounts: {},

    typingUsers: {},

    isLoadingConversations: false,
    isLoadingMessages: false,

    setConversations: (conversations) =>
        set({
            conversations,
        }),

    addConversation: (conversation) =>
        set((state) => {
            const exists = state.conversations.some(
                (item) => item.id === conversation.id,
            );

            if (exists) {
                return state;
            }

            return {
                conversations: [conversation, ...state.conversations],
            };
        }),

    updateConversation: (conversationId, updates) =>
        set((state) => ({
            conversations: state.conversations.map((conversation) =>
                conversation.id === conversationId
                    ? {
                        ...conversation,
                        ...updates,
                    }
                    : conversation,
            ),
        })),

    removeConversation: (conversationId) =>
        set((state) => {
            const conversations = state.conversations.filter(
                (conversation) => conversation.id !== conversationId,
            );

            const messages = { ...state.messages };
            const unreadCounts = { ...state.unreadCounts };
            const typingUsers = { ...state.typingUsers };

            delete messages[conversationId];
            delete unreadCounts[conversationId];
            delete typingUsers[conversationId];

            return {
                conversations,
                messages,
                unreadCounts,
                typingUsers,
                activeConversationId:
                    state.activeConversationId === conversationId
                        ? null
                        : state.activeConversationId,
            };
        }),

    setActiveConversation: (conversationId) =>
        set({
            activeConversationId: conversationId,
        }),

    setMessages: (conversationId, messages) =>
        set((state) => ({
            messages: {
                ...state.messages,
                [conversationId]: messages,
            },
        })),

    addMessage: (message) =>
        set((state) => {
            const conversationMessages = state.messages[message.conversationId] ?? [];

            const exists = conversationMessages.some(
                (item) => item.id === message.id,
            );

            if (exists) {
                return state;
            }

            const updatedMessages = [...conversationMessages, message];

            const conversations = state.conversations.map((conversation) =>
                conversation.id === message.conversationId
                    ? {
                        ...conversation,
                        updatedAt: message.createdAt,
                        lastMessage: message,
                    }
                    : conversation,
            );

            const isActive = state.activeConversationId === message.conversationId;

            return {
                messages: {
                    ...state.messages,
                    [message.conversationId]: updatedMessages,
                },

                conversations,

                unreadCounts: isActive
                    ? state.unreadCounts
                    : {
                        ...state.unreadCounts,
                        [message.conversationId]:
                            (state.unreadCounts[message.conversationId] ?? 0) + 1,
                    },
            };
        }),

    updateMessage: (conversationId, messageId, updates) =>
        set((state) => ({
            messages: {
                ...state.messages,
                [conversationId]: (state.messages[conversationId] ?? []).map(
                    (message) =>
                        message.id === messageId
                            ? {
                                ...message,
                                ...updates,
                            }
                            : message,
                ),
            },
        })),

    removeMessage: (conversationId, messageId) =>
        set((state) => ({
            messages: {
                ...state.messages,
                [conversationId]: (state.messages[conversationId] ?? []).filter(
                    (message) => message.id !== messageId,
                ),
            },
        })),

    setUnreadCount: (conversationId, count) =>
        set((state) => ({
            unreadCounts: {
                ...state.unreadCounts,
                [conversationId]: Math.max(0, count),
            },
        })),

    incrementUnread: (conversationId) =>
        set((state) => ({
            unreadCounts: {
                ...state.unreadCounts,
                [conversationId]: (state.unreadCounts[conversationId] ?? 0) + 1,
            },
        })),

    clearUnread: (conversationId) =>
        set((state) => ({
            unreadCounts: {
                ...state.unreadCounts,
                [conversationId]: 0,
            },
        })),

    setTyping: (conversationId, userId, isTyping) =>
        set((state) => {
            const currentUsers = state.typingUsers[conversationId] ?? [];

            if (isTyping) {
                if (currentUsers.includes(userId)) {
                    return state;
                }

                return {
                    typingUsers: {
                        ...state.typingUsers,
                        [conversationId]: [...currentUsers, userId],
                    },
                };
            }

            return {
                typingUsers: {
                    ...state.typingUsers,
                    [conversationId]: currentUsers.filter((id) => id !== userId),
                },
            };
        }),

    setLoadingConversations: (loading) =>
        set({
            isLoadingConversations: loading,
        }),

    setLoadingMessages: (loading) =>
        set({
            isLoadingMessages: loading,
        }),

    clearChat: () =>
        set({
            conversations: [],
            activeConversationId: null,
            messages: {},
            unreadCounts: {},
            typingUsers: {},
            isLoadingConversations: false,
            isLoadingMessages: false,
        }),
}));
