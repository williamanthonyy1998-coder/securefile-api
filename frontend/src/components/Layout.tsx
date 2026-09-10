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
  LayoutDashboard,
} from "lucide-react";
import { api, API, token } from "@/lib/api";
import { cn } from "@/lib/utils";
import { connectSocket, disconnectSocket } from "@/services/socket";
import { useChatStore } from "@/stores/chat.store";
import { queryClient } from "@/providers/QueryClientProvider";
import { chatKeys } from "@/api/chat.api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const tenantItems: Array<[string, string, any, string?]> = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["users", "User Management", UsersIcon],
  ["files", "Files", FilesIcon],
  ["shared", "Shared", Folder],
  ["trash", "Trash", Trash2],
  ["requests", "Requests", ClipboardCheck],
  ["approvals", "Approvals", ClipboardCheck],
  ["task-management", "Task Management", Briefcase],
  ["chat", "Chat", MessageSquare],
  ["scan-documents", "Scan Documents", ScanLine, "scanner"],
  ["fax-documents", "Fax Documents", Printer, "fax"],
  ["ai", "AI Chat Bot", Bot],
  ["settings", "Settings", Settings],
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

function SidebarNav({
  items,
  chatHighlight,
  onNavigate,
  onChatOpen,
}: {
  items: Array<[string, string, any, string?]>;
  chatHighlight: boolean;
  onNavigate?: () => void;
  onChatOpen?: () => void;
}) {
  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map(([to, label, Icon]) => (
        <NavLink
          key={to}
          to={"/" + to}
          onClick={() => {
            onNavigate?.();
            if (to === "chat") onChatOpen?.();
          }}
          className={({ isActive }) =>
            cn(
              "relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              to === "chat" &&
                chatHighlight &&
                !isActive &&
                "after:ml-auto after:size-1.5 after:rounded-full after:bg-primary after:shadow-[0_0_0_3px_rgba(247,127,0,0.16)] after:content-['']",
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                size={17}
                className={cn(
                  "shrink-0 opacity-90",
                  isActive && "text-primary-foreground opacity-100",
                )}
              />
              <span className="truncate">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

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
    } catch {}
    if (!localStorage.getItem("sf_addons")) {
      api("/companies/me")
        .then((c: any) => {
          const a = (c.subscription?.addons || {}) as Record<string, boolean>;
          setAddons(a);
          localStorage.setItem("sf_addons", JSON.stringify(a));
          if (c.subscription?.planCode)
            localStorage.setItem("sf_plan", c.subscription.planCode);
        })
        .catch(() => {});
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
      } catch {}
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
      } catch {}

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
        } catch {}
      }

      window.setTimeout(
        () => setToast((current) => (current?.id === item.id ? null : current)),
        6000,
      );
    };

    const source = new EventSource(
      `${API}/realtime?token=${encodeURIComponent(token())}`,
    );

    source.onerror = () => {};

    const onNotification = (event: Event) => {
      try {
        pushNotification(
          JSON.parse((event as MessageEvent).data) as NotificationItem,
        );
      } catch {}
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
      } catch {}
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
      } catch {}
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
    } catch {}
  }

  async function markAllRead() {
    try {
      await api("/workspace/notifications/read-all", {
        method: "PATCH",
      });

      setNotifications([]);
      setToast(null);
    } catch {}
  }

  const email = localStorage.getItem("sf_email") || "User";
  const planLabel = PLAN_NAMES[localStorage.getItem("sf_plan") || ""] || "";
  const initial = email.trim().charAt(0).toUpperCase() || "U";

  const sidebarBody = (
    <>
      <div className="shrink-0 px-4 pb-5 pt-2 text-[22px] font-extrabold tracking-tight text-white">
        Secure<span className="text-sidebar-primary">File</span>
      </div>

      <SidebarNav
        items={items}
        chatHighlight={chatHighlight}
        onNavigate={() => setMobileNavOpen(false)}
        onChatOpen={() => setChatHighlight(false)}
      />

      <div className="mt-auto border-t border-sidebar-border px-2 pt-3">
        <Button
          variant="ghost"
          className="h-auto w-full justify-start gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={logout}
        >
          <LogOut size={17} />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        {sidebarBody}
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="w-[270px] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:text-white"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <div className="flex h-full flex-col py-4">{sidebarBody}</div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col md:pl-[260px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/90 px-3 backdrop-blur-md sm:px-6">
          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={18} />
          </Button>

          <div className="relative flex min-w-0 flex-1 items-center">
            <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <Input
              className="h-10 max-w-md border-transparent bg-muted pl-9 shadow-none focus-visible:border-primary/40 focus-visible:bg-card"
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

          <div className="flex items-center gap-2 sm:gap-3">
            {!isSuper && (
              <div className="relative">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Notifications"
                  onClick={() => setNotificationOpen((v) => !v)}
                >
                  <Bell size={18} />
                </Button>
                {unreadCount > 0 && (
                  <Badge className="absolute -right-1.5 -top-1.5 h-[18px] min-w-[18px] justify-center rounded-full border-2 border-card bg-primary px-1 text-[10px] text-primary-foreground hover:bg-primary">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                )}

                {notificationOpen && (
                  <div className="absolute right-0 top-12 z-50 w-[min(390px,calc(100vw-30px))] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">Notifications</p>
                        <p className="text-[11px] text-muted-foreground">
                          {unreadCount
                            ? `${unreadCount} unread`
                            : "All caught up"}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {browserPermission === "default" && (
                          <Button
                            variant="outline"
                            size="icon-sm"
                            title="Enable browser alerts"
                            onClick={enableBrowserAlerts}
                          >
                            <Bell size={15} />
                          </Button>
                        )}
                        {unreadCount > 0 && (
                          <Button
                            variant="outline"
                            size="icon-sm"
                            title="Mark all read"
                            onClick={markAllRead}
                          >
                            <CheckCheck size={15} />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="icon-sm"
                          title="Close"
                          onClick={() => setNotificationOpen(false)}
                        >
                          <X size={15} />
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="h-[420px]">
                      {notifications.map((n) => (
                        <button
                          key={n.id}
                          className="grid w-full grid-cols-[8px_1fr] gap-2.5 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted"
                          onClick={() => {
                            if (!n.readAt) markRead(n.id);
                          }}
                        >
                          <span className="mt-1.5 size-2 rounded-full bg-primary" />
                          <span>
                            <b className="block text-sm text-foreground">
                              {n.title}
                            </b>
                            <small className="mt-0.5 block text-xs text-muted-foreground">
                              {n.body}
                            </small>
                            <time className="mt-1 block text-[10px] text-muted-foreground">
                              {new Date(n.createdAt).toLocaleString()}
                            </time>
                          </span>
                        </button>
                      ))}
                      {!notifications.length && (
                        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                          No unread notifications.
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}

            <Separator orientation="vertical" className="hidden h-8 sm:block" />

            <div className="flex items-center gap-2.5">
              <Avatar className="size-9 rounded-lg">
                <AvatarFallback className="rounded-lg bg-foreground text-xs font-bold text-background">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div className="hidden min-w-0 flex-col items-end leading-tight sm:flex">
                <span className="max-w-[180px] truncate text-[13px] font-semibold">
                  {email}
                </span>
                {!isSuper && planLabel ? (
                  <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {planLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <section className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-6 sm:px-6 sm:py-7">
          {children}
        </section>
      </div>

      {systemToast && (
        <div
          className={cn(
            "fixed bottom-5 right-5 z-[70] flex max-w-sm items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg",
            systemToast.type === "success" && "border-l-4 border-l-primary",
            systemToast.type === "error" && "border-l-4 border-l-destructive",
            systemToast.type === "info" && "border-l-4 border-l-primary",
          )}
          role="status"
        >
          <span
            className={cn(
              "mt-0.5",
              systemToast.type === "error"
                ? "text-destructive"
                : "text-primary",
            )}
          >
            {systemToast.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : systemToast.type === "error" ? (
              <AlertCircle size={18} />
            ) : (
              <Info size={18} />
            )}
          </span>
          <span className="flex-1 text-sm">{systemToast.message}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss"
            onClick={() => setSystemToast(null)}
          >
            <X size={16} />
          </Button>
        </div>
      )}

      {toast && !isSuper && (
        <button
          className="fixed bottom-5 right-5 z-[60] flex max-w-sm items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-lg"
          onClick={() => {
            setNotificationOpen(true);
            setToast(null);
            if (!toast.readAt) markRead(toast.id);
          }}
        >
          <span className="min-w-0 flex-1">
            <b className="block text-sm">{toast.title}</b>
            <small className="mt-0.5 block text-xs text-muted-foreground">
              {toast.body}
            </small>
          </span>
          <X size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
