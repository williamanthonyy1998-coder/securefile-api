import { Send } from "lucide-react";

type ChatMailPaneProps = {
  people: any[];
  mailBox: "inbox" | "sent";
  recipientMode: "USER" | "EMAIL";
  onRecipientModeChange: (mode: "USER" | "EMAIL") => void;
  mailRecipient: string;
  onMailRecipientChange: (value: string) => void;
  subject: string;
  onSubjectChange: (value: string) => void;
  mailBody: string;
  onMailBodyChange: (value: string) => void;
  onSendMail: () => void;
  mailDetail: any;
};

export default function ChatMailPane({
  people,
  mailBox,
  recipientMode,
  onRecipientModeChange,
  mailRecipient,
  onMailRecipientChange,
  subject,
  onSubjectChange,
  mailBody,
  onMailBodyChange,
  onSendMail,
  mailDetail,
}: ChatMailPaneProps) {
  return (
    <div className="grid2 mail-layout">
      <div className="panel">
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>SecureFile Mail</h2>
          <span className="muted">
            {mailBox === "inbox" ? "Inbox" : "Sent"}
          </span>
        </div>
        <div className="mail-compose-tabs">
          <button
            className={`btn small ${recipientMode === "USER" ? "" : "secondary"}`}
            onClick={() => onRecipientModeChange("USER")}
          >
            Company user
          </button>
          <button
            className={`btn small ${recipientMode === "EMAIL" ? "" : "secondary"}`}
            onClick={() => onRecipientModeChange("EMAIL")}
          >
            Email address
          </button>
        </div>
        {recipientMode === "USER" ? (
          <label>
            Recipient
            <select
              value={mailRecipient}
              onChange={(e) => onMailRecipientChange(e.target.value)}
            >
              <option value="">Choose company user</option>
              {people.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.uniqueName} — {u.email}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            Recipient email
            <input
              type="email"
              value={mailRecipient}
              onChange={(e) => onMailRecipientChange(e.target.value)}
              placeholder="name@example.com"
            />
          </label>
        )}
        <label>
          Subject
          <input
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="Subject"
          />
        </label>
        <label>
          Message
          <textarea
            rows={10}
            value={mailBody}
            onChange={(e) => onMailBodyChange(e.target.value)}
            placeholder="Write your email..."
          />
        </label>
        <button
          className="btn"
          disabled={
            !mailRecipient ||
            !subject.trim() ||
            !mailBody.trim() ||
            (recipientMode === "EMAIL" &&
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailRecipient))
          }
          onClick={onSendMail}
        >
          <Send size={14} /> Send email
        </button>
        <p className="muted" style={{ marginTop: 10 }}>
          Incoming mail can be routed into this mailbox through the
          SecureFile inbound-email webhook.
        </p>
      </div>
      <div className="panel">
        <h2>{mailDetail?.subject || "Select an email"}</h2>
        {mailDetail ? (
          <>
            <p className="muted">
              <b>From:</b> {mailDetail.sender?.email || "External sender"}
              <br />
              <b>To:</b> {mailDetail.recipientEmail}
              <br />
              <b>Date:</b> {new Date(mailDetail.createdAt).toLocaleString()}
            </p>
            <div className="data mail-body">{mailDetail.body}</div>
          </>
        ) : (
          <p className="muted">Select an email from the mailbox.</p>
        )}
      </div>
    </div>
  );
}
