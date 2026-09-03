import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Folder,
  Trash2,
  Files as FilesIcon,
  Building2,
  Users as UsersIcon,
  MessageSquare,
  ClipboardCheck,
  Briefcase,
  ScanLine,
  Printer,
  Bot,
  Settings,
  LogOut,
  Search,
  CheckCheck,
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  Menu,
} from "lucide-react";
import { api, API, token } from "../lib/api";
import { connectSocket, disconnectSocket } from "../services/socket";
import { useChatStore } from "../stores/chat.store";
import { queryClient } from "../providers/QueryClientProvider";
import { chatKeys } from "../api/chat.api";

const tenantItems: Array<[string, string, any, string?]> = [
  ["dashboard", "Dashboard", Bell],
  ["users", "User Management", UsersIcon],
  ["files", "Files", FilesIcon],
  ["module/shared", "Shared", Folder],
  ["module/trash", "Trash", Trash2],
  ["module/requests", "Requests", ClipboardCheck],
  ["module/approvals", "Approvals", ClipboardCheck],
  ["module/task-management", "Task Management", Briefcase],
  ["chat", "Chat", MessageSquare],
  ["module/scan-documents", "Scan Documents", ScanLine, "scanner"],
  ["module/fax-documents", "Fax Documents", Printer, "fax"],
  ["module/ai", "AI Chat Bot", Bot],
  ["module/settings", "Settings", Settings],
];

const superItems: Array<[string, string, any, string?]> = [
  ["super-admin", "Companies", Building2],
];

const PLAN_NAMES: Record<string, string> = {
  STARTER: "Basic",
  BUSINESS: "Advanced",
  PROFESSIONAL: "Premium",
  CUSTOM: "Enterprise",
};

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export default function Layout({ children }: { children: any }) {
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const role = localStorage.getItem("sf_role") || "";
  const isSuper = role === "SUPER_ADMIN";

  const [addons, setAddons] = useState<Record<string, boolean>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const notificationIds = useRef<Set<string>>(new Set());

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [chatHighlight, setChatHighlight] = useState(false);

  const [browserPermission, setBrowserPermission] = useState<string>(
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission,
  );

  function logout() {
    disconnectSocket();
    useChatStore.getState().clearChat();
    queryClient.removeQueries({ queryKey: chatKeys.all });
    setMobileNavOpen(false);
    localStorage.clear();
    nav("/login");
  }

  const [toast, setToast] = useState<NotificationItem | null>(null);

  const [systemToast, setSystemToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isSuper) return;
    try {
      const saved = JSON.parse(localStorage.getItem("sf_addons") || "{}");
      if (saved && typeof saved === "object") setAddons(saved);
    } catch { }
    // Existing sessions from older builds may not have login metadata yet.
    // Fetch it once, then cache it locally for the rest of the session.
    if (!localStorage.getItem("sf_addons")) {
      api("/companies/me")
        .then((c: any) => {
          const a = (c.subscription?.addons || {}) as Record<string, boolean>;
          setAddons(a);
          localStorage.setItem("sf_addons", JSON.stringify(a));
          if (c.subscription?.planCode)
            localStorage.setItem("sf_plan", c.subscription.planCode);
        })
        .catch(() => { });
    }
  }, [isSuper]);

  useEffect(() => {
    const accessToken = token();
    if (!isSuper && accessToken) connectSocket(accessToken);
  }, [isSuper]);

  useEffect(() => {
    const onAlert = (event: Event) => {
      try {
        const detail = (event as CustomEvent).detail as {
          type: "success" | "error" | "info";
          message: string;
        };

        if (!detail?.message) return;

        setSystemToast(detail);

        window.setTimeout(
          () =>
            setSystemToast((current) =>
              current?.message === detail.message ? null : current,
            ),
          5000,
        );
      } catch { }
    };

    window.addEventListener("sf:alert", onAlert as EventListener);

    return () =>
      window.removeEventListener("sf:alert", onAlert as EventListener);
  }, []);

  useEffect(() => {
    const onChatEvent = () => setChatHighlight(true);
    const onChatOpen = () => setChatHighlight(false);
    window.addEventListener("sf:chat-event", onChatEvent);
    window.addEventListener("sf:chat-open", onChatOpen);
    return () => {
      window.removeEventListener("sf:chat-event", onChatEvent);
      window.removeEventListener("sf:chat-open", onChatOpen);
    };
  }, []);

  useEffect(() => {
    if (isSuper || !token()) return;

    const pushNotification = (item: NotificationItem) => {
      if (item.readAt) return;
      notificationIds.current.add(item.id);
      if (/message|email|chat/i.test(`${item.title} ${item.body}`))
        setChatHighlight(true);
      try {
        window.dispatchEvent(
          new CustomEvent("sf:notification", { detail: JSON.stringify(item) }),
        );
      } catch { }

      setNotifications((prev) =>
        [item, ...prev.filter((x) => x.id !== item.id)].slice(0, 100),
      );

      setToast(item);

      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(item.title, {
            body: item.body,
            icon: "/favicon.svg",
          });
        } catch { }
      }

      window.setTimeout(
        () => setToast((current) => (current?.id === item.id ? null : current)),
        6000,
      );
    };

    const source = new EventSource(
      `${API}/realtime?token=${encodeURIComponent(token())}`,
    );

    source.onerror = () => {
      // EventSource automatically reconnects. On reconnect the server sends
      // the unread state once; there is no notification polling.
    };

    const onNotification = (event: Event) => {
      try {
        pushNotification(
          JSON.parse((event as MessageEvent).data) as NotificationItem,
        );
      } catch { }
    };

    const onNotificationSync = (event: Event) => {
      try {
        const items = JSON.parse(
          (event as MessageEvent).data,
        ) as NotificationItem[];
        const unread = Array.isArray(items)
          ? items.filter((item) => !item.readAt)
          : [];
        notificationIds.current = new Set(unread.map((item) => item.id));
        setNotifications(unread.slice().reverse().slice(0, 100));
      } catch { }
    };

    source.addEventListener("notification", onNotification);
    source.addEventListener("notification-sync", onNotificationSync);

    const onNotificationRead = (event: Event) => {
      try {
        const id = String(
          (JSON.parse((event as MessageEvent).data) as { id?: string })?.id ||
          "",
        );
        if (!id) return;
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      } catch { }
    };

    const onNotificationsReadAll = () => {
      setNotifications([]);
      setToast(null);
    };

    source.addEventListener("notification-read", onNotificationRead);
    source.addEventListener("notifications-read-all", onNotificationsReadAll);

    return () => {
      source.removeEventListener("notification", onNotification);
      source.removeEventListener("notification-sync", onNotificationSync);
      source.removeEventListener("notification-read", onNotificationRead);
      source.removeEventListener(
        "notifications-read-all",
        onNotificationsReadAll,
      );
      source.close();
    };
  }, [isSuper]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications],
  );

  const items = isSuper
    ? superItems
    : tenantItems.filter(([to, , , _feature]) => {
      if (role === "CLIENT" && to === "users") return false;

      if (role === "EMPLOYEE" && to === "users") return false;

      return !_feature || !!addons[_feature];
    });

  async function enableBrowserAlerts() {
    if (typeof Notification === "undefined") {
      setBrowserPermission("unsupported");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
    } catch {
      setBrowserPermission("denied");
    }
  }

  async function markRead(id: string) {
    try {
      await api(`/workspace/notifications/${id}/read`, {
        method: "PATCH",
      });

      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch { }
  }

  async function markAllRead() {
    try {
      await api("/workspace/notifications/read-all", {
        method: "PATCH",
      });

      setNotifications([]);
      setToast(null);
    } catch { }
  }

  return (
    <div className="app">
      {/* =========================================================
          SIDEBAR
          ========================================================= */}
      <aside
        className={`flex h-screen flex-col overflow-hidden ${mobileNavOpen ? "mobile-open" : ""}`}
      >
        {/* Brand stays fixed at the top */}
        <div className="brand shrink-0">
          Secure<span>File</span>
        </div>

        {/* =======================================================
            SCROLLABLE NAVIGATION ONLY
            Logout is NOT inside this scroll area.
            ======================================================= */}
        <nav
          className="
            overflow-x-hidden
            overflow-y-auto
            h-[75%]
            hide-scrollbar
          "
        >
          {items.map(([to, label, I]) => (
            <NavLink
              key={to}
              to={"/" + to}
              className={({ isActive }) =>
                `${isActive ? "active" : ""} ${to === "chat" && chatHighlight && !isActive ? "chat-nav-highlight" : ""}`.trim()
              }
              onClick={() => {
                setMobileNavOpen(false);
                if (to === "chat") setChatHighlight(false);
              }}
            >
              <I size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* =======================================================
            LOGOUT
            Always stays at the bottom.
            ======================================================= */}
        <button
          className="logout shrink-0"
          onClick={logout}
        >
          <LogOut size={17} />
          Logout
        </button>
      </aside>

      {/* =========================================================
          MAIN CONTENT
          ========================================================= */}
      {mobileNavOpen && (
        <button
          className="mobile-nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <main className="min-w-0">
        <header>
          <button
            className="mobile-menu-button"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={21} />
          </button>
          <div className="search">
            <Search size={16} />

            <input
              placeholder="Search files, folders, users..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && q.trim() && !isSuper) {
                  nav(`/files?q=${encodeURIComponent(q.trim())}`);
                }
              }}
            />
          </div>

          <div className="header-actions">
            {!isSuper && (
              <div className="notification-wrap">
                <button
                  className="notification-button"
                  aria-label="Notifications"
                  onClick={() => setNotificationOpen((v) => !v)}
                >
                  <Bell size={19} />

                  {unreadCount > 0 && (
                    <span className="notification-badge">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                {notificationOpen && (
                  <div className="notification-popover">
                    <div className="notification-head">
                      <div>
                        <strong>Notifications</strong>

                        <small>
                          {unreadCount
                            ? `${unreadCount} unread`
                            : "All caught up"}
                        </small>
                      </div>

                      <div className="notification-head-actions">
                        {browserPermission === "default" && (
                          <button
                            title="Enable browser alerts"
                            onClick={enableBrowserAlerts}
                          >
                            <Bell size={15} />
                          </button>
                        )}

                        {unreadCount > 0 && (
                          <button title="Mark all read" onClick={markAllRead}>
                            <CheckCheck size={15} />
                          </button>
                        )}

                        <button
                          title="Close"
                          onClick={() => setNotificationOpen(false)}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="notification-list">
                      {notifications.map((n) => (
                        <button
                          key={n.id}
                          className="notification-item"
                          onClick={() => {
                            if (!n.readAt) {
                              markRead(n.id);
                            }
                          }}
                        >
                          <span className="notification-dot" />

                          <span>
                            <b>{n.title}</b>

                            <small>{n.body}</small>

                            <time>
                              {new Date(n.createdAt).toLocaleString()}
                            </time>
                          </span>
                        </button>
                      ))}

                      {!notifications.length && (
                        <div className="notification-empty">
                          No unread notifications.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="top-user">
              {localStorage.getItem("sf_email") || "User"}

              {!isSuper && (
                <small
                  style={{
                    display: "block",
                    fontSize: 10,
                    color: "#7b8799",
                    textAlign: "right",
                  }}
                >
                  {PLAN_NAMES[localStorage.getItem("sf_plan") || ""] || ""}
                </small>
              )}
            </div>
          </div>
        </header>

        <section className="content">{children}</section>
      </main>

      {/* =========================================================
          SYSTEM TOAST
          ========================================================= */}
      {systemToast && (
        <div className={`system-toast ${systemToast.type}`} role="status">
          <span className="system-toast-icon">
            {systemToast.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : systemToast.type === "error" ? (
              <AlertCircle size={18} />
            ) : (
              <Info size={18} />
            )}
          </span>

          <span>{systemToast.message}</span>

          <button aria-label="Dismiss" onClick={() => setSystemToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* =========================================================
          NOTIFICATION TOAST
          ========================================================= */}
      {toast && !isSuper && (
        <button
          className="notification-toast"
          onClick={() => {
            setNotificationOpen(true);
            setToast(null);

            if (!toast.readAt) {
              markRead(toast.id);
            }
          }}
        >
          <span>
            <b>{toast.title}</b>
            <small>{toast.body}</small>
          </span>

          <X size={16} />
        </button>
      )}
    </div>
  );
}
