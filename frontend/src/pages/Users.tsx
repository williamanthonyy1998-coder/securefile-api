import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit3,
  Files,
  Folder,
  KeyRound,
  PauseCircle,
  PlayCircle,
  LayoutDashboard,
  Mail,
  MessageSquare,
  PanelLeft,
  Printer,
  ScanLine,
  Settings,
  Shield,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { sfConfirm } from "../lib/dialogs";

type User = {
  id: string;
  email: string;
  uniqueName: string;
  role: string;
  status: string;
  emailVerifiedAt?: string | null;
  personalFolderAllowed: boolean;
  sidebarItems?: string[];
  createdAt: string;
  _count?: { ownedFiles: number; ownedFolders: number };
};

type FolderPermission = {
  folderId: string;
  canView: boolean;
  canDownload: boolean;
  canUpload: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
};

type SidebarOption = {
  id: string;
  label: string;
  description: string;
  icon: any;
};

const SIDEBAR_OPTIONS: SidebarOption[] = [
  { id: "dashboard", label: "Dashboard", description: "Personal workspace overview", icon: LayoutDashboard },
  { id: "files", label: "Files", description: "Personal and permitted files", icon: Files },
  { id: "shared", label: "Shared", description: "Files and folders shared with the user", icon: PanelLeft },
  { id: "trash", label: "Trash", description: "Deleted resources", icon: Archive },
  { id: "requests", label: "Requests", description: "Access and file requests", icon: CheckCircle2 },
  { id: "approvals", label: "Approvals", description: "Approval workflow", icon: Shield },
  { id: "task-management", label: "Task Management", description: "Assigned and created tasks", icon: KeyRound },
  { id: "chat", label: "Chat", description: "Workspace messaging", icon: MessageSquare },
  { id: "scan-documents", label: "Scan Documents", description: "Document scanning tools", icon: ScanLine },
  { id: "fax-documents", label: "Fax Documents", description: "Fax workspace", icon: Printer },
  { id: "ai", label: "AI Chat Bot", description: "SecureFile AI assistant", icon: Bot },
  { id: "settings", label: "Settings", description: "Personal workspace settings", icon: Settings },
];

const emptyForm = {
  name: "",
  email: "",
  role: "EMPLOYEE",
  personalFolderAllowed: true,
  sidebarItems: ["files"] as string[],
  folderPermissions: {} as Record<string, FolderPermission>,
};

const defaultPermission = (folderId: string): FolderPermission => ({
  folderId,
  canView: true,
  canDownload: true,
  canUpload: false,
  canEdit: false,
  canDelete: false,
  canShare: false,
});

function roleLabel(role: string) {
  if (role === "COMPANY_ADMIN") return "Company Admin";
  if (role === "SUPER_ADMIN") return "Super Admin";
  if (role === "CLIENT") return "Client";
  return "Employee";
}

function statusClass(status: string) {
  return `status-pill ${status.toLowerCase()}`;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [folders, setFolders] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState<"create" | "edit" | null>(null);
  const [accessOpen, setAccessOpen] = useState<"folders" | "sidebar" | null>(null);
  const [selected, setSelected] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [invitationUrl, setInvitationUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [folderSectionOpen, setFolderSectionOpen] = useState(true);
  const [sidebarSectionOpen, setSidebarSectionOpen] = useState(true);

  const currentUserId = localStorage.getItem("sf_user_id");
  const currentUserRole = localStorage.getItem("sf_role");

  async function load() {
    try {
      setErr("");
      const [u, m, f] = await Promise.all([
        api("/users", { headers: { "X-SF-Force-Refresh": "true" } }),
        api("/users/meta", { headers: { "X-SF-Force-Refresh": "true" } }).catch(() => null),
        api("/folders", { headers: { "X-SF-Force-Refresh": "true" } }),
      ]);
      setUsers(Array.isArray(u) ? u : []);
      setMeta(m);
      setFolders(Array.isArray(f) ? f : []);
    } catch (e: any) {
      setErr(e.message || "Unable to load users.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const companyFolders = useMemo(
    () => folders.filter((f: any) => !f.isPersonal && !f.deletedAt),
    [folders],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return users.filter(
      (u) =>
        !q ||
        u.uniqueName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        roleLabel(u.role).toLowerCase().includes(q) ||
        u.status.toLowerCase().includes(q),
    );
  }, [users, query]);

  function resetModals() {
    setOpen(null);
    setAccessOpen(null);
    setSelected(null);
    setInvitationUrl("");
    setLoadingEdit(false);
    setLoadingAccess(false);
    setForm(emptyForm);
  }

  function openCreate() {
    setErr("");
    setNotice("");
    setInvitationUrl("");
    setSelected(null);
    setForm({ ...emptyForm, sidebarItems: ["files"], folderPermissions: {} });
    setOpen("create");
    setAccessOpen(null);
  }

  function openEdit(u: User) {
    if (u.role === "COMPANY_ADMIN" || u.id === currentUserId) return;
    setErr("");
    setNotice("");
    setSelected(u);
    setForm({
      ...emptyForm,
      name: u.uniqueName,
      email: u.email,
      role: u.role === "CLIENT" ? "CLIENT" : "EMPLOYEE",
      personalFolderAllowed: u.personalFolderAllowed,
      sidebarItems: u.sidebarItems?.length ? [...u.sidebarItems] : ["files"],
    });
    setOpen("edit");
    setAccessOpen(null);
  }

  async function openFolderPermissions(u: User) {
    if (u.role === "COMPANY_ADMIN" || u.id === currentUserId) return;
    setErr("");
    setNotice("");
    setSelected(u);
    setLoadingAccess(true);
    setAccessOpen("folders");
    try {
      const current = await api(`/users/${u.id}/permissions`, {
        headers: { "X-SF-Force-Refresh": "true" },
      });
      const map: Record<string, FolderPermission> = {};
      (current || []).forEach((s: any) => {
        if (!s.folderId) return;
        map[s.folderId] = {
          folderId: s.folderId,
          canView: s.canView,
          canDownload: s.canDownload,
          canUpload: s.canUpload,
          canEdit: s.canEdit,
          canDelete: s.canDelete,
          canShare: s.canShare,
        };
      });
      setForm((prev) => ({ ...prev, folderPermissions: map }));
    } catch (e: any) {
      setErr(e.message || "Unable to load this user's folder access.");
      setAccessOpen(null);
    } finally {
      setLoadingAccess(false);
    }
  }

  function openSidebarPermissions(u: User) {
    if (u.role === "COMPANY_ADMIN" || u.id === currentUserId) return;
    setErr("");
    setNotice("");
    setSelected(u);
    setForm((prev) => ({
      ...prev,
      sidebarItems: u.sidebarItems?.length ? [...u.sidebarItems] : ["files"],
    }));
    setAccessOpen("sidebar");
  }

  function toggleSidebar(id: string) {
    setForm((prev) => ({
      ...prev,
      sidebarItems: prev.sidebarItems.includes(id)
        ? prev.sidebarItems.filter((x) => x !== id)
        : [...prev.sidebarItems, id],
    }));
  }

  function toggleFolder(folderId: string) {
    setForm((prev) => {
      const next = { ...prev.folderPermissions };
      if (next[folderId]) delete next[folderId];
      else next[folderId] = defaultPermission(folderId);
      return { ...prev, folderPermissions: next };
    });
  }

  function updateFolderPermission(
    folderId: string,
    key: keyof Omit<FolderPermission, "folderId">,
    value: boolean,
  ) {
    setForm((prev) => ({
      ...prev,
      folderPermissions: {
        ...prev.folderPermissions,
        [folderId]: { ...prev.folderPermissions[folderId], [key]: value },
      },
    }));
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const d = await api("/users", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          role: form.role,
          personalFolderAllowed: form.personalFolderAllowed,
          sidebarItems: form.sidebarItems,
          folderIds: Object.keys(form.folderPermissions),
        }),
      });
      setInvitationUrl(d.invitationUrl || "");
      setNotice(
        d.emailDelivered
          ? "Invitation sent successfully."
          : "User created, but the invitation email could not be delivered. Check the email configuration and use Resend invitation after fixing it.",
      );
      setOpen(null);
      setAccessOpen(null);
      setSelected(null);
      setLoadingEdit(false);
      setLoadingAccess(false);
      setForm(emptyForm);
      await load();
    } catch (e: any) {
      setErr(e.message || "Unable to create user.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      await api(`/users/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          role: form.role,
          personalFolderAllowed: form.personalFolderAllowed,
        }),
      });
      setNotice("User account details updated successfully.");
      resetModals();
      await load();
    } catch (e: any) {
      setErr(e.message || "Unable to update user.");
    } finally {
      setSaving(false);
    }
  }

  async function saveFolderPermissions() {
    if (!selected) return;
    setSaving(true);
    try {
      await api(`/users/${selected.id}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ folders: Object.values(form.folderPermissions) }),
      });
      setNotice(`Folder permissions updated for ${selected.uniqueName}.`);
      setAccessOpen(null);
      setSelected(null);
      setForm(emptyForm);
    } catch (e: any) {
      setErr(e.message || "Unable to update folder permissions.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSidebarPermissions() {
    if (!selected) return;
    setSaving(true);
    try {
      await api(`/users/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ sidebarItems: form.sidebarItems }),
      });
      setNotice(`Sidebar access updated for ${selected.uniqueName}.`);
      setAccessOpen(null);
      setSelected(null);
      setForm(emptyForm);
      await load();
    } catch (e: any) {
      setErr(e.message || "Unable to update sidebar access.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(u: User) {
    if (u.role === "COMPANY_ADMIN" || u.id === currentUserId) return;
    const suspending = u.status === "ACTIVE";
    const confirmed = await sfConfirm(
      suspending
        ? `Suspend ${u.uniqueName}? They will no longer be able to access this SecureFile workspace until activated again.`
        : `Activate ${u.uniqueName}? They will regain access to this SecureFile workspace.`,
      {
        title: suspending ? "Suspend user" : "Activate user",
        danger: suspending,
        confirmLabel: suspending ? "Suspend user" : "Activate user",
      }
    );
    if (!confirmed) return;
    try {
      await api(`/users/${u.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: suspending ? "SUSPENDED" : "ACTIVE" }),
      });
      setNotice(suspending ? `${u.uniqueName} has been suspended.` : `${u.uniqueName} has been activated.`);
      await load();
    } catch (e: any) {
      setErr(e.message || "Unable to update status.");
    }
  }

  async function remove(u: User) {
    if (u.role === "COMPANY_ADMIN" || u.id === currentUserId) return;
    if (!(await sfConfirm(`Remove ${u.uniqueName} from this company? This cannot be undone.`, { title: "Remove user", danger: true, confirmLabel: "Remove user" }))) return;
    try {
      await api(`/users/${u.id}`, { method: "DELETE" });
      setNotice("User removed successfully.");
      await load();
    } catch (e: any) {
      setErr(e.message || "Unable to remove user.");
    }
  }

  async function resend(u: User) {
    if (u.role === "COMPANY_ADMIN" || u.id === currentUserId) return;
    try {
      const d = await api(`/users/${u.id}/resend-invitation`, { method: "POST" });
      setInvitationUrl(d.invitationUrl || "");
      setNotice("Invitation resent successfully.");
    } catch (e: any) {
      setErr(e.message || "Unable to resend invitation.");
    }
  }

  const isProtectedUser = (u: User) => u.role === "COMPANY_ADMIN" || u.id === currentUserId;
  const displayRole = (u: User) => (u.id === currentUserId && currentUserRole === "COMPANY_ADMIN" ? "COMPANY_ADMIN" : u.role);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>User Management</h1>
          <p>Manage people, access, folder permissions and each user's workspace navigation.</p>
        </div>
        <button className="btn" onClick={openCreate}><UserPlus size={16} /> Add user</button>
      </div>

      {err && <div className="error" style={{ marginBottom: 16 }}>{err}</div>}
      {notice && (
        <div className="success" style={{ marginBottom: 16 }}>
          <span>{notice}</span>
          {invitationUrl && (
            <button className="link-button" onClick={() => navigator.clipboard.writeText(invitationUrl)} style={{ marginLeft: 10, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Copy size={14} /> Copy invitation link
            </button>
          )}
        </div>
      )}

      <div className="cards">
        <div className="stat"><span>Purchased seats</span><strong>{meta?.purchasedSeats ?? "—"}</strong></div>
        <div className="stat"><span>Used seats</span><strong>{meta?.usedSeats ?? users.length}</strong></div>
        <div className="stat"><span>Remaining</span><strong>{meta?.remainingSeats ?? "—"}</strong></div>
        <div className="stat"><span>Storage allocation</span><strong>{meta?.storageGb ?? "—"} GB</strong></div>
      </div>

      <div className="panel user-management-panel">
        <div className="company-toolbar user-management-toolbar">
          <div className="company-search user-search-field">
            <UsersRound size={16} className="text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users, emails, roles or status..." />
          </div>
          <button className="btn secondary" onClick={load}>Refresh</button>
        </div>

        <div className="user-table-summary">
          <div><strong>{filtered.length}</strong><span>visible users</span></div>
          <div><strong>{users.filter((u) => u.status === "ACTIVE").length}</strong><span>active</span></div>
          <div><strong>{users.filter((u) => u.status === "INVITED").length}</strong><span>pending invites</span></div>
        </div>

        <div className="company-table-wrap user-table-scroll">
          <table className="company-table user-table">
            <colgroup>
              <col className="user-col-user" /><col className="user-col-role" /><col className="user-col-status" />
              <col className="user-col-files" /><col className="user-col-personal" /><col className="user-col-sidebar" /><col className="user-col-actions" />
            </colgroup>
            <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Files</th><th>Personal folder</th><th>Sidebar</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((u) => {
                const protectedUser = isProtectedUser(u);
                const shownRole = displayRole(u);
                return (
                  <tr key={u.id} className={protectedUser ? "protected-user-row" : ""}>
                    <td>
                      <div className="user-cell">
                        <span className="user-avatar">{u.uniqueName.trim().charAt(0).toUpperCase() || "U"}</span>
                        <span><strong>{u.uniqueName}</strong><small>{u.email}</small></span>
                      </div>
                    </td>
                    <td><span className={`role-badge ${shownRole === "COMPANY_ADMIN" ? "admin" : ""}`}>{roleLabel(shownRole)}</span></td>
                    <td><span className={statusClass(u.status)}>{u.status}</span></td>
                    <td>{u._count?.ownedFiles ?? 0}</td>
                    <td>{u.personalFolderAllowed ? "Allowed" : "Disabled"}</td>
                    <td><span className="sidebar-count">{u.sidebarItems?.length || 1} tabs</span></td>
                    <td>
                      <div className="row-actions user-row-actions">
                        {protectedUser ? (
                          <span className="protected-label">Admin account</span>
                        ) : (
                          <>
                            <button className="icon-btn" aria-label="Edit account" title="Edit account details" onClick={() => openEdit(u)}><Edit3 size={15} /></button>
                            <button className="icon-btn" aria-label="Folder permissions" title="Folder permissions" onClick={() => openFolderPermissions(u)}><Folder size={15} /></button>
                            <button className="icon-btn" aria-label="Sidebar permissions" title="Sidebar permissions" onClick={() => openSidebarPermissions(u)}><PanelLeft size={15} /></button>
                            {u.status === "INVITED" && <button className="icon-btn" aria-label="Resend invitation" title="Resend invitation" onClick={() => resend(u)}><Mail size={15} /></button>}
                            <button
                              className={`icon-btn user-status-action ${u.status === "ACTIVE" ? "is-active" : "is-suspended"}`}
                              aria-label={u.status === "ACTIVE" ? "Suspend" : "Activate"}
                              title={u.status === "ACTIVE" ? "Suspend user" : "Activate user"}
                              onClick={() => toggleStatus(u)}
                            >
                              {u.status === "ACTIVE" ? <PauseCircle size={15} /> : <PlayCircle size={15} />}
                            </button>
                            <button className="icon-btn danger" aria-label="Remove user" title="Remove user" onClick={() => remove(u)}><Trash2 size={15} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && <div className="empty-company"><h3>No users found</h3><p>Invite your first Employee or Client.</p><button className="btn" onClick={openCreate}>Add user</button></div>}
        </div>
      </div>

      {(open || accessOpen) && (
        <div className="modal-backdrop user-management-modal-layer" onMouseDown={(e) => e.target === e.currentTarget && resetModals()}>
          <div className={`modal user-editor-modal ${accessOpen ? "access-modal" : ""}`}>
            <div className="modal-head user-editor-head">
              <div>
                <p className="eyebrow">User management</p>
                <h2>
                  {accessOpen === "folders" ? "Folder permissions" : accessOpen === "sidebar" ? "Sidebar permissions" : open === "create" ? "Add user" : "Edit user"}
                </h2>
                <p className="user-editor-subtitle">
                  {accessOpen === "folders"
                    ? `Control exactly what ${selected?.uniqueName || "this user"} can do inside each shared company folder.`
                    : accessOpen === "sidebar"
                      ? `Choose which workspace sections ${selected?.uniqueName || "this user"} can see. Logout remains available automatically.`
                      : open === "create"
                        ? "Create the account once. Folder and sidebar controls are managed separately from the account profile."
                        : "Update the account profile without mixing it with access-control settings."}
                </p>
              </div>
              <button className="close-btn" onClick={resetModals}><X size={18} /></button>
            </div>

            {open && (
              <form onSubmit={open === "create" ? create : saveEdit} className="profile-form">
                <div className="editor-section">
                  <div className="editor-section-title">
                    <span className="section-icon"><UsersRound size={16} /></span>
                    <span><strong>Account details</strong><small>Identity, email and workspace role</small></span>
                  </div>
                  <div className="editor-grid two profile-grid">
                    <div className="field"><label htmlFor="user-name">Full name</label><input id="user-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter full name" required /></div>
                    <div className="field"><label htmlFor="user-email">Email address</label><input id="user-email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@company.com" required /></div>
                    <div className="field"><label htmlFor="user-role">Role</label><select id="user-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="EMPLOYEE">Employee</option><option value="CLIENT">Client</option></select><small className="field-help">Company Admin is reserved for the workspace owner and cannot be assigned here.</small></div>
                    <div className="setting-card">
                      <div><strong>Personal folder</strong><small>Give this user a private workspace folder.</small></div>
                      <label className="switch-row"><input type="checkbox" checked={form.personalFolderAllowed} onChange={(e) => setForm({ ...form, personalFolderAllowed: e.target.checked })} /><span>{form.personalFolderAllowed ? "Allowed" : "Disabled"}</span></label>
                    </div>
                  </div>
                  {open === "create" && <div className="info-callout"><CheckCircle2 size={16} /><span>SecureFile generates the temporary password and sends login details plus password-reset options to the user's email.</span></div>}
                </div>

                <div className="modal-actions editor-actions">
                  <div className="editor-actions-hint">Account details only. Use the separate folder and sidebar permission buttons in the user table to manage access.</div>
                  <button type="button" className="btn secondary" onClick={resetModals}>Cancel</button>
                  <button className="btn" disabled={saving}>{saving ? "Saving…" : open === "create" ? "Create & send invitation" : "Save changes"}</button>
                </div>
              </form>
            )}

            {accessOpen === "folders" && (
              <div className="access-editor-body">
                <div className="access-toolbar">
                  <div><strong>{Object.keys(form.folderPermissions).length} folders selected</strong><span>View, download, upload and share are controlled per folder. Folder editing and deletion are always disabled for recipients.</span></div>
                  <button type="button" className="text-button" onClick={() => setForm((prev) => ({ ...prev, folderPermissions: {} }))}>Clear all</button>
                </div>
                {loadingAccess ? <div className="editor-loading">Loading current folder access…</div> : companyFolders.length ? (
                  <div className="folder-access-grid">
                    {companyFolders.map((f: any) => {
                      const p = form.folderPermissions[f.id];
                      return (
                        <div className={`folder-access-card ${p ? "selected" : ""}`} key={f.id}>
                          <label className="folder-select-row">
                            <span className="folder-check"><input type="checkbox" checked={!!p} onChange={() => toggleFolder(f.id)} /><span className="custom-check"><Check size={13} /></span></span>
                            <span className="folder-meta"><strong>{f.name}</strong><small>{p ? "Access enabled" : "Not shared"}</small></span>
                          </label>
                          {p && <div className="permission-mini-grid">{(["canView", "canDownload", "canUpload", "canShare"] as const).map((key) => <label key={key}><input type="checkbox" checked={p[key]} onChange={(e) => updateFolderPermission(f.id, key, e.target.checked)} /><span>{key.replace("can", "")}</span></label>)}</div>}
                        </div>
                      );
                    })}
                  </div>
                ) : <div className="empty-editor"><Folder size={18} /><span>No company folders available.</span></div>}
                <div className="modal-actions editor-actions"><div className="editor-actions-hint">These permissions apply only to the selected user's shared company folders. Recipients can never rename, move or delete a shared folder.</div><button type="button" className="btn secondary" onClick={resetModals}>Cancel</button><button type="button" className="btn" disabled={saving || loadingAccess} onClick={saveFolderPermissions}>{saving ? "Saving…" : "Save folder permissions"}</button></div>
              </div>
            )}

            {accessOpen === "sidebar" && (
              <div className="access-editor-body">
                <div className="access-toolbar"><div><strong>{form.sidebarItems.length} tabs visible</strong><span>Select the workspace areas this Employee or Client should see.</span></div><button type="button" className="text-button" onClick={() => setForm((prev) => ({ ...prev, sidebarItems: ["files"] }))}>Files only</button></div>
                <div className="sidebar-options-grid">{SIDEBAR_OPTIONS.map((item) => { const Icon = item.icon; const active = form.sidebarItems.includes(item.id); return <button type="button" key={item.id} className={`sidebar-option ${active ? "active" : ""}`} onClick={() => toggleSidebar(item.id)}><span className="sidebar-option-icon"><Icon size={16} /></span><span><strong>{item.label}</strong><small>{item.description}</small></span><span className="sidebar-option-check"><Check size={13} /></span></button>; })}</div>
                <div className="modal-actions editor-actions"><div className="editor-actions-hint">Logout is always available. Company Admin navigation is not controlled from this screen.</div><button type="button" className="btn secondary" onClick={resetModals}>Cancel</button><button type="button" className="btn" disabled={saving} onClick={saveSidebarPermissions}>{saving ? "Saving…" : "Save sidebar access"}</button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
