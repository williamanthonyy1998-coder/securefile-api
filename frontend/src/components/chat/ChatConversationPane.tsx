import type { ReactNode } from "react";
import { Send } from "lucide-react";

type ChatConversationPaneProps = {
  mode: "chat" | "group";
  currentUser: any;
  currentGroup: any;
  online: Set<string>;
  currentTyping: string[];
  messages: any[];
  me: string;
  conversationId: string;
  body: string;
  onBodyChange: (value: string) => void;
  onSend: () => void;
  messageStatus: (message: any) => ReactNode;
};

export default function ChatConversationPane({
  mode,
  currentUser,
  currentGroup,
  online,
  currentTyping,
  messages,
  me,
  conversationId,
  body,
  onBodyChange,
  onSend,
  messageStatus,
}: ChatConversationPaneProps) {
  return (
    <div className="panel chat-conversation">
      <div className="chat-conversation-head">
        <div>
          <h2>
            {mode === "chat"
              ? currentUser?.uniqueName || "Select a person"
              : currentGroup?.name || "Select a group"}
          </h2>
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
          {mode === "group"
            ? `${currentGroup?.members?.length || 0} members`
            : ""}
        </span>
      </div>
      <div className="data chat-messages">
        {messages.map((m: any) => (
          <div
            className={`message-bubble ${m.senderId === me ? "mine" : ""}`}
            key={m.id}
          >
            <b>{m.sender?.uniqueName || "You"}</b>
            <p>{m.body}</p>
            <small>
              {new Date(m.createdAt).toLocaleString()} {messageStatus(m)}
            </small>
          </div>
        ))}
        {!messages.length && (
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
          disabled={!conversationId}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <button
          className="btn"
          disabled={!conversationId || !body.trim()}
          onClick={onSend}
        >
          <Send size={14} /> Send
        </button>
      </div>
    </div>
  );
}
