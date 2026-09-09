import { useState } from "react";
import { api } from "../../lib/api";
import { ShieldCheck, X } from "lucide-react";

export default function ApprovalsPanel({ data, refresh, setErr }: any) {
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
