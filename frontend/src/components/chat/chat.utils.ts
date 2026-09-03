import axios from "axios";
import type { Conversation, ChatUser, Message } from "../../api/chat.api";

export function chatErrorMessage(error: unknown, fallback = "Something went wrong") {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    return data?.error || data?.message || error.message || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function displayName(user?: ChatUser | null) {
  if (!user) return "Unknown";
  if (user.uniqueName) return user.uniqueName;
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return full || user.email || "Unknown";
}

export function otherParticipant(conversation: Conversation | undefined, me: string) {
  return conversation?.participants.find((p) => p.userId !== me)?.user;
}

export function conversationTitle(conversation: Conversation | undefined, me: string) {
  if (!conversation) return "Select a conversation";
  if (conversation.type === "GROUP") return conversation.name || "Group";
  return displayName(otherParticipant(conversation, me));
}

export function chronologicalMessages(messages: Message[] | undefined) {
  if (!messages?.length) return [];
  return [...messages].sort((a, b) => {
    const time = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (time !== 0) return time;
    return a.id.localeCompare(b.id);
  });
}
