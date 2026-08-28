import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import {
  Check,
  Copy,
  Edit3,
  KeyRound,
  Mail,
  Shield,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

type User = {
  id: string;
  email: string;
  uniqueName: string;
  role: string;
  status: string;
  emailVerifiedAt?: string | null;
  personalFolderAllowed: boolean;
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

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [folders, setFolders] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  const [open, setOpen] = useState<
    "create" | "edit" | "permissions" | null
  >(null);

  const [selected, setSelected] = useState<User | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "EMPLOYEE",
    personalFolderAllowed: true,
  });

  const [folderPermissions, setFolderPermissions] = useState<
    Record<string, FolderPermission>
  >({});

  const [invitationUrl, setInvitationUrl] = useState("");

  // Custom role dropdown state
  const [roleOpen, setRoleOpen] = useState(false);

  async function load() {
    try {
      setErr("");

      const [u, m, f] = await Promise.all([
        api("/users"),
        api("/users/meta").catch(() => null),
        api("/folders"),
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

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        const q = query.toLowerCase().trim();

        return (
          !q ||
          u.uniqueName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
        );
      }),
    [users, query],
  );

  function close() {
    setOpen(null);
    setSelected(null);
    setInvitationUrl("");
    setRoleOpen(false);
  }

  async function create(e: FormEvent) {
    e.preventDefault();

    try {
      const d = await api("/users", {
        method: "POST",
        body: JSON.stringify(form),
      });

      setInvitationUrl(d.invitationUrl || "");
      setNotice("Invitation created successfully.");
      setOpen(null);
      setRoleOpen(false);

      await load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();

    if (!selected) return;

    try {
      await api(`/users/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });

      setNotice("User updated.");
      close();

      await load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function toggleStatus(u: User) {
    try {
      await api(`/users/${u.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
        }),
      });

      await load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function remove(u: User) {
    if (
      !confirm(
        `Remove ${u.uniqueName} from this company? This cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await api(`/users/${u.id}`, {
        method: "DELETE",
      });

      await load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function resend(u: User) {
    try {
      const d = await api(`/users/${u.id}/resend-invitation`, {
        method: "POST",
      });

      setInvitationUrl(d.invitationUrl || "");
      setNotice("Invitation resent.");
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function openPermissions(u: User) {
    try {
      const current = await api(`/users/${u.id}/permissions`);

      const map: Record<string, FolderPermission> = {};

      (current || []).forEach((s: any) => {
        if (s.folderId) {
          map[s.folderId] = {
            folderId: s.folderId,
            canView: s.canView,
            canDownload: s.canDownload,
            canUpload: s.canUpload,
            canEdit: s.canEdit,
            canDelete: s.canDelete,
            canShare: s.canShare,
          };
        }
      });

      setFolderPermissions(map);
      setSelected(u);
      setRoleOpen(false);
      setOpen("permissions");
    } catch (e: any) {
      setErr(e.message);
    }
  }

  function toggleFolder(folderId: string) {
    setFolderPermissions((prev) => {
      const exists = prev[folderId];

      if (exists) {
        const next = { ...prev };
        delete next[folderId];
        return next;
      }

      return {
        ...prev,
        [folderId]: {
          folderId,
          canView: true,
          canDownload: true,
          canUpload: false,
          canEdit: false,
          canDelete: false,
          canShare: false,
        },
      };
    });
  }

  async function savePermissions() {
    if (!selected) return;

    try {
      await api(`/users/${selected.id}/permissions`, {
        method: "PUT",
        body: JSON.stringify({
          folders: Object.values(folderPermissions),
        }),
      });

      setNotice("Folder access updated.");
      close();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  function formatRole(role: string): string {
    const roles: Record<string, string> = {
      SUPER_ADMIN: "Super Admin",
      COMPANY_ADMIN: "Admin",
      EMPLOYEE: "Employee",
      CLIENT: "Client",
    };
  
    return roles[role] || role;
  }

  return (
    <>
      {/* PAGE HEADER */}
      <div className="page-head">
        <div>
          <p className="eyebrow">Administration</p>

          <h1>User Management</h1>

          <p>
            Invite, manage and control access for Employees and Clients.
          </p>
        </div>

        <button
          className="btn"
          onClick={() => {
            setForm({
              name: "",
              email: "",
              role: "EMPLOYEE",
              personalFolderAllowed: true,
            });

            setRoleOpen(false);
            setOpen("create");
          }}
        >
          <UserPlus size={16} />

          Add user
        </button>
      </div>

      {/* ERROR */}
      {err && (
        <div
          className="error"
          style={{ marginBottom: 16 }}
        >
          {err}
        </div>
      )}

      {/* SUCCESS */}
      {notice && (
        <div
          className="success"
          style={{ marginBottom: 16 }}
        >
          {notice}{" "}

          {invitationUrl && (
            <button
              className="link-button"
              onClick={() =>
                navigator.clipboard.writeText(invitationUrl)
              }
            >
              <Copy size={14} />

              Copy invitation link
            </button>
          )}
        </div>
      )}

      {/* STATS */}
      <div className="cards">
        <div className="stat">
          <span>Purchased seats</span>

          <strong>
            {meta?.purchasedSeats ?? "—"}
          </strong>
        </div>

        <div className="stat">
          <span>Used seats</span>

          <strong>
            {meta?.usedSeats ?? users.length}
          </strong>
        </div>

        <div className="stat">
          <span>Remaining</span>

          <strong>
            {meta?.remainingSeats ?? "—"}
          </strong>
        </div>

        <div className="stat">
          <span>Storage allocation</span>

          <strong>
            {meta?.storageGb ?? "—"} GB
          </strong>
        </div>
      </div>

      {/* USERS TABLE */}
      <div className="panel">
        <div className="company-toolbar">
          <div className="company-search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users, emails or roles..."
            />
          </div>

          <button
            className="btn secondary"
            onClick={load}
          >
            Refresh
          </button>
        </div>

        <div className="company-table-wrap">
          <table className="company-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Files</th>
                <th>Personal folder</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.uniqueName}</strong>

                    <small
                      style={{
                        display: "block",
                        color: "#7b8799",
                      }}
                    >
                      {u.email}
                    </small>
                  </td>

                  <td>{formatRole(u.role)}</td>

                  <td>
                    <span
                      className={`status-pill ${u.status.toLowerCase()}`}
                    >
                      {u.status}
                    </span>
                  </td>

                  <td>
                    {u._count?.ownedFiles ?? 0}
                  </td>

                  <td>
                    {u.personalFolderAllowed
                      ? "Allowed"
                      : "Disabled"}
                  </td>

                  <td>
                    <div className="row-actions">
                      {/* EDIT */}
                      <button
                        className="icon-btn"
                        title="Edit"
                        onClick={() => {
                          setSelected(u);

                          setForm({
                            name: u.uniqueName,
                            email: u.email,
                            role: u.role,
                            personalFolderAllowed:
                              u.personalFolderAllowed,
                          });

                          setRoleOpen(false);
                          setOpen("edit");
                        }}
                      >
                        <Edit3 size={15} />
                      </button>

                      {/* PERMISSIONS */}
                      <button
                        className="icon-btn"
                        title="Folder permissions"
                        onClick={() =>
                          openPermissions(u)
                        }
                      >
                        <Shield size={15} />
                      </button>

                      {/* RESEND INVITATION */}
                      {u.status === "INVITED" && (
                        <button
                          className="icon-btn"
                          title="Resend invitation"
                          onClick={() =>
                            resend(u)
                          }
                        >
                          <Mail size={15} />
                        </button>
                      )}

                      {/* STATUS */}
                      <button
                        className="icon-btn"
                        title={
                          u.status === "ACTIVE"
                            ? "Suspend"
                            : "Activate"
                        }
                        onClick={() =>
                          toggleStatus(u)
                        }
                      >
                        <KeyRound size={15} />
                      </button>

                      {/* DELETE */}
                      <button
                        className="icon-btn danger"
                        title="Remove"
                        onClick={() =>
                          remove(u)
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!filtered.length && (
            <div className="empty-company">
              <h3>No users found</h3>

              <p>
                Invite your first Employee or Client.
              </p>

              <button
                className="btn"
                onClick={() => {
                  setForm({
                    name: "",
                    email: "",
                    role: "EMPLOYEE",
                    personalFolderAllowed: true,
                  });

                  setRoleOpen(false);
                  setOpen("create");
                }}
              >
                Add user
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      {open && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              close();
            }
          }}
        >
          <div className="modal">
            {/* MODAL HEADER */}
            <div className="modal-head">
              <div>
                <p className="eyebrow">
                  User management
                </p>

                <h2>
                  {open === "create"
                    ? "Invite user"
                    : open === "edit"
                      ? "Edit user"
                      : "Folder permissions"}
                </h2>
              </div>

              <button
                type="button"
                className="cursor-pointer"
                onClick={close}
              >
                <div className="rounded-lg bg-gray-200 p-1">
                  <X size={18} />
                </div>
              </button>
            </div>

            {/* CREATE / EDIT */}
            {(open === "create" ||
              open === "edit") && (
              <form
                onSubmit={
                  open === "create"
                    ? create
                    : saveEdit
                }
              >
                {/* FULL NAME */}
                <label>
                  Full name

                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        name: e.target.value,
                      })
                    }
                    required
                  />
                </label>

                {/* EMAIL */}
                <label>
                  Email

                  <input
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        email: e.target.value,
                      })
                    }
                    required
                    disabled={open === "edit"}
                  />
                </label>

                <p
                  className="muted"
                  style={{ marginTop: 4 }}
                >
                  The invitation is sent to this email.
                  The user must open it and set a password
                  before the account becomes active.
                </p>

                {/* CUSTOM ROLE DROPDOWN */}
                <div className="mt-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-gray-700">
                      Role
                    </span>

                    <div className="relative">
                      {/* DROPDOWN BUTTON */}
                      <button
                        type="button"
                        onClick={() =>
                          setRoleOpen(
                            (prev) => !prev,
                          )
                        }
                        className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left text-sm text-gray-900 outline-none transition-all duration-150 hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        aria-haspopup="listbox"
                        aria-expanded={roleOpen}
                      >
                        <span>
                          {form.role ===
                          "EMPLOYEE"
                            ? "Employee"
                            : "Client"}
                        </span>

                        <svg
                          className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                            roleOpen
                              ? "rotate-180"
                              : ""
                          }`}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-.02 1.06l.02 1.06z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>

                      {/* DROPDOWN PANEL */}
                      {roleOpen && (
                        <div
                          className="absolute left-0 right-0 z-[100] mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white p-1 shadow-xl ring-1 ring-black/5"
                          role="listbox"
                        >
                          {/* EMPLOYEE */}
                          <button
                            type="button"
                            role="option"
                            aria-selected={
                              form.role ===
                              "EMPLOYEE"
                            }
                            onClick={() => {
                              setForm({
                                ...form,
                                role: "EMPLOYEE",
                              });

                              setRoleOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                              form.role ===
                              "EMPLOYEE"
                                ? "bg-gray-100 font-medium text-gray-900"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <span>
                              Employee
                            </span>

                            {form.role ===
                              "EMPLOYEE" && (
                              <Check
                                size={16}
                                className="text-gray-700"
                              />
                            )}
                          </button>

                          {/* CLIENT */}
                          <button
                            type="button"
                            role="option"
                            aria-selected={
                              form.role ===
                              "CLIENT"
                            }
                            onClick={() => {
                              setForm({
                                ...form,
                                role: "CLIENT",
                              });

                              setRoleOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                              form.role ===
                              "CLIENT"
                                ? "bg-gray-100 font-medium text-gray-900"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <span>
                              Client
                            </span>

                            {form.role ===
                              "CLIENT" && (
                              <Check
                                size={16}
                                className="text-gray-700"
                              />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </label>
                </div>

                {/* PERSONAL FOLDER */}
                <label className="checkline">
                  <input
                    type="checkbox"
                    checked={
                      form.personalFolderAllowed
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        personalFolderAllowed:
                          e.target.checked,
                      })
                    }
                  />

                  Allow personal folder
                </label>

                {/* FORM ACTIONS */}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={close}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="btn"
                  >
                    {open === "create"
                      ? "Send invitation"
                      : "Save changes"}
                  </button>
                </div>
              </form>
            )}

            {/* FOLDER PERMISSIONS */}
            {open === "permissions" && (
              <div>
                <p className="muted">
                  Choose company folders this user
                  can access. Resource permissions are
                  enforced by the API.
                </p>

                <div className="permission-list">
                  {folders
                    .filter(
                      (f: any) =>
                        f.ownerId !==
                        selected?.id,
                    )
                    .map((f: any) => {
                      const p =
                        folderPermissions[f.id];

                      return (
                        <div
                          className="permission-row"
                          key={f.id}
                        >
                          <label className="checkline">
                            <input
                              type="checkbox"
                              checked={!!p}
                              onChange={() =>
                                toggleFolder(
                                  f.id,
                                )
                              }
                            />

                            <strong>
                              {f.name}
                            </strong>
                          </label>

                          {p && (
                            <div className="permission-checks">
                              {(
                                [
                                  "canView",
                                  "canDownload",
                                  "canUpload",
                                  "canEdit",
                                  "canDelete",
                                  "canShare",
                                ] as const
                              ).map((k) => (
                                <label
                                  className="tiny-check"
                                  key={k}
                                >
                                  <input
                                    type="checkbox"
                                    checked={p[k]}
                                    onChange={(e) =>
                                      setFolderPermissions(
                                        {
                                          ...folderPermissions,
                                          [f.id]: {
                                            ...p,
                                            [k]:
                                              e.target
                                                .checked,
                                          },
                                        },
                                      )
                                    }
                                  />

                                  {k.replace(
                                    "can",
                                    "",
                                  )}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* PERMISSION ACTIONS */}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={close}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn"
                    onClick={savePermissions}
                  >
                    Save permissions
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}