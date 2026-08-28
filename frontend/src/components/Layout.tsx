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
} from "lucide-react";
import { api, API, token } from "../lib/api";

const tenantItems: Array<[string, string, any, string?]> = [
  ["dashboard", "Dashboard", Bell],
  ["files", "Files", FilesIcon],
  ["module/shared", "Shared", Folder],
  ["module/trash", "Trash", Trash2],
  ["module/requests", "Requests", ClipboardCheck],
  ["module/approvals", "Approvals", ClipboardCheck],
  ["module/task-management", "Task Management", Briefcase],
  ["module/chat", "Chat", MessageSquare],
  ["users", "User Management", UsersIcon],
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
  const role = localStorage.getItem("sf_role") || "";
  const isSuper = role === "SUPER_ADMIN";
  const [addons, setAddons] = useState<Record<string, boolean>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const notificationIds = useRef<Set<string>>(new Set());
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<string>(
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission,
  );
  const [toast, setToast] = useState<NotificationItem | null>(null);
  const [systemToast, setSystemToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!isSuper)
      api("/companies/me")
        .then((c: any) => {
          setAddons((c.subscription?.addons || {}) as Record<string, boolean>);
          if (c.subscription?.planCode)
            localStorage.setItem("sf_plan", c.subscription.planCode);
        })
        .catch(() => {});
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
      } catch {}
    };
    window.addEventListener("sf:alert", onAlert as EventListener);
    return () =>
      window.removeEventListener("sf:alert", onAlert as EventListener);
  }, []);

  // useEffect(() => {
  //   if (isSuper || !token()) return;
  //   let alive = true;
  //   api("/workspace/notifications")
  //     .then((rows: any) => {
  //       if (alive) {
  //         const initial = Array.isArray(rows)
  //           ? (rows as NotificationItem[])
  //           : [];
  //         notificationIds.current = new Set(initial.map((n) => n.id));
  //         setNotifications(initial);
  //       }
  //     })
  //     .catch(() => {});
  //   const pushNotification = (item: NotificationItem) => {
  //     notificationIds.current.add(item.id);
  //     setNotifications((prev) =>
  //       [item, ...prev.filter((x) => x.id !== item.id)].slice(0, 100),
  //     );
  //     setToast(item);
  //     if (
  //       typeof Notification !== "undefined" &&
  //       Notification.permission === "granted"
  //     ) {
  //       try {
  //         new Notification(item.title, {
  //           body: item.body,
  //           icon: "/favicon.svg",
  //         });
  //       } catch {}
  //     }
  //     window.setTimeout(
  //       () => setToast((current) => (current?.id === item.id ? null : current)),
  //       6000,
  //     );
  //   };
  //   const source = new EventSource(
  //     `${API}/realtime?token=${encodeURIComponent(token())}`,
  //   );
  //   const onNotification = (event: Event) => {
  //     try {
  //       pushNotification(
  //         JSON.parse((event as MessageEvent).data) as NotificationItem,
  //       );
  //     } catch {}
  //   };
  //   source.addEventListener("notification", onNotification);
  //   const poll = window.setInterval(async () => {
  //     try {
  //       const rows = await api("/workspace/notifications");
  //       const latest = (Array.isArray(rows) ? rows : []) as NotificationItem[];
  //       for (const item of latest.slice(0, 20).reverse())
  //         if (!notificationIds.current.has(item.id)) pushNotification(item);
  //       setNotifications((prev) => {
  //         const map = new Map<string, NotificationItem>();
  //         for (const n of [...latest, ...prev])
  //           if (!map.has(n.id)) map.set(n.id, n);
  //         return [...map.values()].slice(0, 100);
  //       });
  //     } catch {}
  //   }, 10000);
  //   return () => {
  //     alive = false;
  //     source.removeEventListener("notification", onNotification);
  //     source.close();
  //     window.clearInterval(poll);
  //   };
  // }, [isSuper]);

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
      await api(`/workspace/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      );
    } catch {}
  }
  async function markAllRead() {
    try {
      await api("/workspace/notifications/read-all", { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          readAt: n.readAt || new Date().toISOString(),
        })),
      );
    } catch {}
  }
  return (
    <div className="app">
      <aside>
        <div className="brand">
          Secure<span>File</span>
        </div>
        <nav>
          {items.map(([to, label, I]) => (
            <NavLink
              key={to}
              to={"/" + to}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <I size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          className="logout"
          onClick={() => {
            localStorage.clear();
            nav("/login");
          }}
        >
          <LogOut size={17} />
          Logout
        </button>
      </aside>
      <main>
        <header>
          <div className="search">
            <Search size={16} />
            <input
              placeholder="Search files, folders, users..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && q.trim() && !isSuper)
                  nav(`/files?q=${encodeURIComponent(q.trim())}`);
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
                          className={`notification-item ${n.readAt ? "read" : ""}`}
                          onClick={() => {
                            if (!n.readAt) markRead(n.id);
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
                          No notifications yet.
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
      {toast && !isSuper && (
        <button
          className="notification-toast"
          onClick={() => {
            setNotificationOpen(true);
            setToast(null);
            if (!toast.readAt) markRead(toast.id);
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
