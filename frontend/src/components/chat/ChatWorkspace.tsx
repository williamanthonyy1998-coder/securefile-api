import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import ChatSidebar from "./ChatSidebar";
import ChatConversationPane from "./ChatConversationPane";
import ChatMailPane from "./ChatMailPane";

type ChatMode = "chat" | "group" | "mail";

function notifyChatOpen() {
  try {
    window.dispatchEvent(new CustomEvent("sf:chat-open"));
  } catch {}
}

export default function ChatWorkspace() {
  const { conversationId = "" } = useParams();
  const nav = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const me = localStorage.getItem("sf_user_id") || "";
  const [mode, setMode] = useState<ChatMode>("chat");
  const [to, setTo] = useState("");
  const [groupId, setGroupId] = useState("");
  const [body, setBody] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupUsers, setGroupUsers] = useState<string[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [mailBox, setMailBox] = useState<"inbox" | "sent">("inbox");
  const [subject, setSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [mailRecipient, setMailRecipient] = useState("");
  const [recipientMode, setRecipientMode] = useState<"USER" | "EMAIL">("USER");
  const [mailDetail, setMailDetail] = useState<any>(null);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [delivered, setDelivered] = useState<Set<string>>(new Set());
  const [readAtByUser, setReadAtByUser] = useState<Record<string, string>>({});
  const socketRef = useRef<any>(null);
  const conversationIdRef = useRef("");
  const typingTimer = useRef<number | undefined>(undefined);
  const people = users.filter((u: any) => u.id !== me && u.status === "ACTIVE");

  const socketUrl = (() => {
    const configured = String(
      (import.meta as any).env?.VITE_SOCKET_URL || "",
    ).trim();
    if (configured) return configured.replace(/\/$/, "");
    const apiBase = String((import.meta as any).env?.VITE_API_URL || "").trim();
    if (apiBase) return apiBase.replace(/\/api\/?$/, "");
    return (
      (window.location.protocol === "https:" ? "https://" : "http://") +
      window.location.hostname +
      ":4000"
    );
  })();

  function openConversation(id: string, nextMode?: ChatMode) {
    notifyChatOpen();
    if (nextMode) setMode(nextMode);
    if (id) nav(`/chat/${id}`);
    else nav("/chat");
  }

  async function loadGroups() {
    try {
      setGroups(await api("/workspace/groups"));
    } catch {}
  }

  async function loadConversations() {
    try {
      const r = await api("/conversations?limit=100");
      setConversations(r?.conversations || []);
    } catch {}
  }

  async function loadMessages(id = conversationId) {
    try {
      if (!id) {
        setMessages([]);
        return;
      }
      const c = await api("/conversations/" + encodeURIComponent(id));
      const conversation = c?.conversation || c;
      const reads: any = {};
      for (const p of conversation?.participants || [])
        if (p.lastReadAt) reads[p.userId] = p.lastReadAt;
      setReadAtByUser(reads);
      setDelivered(new Set());

      const isGroup = conversation?.type === "GROUP";
      const otherId =
        conversation?.participants?.find((p: any) => p.userId !== me)?.userId ||
        to;
      const rows = await api(
        "/workspace/messages?" +
          (isGroup
            ? "groupId=" + encodeURIComponent(id)
            : "withUser=" + encodeURIComponent(otherId || "")),
      );
      setMessages(rows || []);
      const sock = socketRef.current;
      if (sock?.connected)
        sock.emit("chat:message_read", { conversationId: id });
    } catch {
      setMessages([]);
    }
  }

  async function ensureDirect(userId: string) {
    const existing = conversations.find(
      (c: any) =>
        c.type === "DIRECT" &&
        c.participants?.some((p: any) => p.userId === me) &&
        c.participants?.some((p: any) => p.userId === userId),
    );
    if (existing) return existing.id;
    try {
      const r = await api("/conversations/direct", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      const c = r?.conversation;
      if (c) {
        setConversations((v) => [...v.filter((x: any) => x.id !== c.id), c]);
        return c.id;
      }
    } catch {}
    return "";
  }

  useEffect(() => {
    notifyChatOpen();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      const factory = (window as any).io;
      const authToken = localStorage.getItem("sf_token") || "";
      if (!factory || !authToken) return;
      const socket = factory(socketUrl, {
        auth: { token: authToken },
        transports: ["websocket", "polling"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
      });
      socketRef.current = socket;
      socket.on("chat:presence_snapshot", (p: any) =>
        setOnline(new Set(Array.isArray(p?.userIds) ? p.userIds : [])),
      );
      socket.on("chat:presence", (p: any) =>
        setOnline((prev) => {
          const n = new Set(prev);
          if (p?.online) n.add(p.userId);
          else n.delete(p.userId);
          return n;
        }),
      );
      socket.on("chat:typing", (p: any) => {
        if (!p?.userId) return;
        setTypingUsers((prev) => new Set(prev).add(p.userId));
      });
      socket.on("chat:stop_typing", (p: any) => {
        if (!p?.userId) return;
        setTypingUsers((prev) => {
          const n = new Set(prev);
          n.delete(p.userId);
          return n;
        });
      });
      socket.on("chat:message_delivered", (p: any) => {
        if (p?.messageId)
          setDelivered((prev) => new Set(prev).add(p.messageId));
      });
      socket.on("chat:message_read", (p: any) => {
        if (!p?.conversationId || !p?.userId || !p?.lastReadAt) return;
        setReadAtByUser((prev) => ({ ...prev, [p.userId]: p.lastReadAt }));
      });
      socket.on("chat:new_message", (m: any) => {
        if (!m?.id || !m?.conversationId) return;
        const active = conversationIdRef.current === m.conversationId;
        if (active) {
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m],
          );
          if (m.senderId !== me)
            socket.emit("chat:message_read", {
              conversationId: m.conversationId,
            });
        }
        try {
          window.dispatchEvent(
            new CustomEvent("sf:chat-event", {
              detail: JSON.stringify({ message: m, active }),
            }),
          );
        } catch {}
        if (m.senderId === me) setDelivered((prev) => new Set(prev).add(m.id));
      });
      socket.on("connect", () => {
        if (conversationIdRef.current)
          socket.emit("chat:join_conversation", {
            conversationId: conversationIdRef.current,
          });
      });
      socket.on("connect_error", (e: any) =>
        console.warn("[SecureFile chat]", e?.message || "connection error"),
      );
    };
    if ((window as any).io) start();
    else {
      const timer = window.setInterval(() => {
        if ((window as any).io) {
          window.clearInterval(timer);
          start();
        }
      }, 100);
      window.setTimeout(() => window.clearInterval(timer), 10000);
    }
    return () => {
      cancelled = true;
      const sock = socketRef.current;
      if (sock) {
        sock.removeAllListeners();
        sock.disconnect();
        socketRef.current = null;
      }
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
    };
  }, [socketUrl, me]);

  useEffect(() => {
    Promise.all([api("/users"), loadGroups(), loadConversations()])
      .then(([u]) => setUsers(u || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const previous = conversationIdRef.current;
    conversationIdRef.current = conversationId;
    const sock = socketRef.current;
    if (sock?.connected) {
      if (previous && previous !== conversationId)
        sock.emit("chat:leave_conversation", { conversationId: previous });
      if (conversationId)
        sock.emit("chat:join_conversation", { conversationId });
    }
    loadMessages(conversationId);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setTo("");
      setGroupId("");
      return;
    }
    const listed = conversations.find((c: any) => c.id === conversationId);
    if (listed) {
      if (listed.type === "GROUP") {
        setMode((current) => (current === "mail" ? current : "group"));
        setGroupId(listed.id);
        setTo("");
        return;
      }
      setMode((current) => (current === "mail" ? current : "chat"));
      const other = listed.participants?.find((p: any) => p.userId !== me)
        ?.userId;
      if (other) setTo(other);
      setGroupId("");
      return;
    }
    let cancelled = false;
    api("/conversations/" + encodeURIComponent(conversationId))
      .then((c) => {
        if (cancelled) return;
        const conversation = c?.conversation || c;
        if (!conversation?.id) return;
        setConversations((v) =>
          v.some((x: any) => x.id === conversation.id)
            ? v
            : [conversation, ...v],
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [conversationId, conversations, me]);

  useEffect(() => {
    if (mode === "mail") loadEmails();
  }, [mode, mailBox]);

  async function loadEmails() {
    try {
      setEmails(await api("/workspace/emails?box=" + mailBox));
    } catch {}
  }

  function handleTyping(value: string) {
    setBody(value);
    const sock = socketRef.current;
    if (!sock?.connected || !conversationId) return;
    sock.emit("chat:typing", { conversationId });
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(
      () => sock.emit("chat:stop_typing", { conversationId }),
      900,
    );
  }

  async function send() {
    const text = body.trim();
    if (!text || !conversationId) return;
    const sock = socketRef.current;
    try {
      if (sock?.connected) {
        await new Promise((resolve, reject) =>
          sock
            .timeout(8000)
            .emit(
              "chat:send_message",
              { conversationId, body: text },
              (ack: any) =>
                ack?.ok
                  ? resolve(ack)
                  : reject(new Error(ack?.error || "Unable to send message")),
            ),
        );
      } else {
        await api("/workspace/messages", {
          method: "POST",
          body: JSON.stringify({
            recipientId: mode === "chat" ? to : undefined,
            groupId: mode === "group" ? groupId : undefined,
            body: text,
          }),
        });
        await loadMessages(conversationId);
      }
      setBody("");
      if (sock?.connected) sock.emit("chat:stop_typing", { conversationId });
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function createGroup() {
    if (!groupName.trim() || !groupUsers.length) return;
    try {
      const g = await api("/workspace/groups", {
        method: "POST",
        body: JSON.stringify({ name: groupName, userIds: groupUsers }),
      });
      setGroupName("");
      setGroupUsers([]);
      await Promise.all([loadGroups(), loadConversations()]);
      openConversation(g.id, "group");
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function renameGroup(g: any) {
    const name = window.prompt("New group name", g.name);
    if (!name?.trim()) return;
    try {
      await api("/workspace/groups/" + g.id, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      loadGroups();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function deleteGroup(g: any) {
    if (!confirm(`Delete group "${g.name}"? Messages will be removed.`)) return;
    try {
      await api("/workspace/groups/" + g.id, { method: "DELETE" });
      if (conversationId === g.id) nav("/chat");
      await Promise.all([loadGroups(), loadConversations()]);
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function sendMail() {
    const emailMode = recipientMode === "EMAIL";
    const valid = emailMode
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailRecipient.trim())
      : !!mailRecipient;
    if (!valid || !subject.trim() || !mailBody.trim()) return;
    try {
      await api("/workspace/email", {
        method: "POST",
        body: JSON.stringify({
          recipientId: emailMode ? undefined : mailRecipient,
          recipientEmail: emailMode
            ? mailRecipient.trim().toLowerCase()
            : undefined,
          subject: subject.trim(),
          body: mailBody.trim(),
        }),
      });
      setSubject("");
      setMailBody("");
      setMailRecipient("");
      setMailBox("sent");
      setMailDetail(null);
      await loadEmails();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function selectUser(userId: string) {
    setMode("chat");
    setTo(userId);
    const id = await ensureDirect(userId);
    if (id) openConversation(id, "chat");
  }

  function selectGroup(id: string) {
    setGroupId(id);
    openConversation(id, "group");
  }

  const currentUser = people.find((u: any) => u.id === to);
  const currentGroup = groups.find((g: any) => g.id === groupId);
  const currentTyping = [...typingUsers]
    .filter((id) => id !== me)
    .map((id) => users.find((u: any) => u.id === id)?.uniqueName)
    .filter(Boolean);
  const otherParticipantIds =
    mode === "chat" && to
      ? [to]
      : (currentGroup?.members || [])
          .map((m: any) => m.userId)
          .filter((id: string) => id !== me);

  function messageStatus(m: any) {
    if (m.senderId !== me) return null;
    const readTimes = otherParticipantIds
      .map((id: string) => readAtByUser[id])
      .filter(Boolean) as string[];
    const isRead =
      readTimes.length > 0 &&
      otherParticipantIds.every(
        (id: string) =>
          readAtByUser[id] &&
          new Date(m.createdAt).getTime() <=
            new Date(readAtByUser[id]).getTime(),
      );
    if (isRead)
      return (
        <span className="message-checks read" title="Seen">
          ✓✓
        </span>
      );
    if (delivered.has(m.id))
      return (
        <span className="message-checks delivered" title="Delivered">
          ✓✓
        </span>
      );
    return (
      <span className="message-checks sent" title="Sent">
        ✓
      </span>
    );
  }

  const threadMode: "chat" | "group" =
    groupId && conversationId === groupId ? "group" : "chat";

  return (
    <div className="chat-shell">
      <ChatSidebar
        mode={mode}
        onModeChange={setMode}
        people={people}
        selectedUserId={to}
        online={online}
        onSelectUser={selectUser}
        groups={groups}
        selectedGroupId={groupId}
        onSelectGroup={selectGroup}
        onRenameGroup={renameGroup}
        onDeleteGroup={deleteGroup}
        groupName={groupName}
        onGroupNameChange={setGroupName}
        groupUsers={groupUsers}
        onToggleGroupUser={(userId, checked) =>
          setGroupUsers((v) =>
            checked ? [...v, userId] : v.filter((x) => x !== userId),
          )
        }
        onCreateGroup={createGroup}
        mailBox={mailBox}
        onMailBoxChange={setMailBox}
        emails={emails}
        mailDetail={mailDetail}
        onSelectMail={setMailDetail}
      />
      <div className="chat-main">
        {mode === "mail" ? (
          <ChatMailPane
            people={people}
            mailBox={mailBox}
            recipientMode={recipientMode}
            onRecipientModeChange={setRecipientMode}
            mailRecipient={mailRecipient}
            onMailRecipientChange={setMailRecipient}
            subject={subject}
            onSubjectChange={setSubject}
            mailBody={mailBody}
            onMailBodyChange={setMailBody}
            onSendMail={sendMail}
            mailDetail={mailDetail}
          />
        ) : (
          <ChatConversationPane
            mode={threadMode}
            currentUser={currentUser}
            currentGroup={currentGroup}
            online={online}
            currentTyping={currentTyping}
            messages={messages}
            me={me}
            conversationId={conversationId}
            body={body}
            onBodyChange={handleTyping}
            onSend={send}
            messageStatus={messageStatus}
          />
        )}
      </div>
    </div>
  );
}
