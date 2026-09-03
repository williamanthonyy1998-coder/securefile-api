import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api as restApi } from "../../lib/api";
import axios from "../../lib/axios";
import {
  type Conversation,
  type Message,
  useConversation,
  useConversationMessages,
  useConversations,
  useCreateDirectConversation,
  useCreateGroupConversation,
  useLeaveConversation,
  useMarkConversationAsRead,
  useSendMessage,
  useUnreadConversations,
  useUpdateConversation,
} from "../../api/chat.api";
import ChatSidebar from "./ChatSidebar";
import ChatConversationPane from "./ChatConversationPane";
import ChatMailPane from "./ChatMailPane";
import { useChatRealtime } from "./useChatRealtime";
import {
  chatErrorMessage,
  chronologicalMessages,
  conversationTitle,
  otherParticipant,
} from "./chat.utils";

type ChatMode = "chat" | "group" | "mail";

function notifyChatOpen() {
  try {
    window.dispatchEvent(new CustomEvent("sf:chat-open"));
  } catch {}
}

export default function ChatWorkspace() {
  const { conversationId = "" } = useParams();
  const nav = useNavigate();
  const me = localStorage.getItem("sf_user_id") || "";
  const [mode, setMode] = useState<ChatMode>("chat");
  const [body, setBody] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupUsers, setGroupUsers] = useState<string[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [mailBox, setMailBox] = useState<"inbox" | "sent">("inbox");
  const [subject, setSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [mailRecipient, setMailRecipient] = useState("");
  const [recipientMode, setRecipientMode] = useState<"USER" | "EMAIL">("USER");
  const [mailDetail, setMailDetail] = useState<any>(null);
  const [sending, setSending] = useState(false);

  const conversationsQuery = useConversations({ limit: 100 });
  const unreadQuery = useUnreadConversations();
  const conversationQuery = useConversation(conversationId || undefined);
  const messagesQuery = useConversationMessages(conversationId || undefined, {
    limit: 100,
  });
  const createDirect = useCreateDirectConversation();
  const createGroup = useCreateGroupConversation();
  const updateConversation = useUpdateConversation();
  const leaveConversation = useLeaveConversation();
  const sendMessage = useSendMessage();
  const markRead = useMarkConversationAsRead();
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await axios.get("/users/chat");
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  const {
    online,
    typingUsers,
    delivered,
    readAtByUser,
    setReadAtByUser,
    emitTyping,
    emitStopTyping,
    sendViaSocket,
  } = useChatRealtime(conversationId);

  const conversations = conversationsQuery.data?.conversations ?? [];
  const users = usersQuery.data ?? [];
  const people = users.filter((u: any) => u.id !== me && u.status === "ACTIVE");
  const unreadByConversation = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of unreadQuery.data?.conversations ?? []) {
      map[row.conversationId] = row.unreadCount;
    }
    return map;
  }, [unreadQuery.data]);

  const activeConversation: Conversation | undefined =
    conversationQuery.data?.conversation ||
    conversations.find((item) => item.id === conversationId);

  const directConversations = conversations.filter((item) => item.type === "DIRECT");
  const groupConversations = conversations.filter((item) => item.type === "GROUP");
  const messages = chronologicalMessages(messagesQuery.data?.messages);

  useEffect(() => {
    notifyChatOpen();
  }, []);

  useEffect(() => {
    if (!conversationId || !activeConversation) return;
    setMode((current) =>
      current === "mail"
        ? current
        : activeConversation.type === "GROUP"
          ? "group"
          : "chat",
    );
  }, [conversationId, activeConversation?.type]);

  useEffect(() => {
    const reads: Record<string, string> = {};
    for (const participant of activeConversation?.participants || []) {
      if (participant.lastReadAt) reads[participant.userId] = participant.lastReadAt;
    }
    setReadAtByUser(reads);
  }, [activeConversation, setReadAtByUser]);

  useEffect(() => {
    if (conversationId) markRead.mutate(conversationId);
  }, [conversationId]);

  useEffect(() => {
    if (mode === "mail") loadEmails();
  }, [mode, mailBox]);

  async function loadEmails() {
    try {
      setEmails(await restApi("/workspace/emails?box=" + mailBox));
    } catch {}
  }

  function openConversation(id: string, nextMode?: ChatMode) {
    notifyChatOpen();
    if (nextMode) setMode(nextMode);
    nav(id ? `/chat/${id}` : "/chat");
  }

  async function selectUser(userId: string) {
    const existing = directConversations.find((conversation) =>
      conversation.participants.some((p) => p.userId === userId),
    );
    if (existing) {
      openConversation(existing.id, "chat");
      return;
    }
    try {
      const result = await createDirect.mutateAsync({ userId });
      openConversation(result.conversation.id, "chat");
    } catch (error) {
      alert(chatErrorMessage(error, "Unable to start chat"));
    }
  }

  function selectConversation(conversation: Conversation) {
    openConversation(
      conversation.id,
      conversation.type === "GROUP" ? "group" : "chat",
    );
  }

  function handleTyping(value: string) {
    setBody(value);
    if (conversationId) emitTyping(conversationId);
  }

  async function send() {
    const text = body.trim();
    if (!text || !conversationId || sending) return;
    setSending(true);
    try {
      const viaSocket = sendViaSocket(conversationId, text);
      if (viaSocket) await viaSocket;
      else await sendMessage.mutateAsync({ conversationId, body: text });
      setBody("");
      emitStopTyping(conversationId);
    } catch (error) {
      alert(chatErrorMessage(error, "Unable to send message"));
    } finally {
      setSending(false);
    }
  }

  async function createGroupChat() {
    if (!groupName.trim() || !groupUsers.length) return;
    try {
      const result = await createGroup.mutateAsync({
        name: groupName.trim(),
        participantIds: groupUsers,
      });
      setGroupName("");
      setGroupUsers([]);
      openConversation(result.conversation.id, "group");
    } catch (error) {
      alert(chatErrorMessage(error, "Unable to create group"));
    }
  }

  async function renameGroup(conversation: Conversation) {
    const name = window.prompt("New group name", conversation.name || "");
    if (!name?.trim()) return;
    try {
      await updateConversation.mutateAsync({
        conversationId: conversation.id,
        payload: { name: name.trim() },
      });
    } catch (error) {
      alert(chatErrorMessage(error, "Unable to rename group"));
    }
  }

  async function leaveGroup(conversation: Conversation) {
    if (!confirm(`Leave group "${conversation.name || "Group"}"?`)) return;
    try {
      await leaveConversation.mutateAsync(conversation.id);
      if (conversationId === conversation.id) nav("/chat");
    } catch (error) {
      alert(chatErrorMessage(error, "Unable to leave group"));
    }
  }

  async function sendMail() {
    const emailMode = recipientMode === "EMAIL";
    const valid = emailMode
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailRecipient.trim())
      : !!mailRecipient;
    if (!valid || !subject.trim() || !mailBody.trim()) return;
    try {
      await restApi("/workspace/email", {
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

  const currentUser = otherParticipant(activeConversation, me);
  const currentTyping = [...typingUsers.entries()]
    .filter(([id]) => id !== me)
    .map(([, name]) => name)
    .filter(Boolean);
  const otherParticipantIds = (activeConversation?.participants || [])
    .map((p) => p.userId)
    .filter((id) => id !== me);

  function messageStatus(message: Message) {
    if (message.senderId !== me) return null;
    const isRead =
      otherParticipantIds.length > 0 &&
      otherParticipantIds.every(
        (id) =>
          readAtByUser[id] &&
          new Date(message.createdAt).getTime() <=
            new Date(readAtByUser[id]).getTime(),
      );
    if (isRead)
      return (
        <span className="message-checks read" title="Seen">
          ✓✓
        </span>
      );
    if (delivered.has(message.id))
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
    activeConversation?.type === "GROUP" ? "group" : "chat";

  return (
    <div className="chat-shell">
      <ChatSidebar
        mode={mode}
        onModeChange={setMode}
        people={people}
        directConversations={directConversations}
        groupConversations={groupConversations}
        selectedConversationId={conversationId}
        unreadByConversation={unreadByConversation}
        me={me}
        online={online}
        onSelectConversation={selectConversation}
        onStartDirect={selectUser}
        onRenameGroup={renameGroup}
        onLeaveGroup={leaveGroup}
        groupName={groupName}
        onGroupNameChange={setGroupName}
        groupUsers={groupUsers}
        onToggleGroupUser={(userId, checked) =>
          setGroupUsers((v) =>
            checked ? [...v, userId] : v.filter((x) => x !== userId),
          )
        }
        onCreateGroup={createGroupChat}
        creatingGroup={createGroup.isPending}
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
            title={conversationTitle(activeConversation, me)}
            memberCount={activeConversation?.participants.length || 0}
            currentUser={currentUser}
            online={online}
            currentTyping={currentTyping}
            messages={messages}
            loading={messagesQuery.isLoading}
            me={me}
            conversationId={conversationId}
            body={body}
            sending={sending}
            onBodyChange={handleTyping}
            onSend={send}
            messageStatus={messageStatus}
          />
        )}
      </div>
    </div>
  );
}
