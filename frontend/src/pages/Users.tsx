import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Check, Copy, Edit3, KeyRound, Mail, Shield, Trash2, UserPlus, X } from 'lucide-react';

type User = {
  id: string; email: string; uniqueName: string; role: string; status: string;
  emailVerifiedAt?: string | null; personalFolderAllowed: boolean;
  createdAt: string; _count?: { ownedFiles: number; ownedFolders: number };
};

type FolderPermission = {
  folderId: string; canView: boolean; canDownload: boolean; canUpload: boolean; canEdit: boolean; canDelete: boolean; canShare: boolean;
};

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [folders, setFolders] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState<'create' | 'edit' | 'permissions' | null>(null);
  const [selected, setSelected] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'EMPLOYEE', personalFolderAllowed: true });
  const [folderPermissions, setFolderPermissions] = useState<Record<string, FolderPermission>>({});
  const [invitationUrl, setInvitationUrl] = useState('');

  async function load() {
    try {
      setErr('');
      const [u, m, f] = await Promise.all([api('/users'), api('/users/meta').catch(() => null), api('/folders')]);
      setUsers(Array.isArray(u) ? u : []);
      setMeta(m);
      setFolders(Array.isArray(f) ? f : []);
    } catch (e: any) { setErr(e.message || 'Unable to load users.'); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => users.filter(u => {
    const q = query.toLowerCase().trim();
    return !q || u.uniqueName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  }), [users, query]);

  function close() { setOpen(null); setSelected(null); setInvitationUrl(''); }

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      const d = await api('/users', { method: 'POST', body: JSON.stringify(form) });
      setInvitationUrl(d.invitationUrl || '');
      setNotice('Invitation created successfully.');
      setOpen(null);
      await load();
    } catch (e: any) { setErr(e.message); }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      await api(`/users/${selected.id}`, { method: 'PATCH', body: JSON.stringify(form) });
      setNotice('User updated.');
      close();
      await load();
    } catch (e: any) { setErr(e.message); }
  }

  async function toggleStatus(u: User) {
    try {
      await api(`/users/${u.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }) });
      await load();
    } catch (e: any) { setErr(e.message); }
  }

  async function remove(u: User) {
    if (!confirm(`Remove ${u.uniqueName} from this company? This cannot be undone.`)) return;
    try { await api(`/users/${u.id}`, { method: 'DELETE' }); await load(); }
    catch (e: any) { setErr(e.message); }
  }

  async function resend(u: User) {
    try {
      const d = await api(`/users/${u.id}/resend-invitation`, { method: 'POST' });
      setInvitationUrl(d.invitationUrl || '');
      setNotice('Invitation resent.');
    } catch (e: any) { setErr(e.message); }
  }

  async function openPermissions(u: User) {
    try {
      const current = await api(`/users/${u.id}/permissions`);
      const map: Record<string, FolderPermission> = {};
      (current || []).forEach((s: any) => {
        if (s.folderId) map[s.folderId] = {
          folderId: s.folderId, canView: s.canView, canDownload: s.canDownload,
          canUpload: s.canUpload, canEdit: s.canEdit, canDelete: s.canDelete, canShare: s.canShare
        };
      });
      setFolderPermissions(map);
      setSelected(u);
      setOpen('permissions');
    } catch (e: any) { setErr(e.message); }
  }

  function toggleFolder(folderId: string) {
    setFolderPermissions(prev => {
      const exists = prev[folderId];
      if (exists) {
        const next = { ...prev }; delete next[folderId]; return next;
      }
      return { ...prev, [folderId]: { folderId, canView: true, canDownload: true, canUpload: false, canEdit: false, canDelete: false, canShare: false } };
    });
  }

  async function savePermissions() {
    if (!selected) return;
    try {
      await api(`/users/${selected.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ folders: Object.values(folderPermissions) })
      });
      setNotice('Folder access updated.');
      close();
    } catch (e: any) { setErr(e.message); }
  }

  return <>
    <div className="page-head">
      <div><p className="eyebrow">Administration</p><h1>User Management</h1><p>Invite, manage and control access for Employees and Clients.</p></div>
      <button className="btn" onClick={() => { setForm({ name: '', email: '', role: 'EMPLOYEE', personalFolderAllowed: true }); setOpen('create'); }}><UserPlus size={16}/> Add user</button>
    </div>

    {err && <div className="error" style={{ marginBottom: 16 }}>{err}</div>}
    {notice && <div className="success" style={{ marginBottom: 16 }}>{notice} {invitationUrl && <button className="link-button" onClick={() => navigator.clipboard.writeText(invitationUrl)}><Copy size={14}/> Copy invitation link</button>}</div>}

    <div className="cards">
      <div className="stat"><span>Purchased seats</span><strong>{meta?.purchasedSeats ?? '—'}</strong></div>
      <div className="stat"><span>Used seats</span><strong>{meta?.usedSeats ?? users.length}</strong></div>
      <div className="stat"><span>Remaining</span><strong>{meta?.remainingSeats ?? '—'}</strong></div>
      <div className="stat"><span>Storage allocation</span><strong>{meta?.storageGb ?? '—'} GB</strong></div>
    </div>

    <div className="panel">
      <div className="company-toolbar">
        <div className="company-search"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search users, emails or roles..." /></div>
        <button className="btn secondary" onClick={load}>Refresh</button>
      </div>
      <div className="company-table-wrap">
        <table className="company-table">
          <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Files</th><th>Personal folder</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(u => <tr key={u.id}>
              <td><strong>{u.uniqueName}</strong><small style={{ display:'block', color:'#7b8799' }}>{u.email}</small></td>
              <td>{u.role}</td>
              <td><span className={`status-pill ${u.status.toLowerCase()}`}>{u.status}</span></td>
              <td>{u._count?.ownedFiles ?? 0}</td>
              <td>{u.personalFolderAllowed ? 'Allowed' : 'Disabled'}</td>
              <td><div className="row-actions">
                <button className="icon-btn" title="Edit" onClick={() => { setSelected(u); setForm({ name:u.uniqueName, email:u.email, role:u.role, personalFolderAllowed:u.personalFolderAllowed }); setOpen('edit'); }}><Edit3 size={15}/></button>
                <button className="icon-btn" title="Folder permissions" onClick={() => openPermissions(u)}><Shield size={15}/></button>
                {u.status === 'INVITED' && <button className="icon-btn" title="Resend invitation" onClick={() => resend(u)}><Mail size={15}/></button>}
                <button className="icon-btn" title={u.status === 'ACTIVE' ? 'Suspend' : 'Activate'} onClick={() => toggleStatus(u)}><KeyRound size={15}/></button>
                <button className="icon-btn danger" title="Remove" onClick={() => remove(u)}><Trash2 size={15}/></button>
              </div></td>
            </tr>)}
          </tbody>
        </table>
        {!filtered.length && <div className="empty-company"><h3>No users found</h3><p>Invite your first Employee or Client.</p><button className="btn" onClick={() => setOpen('create')}>Add user</button></div>}
      </div>
    </div>

    {open && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
      <div className="modal">
        <div className="modal-head"><div><p className="eyebrow">User management</p><h2>{open === 'create' ? 'Invite user' : open === 'edit' ? 'Edit user' : 'Folder permissions'}</h2></div><button className="close-btn" onClick={close}><X size={18}/></button></div>

        {(open === 'create' || open === 'edit') && <form onSubmit={open === 'create' ? create : saveEdit}>
          <label>Full name<input value={form.name} onChange={e => setForm({...form,name:e.target.value})} required /></label>
          <label>Email<input type="email" autoComplete="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} required disabled={open === 'edit'} /></label>
          <p className="muted" style={{marginTop:4}}>The invitation is sent to this email. The user must open it and set a password before the account becomes active.</p><label>Role<select value={form.role} onChange={e => setForm({...form,role:e.target.value})}><option value="EMPLOYEE">Employee</option><option value="CLIENT">Client</option></select></label>
          <label className="checkline"><input type="checkbox" checked={form.personalFolderAllowed} onChange={e => setForm({...form,personalFolderAllowed:e.target.checked})}/> Allow personal folder</label>
          <div className="modal-actions"><button type="button" className="btn secondary" onClick={close}>Cancel</button><button className="btn">{open === 'create' ? 'Send invitation' : 'Save changes'}</button></div>
        </form>}

        {open === 'permissions' && <div>
          <p className="muted">Choose company folders this user can access. Resource permissions are enforced by the API.</p>
          <div className="permission-list">
            {folders.filter((f:any) => f.ownerId !== selected?.id).map((f:any) => {
              const p = folderPermissions[f.id];
              return <div className="permission-row" key={f.id}>
                <label className="checkline"><input type="checkbox" checked={!!p} onChange={() => toggleFolder(f.id)}/><strong>{f.name}</strong></label>
                {p && <div className="permission-checks">
                  {(['canView','canDownload','canUpload','canEdit','canDelete','canShare'] as const).map(k => <label className="tiny-check" key={k}><input type="checkbox" checked={p[k]} onChange={e => setFolderPermissions({...folderPermissions,[f.id]:{...p,[k]:e.target.checked}})}/>{k.replace('can','')}</label>)}
                </div>}
              </div>;
            })}
          </div>
          <div className="modal-actions"><button className="btn secondary" onClick={close}>Cancel</button><button className="btn" onClick={savePermissions}>Save permissions</button></div>
        </div>}
      </div>
    </div>}
  </>;
}
