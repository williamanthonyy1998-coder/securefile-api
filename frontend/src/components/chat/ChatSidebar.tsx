type ChatMode = "chat" | "group" | "mail";

type ChatSidebarProps = {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  people: any[];
  selectedUserId: string;
  online: Set<string>;
  onSelectUser: (userId: string) => void;
  groups: any[];
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
  onRenameGroup: (group: any) => void;
  onDeleteGroup: (group: any) => void;
  groupName: string;
  onGroupNameChange: (value: string) => void;
  groupUsers: string[];
  onToggleGroupUser: (userId: string, checked: boolean) => void;
  onCreateGroup: () => void;
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
  selectedUserId,
  online,
  onSelectUser,
  groups,
  selectedGroupId,
  onSelectGroup,
  onRenameGroup,
  onDeleteGroup,
  groupName,
  onGroupNameChange,
  groupUsers,
  onToggleGroupUser,
  onCreateGroup,
  mailBox,
  onMailBoxChange,
  emails,
  mailDetail,
  onSelectMail,
}: ChatSidebarProps) {
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
          {people.map((u: any) => (
            <button
              key={u.id}
              className={`chat-person ${selectedUserId === u.id ? "selected" : ""}`}
              onClick={() => onSelectUser(u.id)}
            >
              <span
                className={`presence-dot ${online.has(u.id) ? "online" : "offline"}`}
              />
              <span className="chat-person-copy">
                <b>{u.uniqueName}</b>
                <small>
                  {online.has(u.id) ? "Online" : "Offline"} · {u.email}
                </small>
              </span>
            </button>
          ))}
          {!people.length && (
            <p className="muted">No active company users.</p>
          )}
        </>
      )}
      {mode === "group" && (
        <>
          {groups.map((g: any) => (
            <div
              key={g.id}
              className={`chat-person group-item ${selectedGroupId === g.id ? "selected" : ""}`}
            >
              <button
                className="link-button"
                style={{ display: "block", width: "100%", textAlign: "left" }}
                onClick={() => onSelectGroup(g.id)}
              >
                <b>{g.name}</b>
                <small>{g.members?.length || 0} members</small>
              </button>
              <div className="row-actions">
                <button
                  className="icon-btn"
                  title="Rename"
                  onClick={() => onRenameGroup(g)}
                >
                  ✎
                </button>
                <button
                  className="icon-btn danger"
                  title="Delete"
                  onClick={() => onDeleteGroup(g)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
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
                {u.uniqueName}
              </label>
            ))}
            <button
              className="btn small"
              disabled={!groupName.trim() || !groupUsers.length}
              onClick={onCreateGroup}
            >
              Create group
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
