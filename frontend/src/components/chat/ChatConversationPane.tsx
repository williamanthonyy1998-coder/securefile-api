import type { ReactNode } from "react";
import { Send } from "lucide-react";
import type { ChatUser, Message } from "../../api/chat.api";
import { displayName } from "./chat.utils";

type ChatConversationPaneProps = {
  mode: "chat" | "group";
  title: string;
  memberCount: number;
  currentUser?: ChatUser;
  online: Set<string>;
  currentTyping: string[];
  messages: Message[];
  loading: boolean;
  me: string;
  conversationId: string;
  body: string;
  sending: boolean;
  onBodyChange: (value: string) => void;
  onSend: () => void;
  messageStatus: (message: Message) => ReactNode;
};

export default function ChatConversationPane({
  mode,
  title,
  memberCount,
  currentUser,
  online,
  currentTyping,
  messages,
  loading,
  me,
  conversationId,
  body,
  sending,
  onBodyChange,
  onSend,
  messageStatus,
}: ChatConversationPaneProps) {
  return (
    <div className="panel chat-conversation">
      <div className="chat-conversation-head">
        <div>
          <h2>{conversationId ? title : "Select a conversation"}</h2>
          {mode === "chat" && currentUser && (
            <span
              className={`chat-status ${online.has(currentUser.id) ? "online" : "offline"}`}
            >
              <span
                className={`presence-dot ${online.has(currentUser.id) ? "online" : "offline"}`}
              />
              {online.has(currentUser.id) ? "Online" : "Offline"}
            </span>
          )}
          {currentTyping.length > 0 && (
            <span className="typing-indicator">
              {currentTyping.length === 1
                ? `${currentTyping[0]} is typing...`
                : `${currentTyping.join(", ")} are typing...`}
            </span>
          )}
        </div>
        <span className="muted">
          {mode === "group" && conversationId ? `${memberCount} members` : ""}
        </span>
      </div>
      <div className="data chat-messages">
        {loading && <span className="muted">Loading messages…</span>}
        {!loading &&
          messages.map((m) => (
            <div
              className={`message-bubble ${m.senderId === me ? "mine" : ""}`}
              key={m.id}
            >
              <b>
                {m.senderId === me ? "You" : displayName(m.sender)}
              </b>
              <p>{m.body}</p>
              <small>
                {new Date(m.createdAt).toLocaleString()} {messageStatus(m)}
              </small>
            </div>
          ))}
        {!loading && !messages.length && (
          <span className="muted">
            Select a chat or group to start messaging.
          </span>
        )}
      </div>
      <div className="toolbar">
        <input
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder={
            conversationId ? "Write a message..." : "Select a chat first"
          }
          disabled={!conversationId || sending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <button
          className="btn"
          disabled={!conversationId || !body.trim() || sending}
          onClick={onSend}
        >
          <Send size={14} /> {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
