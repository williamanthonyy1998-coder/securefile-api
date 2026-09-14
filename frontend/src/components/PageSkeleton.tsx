import { cn } from "@/lib/utils";

type Variant =
  | "dashboard" | "files" | "users" | "settings" | "chat"
  | "table" | "scanner" | "fax" | "ai" | "super" | "default";

function Bar({ className = "" }: { className?: string }) {
  return <div className={cn("sf-skeleton rounded-lg", className)} />;
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-[minmax(220px,1fr)_160px_120px_150px_90px] gap-4 bg-muted/60 px-5 py-3">
        {["w-28", "w-20", "w-16", "w-20", "w-14"].map((w, i) => <Bar key={i} className={`h-3 ${w}`} />)}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-[minmax(220px,1fr)_160px_120px_150px_90px] items-center gap-4 border-t border-border px-5 py-4">
          <div className="flex items-center gap-3"><Bar className="h-9 w-9 rounded-lg" /><div className="space-y-2"><Bar className="h-3 w-36" /><Bar className="h-2.5 w-20" /></div></div>
          <Bar className="h-3 w-24" /><Bar className="h-3 w-16" /><Bar className="h-3 w-20" /><Bar className="ml-auto h-8 w-8 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export default function PageSkeleton({ variant = "default" }: { variant?: Variant }) {
  if (variant === "dashboard") return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2"><Bar className="h-3 w-20" /><Bar className="h-9 w-52" /><Bar className="h-4 w-80 max-w-full" /></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="rounded-2xl border border-border bg-card p-5"><div className="flex justify-between"><Bar className="h-3 w-24" /><Bar className="h-9 w-9 rounded-lg" /></div><Bar className="mt-5 h-8 w-16" /></div>)}</div>
      <div className="rounded-2xl border border-border bg-card p-6"><div className="flex justify-between"><div className="space-y-2"><Bar className="h-5 w-24" /><Bar className="h-3 w-44" /></div><Bar className="h-9 w-9 rounded-lg" /></div><div className="mt-6 grid gap-8 md:grid-cols-[220px_1fr] items-center"><Bar className="mx-auto h-44 w-44 rounded-full" /><div className="space-y-5"><Bar className="h-3 w-full" /><div className="grid grid-cols-2 gap-3"><Bar className="h-20 w-full" /><Bar className="h-20 w-full" /></div></div></div></div>
    </div>
  );

  if (variant === "files") return (
    <div className="space-y-5 animate-pulse"><div className="flex items-end justify-between gap-6"><div className="space-y-2"><Bar className="h-3 w-20" /><Bar className="h-9 w-28" /><Bar className="h-4 w-80" /></div><div className="space-y-3 w-[360px]"><Bar className="h-11 w-full" /><Bar className="h-10 w-24" /></div></div><div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]"><div className="rounded-2xl border border-border bg-card p-5 space-y-4"><Bar className="h-5 w-20" /><Bar className="h-3 w-40" /><Bar className="h-9 w-full" />{Array.from({length:7}).map((_,i)=><Bar key={i} className="h-8 w-full" />)}</div><div className="rounded-2xl border border-border bg-card p-5 space-y-5"><Bar className="h-20 w-full" /><Bar className="h-5 w-36" /><TableSkeleton rows={5}/></div></div></div>
  );

  if (variant === "users") return <div className="space-y-5 animate-pulse"><div className="flex justify-between"><div className="space-y-2"><Bar className="h-3 w-28"/><Bar className="h-9 w-48"/><Bar className="h-4 w-96 max-w-full"/></div><Bar className="h-10 w-28"/></div><div className="grid gap-3 sm:grid-cols-3"><Bar className="h-24 w-full"/><Bar className="h-24 w-full"/><Bar className="h-24 w-full"/></div><TableSkeleton rows={7}/></div>;

  if (variant === "settings") return <div className="space-y-5 animate-pulse"><div className="space-y-2"><Bar className="h-3 w-20"/><Bar className="h-9 w-36"/><Bar className="h-4 w-56"/></div><div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]"><div className="rounded-2xl border border-border bg-card p-3 space-y-2"><Bar className="h-10 w-full"/><Bar className="h-10 w-full"/><Bar className="h-10 w-full"/></div><div className="space-y-4"><div className="rounded-2xl border border-border bg-card overflow-hidden"><Bar className="h-28 w-full rounded-none"/><div className="p-6"><Bar className="h-9 w-9 rounded-xl"/><Bar className="mt-4 h-5 w-32"/><Bar className="mt-2 h-3 w-24"/></div></div><div className="rounded-2xl border border-border bg-card p-6 space-y-5"><Bar className="h-5 w-28"/><div className="grid grid-cols-2 gap-4"><Bar className="h-11"/><Bar className="h-11"/><Bar className="h-11"/><Bar className="h-11"/></div></div></div></div></div>;

  if (variant === "chat") return <div className="h-[calc(100vh-7.5rem)] min-h-[560px] rounded-2xl border border-border bg-card overflow-hidden animate-pulse"><div className="grid h-full grid-cols-[280px_1fr]"><div className="border-r border-border p-4 space-y-3"><Bar className="h-10 w-full"/>{Array.from({length:8}).map((_,i)=><Bar key={i} className="h-14 w-full"/>)}</div><div className="p-6 space-y-5"><div className="flex justify-between"><div className="space-y-2"><Bar className="h-5 w-40"/><Bar className="h-3 w-24"/></div><Bar className="h-9 w-9 rounded-lg"/></div><div className="space-y-4 pt-16"><Bar className="ml-auto h-14 w-2/3"/><Bar className="h-14 w-1/2"/><Bar className="ml-auto h-14 w-1/2"/></div><Bar className="mt-auto h-12 w-full"/></div></div></div>;

  if (variant === "scanner" || variant === "fax" || variant === "ai") return <div className="space-y-5 animate-pulse"><div className="flex justify-between"><div className="space-y-2"><Bar className="h-3 w-24"/><Bar className="h-9 w-44"/><Bar className="h-4 w-72"/></div><Bar className="h-10 w-28"/></div><div className="grid gap-4 lg:grid-cols-[1.4fr_.8fr]"><div className="rounded-2xl border border-border bg-card p-6 space-y-5"><Bar className="h-6 w-40"/><Bar className="h-12 w-full"/><Bar className="h-44 w-full"/><div className="flex gap-3"><Bar className="h-10 w-28"/><Bar className="h-10 w-28"/></div></div><div className="rounded-2xl border border-border bg-card p-6 space-y-4"><Bar className="h-5 w-28"/><Bar className="h-24 w-full"/><Bar className="h-24 w-full"/><Bar className="h-24 w-full"/></div></div></div>;

  if (variant === "super") return <div className="space-y-5 animate-pulse"><div className="flex justify-between"><div className="space-y-2"><Bar className="h-3 w-24"/><Bar className="h-9 w-52"/><Bar className="h-4 w-80"/></div><Bar className="h-10 w-28"/></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:4}).map((_,i)=><Bar key={i} className="h-24"/>)}</div><TableSkeleton rows={8}/></div>;

  return <div className="space-y-5 animate-pulse"><div className="flex justify-between"><div className="space-y-2"><Bar className="h-3 w-20"/><Bar className="h-9 w-44"/><Bar className="h-4 w-80"/></div><Bar className="h-10 w-24"/></div><TableSkeleton rows={7}/></div>;
}
