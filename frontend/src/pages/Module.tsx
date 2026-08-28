import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, directUpload } from "../lib/api";
import { jpegPagesToPdfBlob } from "../utils/jpegPdf";
import {
  Check,
  Trash2,
  RefreshCw,
  Send,
  RotateCcw,
  ShieldCheck,
  Clock,
  FileUp,
  X,
  ScanLine,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const META: any = {
  shared: ["Shared", "Manage resources shared with you or by you."],
  requests: [
    "Requests",
    "Request a file or folder by name from the person who controls it.",
  ],
  approvals: [
    "Approvals",
    "Review incoming requests and fulfill them with the correct file or folder.",
  ],
  "task-management": [
    "Task Management",
    "Assign, track and complete work with page-level instructions.",
  ],
  trash: ["Trash", "Recover deleted files and folders for 30 days."],
  chat: ["Chat", "Company-scoped secure messaging."],
  "scan-documents": [
    "Scan Documents",
    "Connect the Windows scanner bridge, scan as many pages as you need, combine them into one PDF, name it, and save it privately.",
  ],
  "fax-documents": [
    "Fax Documents",
    "Receive faxes on your personal SecureFile number and send documents to any fax number.",
  ],
  ai: ["AI Chat Bot", "Ask the configured SecureFile assistant."],
  settings: ["Settings", "Review company and subscription settings."],
};

export default function Module() {
  const { name = "shared" } = useParams();
  const [features, setFeatures] = useState<any>({});
  const [data, setData] = useState<any[]>([]),
    [users, setUsers] = useState<any[]>([]),
    [err, setErr] = useState(""),
    [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const title = META[name]?.[0] || name;
  const desc = META[name]?.[1] || "Workspace module";
  useEffect(() => {
    api("/companies/me")
      .then((c: any) => setFeatures(c.subscription?.addons || {}))
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [name, refresh]);
  async function load() {
    try {
      setErr("");
      if (
        ["requests", "approvals", "task-management", "chat"].includes(
          name || "",
        )
      )
        setUsers(await api("/users"));
      const endpoint: any = {
        shared: "/sharing",
        requests: "/workspace/requests",
        approvals: "/workspace/approvals",
        "task-management": "/workspace/tasks",
        chat: "/workspace/messages",
      }[name || ""];
      if (endpoint) setData(await api(endpoint));
    } catch (e: any) {
      setErr(e.message);
    }
  }
  async function action(path: string, method = "POST", body?: any) {
    try {
      await api(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      setNotice("Updated successfully.");
      setRefresh((x) => x + 1);
    } catch (e: any) {
      setErr(e.message);
    }
  }
  const gated =
    (name === "scan-documents" && !features.scanner) ||
    (name === "fax-documents" && !features.fax);
  if (gated)
    return (
      <>
        <div className="page-head">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1>{title}</h1>
            <p>{desc}</p>
          </div>
        </div>
        <div className="panel">
          <h2>Feature not included in your plan</h2>
          <p className="muted">
            This module is hidden from your workspace because the required
            add-on is not included in your current SecureFile subscription.
          </p>
        </div>
      </>
    );
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>{title}</h1>
          <p>{desc}</p>
        </div>
        <button
          className="btn secondary"
          onClick={() => setRefresh((x) => x + 1)}
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      {err && (
        <div className="error" style={{ marginBottom: 16 }}>
          {err}
        </div>
      )}
      {notice && (
        <div className="success" style={{ marginBottom: 16 }}>
          {notice}
        </div>
      )}
      {name === "requests" && (
        <Requests
          data={data}
          users={users}
          refresh={() => setRefresh((x) => x + 1)}
          setErr={setErr}
        />
      )}{" "}
      {name === "approvals" && (
        <Approvals
          data={data}
          refresh={() => setRefresh((x) => x + 1)}
          setErr={setErr}
        />
      )}{" "}
      {name === "task-management" && (
        <Tasks
          data={data}
          users={users}
          refresh={() => setRefresh((x) => x + 1)}
          setErr={setErr}
        />
      )}{" "}
      {name === "trash" && (
        <Trash refresh={() => setRefresh((x) => x + 1)} setErr={setErr} />
      )}{" "}
      {name === "shared" && (
        <Shared
          data={data}
          refresh={() => setRefresh((x) => x + 1)}
          setErr={setErr}
        />
      )}{" "}
      {name === "chat" && <Chat users={users} />}{" "}
      {name === "scan-documents" && (
        <UploadModule kind="scan" setErr={setErr} />
      )}{" "}
      {name === "fax-documents" && <UploadModule kind="fax" setErr={setErr} />}{" "}
      {name === "ai" && <AI setErr={setErr} />}{" "}
      {name === "settings" && <Settings />}
    </>
  );
}

function Requests({ data, users, refresh, setErr }: any) {
  const [type, setType] = useState("FILE"),
    [name, setName] = useState(""),
    [approver, setApprover] = useState(""),
    [note, setNote] = useState(""),
    [download, setDownload] = useState(false);
  const me = localStorage.getItem("sf_user_id");
  async function submit() {
    try {
      await api("/workspace/requests", {
        method: "POST",
        body: JSON.stringify({
          requestedType: type,
          requestedName: name,
          targetUserId: approver,
          note,
          canDownload: download,
        }),
      });
      setName("");
      setApprover("");
      setNote("");
      setDownload(false);
      refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <div className="grid2">
      <div className="panel">
        <h2>Request access</h2>
        <p className="muted">
          You do not need to choose a file you already have. Tell the person
          what you need; they will select the actual resource when approving.
        </p>
        <label>
          Requested item type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="FILE">File</option>
            <option value="FOLDER">Folder</option>
          </select>
        </label>
        <label>
          File / folder name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. March Claims Report.pdf"
          />
        </label>
        <label>
          Send request to
          <select
            value={approver}
            onChange={(e) => setApprover(e.target.value)}
          >
            <option value="">Select authorized person</option>
            {users
              .filter((u: any) => u.id !== me && u.status === "ACTIVE")
              .map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.uniqueName} — {u.role}
                </option>
              ))}
          </select>
        </label>
        <label>
          Why do you need it?
          <textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Explain what you need and why."
          />
        </label>
        <label className="checkline">
          <input
            type="checkbox"
            checked={download}
            onChange={(e) => setDownload(e.target.checked)}
          />{" "}
          Request download permission too
        </label>
        <button
          className="btn"
          disabled={!name.trim() || !approver}
          onClick={submit}
        >
          Submit request
        </button>
      </div>
      <div className="panel">
        <h2>My requests</h2>
        <p className="muted">
          Only requests you submitted. You cannot approve your own requests.
        </p>
        <table>
          <thead>
            <tr>
              <th>Requested</th>
              <th>Approver</th>
              <th>Access</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.map((x: any) => (
              <tr key={x.id}>
                <td>
                  <b>{x.requestedName}</b>
                  <small className="table-sub">{x.requestedType}</small>
                </td>
                <td>
                  {x.targetUser?.uniqueName || x.targetUser?.email || "—"}
                </td>
                <td>{x.canDownload ? "View + Download" : "View"}</td>
                <td>
                  <span
                    className={`status-pill ${x.status === "APPROVED" ? "active" : x.status === "REJECTED" ? "danger" : ""}`}
                  >
                    {x.status}
                  </span>
                </td>
                <td>
                  {x.status === "PENDING" && (
                    <button
                      className="icon-btn danger"
                      title="Delete request"
                      onClick={async () => {
                        if (confirm("Delete this pending request?")) {
                          try {
                            await api("/workspace/requests/" + x.id, {
                              method: "DELETE",
                            });
                            refresh();
                          } catch (e: any) {
                            setErr(e.message);
                          }
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!data.length && (
              <tr>
                <td colSpan={5} className="muted">
                  No requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Approvals({ data, refresh, setErr }: any) {
  const [open, setOpen] = useState<any>(null),
    [resources, setResources] = useState<any[]>([]),
    [q, setQ] = useState("");
  async function select(a: any) {
    setOpen(a);
    try {
      setResources(
        await api(
          "/workspace/approvals/" +
            a.id +
            "/resources?q=" +
            encodeURIComponent(a.accessRequest?.requestedName || ""),
        ),
      );
    } catch (e: any) {
      setErr(e.message);
    }
  }
  async function resolve(status: string, r?: any) {
    try {
      await api("/workspace/approvals/" + open.id, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          fileId: r?.type === "FILE" ? r.id : undefined,
          folderId: r?.type === "FOLDER" ? r.id : undefined,
        }),
      });
      setOpen(null);
      refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <div className="panel">
      <h2>Incoming approval requests</h2>
      <p className="muted">
        Only requests assigned to you appear here. The requester never gets
        approval controls.
      </p>
      <table>
        <thead>
          <tr>
            <th>Requester</th>
            <th>Requested item</th>
            <th>Reason</th>
            <th>Access</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {data.map((a: any) => (
            <tr key={a.id}>
              <td>
                <b>{a.requester?.uniqueName}</b>
                <small className="table-sub">{a.requester?.email}</small>
              </td>
              <td>
                <b>{a.accessRequest?.requestedName}</b>
                <small className="table-sub">
                  {a.accessRequest?.requestedType}
                </small>
              </td>
              <td>{a.note || "—"}</td>
              <td>{a.canDownload ? "View + Download" : "View"}</td>
              <td>{a.status}</td>
              <td>
                {a.status === "PENDING" ? (
                  <button className="btn small" onClick={() => select(a)}>
                    <ShieldCheck size={13} /> Review
                  </button>
                ) : (
                  <span className="muted">Resolved</span>
                )}
              </td>
            </tr>
          ))}
          {!data.length && (
            <tr>
              <td colSpan={6} className="muted">
                No pending requests.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {open && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-head">
              <div>
                <p className="eyebrow">Approval</p>
                <h2>Fulfill request</h2>
                <p className="muted">
                  Requester asked for:{" "}
                  <b>{open.accessRequest?.requestedName}</b>
                </p>
              </div>
              <button className="close-btn" onClick={() => setOpen(null)}>
                <X size={18} />
              </button>
            </div>
            <label>
              Search actual resource
              <input
                value={q}
                onChange={async (e) => {
                  setQ(e.target.value);
                  try {
                    setResources(
                      await api(
                        "/workspace/approvals/" +
                          open.id +
                          "/resources?q=" +
                          encodeURIComponent(e.target.value),
                      ),
                    );
                  } catch {}
                }}
                placeholder="Search files/folders you control"
              />
            </label>
            <div className="data" style={{ maxHeight: 240 }}>
              {resources.map((r) => (
                <button
                  key={r.type + r.id}
                  className="link-button"
                  style={{ display: "block", padding: "10px 0", width: "100%" }}
                  onClick={() => resolve("APPROVED", r)}
                >
                  {r.name} <small>({r.type})</small>
                </button>
              ))}
              {!resources.length && (
                <span className="muted">
                  No matching resources you are authorized to share.
                </span>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setOpen(null)}>
                Cancel
              </button>
              <button
                className="btn secondary"
                onClick={() => resolve("REJECTED")}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tasks({ data, users, refresh, setErr }: any) {
  const [assignee, setAssignee] = useState(""),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [resourceType, setResourceType] = useState("FILE"),
    [resourceId, setResourceId] = useState(""),
    [resources, setResources] = useState<any[]>([]),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [priority, setPriority] = useState("MEDIUM"),
    [dueAt, setDueAt] = useState("");
  const admin = localStorage.getItem("sf_role") === "COMPANY_ADMIN";
  useEffect(() => {
    if (admin)
      Promise.all([api("/files"), api("/folders")])
        .then(([f, fo]) =>
          setResources([
            ...(f || []).map((x: any) => ({ ...x, type: "FILE" })),
            ...(fo || []).map((x: any) => ({ ...x, type: "FOLDER" })),
          ]),
        )
        .catch(() => {});
  }, [admin]);
  async function create() {
    try {
      await api("/workspace/tasks", {
        method: "POST",
        body: JSON.stringify({
          assigneeId: assignee,
          title,
          description,
          fileId:
            resourceType === "FILE" && resourceId ? resourceId : undefined,
          folderId:
            resourceType === "FOLDER" && resourceId ? resourceId : undefined,
          startPage: resourceType === "FILE" && start ? +start : undefined,
          endPage: resourceType === "FILE" && end ? +end : undefined,
          priority,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        }),
      });
      setTitle("");
      setDescription("");
      setResourceId("");
      setStart("");
      setEnd("");
      setDueAt("");
      refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }
  async function status(id: string, status: string) {
    try {
      await api("/workspace/tasks/" + id + "/status", {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <div className="grid2">
      <div className="panel">
        {admin ? (
          <>
            <h2>Assign task</h2>
            <label>
              Assignee
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              >
                <option value="">Select employee/client</option>
                {users
                  .filter(
                    (u: any) => u.role === "EMPLOYEE" || u.role === "CLIENT",
                  )
                  .map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.uniqueName} — {u.email}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Task title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Review contract pages"
              />
            </label>
            <label>
              Instructions
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe exactly what needs to be done."
              />
            </label>
            <div className="grid2">
              <label>
                Resource type
                <select
                  value={resourceType}
                  onChange={(e) => {
                    setResourceType(e.target.value);
                    setResourceId("");
                    if (e.target.value === "FOLDER") {
                      setStart("");
                      setEnd("");
                    }
                  }}
                >
                  <option value="FILE">File</option>
                  <option value="FOLDER">Folder</option>
                </select>
              </label>
              <label>
                {resourceType === "FILE" ? "File" : "Folder"}
                <select
                  value={resourceId}
                  onChange={(e) => setResourceId(e.target.value)}
                >
                  <option value="">Select {resourceType.toLowerCase()}</option>
                  {resources
                    .filter((r: any) => r.type === resourceType)
                    .map((r: any) => (
                      <option key={r.type + r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="grid2">
              <label>
                Start page
                <input
                  type="number"
                  min="1"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                End page
                <input
                  type="number"
                  min="1"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>
            <div className="grid2">
              <label>
                Priority
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {["LOW", "MEDIUM", "HIGH", "URGENT"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Due date/time
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                />
              </label>
            </div>
            <button
              className="btn"
              disabled={!assignee || !title}
              onClick={create}
            >
              Assign task
            </button>
          </>
        ) : (
          <>
            <h2>My assigned work</h2>
            <p className="muted">
              Only the person assigned the task can update its status.
            </p>
          </>
        )}
      </div>
      <div className="panel">
        <h2>{admin ? "Task queue" : "My tasks"}</h2>
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Resource</th>
              <th>Pages</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {data.map((t: any) => (
              <tr key={t.id}>
                <td>
                  <b>{t.title}</b>
                  <small className="table-sub">{t.assignee?.uniqueName}</small>
                </td>
                <td>{t.file?.name || t.folder?.name || "—"}</td>
                <td>
                  {t.startPage || t.endPage
                    ? `${t.startPage || 1}–${t.endPage || "end"}`
                    : "All"}
                </td>
                <td>{t.priority}</td>
                <td>
                  {admin ? (
                    <span className="status-pill">{t.status}</span>
                  ) : (
                    <select
                      value={t.status}
                      onChange={(e) => status(t.id, e.target.value)}
                    >
                      {[
                        "PENDING",
                        "STARTED",
                        "PARTIALLY_COMPLETED",
                        "COMPLETED",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td>
                  {t.dueAt ? new Date(t.dueAt).toLocaleString() : "No deadline"}
                </td>
              </tr>
            ))}
            {!data.length && (
              <tr>
                <td colSpan={6} className="muted">
                  No active tasks.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Trash({ refresh, setErr }: any) {
  const [data, setData] = useState<any>({ files: [], folders: [] });
  async function load() {
    try {
      setData(await api("/trash"));
    } catch (e: any) {
      setErr(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [refresh]);
  async function restore(x: any) {
    try {
      await api(`/trash/${x.type}/${x.id}/restore`);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }
  async function perm(x: any) {
    if (!confirm(`Permanently delete ${x.name}? This cannot be undone.`))
      return;
    try {
      await api(`/trash/${x.type}/${x.id}`, { method: "DELETE" });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }
  const rows = [...data.files, ...data.folders];
  return (
    <div className="panel">
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>Trash</h2>
          <p className="muted">
            Deleted files and folders remain recoverable for 30 days.
          </p>
        </div>
        <button className="btn secondary" onClick={load}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Deleted</th>
            <th>Expires</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x: any) => (
            <tr key={x.type + x.id}>
              <td>
                <b>{x.name}</b>
              </td>
              <td>{x.type}</td>
              <td>
                {x.deletedAt ? new Date(x.deletedAt).toLocaleString() : "—"}
              </td>
              <td>
                {x.deletedAt
                  ? new Date(
                      new Date(x.deletedAt).getTime() + 30 * 86400000,
                    ).toLocaleDateString()
                  : "—"}
              </td>
              <td>
                <div className="row-actions">
                  <button className="btn small" onClick={() => restore(x)}>
                    <RotateCcw size={13} /> Restore
                  </button>
                  <button
                    className="icon-btn danger"
                    title="Delete permanently"
                    onClick={() => perm(x)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={5} className="muted">
                Trash is empty.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Shared({ data, refresh, setErr }: any) {
  const me = localStorage.getItem("sf_user_id");
  async function update(id: string, key: string, value: boolean) {
    try {
      await api(`/sharing/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      });
      refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }
  async function remove(id: string) {
    if (
      !confirm("Remove this share? The recipient will immediately lose access.")
    )
      return;
    try {
      await api(`/sharing/${id}`, { method: "DELETE" });
      refresh();
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <div className="panel">
      <h2>Shared resources</h2>
      <p className="muted">
        Manage resources shared with you or by you. Owners can change
        permissions or revoke access.
      </p>
      <table>
        <thead>
          <tr>
            <th>Resource</th>
            <th>Shared by</th>
            <th>Shared with</th>
            <th>Permissions</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {data.map((s: any) => {
            const mine = Boolean(s.manageable);
            return (
              <tr key={s.id}>
                <td>
                  <b>{s.file?.name || s.folder?.name || "Resource"}</b>
                  <small className="table-sub">{s.type}</small>
                </td>
                <td>{s.owner?.uniqueName || s.owner?.email || "—"}</td>
                <td>
                  {s.recipient?.uniqueName ||
                    s.recipient?.email ||
                    "Public link"}
                </td>
                <td>
                  {mine ? (
                    <div className="share-perms">
                      {[
                        ["canView", "View"],
                        ["canDownload", "Download"],
                        ["canUpload", "Upload"],
                        ["canEdit", "Edit"],
                        ["canDelete", "Delete"],
                        ["canShare", "Re-share"],
                      ].map(([key, label]: any) => (
                        <label className="checkline" key={key}>
                          <input
                            type="checkbox"
                            checked={!!s[key]}
                            onChange={(e) =>
                              update(s.id, key, e.target.checked)
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <span className="muted">
                      {s.canView ? "View " : ""}
                      {s.canDownload ? "Download " : ""}
                      {s.canUpload ? "Upload " : ""}
                      {s.canEdit ? "Edit " : ""}
                      {s.canDelete ? "Delete " : ""}
                      {s.canShare ? "Re-share" : ""}
                    </span>
                  )}
                </td>
                <td>
                  {mine ? (
                    <button
                      className="icon-btn danger"
                      title="Revoke access"
                      onClick={() => remove(s.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
          {!data.length && (
            <tr>
              <td colSpan={5} className="muted">
                No shared resources yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SimpleTable({ title, data }: any) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      <table>
        <tbody>
          {data.map((x: any) => (
            <tr key={x.id}>
              <td>{x.file?.name || x.folder?.name || x.name || x.id}</td>
              <td>{x.recipient?.uniqueName || x.type || ""}</td>
            </tr>
          ))}
          {!data.length && (
            <tr>
              <td className="muted">Nothing to show.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function UploadModule({ kind, setErr }: any) {
  if (kind === "fax") return <FaxUpload setErr={setErr} />;
  return <ScannerModule setErr={setErr} />;
}

function FaxUpload({ setErr }: any) {
  const [line, setLine] = useState<any>(null),
    [jobs, setJobs] = useState<any[]>([]),
    [files, setFiles] = useState<any[]>([]),
    [to, setTo] = useState(""),
    [header, setHeader] = useState(""),
    [fileId, setFileId] = useState(""),
    [uploadFile, setUploadFile] = useState<File | null>(null),
    [mode, setMode] = useState<"existing" | "upload">("existing"),
    [countryCode, setCountryCode] = useState("1"),
    [areaCode, setAreaCode] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      setLoading(true);
      const [fax, fileList] = await Promise.all([api("/fax"), api("/files")]);
      setLine(fax.line);
      setJobs(fax.jobs || []);
      setFiles((fileList || []).filter((f: any) => !f.deletedAt));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function provision() {
    try {
      setBusy(true);
      await api("/fax/number/provision", {
        method: "POST",
        body: JSON.stringify({
          countryCode: +countryCode,
          areaCode: +areaCode,
        }),
      });
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    try {
      if (!to.trim()) return setErr("Enter the destination fax number.");
      if (mode === "existing" && !fileId)
        return setErr("Choose a SecureFile document.");
      if (mode === "upload" && !uploadFile)
        return setErr("Choose a document to fax.");
      setBusy(true);
      if (mode === "existing") {
        await api("/fax/send", {
          method: "POST",
          body: JSON.stringify({ to: to.trim(), fileId, headerText: header }),
        });
      } else {
        const uploaded = await directUpload(uploadFile!, { source: "UPLOAD" });
        await api("/fax/send", {
          method: "POST",
          body: JSON.stringify({
            to: to.trim(),
            fileId: uploaded.id,
            headerText: header,
          }),
        });
      }
      setTo("");
      setHeader("");
      setFileId("");
      setUploadFile(null);
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="panel">
        <p className="muted">Loading your fax workspace...</p>
      </div>
    );
  return (
    <div className="grid2">
      <div>
        <div className="panel">
          <h2>My personal fax number</h2>
          <p className="muted">
            This number belongs only to your SecureFile user. Incoming faxes to
            this number are saved privately to your account and are not visible
            to other users unless you share them.
          </p>
          {line?.phoneNumber ? (
            <div
              className="data"
              style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1 }}
            >
              {line.phoneNumber}
            </div>
          ) : (
            <>
              <div className="grid2">
                <label>
                  Country code
                  <input
                    value={countryCode}
                    onChange={(e) =>
                      setCountryCode(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="1"
                  />
                </label>
                <label>
                  Area code
                  <input
                    value={areaCode}
                    onChange={(e) =>
                      setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))
                    }
                    placeholder="e.g. 212"
                  />
                </label>
              </div>
              <button
                className="btn"
                disabled={busy || areaCode.length !== 3}
                onClick={provision}
              >
                {busy ? "Provisioning..." : "Get my fax number"}
              </button>
              <p className="muted" style={{ marginTop: 8 }}>
                Provisioning a real receiving number may create a provider
                charge.
              </p>
            </>
          )}
        </div>
        <div className="panel">
          <h2>Send a fax</h2>
          <label>
            Recipient fax number
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="+14155551234"
            />
          </label>
          <label>
            Header text{" "}
            <small className="muted">(optional, max 50 characters)</small>
            <input
              maxLength={50}
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              placeholder="SecureFile"
            />
          </label>
          <div className="toolbar">
            <button
              className={`btn small ${mode === "existing" ? "" : "secondary"}`}
              onClick={() => setMode("existing")}
            >
              SecureFile file
            </button>
            <button
              className={`btn small ${mode === "upload" ? "" : "secondary"}`}
              onClick={() => setMode("upload")}
            >
              Upload document
            </button>
          </div>
          {mode === "existing" ? (
            <label>
              Document
              <select
                value={fileId}
                onChange={(e) => setFileId(e.target.value)}
              >
                <option value="">Choose a file</option>
                {files.map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Document
              <input
                type="file"
                accept="application/pdf,.pdf,.doc,.docx,.jpg,.jpeg,.png,.tif,.tiff"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </label>
          )}
          <button
            className="btn"
            disabled={
              busy ||
              !line?.phoneNumber ||
              !to ||
              (mode === "existing" && !fileId) ||
              (mode === "upload" && !uploadFile)
            }
            onClick={send}
          >
            <Send size={15} />
            {busy ? "Sending..." : "Send fax"}
          </button>
          <p className="muted" style={{ marginTop: 8 }}>
            Your personal fax number is used as the caller ID when the provider
            supports it.
          </p>
        </div>
      </div>
      <div className="panel">
        <div className="toolbar" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0 }}>My fax history</h2>
            <p className="muted">
              Only your inbound and outbound fax jobs are shown here.
            </p>
          </div>
          <button className="btn secondary small" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Direction</th>
              <th>Number</th>
              <th>Document</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j: any) => (
              <tr key={j.id}>
                <td>{j.direction === "INBOUND" ? "Received" : "Sent"}</td>
                <td>
                  {j.direction === "INBOUND"
                    ? j.senderNumber || "Unknown"
                    : j.recipientNumber || "—"}
                </td>
                <td>{j.file?.name || "Fax transmission"}</td>
                <td>
                  <span
                    className={`status-pill ${j.status === "SENT" || j.status === "RECEIVED" ? "active" : j.status === "FAILED" ? "danger" : ""}`}
                  >
                    {j.status}
                  </span>
                  {j.errorMessage && (
                    <small className="table-sub">{j.errorMessage}</small>
                  )}
                </td>
                <td>{new Date(j.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {!jobs.length && (
              <tr>
                <td colSpan={5} className="muted">
                  No fax activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type ScanPage = { id: string; name: string; mimeType: string; data: string };
const SCANNER_BRIDGE = (
  import.meta.env.VITE_SCANNER_BRIDGE_URL || "http://127.0.0.1:8765"
).replace(/\/$/, "");

function ScannerModule({ setErr }: any) {
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<"ADF" | "FLATBED">("ADF");
  const [batchPages, setBatchPages] = useState(25);
  const [resolution, setResolution] = useState(300);
  const [colorMode, setColorMode] = useState("COLOR");
  const [duplex, setDuplex] = useState(false);
  const [folderId, setFolderId] = useState("");
  const [folders, setFolders] = useState<any[]>([]);
  const [pdfName, setPdfName] = useState("Scanned Document.pdf");
  const [bridgeMessage, setBridgeMessage] = useState(
    "Checking scanner bridge...",
  );

  async function checkBridge() {
    try {
      const r = await fetch(`${SCANNER_BRIDGE}/health`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!r.ok) throw new Error();
      setBridgeOk(true);
      setBridgeMessage("Scanner bridge connected");
    } catch {
      setBridgeOk(false);
      setBridgeMessage(
        "Scanner bridge not connected. Start scanner-bridge on this Windows PC.",
      );
    }
  }
  useEffect(() => {
    checkBridge();
    api("/folders")
      .then((x: any) => setFolders(Array.isArray(x) ? x : []))
      .catch(() => {});
  }, []);

  async function scan() {
    try {
      setErr("");
      setBusy(true);
      const health = await fetch(`${SCANNER_BRIDGE}/health`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!health.ok)
        throw new Error(
          "Scanner bridge is not connected. Start the SecureFile Scanner Bridge on this Windows workstation.",
        );
      setBridgeOk(true);
      setBridgeMessage("Scanner bridge connected");
      const r = await fetch(`${SCANNER_BRIDGE}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          pages:
            source === "FLATBED" ? 1 : Math.max(1, Math.min(100, batchPages)),
          resolutionDpi: resolution,
          colorMode,
          duplex: source === "ADF" && duplex,
        }),
      });
      const d: any = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Scanner failed.");
      const incoming = (d.pages || []).map((x: any) => ({
        id: crypto.randomUUID(),
        name: x.name,
        mimeType: x.mimeType || "image/jpeg",
        data: x.data,
      })) as ScanPage[];
      if (!incoming.length) throw new Error("The scanner returned no pages.");
      setPages((prev) => [...prev, ...incoming]);
      setBridgeOk(true);
      setBridgeMessage(
        `${incoming.length} page${incoming.length === 1 ? "" : "s"} scanned. ${pages.length + incoming.length} total ready.`,
      );
    } catch (e: any) {
      setErr(e.message || "Scanner failed.");
      setBridgeOk(false);
      setBridgeMessage("Scanner error. Check the scanner, driver, and bridge.");
    } finally {
      setBusy(false);
    }
  }

  function removePage(id: string) {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }
  function movePage(index: number, direction: -1 | 1) {
    setPages((prev) => {
      const next = [...prev],
        to = index + direction;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }
  function clearPages() {
    if (confirm("Remove all scanned pages from this draft?")) setPages([]);
  }

  function base64ToBlob(data: string, mime = "image/jpeg") {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  async function savePdf() {
    if (!pages.length) return;
    try {
      setSaving(true);
      setErr("");
      const name =
        (pdfName.trim() || "Scanned Document").replace(/\.pdf$/i, "") + ".pdf";
      const pdfBlob = jpegPagesToPdfBlob(pages);
      const pdfFile = new File([pdfBlob], name, { type: "application/pdf" });
      await directUpload(pdfFile, {
        folderId: folderId || undefined,
        source: "SCAN",
        name,
      });
      setPages([]);
      setPdfName("Scanned Document.pdf");
      setErr("");
      setBridgeMessage(`Saved ${name} to SecureFile.`);
    } catch (e: any) {
      setErr(e.message || "Unable to create or save PDF.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="scanner-workspace">
      <div className="panel">
        <div className="scanner-status-row">
          <div>
            <h2 style={{ marginBottom: 4 }}>Physical Scanner</h2>
            <p className="muted">
              The browser connects to the SecureFile Scanner Bridge running on
              the same Windows PC as the scanner.
            </p>
          </div>
          <span
            className={`scanner-status ${bridgeOk === true ? "ok" : bridgeOk === false ? "bad" : ""}`}
          >
            {bridgeOk === true ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
            {bridgeMessage}
          </span>
        </div>
        <div className="scanner-controls grid2">
          <label>
            Scanner source
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as any)}
            >
              <option value="ADF">ADF / Document Feeder</option>
              <option value="FLATBED">Flatbed</option>
            </select>
          </label>
          <label>
            Pages per scan batch
            <input
              type="number"
              min="1"
              max="100"
              value={batchPages}
              disabled={source === "FLATBED"}
              onChange={(e) =>
                setBatchPages(Math.max(1, Math.min(100, +e.target.value || 1)))
              }
            />
            <small className="muted">
              ADF scans up to 100 pages per batch. Use Scan More for any total
              page count.
            </small>
          </label>
          <label>
            Resolution
            <select
              value={resolution}
              onChange={(e) => setResolution(+e.target.value)}
            >
              <option value="150">150 DPI</option>
              <option value="200">200 DPI</option>
              <option value="300">300 DPI</option>
              <option value="600">600 DPI</option>
            </select>
          </label>
          <label>
            Color mode
            <select
              value={colorMode}
              onChange={(e) => setColorMode(e.target.value)}
            >
              <option value="COLOR">Color</option>
              <option value="GRAY">Grayscale</option>
              <option value="BW">Black & White</option>
            </select>
          </label>
        </div>
        {source === "ADF" && (
          <label className="checkline scanner-duplex">
            <input
              type="checkbox"
              checked={duplex}
              onChange={(e) => setDuplex(e.target.checked)}
            />{" "}
            Scan both sides (duplex) when the scanner driver supports it
          </label>
        )}
        <div className="toolbar scanner-actions">
          <button className="btn" disabled={busy || saving} onClick={scan}>
            <ScanLine size={16} />
            {busy
              ? "Scanning..."
              : pages.length
                ? "Scan More Pages"
                : "Start Scan"}
          </button>
          <button
            className="btn secondary"
            disabled={busy}
            onClick={checkBridge}
          >
            Check connection
          </button>
          <span className="muted">
            {pages.length} page{pages.length === 1 ? "" : "s"} in current PDF
          </span>
        </div>
      </div>

      <div className="panel">
        <div className="scanner-preview-head">
          <div>
            <h2>Scanned Pages</h2>
            <p className="muted">
              Review, remove, or reorder pages before creating the final PDF.
            </p>
          </div>
          {pages.length > 0 && (
            <button className="btn secondary" onClick={clearPages}>
              Clear all
            </button>
          )}
        </div>
        {!pages.length ? (
          <div className="scanner-empty">
            <ScanLine size={34} />
            <b>No scanned pages yet</b>
            <span>
              Load pages from your physical scanner. You can scan more batches
              before saving.
            </span>
          </div>
        ) : (
          <div className="scan-pages-grid">
            {pages.map((p, i) => (
              <div className="scan-page-card" key={p.id}>
                <div className="scan-page-image">
                  <img
                    src={`data:image/jpeg;base64,${p.data}`}
                    alt={`Scanned page ${i + 1}`}
                  />
                  <span>Page {i + 1}</span>
                </div>
                <div className="scan-page-actions">
                  <button
                    className="icon-btn"
                    title="Move left"
                    disabled={i === 0}
                    onClick={() => movePage(i, -1)}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    className="icon-btn"
                    title="Move right"
                    disabled={i === pages.length - 1}
                    onClick={() => movePage(i, 1)}
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    className="icon-btn danger"
                    title="Remove page"
                    onClick={() => removePage(p.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel scanner-save-panel">
        <div>
          <h2>Save as one PDF</h2>
          <p className="muted">
            Other company users cannot see the saved file unless you share it or
            grant permission. Company Admins retain administrative access.
          </p>
        </div>
        <div className="grid2">
          <label>
            PDF file name
            <input
              value={pdfName}
              onChange={(e) => setPdfName(e.target.value)}
              placeholder="e.g. Patient Records August 21.pdf"
            />
          </label>
          <label>
            Save in folder
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            >
              <option value="">My visible root</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.isPersonal ? " (Personal)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="toolbar">
          <button
            className="btn"
            disabled={!pages.length || saving}
            onClick={savePdf}
          >
            {saving ? "Creating PDF..." : "Create PDF & Save"}
          </button>
          <span className="muted">
            {pages.length
              ? `${pages.length} pages will be combined into ${(pdfName.trim() || "Scanned Document").replace(/\.pdf$/i, "") + ".pdf"}`
              : "Scan pages first."}
          </span>
        </div>
      </div>
    </div>
  );
}

function AI({ setErr }: any) {
  const [q, setQ] = useState(""),
    [a, setA] = useState("");
  async function ask() {
    try {
      const d = await api("/workspace/ai", {
        method: "POST",
        body: JSON.stringify({ message: q }),
      });
      setA(d.answer);
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <div className="panel">
      <h2>SecureFile AI</h2>
      <div className="toolbar">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask something..."
        />
        <button className="btn" onClick={ask}>
          <Send size={15} /> Ask
        </button>
      </div>
      {a && <div className="data">{a}</div>}
    </div>
  );
}
function Chat({ users }: any) {
  const me = localStorage.getItem("sf_user_id");
  const [mode, setMode] = useState<"chat" | "group" | "mail">("chat");
  const [to, setTo] = useState(""),
    [groupId, setGroupId] = useState(""),
    [body, setBody] = useState("");
  const [messages, setMessages] = useState<any[]>([]),
    [groups, setGroups] = useState<any[]>([]);
  const [groupName, setGroupName] = useState(""),
    [groupUsers, setGroupUsers] = useState<string[]>([]);
  const [emails, setEmails] = useState<any[]>([]),
    [mailBox, setMailBox] = useState<"inbox" | "sent">("inbox");
  const [subject, setSubject] = useState(""),
    [mailBody, setMailBody] = useState(""),
    [mailRecipient, setMailRecipient] = useState("");
  const [recipientMode, setRecipientMode] = useState<"USER" | "EMAIL">("USER");
  const [mailDetail, setMailDetail] = useState<any>(null);
  const people = users.filter((u: any) => u.id !== me && u.status === "ACTIVE");

  async function loadGroups() {
    try {
      setGroups(await api("/workspace/groups"));
    } catch {}
  }
  async function loadMessages() {
    try {
      if (mode === "chat" && to)
        setMessages(
          await api("/workspace/messages?withUser=" + encodeURIComponent(to)),
        );
      else if (mode === "group" && groupId)
        setMessages(
          await api(
            "/workspace/messages?groupId=" + encodeURIComponent(groupId),
          ),
        );
    } catch {}
  }
  async function loadEmails() {
    try {
      setEmails(await api("/workspace/emails?box=" + mailBox));
    } catch {}
  }
  useEffect(() => {
    loadGroups();
  }, []);
  useEffect(() => {
    loadMessages();
  }, [mode, to, groupId]);
  useEffect(() => {
    if (mode === "mail") loadEmails();
  }, [mode, mailBox]);

  async function send() {
    if (!body.trim()) return;
    try {
      await api("/workspace/messages", {
        method: "POST",
        body: JSON.stringify({
          recipientId: mode === "chat" ? to : undefined,
          groupId: mode === "group" ? groupId : undefined,
          body: body.trim(),
        }),
      });
      setBody("");
      loadMessages();
    } catch (e: any) {
      alert(e.message);
    }
  }
  async function createGroup() {
    if (!groupName.trim() || !groupUsers.length) return;
    try {
      const g = await api("/workspace/groups", {
        method: "POST",
        body: JSON.stringify({ name: groupName, userIds: groupUsers }),
      });
      setGroupName("");
      setGroupUsers([]);
      await loadGroups();
      setGroupId(g.id);
      setMode("group");
    } catch (e: any) {
      alert(e.message);
    }
  }
  async function renameGroup(g: any) {
    const name = window.prompt("New group name", g.name);
    if (!name?.trim()) return;
    try {
      await api("/workspace/groups/" + g.id, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      loadGroups();
    } catch (e: any) {
      alert(e.message);
    }
  }
  async function deleteGroup(g: any) {
    if (!confirm(`Delete group "${g.name}"? Messages will be removed.`)) return;
    try {
      await api("/workspace/groups/" + g.id, { method: "DELETE" });
      if (groupId === g.id) setGroupId("");
      loadGroups();
    } catch (e: any) {
      alert(e.message);
    }
  }
  async function sendMail() {
    const emailMode = recipientMode === "EMAIL";
    const valid = emailMode
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailRecipient.trim())
      : !!mailRecipient;
    if (!valid || !subject.trim() || !mailBody.trim()) return;
    try {
      await api("/workspace/email", {
        method: "POST",
        body: JSON.stringify({
          recipientId: emailMode ? undefined : mailRecipient,
          recipientEmail: emailMode
            ? mailRecipient.trim().toLowerCase()
            : undefined,
          subject: subject.trim(),
          body: mailBody.trim(),
        }),
      });
      setSubject("");
      setMailBody("");
      setMailRecipient("");
      setMailBox("sent");
      setMailDetail(null);
      await loadEmails();
    } catch (e: any) {
      alert(e.message);
    }
  }
  return (
    <div className="chat-shell">
      <div className="chat-sidebar">
        <div className="chat-tabs">
          <button
            className={mode === "chat" ? "active" : ""}
            onClick={() => setMode("chat")}
          >
            Chats
          </button>
          <button
            className={mode === "group" ? "active" : ""}
            onClick={() => setMode("group")}
          >
            Groups
          </button>
          <button
            className={mode === "mail" ? "active" : ""}
            onClick={() => setMode("mail")}
          >
            Mail
          </button>
        </div>
        {mode === "chat" && (
          <>
            {people.map((u: any) => (
              <button
                key={u.id}
                className={`chat-person ${to === u.id ? "selected" : ""}`}
                onClick={() => setTo(u.id)}
              >
                <b>{u.uniqueName}</b>
                <small>{u.email}</small>
              </button>
            ))}
            {!people.length && (
              <p className="muted">No active company users.</p>
            )}
          </>
        )}
        {mode === "group" && (
          <>
            {groups.map((g: any) => (
              <div
                key={g.id}
                className={`chat-person ${groupId === g.id ? "selected" : ""}`}
              >
                <button
                  className="link-button"
                  style={{ display: "block", width: "100%", textAlign: "left" }}
                  onClick={() => setGroupId(g.id)}
                >
                  <b>{g.name}</b>
                  <small>{g.members?.length || 0} members</small>
                </button>
                <div className="row-actions">
                  <button
                    className="icon-btn"
                    title="Rename"
                    onClick={() => renameGroup(g)}
                  >
                    ✎
                  </button>
                  <button
                    className="icon-btn danger"
                    title="Delete"
                    onClick={() => deleteGroup(g)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            <div className="group-create">
              <input
                placeholder="Group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
              {people.map((u: any) => (
                <label className="checkline" key={u.id}>
                  <input
                    type="checkbox"
                    checked={groupUsers.includes(u.id)}
                    onChange={(e) =>
                      setGroupUsers((v) =>
                        e.target.checked
                          ? [...v, u.id]
                          : v.filter((x) => x !== u.id),
                      )
                    }
                  />
                  {u.uniqueName}
                </label>
              ))}
              <button
                className="btn small"
                disabled={!groupName.trim() || !groupUsers.length}
                onClick={createGroup}
              >
                Create group
              </button>
            </div>
          </>
        )}
        {mode === "mail" && (
          <>
            <div className="mail-box-buttons">
              <button
                className={`btn small ${mailBox === "inbox" ? "" : "secondary"}`}
                onClick={() => setMailBox("inbox")}
              >
                Inbox
              </button>
              <button
                className={`btn small ${mailBox === "sent" ? "" : "secondary"}`}
                onClick={() => setMailBox("sent")}
              >
                Sent
              </button>
            </div>
            {emails.map((m: any) => (
              <button
                key={m.id}
                className={`chat-person ${mailDetail?.id === m.id ? "selected" : ""}`}
                onClick={() => setMailDetail(m)}
              >
                <b>{m.subject || "(No subject)"}</b>
                <small>
                  {mailBox === "sent"
                    ? m.recipientEmail
                    : m.sender?.email || "External sender"}{" "}
                  · {new Date(m.createdAt).toLocaleDateString()}
                </small>
              </button>
            ))}
            {!emails.length && (
              <p className="muted">No emails in this mailbox.</p>
            )}
          </>
        )}
      </div>
      <div className="chat-main">
        {mode === "mail" ? (
          <div className="grid2 mail-layout">
            <div className="panel">
              <div className="toolbar">
                <h2 style={{ margin: 0 }}>SecureFile Mail</h2>
                <span className="muted">
                  {mailBox === "inbox" ? "Inbox" : "Sent"}
                </span>
              </div>
              <div className="mail-compose-tabs">
                <button
                  className={`btn small ${recipientMode === "USER" ? "" : "secondary"}`}
                  onClick={() => setRecipientMode("USER")}
                >
                  Company user
                </button>
                <button
                  className={`btn small ${recipientMode === "EMAIL" ? "" : "secondary"}`}
                  onClick={() => setRecipientMode("EMAIL")}
                >
                  Email address
                </button>
              </div>
              {recipientMode === "USER" ? (
                <label>
                  Recipient
                  <select
                    value={mailRecipient}
                    onChange={(e) => setMailRecipient(e.target.value)}
                  >
                    <option value="">Choose company user</option>
                    {people.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.uniqueName} — {u.email}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label>
                  Recipient email
                  <input
                    type="email"
                    value={mailRecipient}
                    onChange={(e) => setMailRecipient(e.target.value)}
                    placeholder="name@example.com"
                  />
                </label>
              )}
              <label>
                Subject
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                />
              </label>
              <label>
                Message
                <textarea
                  rows={10}
                  value={mailBody}
                  onChange={(e) => setMailBody(e.target.value)}
                  placeholder="Write your email..."
                />
              </label>
              <button
                className="btn"
                disabled={
                  !mailRecipient ||
                  !subject.trim() ||
                  !mailBody.trim() ||
                  (recipientMode === "EMAIL" &&
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailRecipient))
                }
                onClick={sendMail}
              >
                <Send size={14} /> Send email
              </button>
              <p className="muted" style={{ marginTop: 10 }}>
                Incoming mail can be routed into this mailbox through the
                SecureFile inbound-email webhook.
              </p>
            </div>
            <div className="panel">
              <h2>{mailDetail?.subject || "Select an email"}</h2>
              {mailDetail ? (
                <>
                  <p className="muted">
                    <b>From:</b> {mailDetail.sender?.email || "External sender"}
                    <br />
                    <b>To:</b> {mailDetail.recipientEmail}
                    <br />
                    <b>Date:</b>{" "}
                    {new Date(mailDetail.createdAt).toLocaleString()}
                  </p>
                  <div className="data mail-body">{mailDetail.body}</div>
                </>
              ) : (
                <p className="muted">Select an email from the mailbox.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="panel chat-conversation">
            <h2>
              {mode === "chat"
                ? people.find((u: any) => u.id === to)?.uniqueName ||
                  "Select a person"
                : groups.find((g: any) => g.id === groupId)?.name ||
                  "Select a group"}
            </h2>
            <div className="data chat-messages">
              {messages.map((m: any) => (
                <div
                  className={`message-bubble ${m.senderId === me ? "mine" : ""}`}
                  key={m.id}
                >
                  <b>{m.sender?.uniqueName || "You"}</b>
                  <p>{m.body}</p>
                  <small>{new Date(m.createdAt).toLocaleString()}</small>
                </div>
              ))}
              {!messages.length && (
                <span className="muted">
                  Select a chat or group to start messaging.
                </span>
              )}
            </div>
            <div className="toolbar">
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write a message..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button
                className="btn"
                disabled={!(to || groupId) || !body.trim()}
                onClick={send}
              >
                <Send size={14} /> Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function Settings() {
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "billing">(
    "profile",
  );

  const [m, setM] = useState<any>(null),
    [users, setUsers] = useState(1),
    [storage, setStorage] = useState(1),
    [months, setMonths] = useState(1),
    [customMonths, setCustomMonths] = useState(1),
    [quote, setQuote] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState(""),
    [notice, setNotice] = useState("");

  async function load() {
    try {
      setErr("");

      const c = await api("/companies/me");

      setM(c);
      setUsers(Number(c.subscription?.users || 1));
      setStorage(Number(c.subscription?.storageGb || c.storageLimitGb || 1));
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const sub = m?.subscription;

  const isAdmin =
    localStorage.getItem("sf_role") === "COMPANY_ADMIN";

  const planName =
    (
      {
        STARTER: "Basic",
        BUSINESS: "Advanced",
        PROFESSIONAL: "Premium",
        CUSTOM: "Enterprise",
      } as any
    )[sub?.planCode || "CUSTOM"] || "Enterprise";

  const extraRate =
    sub?.planCode === "STARTER"
      ? 5
      : sub?.planCode === "BUSINESS"
        ? 10
        : sub?.planCode === "PROFESSIONAL"
          ? 12
          : 5;

  const expiresAt = sub?.expiresAt
    ? new Date(sub.expiresAt)
    : null;

  const expired =
    !!sub &&
    (sub.status === "SUSPENDED" ||
      sub.status === "CANCELED" ||
      (expiresAt
        ? expiresAt.getTime() <= Date.now()
        : false));

  const daysLeft =
    expiresAt && !expired
      ? Math.max(
          0,
          Math.ceil(
            (expiresAt.getTime() - Date.now()) / 86400000,
          ),
        )
      : 0;

  const changed =
    users > Number(sub?.users || 0) ||
    storage > Number(sub?.storageGb || 0);

  async function getQuote() {
    try {
      setErr("");
      setNotice("");

      const d = await api("/subscriptions/change-quote", {
        method: "POST",
        body: JSON.stringify({
          users,
          storageGb: storage,
          months,
        }),
      });

      setQuote(d.quote);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function requestChange() {
    try {
      setBusy(true);
      setErr("");
      setNotice("");

      const d = await api("/subscriptions/checkout", {
        method: "POST",
        body: JSON.stringify({
          planCode: sub?.planCode || "CUSTOM",
          users,
          storageGb: storage,
          months,
        }),
      });

      setQuote(d.quote);

      if (d.checkoutUrl) {
        window.location.href = d.checkoutUrl;
        return;
      }

      setNotice(
        d.warning ||
          "Checkout is ready. Payment must be successfully confirmed before new limits or access are applied.",
      );

      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (
      !confirm(
        "Cancel this SecureFile subscription now? Your workspace and data will be preserved, but all normal work will be suspended immediately. You can renew from Settings at any time.",
      )
    ) {
      return;
    }

    try {
      setBusy(true);
      setErr("");
      setNotice("");

      await api("/subscriptions/cancel", {
        method: "POST",
      });

      setNotice(
        "Subscription canceled. Your workspace is now view-only. Renew from Settings to restore full access.",
      );

      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const canCheckout = expired || changed;

  return (
    <div className="min-h-full">
      <div className="">
        {/* Header */}
        <div className="mb-6">
          <div className="flex">
            {/* <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Settings
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Account settings
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Manage your profile, security, and billing settings.
              </p>
            </div> */}
          </div>
        </div>

        {/* Alerts */}
        {err && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            <span className="mt-0.5 font-bold">!</span>
            <p>{err}</p>
          </div>
        )}

        {notice && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">
            <span className="mt-0.5 font-bold">✓</span>
            <p>{notice}</p>
          </div>
        )}

        {/* Main Settings Layout */}
        <div className="flex gap-3 w-[100%]">
          {/* Sidebar */}
          <aside className="w-[25%] h-fit rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <div className="flex gap-1 overflow-x-auto lg:block lg:space-y-1 lg:overflow-visible">
              {/* Profile */}
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={`group flex min-w-fit w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                  activeTab === "profile"
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    activeTab === "profile"
                      ? "bg-white/10"
                      : "bg-slate-100"
                  }`}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M20 21a8 8 0 0 0-16 0" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>

                <span>Profile</span>
              </button>

              {/* Security */}
              <button
                type="button"
                onClick={() => setActiveTab("security")}
                className={`group flex min-w-fit w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                  activeTab === "security"
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    activeTab === "security"
                      ? "bg-white/10"
                      : "bg-slate-100"
                  }`}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect
                      x="4"
                      y="11"
                      width="16"
                      height="10"
                      rx="2"
                    />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                </span>

                <span>Security</span>
              </button>

              {/* Billing */}
              <button
                type="button"
                onClick={() => setActiveTab("billing")}
                className={`group flex min-w-fit w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                  activeTab === "billing"
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    activeTab === "billing"
                      ? "bg-white/10"
                      : "bg-slate-100"
                  }`}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect
                      x="3"
                      y="5"
                      width="18"
                      height="14"
                      rx="2"
                    />
                    <path d="M3 10h18" />
                  </svg>
                </span>

                <span>Billing</span>
              </button>
            </div>
          </aside>

          {/* Content */}
          <div className="w-[75%]">
            {activeTab === "profile" && (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">
                      {m?.name
                        ? String(m.name)
                            .charAt(0)
                            .toUpperCase()
                        : "C"}
                    </div>

                    <div>
                      <h2 className="font-semibold text-slate-950">
                        Profile
                      </h2>

                      <p className="text-xs text-slate-500">
                        Your workspace information
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Company name
                    </p>

                    <p className="text-base font-semibold text-slate-950">
                      {m?.name || "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Industry
                    </p>

                    <p className="text-sm font-medium text-slate-700">
                      {m?.businessIndustry || "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 md:col-span-2">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Description
                    </p>

                    <p className="text-sm leading-6 text-slate-600">
                      {m?.businessDescription || "—"}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {activeTab === "security" && (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white">
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect
                          x="4"
                          y="11"
                          width="16"
                          height="10"
                          rx="2"
                        />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                    </div>

                    <div>
                      <h2 className="font-semibold text-slate-950">
                        Security
                      </h2>

                      <p className="text-xs text-slate-500">
                        Manage your password and account security
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  <div className="rounded-2xl border border-slate-200">
                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-950">
                          Password
                        </h3>

                        <p className="mt-1 max-w-xl text-sm leading-5 text-slate-500">
                          Keep your account secure by regularly updating
                          your password.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          /*
                           * Connect your existing password-reset/change
                           * functionality here.
                           *
                           * No billing integration is affected.
                           */
                          setNotice(
                            "Password reset functionality is ready to be connected to your existing password API.",
                          );
                          setErr("");
                        }}
                        className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Reset password
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === "billing" && (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Billing Header */}
                <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">
                        $
                      </div>

                      <div>
                        <h2 className="font-semibold text-slate-950">
                          Subscription & billing
                        </h2>

                        <p className="text-xs text-slate-500">
                          Plan, usage limits, and payment
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                        expired
                          ? "bg-red-100 text-red-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {expired
                        ? "EXPIRED / VIEW-ONLY"
                        : sub?.status || "—"}
                    </span>
                  </div>
                </div>

                <div className="space-y-6 p-5 sm:p-6">
                  {/* Current subscription summary */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">
                        Plan
                      </p>

                      <p className="mt-1 text-lg font-bold text-slate-950">
                        {planName}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">
                        Users
                      </p>

                      <p className="mt-1 text-lg font-bold text-slate-950">
                        {sub?.users || 0}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">
                        Storage
                      </p>

                      <p className="mt-1 text-lg font-bold text-slate-950">
                        {sub?.storageGb || 0}

                        <span className="ml-1 text-xs font-medium text-slate-500">
                          GB
                        </span>
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">
                        Paid period
                      </p>

                      <p className="mt-1 text-lg font-bold text-slate-950">
                        {sub?.months || 1}

                        <span className="ml-1 text-xs font-medium text-slate-500">
                          month
                          {Number(sub?.months || 1) !== 1
                            ? "s"
                            : ""}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Expiry */}
                  <div className="flex flex-col gap-2 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        Subscription expires
                      </p>

                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {expiresAt
                          ? expiresAt.toLocaleString()
                          : "—"}
                      </p>
                    </div>

                    {!expired && expiresAt && (
                      <span className="text-xs font-semibold text-slate-500">
                        {daysLeft} day
                        {daysLeft === 1 ? "" : "s"} left
                      </span>
                    )}
                  </div>

                  {/* Expired */}
                  {expired && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-semibold text-amber-900">
                        Your workspace is view-only.
                      </p>

                      <p className="mt-1 text-sm leading-5 text-amber-800">
                        Your data is preserved, but normal work is locked
                        until a renewal payment is successfully confirmed.
                      </p>
                    </div>
                  )}

                  {/* Pending payment */}
                  {sub?.pendingUsers && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                      <span className="font-semibold">
                        Payment pending:
                      </span>{" "}
                      {sub.pendingUsers} users ·{" "}
                      {sub.pendingStorageGb} GB. Current limits remain
                      active until payment is approved.
                    </div>
                  )}

                  {/* Admin controls */}
                  {isAdmin && (
                    <div className="border-t border-slate-100 pt-6">
                      <div className="mb-5">
                        <h3 className="text-base font-semibold text-slate-950">
                          {expired
                            ? "Renew subscription"
                            : "Purchase additional capacity"}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          {expired
                            ? "Choose your limits and renewal period to restore full access."
                            : "Increase users or storage. Your current plan features stay unchanged."}
                        </p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        {/* Users */}
                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-slate-700">
                            Total users
                          </span>

                          <input
                            type="number"
                            min={Number(sub?.users || 1)}
                            value={users}
                            onChange={(e) => {
                              setUsers(
                                Math.max(
                                  Number(sub?.users || 1),
                                  +e.target.value || 1,
                                ),
                              );

                              setQuote(null);
                            }}
                            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                          />

                          <span className="mt-2 block text-xs leading-5 text-slate-500">
                            Additional user:{" "}
                            <b className="text-slate-700">
                              ${extraRate}/user/month
                            </b>
                            . Each added user gets the same{" "}
                            {planName} features.
                          </span>
                        </label>

                        {/* Storage */}
                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-slate-700">
                            Storage (GB)
                          </span>

                          <input
                            type="number"
                            min={Number(sub?.storageGb || 1)}
                            value={storage}
                            onChange={(e) => {
                              setStorage(
                                Math.max(
                                  Number(sub?.storageGb || 1),
                                  +e.target.value || 1,
                                ),
                              );

                              setQuote(null);
                            }}
                            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                          />

                          <span className="mt-2 block text-xs leading-5 text-slate-500">
                            Additional storage is{" "}
                            <b className="text-slate-700">
                              $0.30/GB/month
                            </b>{" "}
                            beyond included plan storage.
                          </span>
                        </label>

                        {/* Duration */}
                        <label className="block sm:col-span-2">
                          <span className="mb-2 block text-sm font-semibold text-slate-700">
                            Purchase duration
                          </span>

                          <select
                            value={
                              [1, 3, 6, 12, 24, 36].includes(
                                months,
                              )
                                ? months
                                : 0
                            }
                            onChange={(e) => {
                              const v = Number(e.target.value);

                              if (v === 0) {
                                setMonths(customMonths);
                              } else {
                                setMonths(v);
                              }

                              setQuote(null);
                            }}
                            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                          >
                            <option value={1}>1 month</option>
                            <option value={3}>3 months</option>
                            <option value={6}>6 months</option>
                            <option value={12}>12 months</option>
                            <option value={24}>24 months</option>
                            <option value={36}>36 months</option>
                            <option value={0}>Custom</option>
                          </select>
                        </label>

                        {/* Custom months */}
                        {![1, 3, 6, 12, 24, 36].includes(
                          months,
                        ) && (
                          <label className="block sm:col-span-2">
                            <span className="mb-2 block text-sm font-semibold text-slate-700">
                              Number of months
                            </span>

                            <input
                              type="number"
                              min={1}
                              max={120}
                              value={customMonths}
                              onChange={(e) => {
                                const v = Math.max(
                                  1,
                                  Math.min(
                                    120,
                                    +e.target.value || 1,
                                  ),
                                );

                                setCustomMonths(v);
                                setMonths(v);
                                setQuote(null);
                              }}
                              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                            />
                          </label>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                        {!expired && (
                          <button
                            type="button"
                            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={!changed || busy}
                            onClick={getQuote}
                          >
                            Calculate price
                          </button>
                        )}

                        <button
                          type="button"
                          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!canCheckout || busy}
                          onClick={requestChange}
                        >
                          {busy
                            ? "Processing..."
                            : expired
                              ? "Renew & restore access"
                              : "Pay & increase limits"}
                        </button>
                      </div>

                      {!expired && (
                        <button
                          type="button"
                          className="mt-3 text-sm font-semibold text-red-600 transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={busy}
                          onClick={cancel}
                        >
                          Cancel subscription
                        </button>
                      )}
                    </div>
                  )}

                  {/* Non-admin */}
                  {!isAdmin && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      Only the{" "}
                      <span className="font-semibold text-slate-800">
                        Company Admin
                      </span>{" "}
                      can renew or purchase additional users/storage.
                    </div>
                  )}

                  {/* Quote */}
                  {quote && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                            Estimated price
                          </p>

                          <p className="mt-1 text-sm text-emerald-900">
                            Monthly equivalent:{" "}
                            <b>
                              ${Number(quote.monthly).toFixed(2)}
                            </b>
                          </p>
                        </div>

                        <div className="text-left sm:text-right">
                          <p className="text-xs font-medium text-emerald-700">
                            Upfront total
                          </p>

                          <p className="text-xl font-bold text-emerald-900">
                            ${Number(quote.total).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 border-t border-emerald-200 pt-3 text-xs leading-5 text-emerald-800">
                        Access and limits update only after successful
                        payment.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}







