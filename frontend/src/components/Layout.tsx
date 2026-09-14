import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
  Menu,
  LayoutDashboard,
} from "lucide-react";
import { api, token } from "@/lib/api";
import { cn } from "@/lib/utils";
import PageSkeleton from "@/components/PageSkeleton";
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
  const location = useLocation();

  const [q, setQ] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const role = localStorage.getItem("sf_role") || "";
  const isSuper = role === "SUPER_ADMIN";

  const [addons, setAddons] = useState<Record<string, boolean>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const notificationIds = useRef<Set<string>>(new Set());

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationToast, setNotificationToast] = useState<NotificationItem | null>(null);
  const [chatHighlight, setChatHighlight] = useState(false);
  const [pageSkeleton, setPageSkeleton] = useState(true);

  useEffect(() => {
    setPageSkeleton(true);
    const timer = window.setTimeout(() => setPageSkeleton(false), 420);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  const skeletonVariant = useMemo(() => {
    const path = location.pathname;
    if (path === "/dashboard") return "dashboard" as const;
    if (path.startsWith("/files")) return "files" as const;
    if (path === "/users") return "users" as const;
    if (path === "/settings") return "settings" as const;
    if (path.startsWith("/chat")) return "chat" as const;
    if (path === "/scan-documents") return "scanner" as const;
    if (path === "/fax-documents") return "fax" as const;
    if (path === "/ai") return "ai" as const;
    if (path === "/super-admin") return "super" as const;
    return "table" as const;
  }, [location.pathname]);

  function logout() {
    disconnectSocket();
    useChatStore.getState().clearChat();
    queryClient.removeQueries({ queryKey: chatKeys.all });
    setMobileNavOpen(false);
    localStorage.clear();
    nav("/login");
  }


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

    const socket = connectSocket(token());

    const pushNotification = (item: NotificationItem) => {
      if (!item?.id || item.readAt) return;
      if (notificationIds.current.has(item.id)) return;
      notificationIds.current.add(item.id);

      if (/message|email|chat/i.test(`${item.title} ${item.body}`)) {
        setChatHighlight(true);
      }

      try {
        window.dispatchEvent(
          new CustomEvent("sf:notification", { detail: JSON.stringify(item) }),
        );
      } catch {}

      setNotifications((prev) =>
        [item, ...prev.filter((x) => x.id !== item.id)].slice(0, 100),
      );
      setNotificationToast(item);
      window.setTimeout(() => {
        setNotificationToast((current) => current?.id === item.id ? null : current);
      }, 5000);

    };

    const onNew = (item: NotificationItem) => pushNotification(item);
    const onSync = (items: NotificationItem[]) => {
      const unread = Array.isArray(items) ? items.filter((item) => !item.readAt) : [];
      notificationIds.current = new Set(unread.map((item) => item.id));
      setNotifications(unread.slice(0, 100));
    };
    const onRead = (payload: { id?: string }) => {
      const id = String(payload?.id || "");
      if (!id) return;
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      notificationIds.current.delete(id);
    };
    const onReadAll = () => {
      setNotifications([]);
      notificationIds.current.clear();
      setNotificationToast(null);
    };

    socket.on("notification:new", onNew);
    socket.on("notification:sync", onSync);
    socket.on("notification:read", onRead);
    socket.on("notifications:read-all", onReadAll);

    return () => {
      socket.off("notification:new", onNew);
      socket.off("notification:sync", onSync);
      socket.off("notification:read", onRead);
      socket.off("notifications:read-all", onReadAll);
    };
  }, [isSuper]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications],
  );

  useEffect(() => {
    if (isSuper || !token()) return;
    api("/users/me", { headers: { "X-SF-Force-Refresh": "true" } })
      .then((me: any) => {
        if (!me) return;
        if (me.email) localStorage.setItem("sf_email", me.email);
        if (me.uniqueName) localStorage.setItem("sf_name", me.uniqueName);
        if (me.role) localStorage.setItem("sf_role", me.role);
        localStorage.setItem("sf_sidebar_items", JSON.stringify(me.sidebarItems || ["files"]));
      })
      .catch(() => {});
  }, [isSuper]);

  let configuredSidebar: string[] = [];
  try {
    configuredSidebar = JSON.parse(localStorage.getItem("sf_sidebar_items") || "[]");
  } catch {}
  if (!configuredSidebar.length && (role === "EMPLOYEE" || role === "CLIENT")) configuredSidebar = ["files"];

  const items = isSuper
    ? superItems
    : role === "EMPLOYEE" || role === "CLIENT"
      ? tenantItems.filter(([to, , , feature]) => configuredSidebar.includes(to) && to !== "users" && (!feature || !!addons[feature]))
      : tenantItems.filter(([to, , , feature]) => {
          if (role === "CLIENT" && to === "users") return false;
          if (role === "EMPLOYEE" && to === "users") return false;
          return !feature || !!addons[feature];
        });

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
    } catch {}
  }

  const email = localStorage.getItem("sf_email") || "";
  const displayName = localStorage.getItem("sf_name") || email || "User";
  const planLabel = PLAN_NAMES[localStorage.getItem("sf_plan") || ""] || "";
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";

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
                  <div className="sf-notification-popover absolute right-0 top-12 z-50 overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="sf-notification-head flex items-center justify-between border-b border-border px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">Notifications</p>
                        <p className="text-[11px] text-muted-foreground">
                          {unreadCount
                            ? `${unreadCount} unread`
                            : "All caught up"}
                        </p>
                      </div>
                      <div className="flex gap-1">
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
                    <ScrollArea className="sf-notification-list h-[360px]">
                      {notifications.map((n) => (
                        <button
                          key={n.id}
                          className="sf-notification-item grid w-full grid-cols-[8px_1fr] gap-2.5 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted"
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
                  {displayName}
                </span>
                <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {isSuper ? "Super Admin" : role === "COMPANY_ADMIN" ? "Company Admin" : role === "EMPLOYEE" ? "Employee" : role === "CLIENT" ? "Client" : "User"}
                </span>
                {!isSuper && role === "COMPANY_ADMIN" && planLabel ? (
                  <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {planLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <section className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-6 sm:px-6 sm:py-7">
          {pageSkeleton ? <PageSkeleton variant={skeletonVariant} /> : children}
        </section>
      </div>

      {notificationToast && !isSuper && (
        <button
          type="button"
          className="sf-notification-toast fixed bottom-5 right-5 z-[70] flex max-w-[360px] items-start gap-3 rounded-2xl border border-border bg-card p-3.5 text-left shadow-xl"
          onClick={() => {
            setNotificationOpen(true);
            setNotificationToast(null);
            if (!notificationToast.readAt) markRead(notificationToast.id);
          }}
        >
          <span className="sf-notification-toast-dot mt-1.5 shrink-0" />
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm text-foreground">{notificationToast.title}</b>
            <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-muted-foreground">{notificationToast.body}</span>
          </span>
          <X size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
