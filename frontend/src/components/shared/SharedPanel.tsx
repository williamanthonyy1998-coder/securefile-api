import { api } from "../../lib/api";
import { Trash2 } from "lucide-react";

export default function SharedPanel({ data, refresh, setErr }: any) {
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
