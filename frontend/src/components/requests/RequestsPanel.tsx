import { useState } from "react";
import { api } from "../../lib/api";
import { Trash2 } from "lucide-react";

export default function RequestsPanel({ data, users, refresh, setErr }: any) {
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
