import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function TasksPanel({ data, users, refresh, setErr }: any) {
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
