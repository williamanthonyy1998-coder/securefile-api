import type { Conversation } from "../../api/chat.api";
import { conversationTitle, displayName } from "./chat.utils";

type ChatMode = "chat" | "group" | "mail";

type ChatSidebarProps = {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  people: any[];
  directConversations: Conversation[];
  groupConversations: Conversation[];
  selectedConversationId: string;
  unreadByConversation: Record<string, number>;
  me: string;
  online: Set<string>;
  onSelectConversation: (conversation: Conversation) => void;
  onStartDirect: (userId: string) => void;
  onRenameGroup: (conversation: Conversation) => void;
  onLeaveGroup: (conversation: Conversation) => void;
  groupName: string;
  onGroupNameChange: (value: string) => void;
  groupUsers: string[];
  onToggleGroupUser: (userId: string, checked: boolean) => void;
  onCreateGroup: () => void;
  creatingGroup: boolean;
  mailBox: "inbox" | "sent";
  onMailBoxChange: (box: "inbox" | "sent") => void;
  emails: any[];
  mailDetail: any;
  onSelectMail: (mail: any) => void;
};

export default function ChatSidebar({
  mode,
  onModeChange,
  people,
  directConversations,
  groupConversations,
  selectedConversationId,
  unreadByConversation,
  me,
  online,
  onSelectConversation,
  onStartDirect,
  onRenameGroup,
  onLeaveGroup,
  groupName,
  onGroupNameChange,
  groupUsers,
  onToggleGroupUser,
  onCreateGroup,
  creatingGroup,
  mailBox,
  onMailBoxChange,
  emails,
  mailDetail,
  onSelectMail,
}: ChatSidebarProps) {
  const chattedUserIds = new Set(
    directConversations.flatMap((conversation) =>
      conversation.participants
        .map((p) => p.userId)
        .filter((id) => id !== me),
    ),
  );
  const newPeople = people.filter((u: any) => !chattedUserIds.has(u.id));

  return (
    <div className="chat-sidebar">
      <div className="chat-tabs">
        <button
          className={mode === "chat" ? "active" : ""}
          onClick={() => onModeChange("chat")}
        >
          Chats
        </button>
        <button
          className={mode === "group" ? "active" : ""}
          onClick={() => onModeChange("group")}
        >
          Groups
        </button>
        <button
          className={mode === "mail" ? "active" : ""}
          onClick={() => onModeChange("mail")}
        >
          Mail
        </button>
      </div>
      {mode === "chat" && (
        <>
          {directConversations.map((conversation) => {
            const other = conversation.participants.find((p) => p.userId !== me)
              ?.user;
            const unread = unreadByConversation[conversation.id] || 0;
            return (
              <button
                key={conversation.id}
                className={`chat-person ${selectedConversationId === conversation.id ? "selected" : ""}`}
                onClick={() => onSelectConversation(conversation)}
              >
                <span
                  className={`presence-dot ${other && online.has(other.id) ? "online" : "offline"}`}
                />
                <span className="chat-person-copy">
                  <b>{conversationTitle(conversation, me)}</b>
                  <small>
                    {conversation.lastMessage?.body ||
                      (other && online.has(other.id) ? "Online" : "Offline")}
                  </small>
                </span>
                {unread > 0 && (
                  <span className="notification-badge">{unread > 99 ? "99+" : unread}</span>
                )}
              </button>
            );
          })}
          {newPeople.map((u: any) => (
            <button
              key={u.id}
              className="chat-person"
              onClick={() => onStartDirect(u.id)}
            >
              <span
                className={`presence-dot ${online.has(u.id) ? "online" : "offline"}`}
              />
              <span className="chat-person-copy">
                <b>{displayName(u)}</b>
                <small>Start a chat · {u.email}</small>
              </span>
            </button>
          ))}
          {!directConversations.length && !newPeople.length && (
            <p className="muted">No active company users.</p>
          )}
        </>
      )}
      {mode === "group" && (
        <>
          {groupConversations.map((conversation) => {
            const unread = unreadByConversation[conversation.id] || 0;
            return (
              <div
                key={conversation.id}
                className={`chat-person group-item ${selectedConversationId === conversation.id ? "selected" : ""}`}
              >
                <button
                  className="link-button"
                  style={{ display: "block", width: "100%", textAlign: "left" }}
                  onClick={() => onSelectConversation(conversation)}
                >
                  <b>{conversation.name || "Group"}</b>
                  <small>
                    {conversation.participants.length} members
                    {conversation.lastMessage?.body
                      ? ` · ${conversation.lastMessage.body}`
                      : ""}
                  </small>
                </button>
                {unread > 0 && (
                  <span className="notification-badge">{unread > 99 ? "99+" : unread}</span>
                )}
                <div className="row-actions">
                  <button
                    className="icon-btn"
                    title="Rename"
                    onClick={() => onRenameGroup(conversation)}
                  >
                    ✎
                  </button>
                  <button
                    className="icon-btn danger"
                    title="Leave"
                    onClick={() => onLeaveGroup(conversation)}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
          <div className="group-create">
            <input
              placeholder="Group name"
              value={groupName}
              onChange={(e) => onGroupNameChange(e.target.value)}
            />
            {people.map((u: any) => (
              <label className="checkline" key={u.id}>
                <input
                  type="checkbox"
                  checked={groupUsers.includes(u.id)}
                  onChange={(e) => onToggleGroupUser(u.id, e.target.checked)}
                />
                {displayName(u)}
              </label>
            ))}
            <button
              className="btn small"
              disabled={!groupName.trim() || !groupUsers.length || creatingGroup}
              onClick={onCreateGroup}
            >
              {creatingGroup ? "Creating…" : "Create group"}
            </button>
          </div>
        </>
      )}
      {mode === "mail" && (
        <>
          <div className="mail-box-buttons">
            <button
              className={`btn small ${mailBox === "inbox" ? "" : "secondary"}`}
              onClick={() => onMailBoxChange("inbox")}
            >
              Inbox
            </button>
            <button
              className={`btn small ${mailBox === "sent" ? "" : "secondary"}`}
              onClick={() => onMailBoxChange("sent")}
            >
              Sent
            </button>
          </div>
          {emails.map((m: any) => (
            <button
              key={m.id}
              className={`chat-person ${mailDetail?.id === m.id ? "selected" : ""}`}
              onClick={() => onSelectMail(m)}
            >
              <b>{m.subject || "(No subject)"}</b>
              <small>
                {mailBox === "sent"
                  ? m.recipientEmail
                  : m.sender?.email || "External sender"}{" "}
                · {new Date(m.createdAt).toLocaleDateString()}
              </small>
            </button>
          ))}
          {!emails.length && (
            <p className="muted">No emails in this mailbox.</p>
          )}
        </>
      )}
    </div>
  );
}
