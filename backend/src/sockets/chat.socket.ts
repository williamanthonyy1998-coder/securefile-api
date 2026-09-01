import { Server, Socket } from "socket.io";

import { conversationService } from "../services/conversation.service";

import { messageService } from "../services/message.service";

import {
    SOCKET_EVENTS,
    SocketUser,
    JoinConversationPayload,
    LeaveConversationPayload,
    SendMessagePayload,
    TypingPayload,
    SocketCallback,
} from "./socket.server";

interface SocketResponse<T = unknown> {
    ok: boolean;
    data?: T;
    error?: string;
}

class ChatSocket {
    register(io: Server, socket: Socket): void {
        this.registerJoinConversation(io, socket);

        this.registerLeaveConversation(io, socket);

        this.registerSendMessage(io, socket);

        this.registerTyping(io, socket);
    }

    private registerJoinConversation(_io: Server, socket: Socket): void {
        socket.on(
            SOCKET_EVENTS.CHAT.JOIN_CONVERSATION,
            async (
                payload: JoinConversationPayload,
                callback?: SocketCallback<SocketResponse>,
            ) => {
                try {
                    const user = this.getSocketUser(socket);

                    const conversationId = this.validateConversationId(payload);

                    /**
                     * Authorization happens through
                     * ConversationService.
                     */
                    const conversation = await conversationService.getConversationById(
                        conversationId,
                        user.id,
                        user.companyId,
                    );

                    const room = this.getConversationRoom(conversation.id);

                    await socket.join(room);

                    callback?.({
                        ok: true,
                        data: {
                            conversationId: conversation.id,
                        },
                    });
                } catch (error) {
                    this.sendError(callback, error, "Unable to join conversation");
                }
            },
        );
    }

    private registerLeaveConversation(_io: Server, socket: Socket): void {
        socket.on(
            SOCKET_EVENTS.CHAT.LEAVE_CONVERSATION,
            async (
                payload: LeaveConversationPayload,
                callback?: SocketCallback<SocketResponse>,
            ) => {
                try {
                    const conversationId = this.validateConversationId(payload);

                    const room = this.getConversationRoom(conversationId);

                    await socket.leave(room);

                    callback?.({
                        ok: true,
                        data: {
                            conversationId,
                        },
                    });
                } catch (error) {
                    this.sendError(callback, error, "Unable to leave conversation");
                }
            },
        );
    }

    private registerSendMessage(io: Server, socket: Socket): void {
        socket.on(
            SOCKET_EVENTS.CHAT.SEND_MESSAGE,
            async (
                payload: SendMessagePayload,
                callback?: SocketCallback<SocketResponse>,
            ) => {
                try {
                    const user = this.getSocketUser(socket);

                    const conversationId = this.validateConversationId(payload);

                    const body = this.validateMessageBody(payload);

                    /**
                     * MessageService performs the
                     * participant authorization.
                     */
                    const message = await messageService.createMessage(user.id, {
                        conversationId,
                        body,
                    });

                    const room = this.getConversationRoom(conversationId);

                    /**
                     * Broadcast to every socket in
                     * this conversation.
                     */
                    io.to(room).emit(SOCKET_EVENTS.CHAT.NEW_MESSAGE, message);

                    /**
                     * Acknowledge sender.
                     */
                    callback?.({
                        ok: true,
                        data: {
                            message,
                        },
                    });
                } catch (error) {
                    this.sendError(callback, error, "Unable to send message");
                }
            },
        );
    }

    private registerTyping(_io: Server, socket: Socket): void {
        socket.on(SOCKET_EVENTS.CHAT.TYPING, async (payload: TypingPayload) => {
            try {
                const user = this.getSocketUser(socket);

                const conversationId = this.validateConversationId(payload);

                /**
                 * Verify that the user actually belongs
                 * to this conversation.
                 */
                const conversation = await conversationService.getConversationById(
                    conversationId,
                    user.id,
                    user.companyId,
                );

                const room = this.getConversationRoom(conversation.id);

                /**
                 * Don't send typing event back to
                 * the person who is typing.
                 */
                socket.to(room).emit(SOCKET_EVENTS.CHAT.TYPING, {
                    conversationId,
                    userId: user.id,
                    uniqueName: user.uniqueName,
                });
            } catch {
                /**
                 * Typing events are transient.
                 * Don't send internal errors to clients.
                 */
            }
        });

        socket.on(
            SOCKET_EVENTS.CHAT.STOP_TYPING,
            async (payload: TypingPayload) => {
                try {
                    const user = this.getSocketUser(socket);

                    const conversationId = this.validateConversationId(payload);

                    const conversation = await conversationService.getConversationById(
                        conversationId,
                        user.id,
                        user.companyId,
                    );

                    const room = this.getConversationRoom(conversation.id);

                    socket.to(room).emit(SOCKET_EVENTS.CHAT.STOP_TYPING, {
                        conversationId,
                        userId: user.id,
                        uniqueName: user.uniqueName,
                    });
                } catch {
                    /**
                     * Ignore transient typing errors.
                     */
                }
            },
        );
    }

    private getSocketUser(socket: Socket): SocketUser {
        const user = socket.data.user as SocketUser | undefined;

        if (!user) {
            throw new Error("Socket is not authenticated");
        }

        return user;
    }

    private validateConversationId(
        payload:
            | JoinConversationPayload
            | LeaveConversationPayload
            | SendMessagePayload
            | TypingPayload,
    ): string {
        if (
            !payload ||
            typeof payload.conversationId !== "string" ||
            !payload.conversationId.trim()
        ) {
            throw new Error("conversationId is required");
        }

        return payload.conversationId.trim();
    }

    private validateMessageBody(payload: SendMessagePayload): string {
        if (!payload || typeof payload.body !== "string" || !payload.body.trim()) {
            throw new Error("Message body is required");
        }

        const body = payload.body.trim();

        if (body.length > 10000) {
            throw new Error("Message body cannot exceed 10,000 characters");
        }

        return body;
    }

    private getConversationRoom(conversationId: string): string {
        return `conversation:${conversationId}`;
    }

    private sendError(
        callback: SocketCallback<SocketResponse> | undefined,
        error: unknown,
        fallback: string,
    ): void {
        callback?.({
            ok: false,
            error: error instanceof Error ? error.message : fallback,
        });
    }
}

export const chatSocket = new ChatSocket();
