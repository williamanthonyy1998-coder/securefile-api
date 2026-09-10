import { useNavigate } from "react-router-dom";
import { Download, Eye, Trash2 } from "lucide-react";
import { api, downloadPrivateFile } from "../../lib/api";
import FileActionsMenu, {
  type FileActionItem,
} from "../files/FileActionsMenu";
import FileTypeIcon from "../files/FileTypeIcon";

export default function SharedPanel({ data, refresh, setErr }: any) {
  const navigate = useNavigate();
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

  async function download(share: any) {
    const fileId = share.file?.id;
    if (!fileId) return;
    try {
      setErr("");
      await downloadPrivateFile(fileId, share.file?.name || "download");
    } catch (e: any) {
      setErr(e.message || "Download failed.");
    }
  }

  function canViewShare(share: any) {
    if (!share.file?.id) return false;
    if (share.ownerId === me) return true;
    return Boolean(share.canView);
  }

  function canDownloadShare(share: any) {
    if (!share.file?.id) return false;
    if (share.ownerId === me) return true;
    return Boolean(share.canDownload);
  }

  function actionItems(share: any): FileActionItem[] {
    const items: FileActionItem[] = [];

    if (canViewShare(share)) {
      items.push({
        key: "view",
        label: "Open",
        icon: <Eye size={14} />,
        onClick: () =>
          navigate(`/files/${encodeURIComponent(share.file.id)}/view`),
      });
    }

    if (canDownloadShare(share)) {
      items.push({
        key: "download",
        label: "Download",
        icon: <Download size={14} />,
        onClick: () => download(share),
      });
    }

    if (share.manageable) {
      items.push({
        key: "revoke",
        label: "Revoke access",
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: () => remove(share.id),
      });
    }

    return items;
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
            <th className="actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((s: any) => {
            const mine = Boolean(s.manageable);
            const items = actionItems(s);
            return (
              <tr key={s.id}>
                <td>
                  <div className="shared-resource-name">
                    {s.file ? (
                      <FileTypeIcon
                        mimeType={s.file.mimeType}
                        fileName={s.file.name}
                      />
                    ) : null}
                    <div>
                      <b>{s.file?.name || s.folder?.name || "Resource"}</b>
                      <small className="table-sub">
                        {s.file ? "File" : s.folder ? "Folder" : "Resource"} ·{" "}
                        {s.type}
                      </small>
                    </div>
                  </div>
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
                <td className="actions-col">
                  <div className="row-actions">
                    {items.length ? (
                      <FileActionsMenu items={items} />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </div>
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
