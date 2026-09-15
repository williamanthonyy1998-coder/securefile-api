import { cn } from "@/lib/utils";

type Variant =
  | "dashboard"
  | "files"
  | "users"
  | "settings"
  | "chat"
  | "shared"
  | "requests"
  | "approvals"
  | "tasks"
  | "trash"
  | "scanner"
  | "fax"
  | "ai"
  | "super"
  | "file-view"
  | "table"
  | "default";

function Bar({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={cn("sf-skeleton", className)} />;
}

function Heading({ titleWidth = "w-48", lineWidth = "w-80", action = true }: {
  titleWidth?: string; lineWidth?: string; action?: boolean;
}) {
  return (
    <div className="sf-page-skel-head">
      <div className="space-y-2">
        <Bar className="h-3 w-20 rounded-full" />
        <Bar className={`h-9 ${titleWidth} rounded-lg`} />
        <Bar className={`h-4 ${lineWidth} max-w-full rounded-md`} />
      </div>
      {action && <Bar className="h-10 w-28 rounded-xl" />}
    </div>
  );
}

function TableSkeleton({ rows = 7, columns = "standard" }: { rows?: number; columns?: "standard" | "compact" }) {
  const cols = columns === "compact"
    ? "minmax(220px,1fr) 150px 120px 92px"
    : "minmax(240px,1fr) 170px 120px 150px 92px";

  return (
    <div className="sf-table-skeleton">
      <div className="sf-table-skel-head" style={{ gridTemplateColumns: cols }}>
        <Bar className="h-3 w-24" /><Bar className="h-3 w-20" /><Bar className="h-3 w-16" />
        {columns === "standard" && <Bar className="h-3 w-20" />}
        <Bar className="h-3 w-14 ml-auto" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="sf-table-skel-row" style={{ gridTemplateColumns: cols }}>
          <div className="flex items-center gap-3 min-w-0">
            <Bar className="h-9 w-9 shrink-0 rounded-xl" />
            <div className="space-y-2 min-w-0">
              <Bar className={`h-3 ${i % 3 === 0 ? "w-40" : i % 3 === 1 ? "w-32" : "w-36"} rounded-md`} />
              <Bar className="h-2.5 w-20 rounded-md" />
            </div>
          </div>
          <Bar className="h-3 w-24 rounded-md" />
          <Bar className="h-3 w-16 rounded-md" />
          {columns === "standard" && <Bar className="h-3 w-20 rounded-md" />}
          <Bar className="h-8 w-8 ml-auto rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function StatCards({ count = 4 }: { count?: number }) {
  return (
    <div className="sf-skel-stat-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div className="sf-skel-card sf-skel-stat" key={i}>
          <div className="flex items-center justify-between">
            <Bar className="h-3 w-24 rounded-md" />
            <Bar className="h-10 w-10 rounded-xl" />
          </div>
          <Bar className="mt-5 h-8 w-16 rounded-lg" />
          <Bar className="mt-3 h-2.5 w-24 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="sf-page-skeleton sf-dashboard-skeleton">
      <div className="sf-dashboard-hero-skel">
        <div className="space-y-3 min-w-0">
          <Bar className="h-7 w-36 rounded-full" />
          <Bar className="h-11 w-[min(520px,75vw)] rounded-xl" />
          <Bar className="h-4 w-[min(620px,80vw)] max-w-full rounded-md" />
        </div>
        <Bar className="h-16 w-44 rounded-2xl shrink-0" />
      </div>
      <StatCards />
      <div className="sf-skel-section-head"><div className="space-y-2"><Bar className="h-5 w-28 rounded-md" /><Bar className="h-3 w-48 rounded-md" /></div><Bar className="h-3 w-32 rounded-md" /></div>
      <div className="sf-dashboard-action-skel">
        {Array.from({ length: 8 }).map((_, i) => <div className="sf-skel-card p-4 flex items-center gap-3" key={i}><Bar className="h-10 w-10 rounded-xl shrink-0" /><div className="space-y-2 flex-1"><Bar className="h-3 w-28" /><Bar className="h-2.5 w-36 max-w-full" /></div><Bar className="h-4 w-4 rounded" /></div>)}
      </div>
      <div className="sf-skel-card p-6">
        <div className="flex justify-between"><div className="space-y-2"><Bar className="h-5 w-24" /><Bar className="h-3 w-44" /></div><Bar className="h-9 w-9 rounded-xl" /></div>
        <div className="grid gap-8 md:grid-cols-[190px_1fr] items-center mt-7">
          <Bar className="h-44 w-44 rounded-full mx-auto" />
          <div className="space-y-5"><Bar className="h-3 w-full rounded-full" /><div className="grid grid-cols-2 gap-3"><Bar className="h-20 rounded-xl" /><Bar className="h-20 rounded-xl" /></div></div>
        </div>
      </div>
    </div>
  );
}

function FilesSkeleton() {
  return (
    <div className="sf-page-skeleton sf-files-skeleton">
      <Heading titleWidth="w-28" lineWidth="w-80" />
      <div className="sf-files-skel-layout">
        <aside className="sf-skel-card sf-folder-skel">
          <div className="sf-folder-skel-head"><Bar className="h-5 w-20" /><Bar className="h-3 w-44" /><Bar className="h-9 w-full rounded-lg" /></div>
          <div className="sf-folder-skel-list">
            {Array.from({ length: 9 }).map((_, i) => <div className="flex items-center gap-2" key={i}><Bar className="h-4 w-4 rounded" /><Bar className={`h-3 ${i % 3 === 0 ? "w-32" : i % 3 === 1 ? "w-24" : "w-28"} rounded-md`} /><Bar className="h-4 w-10 rounded-full ml-auto" /></div>)}
          </div>
        </aside>
        <div className="sf-skel-card p-5 min-w-0">
          <div className="sf-files-create-skel"><Bar className="h-5 w-28" /><Bar className="h-11 flex-1 rounded-xl" /><Bar className="h-11 w-28 rounded-xl" /></div>
          <div className="flex items-center gap-3 my-5"><Bar className="h-9 w-9 rounded-xl" /><div className="space-y-2"><Bar className="h-4 w-32" /><Bar className="h-2.5 w-40" /></div></div>
          <TableSkeleton rows={6} />
        </div>
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="sf-page-skeleton">
      <Heading titleWidth="w-36" lineWidth="w-56" action={false} />
      <div className="sf-settings-skel-layout">
        <aside className="sf-skel-card sf-settings-nav-skel">
          <Bar className="h-10 w-full rounded-xl" /><Bar className="h-10 w-full rounded-xl" /><Bar className="h-10 w-full rounded-xl" />
        </aside>
        <div className="space-y-4 min-w-0">
          <div className="sf-skel-card overflow-hidden">
            <Bar className="h-28 w-full rounded-none" />
            <div className="p-6 flex items-center gap-4"><Bar className="h-16 w-16 rounded-2xl shrink-0" /><div className="space-y-2"><Bar className="h-5 w-32" /><Bar className="h-3 w-24" /></div><Bar className="h-10 w-28 rounded-xl ml-auto" /></div>
          </div>
          <div className="sf-skel-card p-6 space-y-5"><Bar className="h-5 w-28" /><div className="grid grid-cols-2 gap-4"><Bar className="h-11 rounded-xl" /><Bar className="h-11 rounded-xl" /><Bar className="h-11 rounded-xl" /><Bar className="h-11 rounded-xl" /></div><Bar className="h-10 w-28 rounded-xl ml-auto" /></div>
        </div>
      </div>
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="sf-chat-skel sf-skel-card">
      <aside className="sf-chat-skel-side">
        <Bar className="h-10 w-full rounded-xl" />
        {Array.from({ length: 7 }).map((_, i) => <div className="flex items-center gap-3" key={i}><Bar className="h-10 w-10 rounded-full shrink-0" /><div className="space-y-2 flex-1"><Bar className={`h-3 ${i % 2 ? "w-24" : "w-32"}`} /><Bar className="h-2.5 w-16" /></div></div>)}
      </aside>
      <section className="sf-chat-skel-main">
        <div className="flex items-center justify-between pb-4 border-b border-border"><div className="space-y-2"><Bar className="h-5 w-36" /><Bar className="h-3 w-20" /></div><Bar className="h-9 w-9 rounded-xl" /></div>
        <div className="space-y-4 py-8"><Bar className="h-14 w-[65%] rounded-2xl" /><Bar className="h-12 w-[48%] ml-auto rounded-2xl" /><Bar className="h-16 w-[58%] rounded-2xl" /></div>
        <Bar className="h-12 w-full rounded-xl mt-auto" />
      </section>
    </div>
  );
}

function ToolSkeleton({ kind }: { kind: "scanner" | "fax" | "ai" }) {
  const title = kind === "scanner" ? "Scan workspace" : kind === "fax" ? "Fax workspace" : "AI workspace";
  return (
    <div className="sf-page-skeleton">
      <Heading titleWidth="w-44" lineWidth="w-80" />
      <div className="sf-tool-skel-grid">
        <div className="sf-skel-card p-6 space-y-5"><div className="flex justify-between"><Bar className="h-5 w-36" /><Bar className="h-9 w-9 rounded-xl" /></div><Bar className="h-12 w-full rounded-xl" /><Bar className="h-48 w-full rounded-xl" /><div className="flex gap-3"><Bar className="h-10 w-28 rounded-xl" /><Bar className="h-10 w-28 rounded-xl" /></div></div>
        <div className="sf-skel-card p-6 space-y-4"><Bar className="h-5 w-32" /><Bar className="h-3 w-48" /><Bar className="h-24 w-full rounded-xl" /><Bar className="h-24 w-full rounded-xl" /><Bar className="h-20 w-full rounded-xl" /></div>
      </div>
      <span className="sr-only">{title}</span>
    </div>
  );
}

export default function PageSkeleton({ variant = "default" }: { variant?: Variant }) {
  if (variant === "dashboard") return <DashboardSkeleton />;
  if (variant === "files") return <FilesSkeleton />;
  if (variant === "settings") return <SettingsSkeleton />;
  if (variant === "chat") return <ChatSkeleton />;
  if (variant === "users") return <div className="sf-page-skeleton"><Heading titleWidth="w-48" lineWidth="w-96" /><StatCards count={3} /><TableSkeleton rows={7} /></div>;
  if (variant === "shared") return (
    <div className="sf-page-skeleton sf-shared-skeleton">
      <Heading titleWidth="w-32" lineWidth="w-72" />
      <div className="sf-skel-card sf-shared-toolbar-skel"><div className="flex items-center gap-3"><Bar className="h-10 w-10 rounded-xl" /><div className="space-y-2"><Bar className="h-4 w-32" /><Bar className="h-2.5 w-56 max-w-full" /></div></div><div className="flex gap-2"><Bar className="h-9 w-32 rounded-lg" /><Bar className="h-9 w-28 rounded-lg" /></div></div>
      <div className="shared-summary-grid">{Array.from({length:4}).map((_,i)=><div className="sf-skel-card p-4 flex items-center gap-3" key={i}><Bar className="h-9 w-9 rounded-xl" /><div className="space-y-2"><Bar className="h-4 w-8" /><Bar className="h-2.5 w-20" /></div></div>)}</div>
      <div className="sf-skel-card overflow-hidden">{Array.from({length:6}).map((_,i)=><div className="shared-skel-row" key={i}><Bar className="h-9 w-9 rounded-xl" /><div className="space-y-2 flex-1"><Bar className={`h-3 ${i % 2 ? "w-40" : "w-52"} max-w-full`} /><Bar className="h-2.5 w-28" /></div><Bar className="h-8 w-32 rounded-lg" /><Bar className="h-8 w-24 rounded-lg" /><Bar className="h-8 w-8 rounded-lg" /></div>)}</div>
    </div>
  );
  if (variant === "requests") return <div className="sf-page-skeleton"><Heading titleWidth="w-40" lineWidth="w-96" /><div className="sf-skel-card p-5 mb-4"><div className="grid md:grid-cols-[1fr_1fr_auto] gap-3"><Bar className="h-11 rounded-xl" /><Bar className="h-11 rounded-xl" /><Bar className="h-11 w-28 rounded-xl" /></div></div><TableSkeleton rows={6} columns="compact" /></div>;
  if (variant === "approvals") return <div className="sf-page-skeleton"><Heading titleWidth="w-44" lineWidth="w-96" /><div className="sf-skel-card p-5 mb-4"><div className="flex gap-3"><Bar className="h-10 w-28 rounded-xl" /><Bar className="h-10 w-28 rounded-xl" /><Bar className="h-10 w-28 rounded-xl" /></div></div><TableSkeleton rows={6} /></div>;
  if (variant === "tasks") return <div className="sf-page-skeleton"><Heading titleWidth="w-52" lineWidth="w-80" /><div className="sf-task-filter-skel"><Bar className="h-10 flex-1 rounded-xl" /><Bar className="h-10 w-32 rounded-xl" /><Bar className="h-10 w-28 rounded-xl" /></div><TableSkeleton rows={7} /></div>;
  if (variant === "trash") return <div className="sf-page-skeleton"><Heading titleWidth="w-28" lineWidth="w-96" /><div className="sf-skel-card p-6 mb-4"><div className="flex justify-between"><div className="space-y-2"><Bar className="h-5 w-36" /><Bar className="h-3 w-72" /></div><Bar className="h-10 w-28 rounded-xl" /></div></div><TableSkeleton rows={6} columns="compact" /></div>;
  if (variant === "scanner" || variant === "fax" || variant === "ai") return <ToolSkeleton kind={variant} />;
  if (variant === "super") return <div className="sf-page-skeleton"><Heading titleWidth="w-52" lineWidth="w-80" /><StatCards /><TableSkeleton rows={8} /></div>;
  if (variant === "file-view") return <div className="sf-page-skeleton"><Heading titleWidth="w-72" lineWidth="w-64" /><div className="sf-skel-card p-4"><Bar className="h-[min(70vh,680px)] w-full rounded-xl" /></div></div>;
  return <div className="sf-page-skeleton"><Heading /><TableSkeleton rows={7} /></div>;
}
