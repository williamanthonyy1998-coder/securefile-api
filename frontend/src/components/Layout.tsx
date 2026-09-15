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
  ClipboardList,
  CheckCircle2,
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
  ChevronLeft,
  ChevronRight,
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
  ["requests", "Requests", ClipboardList],
  ["approvals", "Approvals", CheckCircle2],
  ["task-management", "Task Management", Briefcase],
  ["scan-documents", "Scan Documents", ScanLine, "scanner"],
  ["chat", "Chat", MessageSquare],
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

function sidebarSection(to: string) {
  if (to === "users") return "Administration";
  if (["dashboard", "files", "shared", "trash", "requests", "approvals", "task-management", "scan-documents"].includes(to)) return "Workspace";
  if (["chat", "fax-documents", "ai"].includes(to)) return "Collaboration";
  if (to === "settings") return "Account";
  return "Administration";
}

function SidebarNav({
  items,
  chatHighlight,
  onNavigate,
  onChatOpen,
  collapsed = false,
}: {
  items: Array<[string, string, any, string?]>;
  chatHighlight: boolean;
  onNavigate?: () => void;
  onChatOpen?: () => void;
  collapsed?: boolean;
}) {
  let lastSection = "";
  return (
    <nav
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        collapsed ? "px-2" : "px-2.5",
      )}
    >
      {items.map(([to, label, Icon]) => {
        const section = sidebarSection(to);
        const isDashboard = to === "dashboard";
        const showSection = !collapsed && !isDashboard && section !== lastSection;
        if (!isDashboard) lastSection = section;
        return (
          <div key={to} className="contents">
            {showSection && (
              <div className="sidebar-section-label" aria-hidden="true">
                {section}
              </div>
            )}
            <NavLink
              to={"/" + to}
              title={collapsed ? label : undefined}
              onClick={() => {
                onNavigate?.();
                if (to === "chat") onChatOpen?.();
              }}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center rounded-lg py-2.5 text-[13.5px] font-medium transition-all duration-200",
                  collapsed ? "mx-1 justify-center px-0" : "gap-2.5 px-3",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-[0_8px_22px_rgba(247,127,0,0.16)]"
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
                  {!collapsed && <span className="truncate">{label}</span>}
                </>
              )}
            </NavLink>
          </div>
        );
      })}
    </nav>
  );
}

export default function Layout({ children }: { children: any }) {
  const nav = useNavigate();
  const location = useLocation();

  const [q, setQ] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("sf_sidebar_collapsed") === "true",
  );
  const role = localStorage.getItem("sf_role") || "";
  const isSuper = role === "SUPER_ADMIN";
  const [displayName, setDisplayName] = useState(localStorage.getItem("sf_display_name") || localStorage.getItem("sf_name") || localStorage.getItem("sf_email")?.split("@")[0] || "User");
  const [avatarUrl, setAvatarUrl] = useState(localStorage.getItem("sf_avatar_url") || "");
  const roleLabel = role === "COMPANY_ADMIN" ? "Company Admin" : role === "SUPER_ADMIN" ? "Super Admin" : role === "CLIENT" ? "Client" : "Employee";

  const [addons, setAddons] = useState<Record<string, boolean>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const notificationIds = useRef<Set<string>>(new Set());

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationToast, setNotificationToast] = useState<NotificationItem | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const [chatHighlight, setChatHighlight] = useState(false);
  const [pageSkeleton, setPageSkeleton] = useState(true);

  useEffect(() => {
    setPageSkeleton(true);
    const timer = window.setTimeout(() => setPageSkeleton(false), 420);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  useEffect(() => {
    if (!notificationOpen) return;

    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && notificationRef.current?.contains(target)) return;
      setNotificationOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationOpen(false);
    };

    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [notificationOpen]);

  const skeletonVariant = useMemo(() => {
    const path = location.pathname;
    if (path === "/dashboard") return "dashboard" as const;
    if (path === "/files") return "files" as const;
    if (path.startsWith("/files/") && path.endsWith("/view")) return "file-view" as const;
    if (path === "/users") return "users" as const;
    if (path === "/settings") return "settings" as const;
    if (path.startsWith("/chat")) return "chat" as const;
    if (path === "/shared") return "shared" as const;
    if (path === "/requests") return "requests" as const;
    if (path === "/approvals") return "approvals" as const;
    if (path === "/task-management") return "tasks" as const;
    if (path === "/trash") return "trash" as const;
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
    const onSessionExpired = () => logout();
    window.addEventListener("sf:session-expired", onSessionExpired);
    return () => window.removeEventListener("sf:session-expired", onSessionExpired);
  }, []);

  // Revalidate the live account so a suspended/deleted user is signed out
  // without having to navigate or make another API request.
  useEffect(() => {
    if (isSuper || !token()) return;
    let checking = false;
    const check = async () => {
      if (checking || !token()) return;
      checking = true;
      try {
        await api("/users/me", { headers: { "X-SF-Force-Refresh": "true", "X-SF-Session-Check": "true" } });
      } catch {
        // api() dispatches sf:session-expired on 401.
      } finally {
        checking = false;
      }
    };
    const interval = window.setInterval(check, 30000);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [isSuper]);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem("sf_sidebar_collapsed", String(next));
      return next;
    });
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
        if (me.uniqueName) { localStorage.setItem("sf_name", me.uniqueName); localStorage.setItem("sf_display_name", me.uniqueName); setDisplayName(me.uniqueName); }
        if (me.avatarUrl !== undefined) { localStorage.setItem("sf_avatar_url", me.avatarUrl || ""); setAvatarUrl(me.avatarUrl || ""); }
        if (me.role) localStorage.setItem("sf_role", me.role);
        localStorage.setItem("sf_sidebar_items", JSON.stringify(me.sidebarItems || ["files"]));
      })
      .catch(() => {});
  }, [isSuper]);

  useEffect(() => {
    const onProfile = (event: Event) => {
      const detail = (event as CustomEvent).detail as any;
      if (detail?.uniqueName) { setDisplayName(detail.uniqueName); localStorage.setItem("sf_display_name", detail.uniqueName); }
      if (detail && "avatarUrl" in detail) { setAvatarUrl(detail.avatarUrl || ""); localStorage.setItem("sf_avatar_url", detail.avatarUrl || ""); }
    };
    window.addEventListener("sf:profile-updated", onProfile);
    return () => window.removeEventListener("sf:profile-updated", onProfile);
  }, []);

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
  const planLabel = PLAN_NAMES[localStorage.getItem("sf_plan") || ""] || "";
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";

  const sidebarBody = (
    <>
      <div className={cn(
        "sidebar-brand-row shrink-0 border-b border-sidebar-border",
        sidebarCollapsed ? "is-collapsed" : "",
      )}>
        <div className={cn(
          "sidebar-brand-mark font-extrabold tracking-tight text-white transition-all duration-300",
          sidebarCollapsed ? "text-[17px]" : "text-[22px]",
        )}>
          {sidebarCollapsed ? (
            <img
              src="/securefile-favicon.png"
              alt="SecureFile"
              className="sidebar-brand-icon"
            />
          ) : (
            <img
              src="/securefile-logo.png"
              alt="SecureFile"
              className="sidebar-brand-logo"
            />
          )}
        </div>
        <button
          type="button"
          className="sidebar-toggle-button"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      <SidebarNav
        items={items}
        chatHighlight={chatHighlight}
        onNavigate={() => setMobileNavOpen(false)}
        onChatOpen={() => setChatHighlight(false)}
        collapsed={sidebarCollapsed}
      />

      <div className={cn("mt-auto border-t border-sidebar-border px-2 pt-3", sidebarCollapsed ? "pb-2" : "pb-3")}>
        <Button
          variant="ghost"
          className={cn(
            "h-auto w-full rounded-lg py-2.5 text-[13.5px] font-medium text-sidebar-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            sidebarCollapsed ? "justify-center px-0" : "justify-start gap-2.5 px-3",
          )}
          title={sidebarCollapsed ? "Logout" : undefined}
          onClick={logout}
        >
          <LogOut size={17} />
          {!sidebarCollapsed && "Logout"}
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-svh min-h-0 overflow-hidden bg-background">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out md:flex",
        sidebarCollapsed ? "w-[78px]" : "w-[260px]",
      )}>
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

      <div className={cn(
        "flex min-w-0 min-h-0 flex-1 flex-col transition-[padding] duration-300 ease-out",
        sidebarCollapsed ? "md:pl-[78px]" : "md:pl-[260px]",
      )}>
        <header className="z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card/95 px-3 backdrop-blur-md sm:px-6">
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
              <div ref={notificationRef} className="relative">
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
              <Avatar className="size-9 rounded-full">
                {avatarUrl ? <img src={avatarUrl} alt="" className="size-full rounded-full object-cover" /> : <AvatarFallback className="rounded-full bg-foreground text-xs font-bold text-background">{initial}</AvatarFallback>}
              </Avatar>
              <div className="hidden min-w-0 flex-col items-end leading-tight sm:flex">
                <span className="max-w-[180px] truncate text-[13px] font-semibold">{displayName}</span>
                <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{roleLabel}{!isSuper && role === "COMPANY_ADMIN" && planLabel ? ` · ${planLabel}` : ""}</span>
              </div>
            </div>
          </div>
        </header>

        <section className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1400px] px-3 py-6 sm:px-6 sm:py-7">
          {pageSkeleton ? <PageSkeleton variant={skeletonVariant} /> : children}
          </div>
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
