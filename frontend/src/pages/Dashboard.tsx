import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, Bell, Bot, BriefcaseBusiness, CheckCircle2, Clock3, Files, Folder, HardDrive, MessageSquare, Printer, ScanLine, Settings, ShieldCheck, Sparkles, UploadCloud, Users } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "@/lib/api";
import { connectSocket, getSocket } from "@/services/socket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const USED_COLOR = "#f77f00";
const FREE_COLOR = "#e8e8e8";
const actions = [
  ["files", "Open Files", "Upload, organize and preview documents", Files],
  ["shared", "Shared workspace", "See files and folders shared with you", Folder],
  ["users", "Manage users", "Invite people and control access", Users],
  ["requests", "Review requests", "Handle access and workflow requests", CheckCircle2],
  ["task-management", "Tasks", "Track assignments and due dates", BriefcaseBusiness],
  ["chat", "Team chat", "Continue conversations with your team", MessageSquare],
  ["scan-documents", "Scan documents", "Capture and digitize paper documents", ScanLine],
  ["fax-documents", "Fax center", "Send and review fax documents", Printer],
  ["ai", "AI assistant", "Ask SecureFile AI for help", Bot],
  ["settings", "Settings", "Profile, security and workspace controls", Settings],
] as const;

function Skeleton() { return <div className="dashboard-skeleton"><div className="sf-skeleton h-5 w-28"/><div className="sf-skeleton h-10 w-72"/><div className="sf-skeleton h-4 w-96 max-w-full"/><div className="dashboard-skeleton-grid">{Array.from({length:4}).map((_,i)=><div key={i} className="sf-skeleton h-28 rounded-2xl"/>)}</div></div>; }

function roleLabel(role: string) {
  if (role === "COMPANY_ADMIN") return "Company Admin";
  if (role === "SUPER_ADMIN") return "Super Admin";
  if (role === "CLIENT") return "Client";
  return "Employee";
}

export default function Dashboard() {
  const [d, setD] = useState<any>();
  const [team, setTeam] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const role = localStorage.getItem("sf_role") || "";
  const isCompanyAdmin = role === "COMPANY_ADMIN";
  const name = localStorage.getItem("sf_display_name") || "there";
  const sidebar = (() => { try { return JSON.parse(localStorage.getItem("sf_sidebar_items") || "[]") as string[]; } catch { return []; } })();
  const visibleActions = isCompanyAdmin ? actions : actions.filter(([id]) => sidebar.includes(id));

  useEffect(() => {
    api("/companies/stats", { headers: { "X-SF-Force-Refresh": "true" } }).then(setD).catch(console.error);
  }, []);

  useEffect(() => {
    if (!isCompanyAdmin) return;
    setTeamLoading(true);
    api("/users", { headers: { "X-SF-Force-Refresh": "true" } })
      .then((users) => setTeam(Array.isArray(users) ? users : []))
      .catch(() => setTeam([]))
      .finally(() => setTeamLoading(false));
  }, [isCompanyAdmin]);

  useEffect(() => {
    if (!isCompanyAdmin) return;
    const token = localStorage.getItem("sf_token");
    if (!token) return;

    const socket = connectSocket(token);
    const applySnapshot = (payload: { userIds?: string[] }) => {
      setOnlineUsers(new Set(Array.isArray(payload?.userIds) ? payload.userIds : []));
    };
    const applyPresence = (payload: { userId?: string; online?: boolean }) => {
      if (!payload?.userId) return;
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (payload.online) next.add(payload.userId!);
        else next.delete(payload.userId!);
        return next;
      });
    };

    socket.on("chat:presence_snapshot", applySnapshot);
    socket.on("chat:presence", applyPresence);

    // The socket may already be connected from login/chat, so explicitly
    // request a fresh company presence snapshot instead of relying only on connect.
    if (socket.connected) {
      socket.emit("chat:presence_snapshot_request");
    }

    return () => {
      socket.off("chat:presence_snapshot", applySnapshot);
      socket.off("chat:presence", applyPresence);
    };
  }, [isCompanyAdmin]);

  // Keep this hook unconditional. The previous version called useMemo only after
  // the loading state, which changes the hook order when dashboard data arrives
  // and can crash React into a blank page.
  const usedGb = Number(d?.storageUsedBytes || 0) / 1073741824;
  const limitGb = Number(d?.storageLimitGb || 0) || 1;
  const freeGb = Math.max(0, limitGb - usedGb);
  const usedPct = Math.min(100, (usedGb / limitGb) * 100);
  const chartData = useMemo(() => [{ name:"Used", value:Number(usedGb.toFixed(4)), fill:USED_COLOR }, { name:"Available", value:Number(freeGb.toFixed(4)), fill:FREE_COLOR }], [usedGb, freeGb]);

  if (!d) return <Skeleton />;
  const stats = isCompanyAdmin ? [["Team members", d.users || 0, Users, "/users"], ["Total files", d.files || 0, Files, "/files"], ["Folders", d.folders || 0, Folder, "/files"], ["Unread alerts", d.unreadNotifications || 0, Bell, "#"]] : [["My files", d.files || 0, Files, "/files"], ["My folders", d.folders || 0, Folder, "/files"], ["Unread alerts", d.unreadNotifications || 0, Bell, "#"]];

  return <div className="dashboard-page space-y-6">
    <section className="dashboard-hero">
      <div><div className="dashboard-kicker"><Sparkles size={13}/> Secure workspace</div><h1>Good to see you, {name.split(" ")[0]}.</h1><p>{isCompanyAdmin ? "Your workspace command center is ready. Keep your team, files and workflows moving." : "Your SecureFile workspace is ready. Jump into the areas you use most."}</p></div>
      <div className="dashboard-hero-badge"><ShieldCheck size={18}/><span><strong>Protected workspace</strong><small>SecureFile access is active</small></span></div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(([label,value,Icon,to]) => <Link key={String(label)} to={String(to)} className="dashboard-stat-card"><span className="dashboard-stat-icon"><Icon size={18}/></span><span className="dashboard-stat-copy"><small>{String(label)}</small><strong>{String(value)}</strong><em>View details <ArrowRight size={12}/></em></span></Link>)}
    </section>

    <section className="dashboard-section-head"><div><p className="eyebrow">Workspace tools</p><h2>Quick actions</h2><p>Everything important, one click away.</p></div><Link className="dashboard-link" to="/files">Open file workspace <ArrowRight size={14}/></Link></section>
    <section className="dashboard-actions-grid">{visibleActions.map(([id,label,desc,Icon]) => <Link to={`/${id}`} key={id} className="dashboard-action-card"><span className="dashboard-action-icon"><Icon size={18}/></span><span><strong>{label}</strong><small>{desc}</small></span><ArrowRight size={15} className="dashboard-action-arrow"/></Link>)}</section>

    {isCompanyAdmin && (
      <section className="dashboard-team-panel">
        <div className="dashboard-team-head">
          <div>
            <p className="eyebrow">Your team</p>
            <h2>Team members</h2>
            <p>See who has access to this workspace at a glance.</p>
          </div>
          <Link className="dashboard-link" to="/users">Manage users <ArrowRight size={14}/></Link>
        </div>
        {teamLoading ? (
          <div className="dashboard-team-grid">
            {Array.from({ length: 4 }).map((_, i) => <div className="dashboard-team-card is-loading" key={i}><span className="sf-skeleton dashboard-team-avatar-skel"/><span className="dashboard-team-copy-skel"><span className="sf-skeleton"/><span className="sf-skeleton"/></span></div>)}
          </div>
        ) : team.length ? (
          <div className="dashboard-team-grid">
            {team.map((u) => {
              const displayName = u.uniqueName || u.name || u.email?.split("@")[0] || "User";
              const initials = displayName.trim().split(/\s+/).slice(0, 2).map((part: string) => part.charAt(0)).join("").toUpperCase() || "U";
              const isOnline = onlineUsers.has(u.id);
              return (
                <Link to="/users" className="dashboard-team-card" key={u.id}>
                  <span className="dashboard-team-avatar">
                    {u.avatarUrl ? <img src={u.avatarUrl} alt="" /> : initials}
                  </span>
                  <span className="dashboard-team-copy">
                    <strong title={displayName}>{displayName}</strong>
                    <small>{roleLabel(u.role)}</small>
                  </span>
                  <span
                    className={`dashboard-team-status ${isOnline ? "online" : "offline"}`}
                    title={isOnline ? "Online" : "Offline"}
                    aria-label={isOnline ? "Online" : "Offline"}
                  />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="dashboard-team-empty">No team members to display.</div>
        )}
      </section>
    )}

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.85fr)]">
      {isCompanyAdmin && <Card className="dashboard-panel shadow-sm"><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-base">Storage overview</CardTitle><p className="mt-1 text-xs text-muted-foreground">Monitor workspace capacity before it becomes a bottleneck.</p></div><span className="dashboard-panel-icon"><HardDrive size={16}/></span></CardHeader><CardContent className="grid gap-5 md:grid-cols-[210px_1fr] md:items-center"><div className="relative mx-auto h-[190px] w-[190px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={84} paddingAngle={2} stroke="none">{chartData.map(e=><Cell key={e.name} fill={e.fill}/>)}</Pie><Tooltip formatter={(value)=>[`${Number(value||0).toFixed(2)} GB`, "Storage"]}/></PieChart></ResponsiveContainer><div className="dashboard-donut-label"><strong>{usedPct.toFixed(0)}%</strong><span>used</span></div></div><div className="space-y-5"><div><div className="mb-2 flex justify-between text-xs font-semibold"><span>Storage used</span><span>{usedGb.toFixed(2)} / {limitGb.toFixed(2)} GB</span></div><Progress value={usedPct} className="h-2"/></div><div className="grid gap-3 sm:grid-cols-2"><div className="dashboard-mini-metric"><small>Used</small><strong>{usedGb.toFixed(2)} GB</strong></div><div className="dashboard-mini-metric"><small>Available</small><strong>{freeGb.toFixed(2)} GB</strong></div></div></div></CardContent></Card>}
      <Card className="dashboard-panel shadow-sm"><CardHeader><CardTitle className="text-base">Workspace health</CardTitle><p className="mt-1 text-xs text-muted-foreground">A quick snapshot of your SecureFile environment.</p></CardHeader><CardContent className="space-y-3"><div className="health-row"><span><CheckCircle2 size={16}/><b>Account access</b></span><strong>Active</strong></div><div className="health-row"><span><ShieldCheck size={16}/><b>Security</b></span><strong>Protected</strong></div><div className="health-row"><span><Activity size={16}/><b>Workspace services</b></span><strong>Operational</strong></div><div className="health-row"><span><Clock3 size={16}/><b>Last checked</b></span><strong>Just now</strong></div></CardContent></Card>
    </div>

    <section className="dashboard-bottom-grid"><div className="dashboard-tip"><span className="dashboard-tip-icon"><UploadCloud size={18}/></span><div><strong>Keep your workspace organized</strong><p>Use folders, shared permissions and task workflows together to keep every document easy to find and every action accountable.</p></div><Link to="/files"><ArrowRight size={16}/></Link></div><div className="dashboard-tip"><span className="dashboard-tip-icon"><ShieldCheck size={18}/></span><div><strong>Review your security</strong><p>Update your profile, password and two-factor authentication from Settings.</p></div><Link to="/settings"><ArrowRight size={16}/></Link></div></section>
  </div>;
}
