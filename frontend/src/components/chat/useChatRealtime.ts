import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { chatKeys, type Message, type MessagesResponse } from "../../api/chat.api";
import { connectSocket, getSocket } from "../../services/socket";

function upsertMessage(
  current: MessagesResponse | undefined,
  message: Message,
): MessagesResponse {
  const messages = current?.messages ?? [];
  if (messages.some((item) => item.id === message.id)) {
    return current ?? { messages };
  }
  return {
    ...current,
    messages: [message, ...messages],
  };
}

export function useChatRealtime(activeConversationId: string) {
  const queryClient = useQueryClient();
  const me = localStorage.getItem("sf_user_id") || "";
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [delivered, setDelivered] = useState<Set<string>>(new Set());
  const [readAtByUser, setReadAtByUser] = useState<Record<string, string>>({});
  const conversationIdRef = useRef(activeConversationId);
  const typingTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    conversationIdRef.current = activeConversationId;
    setTypingUsers(new Map());
    setDelivered(new Set());
  }, [activeConversationId]);

  useEffect(() => {
    const token = localStorage.getItem("sf_token");
    if (token) connectSocket(token);

    const socket = getSocket();
    if (!socket) return;

    const onPresenceSnapshot = (payload: { userIds?: string[] }) => {
      setOnline(new Set(Array.isArray(payload?.userIds) ? payload.userIds : []));
    };

    const onPresence = (payload: { userId?: string; online?: boolean }) => {
      if (!payload?.userId) return;
      setOnline((prev) => {
        const next = new Set(prev);
        if (payload.online) next.add(payload.userId!);
        else next.delete(payload.userId!);
        return next;
      });
    };

    const onTyping = (payload: {
      conversationId?: string;
      userId?: string;
      uniqueName?: string;
    }) => {
      if (!payload?.userId || payload.conversationId !== conversationIdRef.current) {
        return;
      }
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.set(payload.userId!, payload.uniqueName || payload.userId!);
        return next;
      });
    };

    const onStopTyping = (payload: { conversationId?: string; userId?: string }) => {
      if (!payload?.userId || payload.conversationId !== conversationIdRef.current) {
        return;
      }
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(payload.userId!);
        return next;
      });
    };

    const onDelivered = (payload: { messageId?: string }) => {
      if (payload?.messageId) {
        setDelivered((prev) => new Set(prev).add(payload.messageId!));
      }
    };

    const onRead = (payload: {
      conversationId?: string;
      userId?: string;
      lastReadAt?: string;
    }) => {
      if (!payload?.conversationId || !payload?.userId || !payload?.lastReadAt) {
        return;
      }
      if (payload.conversationId === conversationIdRef.current) {
        setReadAtByUser((prev) => ({ ...prev, [payload.userId!]: payload.lastReadAt! }));
      }
      queryClient.invalidateQueries({
        queryKey: chatKeys.unreadConversations,
      });
    };

    const onNewMessage = (message: Message) => {
      if (!message?.id || !message?.conversationId) return;

      queryClient.setQueriesData(
        { queryKey: ["chat", "messages", message.conversationId] },
        (current: MessagesResponse | undefined) => upsertMessage(current, message),
      );
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations });
      queryClient.invalidateQueries({ queryKey: chatKeys.unreadConversations });

      const active = conversationIdRef.current === message.conversationId;
      if (active && message.senderId !== me) {
        socket.emit("chat:message_read", { conversationId: message.conversationId });
      }
      if (message.senderId === me) {
        setDelivered((prev) => new Set(prev).add(message.id));
      }

      try {
        window.dispatchEvent(
          new CustomEvent("sf:chat-event", {
            detail: JSON.stringify({ message, active }),
          }),
        );
      } catch {}
    };

    socket.on("chat:presence_snapshot", onPresenceSnapshot);
    socket.on("chat:presence", onPresence);
    socket.on("chat:typing", onTyping);
    socket.on("chat:stop_typing", onStopTyping);
    socket.on("chat:message_delivered", onDelivered);
    socket.on("chat:message_read", onRead);
    socket.on("chat:new_message", onNewMessage);

    return () => {
      socket.off("chat:presence_snapshot", onPresenceSnapshot);
      socket.off("chat:presence", onPresence);
      socket.off("chat:typing", onTyping);
      socket.off("chat:stop_typing", onStopTyping);
      socket.off("chat:message_delivered", onDelivered);
      socket.off("chat:message_read", onRead);
      socket.off("chat:new_message", onNewMessage);
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
    };
  }, [me, queryClient]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    let joined = "";

    const syncRoom = () => {
      if (joined && joined !== activeConversationId) {
        socket.emit("chat:leave_conversation", { conversationId: joined });
      }
      joined = activeConversationId;
      if (!activeConversationId) return;
      socket.emit(
        "chat:join_conversation",
        { conversationId: activeConversationId },
        () => {
          socket.emit("chat:message_read", {
            conversationId: activeConversationId,
          });
        },
      );
    };

    if (socket.connected) syncRoom();
    socket.on("connect", syncRoom);

    return () => {
      socket.off("connect", syncRoom);
      if (joined) {
        socket.emit("chat:leave_conversation", { conversationId: joined });
      }
    };
  }, [activeConversationId]);

  function emitTyping(conversationId: string) {
    const socket = getSocket();
    if (!socket?.connected || !conversationId) return;
    socket.emit("chat:typing", { conversationId });
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      socket.emit("chat:stop_typing", { conversationId });
    }, 900);
  }

  function emitStopTyping(conversationId: string) {
    const socket = getSocket();
    if (socket?.connected && conversationId) {
      socket.emit("chat:stop_typing", { conversationId });
    }
  }

  function sendViaSocket(conversationId: string, body: string) {
    const socket = getSocket();
    if (!socket?.connected) return null;
    return new Promise<Message>((resolve, reject) => {
      socket
        .timeout(8000)
        .emit(
          "chat:send_message",
          { conversationId, body },
          (err: Error | null, ack?: { ok?: boolean; data?: { message?: Message }; error?: string }) => {
            if (err) reject(err);
            else if (ack?.ok && ack.data?.message) resolve(ack.data.message);
            else reject(new Error(ack?.error || "Unable to send message"));
          },
        );
    });
  }

  return {
    me,
    online,
    typingUsers,
    delivered,
    readAtByUser,
    setReadAtByUser,
    emitTyping,
    emitStopTyping,
    sendViaSocket,
    socket: getSocket() as Socket | null,
  };
}
