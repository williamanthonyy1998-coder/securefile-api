import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Eye,
  FileText,
  Folder,
  Share2,
  Trash2,
  Upload,
} from "lucide-react";
import { api, downloadPrivateFile } from "../../lib/api";
import { sfConfirm } from "../../lib/dialogs";
import FileActionsMenu, { type FileActionItem } from "../files/FileActionsMenu";
import FileTypeIcon from "../files/FileTypeIcon";

type ShareDirection = "outgoing" | "incoming";

const FILE_PERMISSIONS = [
  ["canView", "View", Eye],
  ["canDownload", "Download", Download],
  ["canShare", "Re-share", Share2],
] as const;

const FOLDER_PERMISSIONS = [
  ["canView", "View", Eye],
  ["canDownload", "Download", Download],
  ["canUpload", "Upload", Upload],
  ["canDelete", "Delete", Trash2],
  ["canShare", "Re-share", Share2],
] as const;

function displayName(user: any) {
  return user?.uniqueName || user?.email || "Unknown user";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function permissionLabel(share: any) {
  const keys = share.file ? FILE_PERMISSIONS : FOLDER_PERMISSIONS;
  const labels = keys.filter(([key]) => Boolean(share[key])).map(([, label]) => label);
  return labels.length ? labels : ["View"];
}

export default function SharedPanel({ data, refresh, setErr }: any) {
  const navigate = useNavigate();
  const me = localStorage.getItem("sf_user_id");
  const [view, setView] = useState<ShareDirection>("incoming");

  const grouped = useMemo(() => {
    const outgoing = data.filter((s: any) => s.ownerId === me);
    const incoming = data.filter((s: any) => s.recipientId === me && s.ownerId !== me);
    return { outgoing, incoming };
  }, [data, me]);

  const visible = grouped[view];

  async function update(id: string, key: string, value: boolean) {
    try {
      await api(`/sharing/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      });
      refresh();
    } catch (e: any) {
      setErr(e.message || "Unable to update sharing permissions.");
    }
  }

  async function remove(id: string) {
    if (
      !(await sfConfirm(
        "Remove this share? The recipient will immediately lose access.",
        { title: "Remove share", danger: true, confirmLabel: "Remove share" },
      ))
    ) return;
    try {
      await api(`/sharing/${id}`, { method: "DELETE" });
      refresh();
    } catch (e: any) {
      // api() already surfaces the error through the global side toast.
      void e;
    }
  }

  async function download(share: any) {
    const fileId = share.file?.id;
    if (!fileId) return;
    try {
      setErr("");
      await downloadPrivateFile(fileId, share.file?.name || "download");
    } catch (e: any) {
      // api() already surfaces the error through the global side toast.
      void e;
    }
  }

  function canViewShare(share: any) {
    return Boolean(share.file?.id && (share.ownerId === me || share.canView));
  }

  function canDownloadShare(share: any) {
    return Boolean(share.file?.id && (share.ownerId === me || share.canDownload));
  }

  function actionItems(share: any): FileActionItem[] {
    const items: FileActionItem[] = [];
    if (canViewShare(share)) {
      items.push({
        key: "view",
        label: "Open file",
        icon: <Eye size={14} />,
        onClick: () => navigate(`/files/${encodeURIComponent(share.file.id)}/view`),
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
    <div className="shared-page-panel">
      <div className="shared-toolbar">
        <div className="shared-toolbar-copy">
          <div className="shared-toolbar-icon"><Share2 size={17} /></div>
          <div>
            <h2>Sharing activity</h2>
            <p>See exactly what was shared, who sent it, and who received access.</p>
          </div>
        </div>
        <div className="shared-view-tabs" role="tablist" aria-label="Sharing views">
          <button role="tab" aria-selected={view === "incoming"} className={view === "incoming" ? "active" : ""} onClick={() => setView("incoming")}>Shared with me <span>{grouped.incoming.length}</span></button>
          <button role="tab" aria-selected={view === "outgoing"} className={view === "outgoing" ? "active" : ""} onClick={() => setView("outgoing")}>Shared by me <span>{grouped.outgoing.length}</span></button>
        </div>
      </div>

      <div className="shared-summary-grid">
        <div className="shared-summary-card"><ArrowUpRight size={16} /><div><strong>{grouped.outgoing.length}</strong><span>Shared by me</span></div></div>
        <div className="shared-summary-card"><ArrowDownLeft size={16} /><div><strong>{grouped.incoming.length}</strong><span>Shared with me</span></div></div>
        <div className="shared-summary-card"><FileText size={16} /><div><strong>{visible.filter((s: any) => Boolean(s.file)).length}</strong><span>Files</span></div></div>
        <div className="shared-summary-card"><Folder size={16} /><div><strong>{visible.filter((s: any) => Boolean(s.folder)).length}</strong><span>Folders</span></div></div>
      </div>

      <div className="shared-list">
        {!visible.length && (
          <div className="shared-empty">
            <div className="shared-empty-icon"><Share2 size={20} /></div>
            <strong>{view === "incoming" ? "Nothing has been shared with you" : view === "outgoing" ? "You have not shared anything yet" : "No shared resources yet"}</strong>
            <span>When something is shared, the sender, recipient, resource and permissions will appear here.</span>
          </div>
        )}

        {visible.map((s: any) => {
          const outgoing = s.ownerId === me;
          const resourceName = s.file?.name || s.folder?.name || "Resource";
          const resourceType = s.file ? "File" : s.folder ? "Folder" : "Resource";
          const counterpart = outgoing
            ? (s.recipient ? displayName(s.recipient) : "Anyone with the public link")
            : displayName(s.owner);
          const directionLabel = outgoing ? "You shared" : "Shared with you";
          const items = actionItems(s);
          const permissionOptions = s.file ? FILE_PERMISSIONS : FOLDER_PERMISSIONS;

          return (
            <article className="shared-item" key={s.id}>
              <div className="shared-item-main">
                <div className="shared-resource-icon">
                  {s.file ? <FileTypeIcon mimeType={s.file.mimeType} fileName={s.file.name} /> : <Folder size={18} />}
                </div>
                <div className="shared-resource-copy">
                  <div className="shared-resource-title-row">
                    <strong title={resourceName}>{resourceName}</strong>
                    <span className={`shared-type-badge ${s.file ? "file" : "folder"}`}>{resourceType}</span>
                    <span className={`shared-scope-badge ${s.type === "PUBLIC" ? "public" : "internal"}`}>{s.type === "PUBLIC" ? "Public link" : "Internal"}</span>
                  </div>
                  <div className="shared-meta-line">
                    <span>{directionLabel}</span>
                    <span className="shared-meta-dot">•</span>
                    <span>{counterpart}</span>
                    <span className="shared-meta-dot">•</span>
                    <span>{formatDate(s.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className="shared-participant">
                <div className={`shared-person-avatar ${outgoing ? "outgoing" : "incoming"}`}>
                  {outgoing ? (s.recipient?.avatarUrl ? <img src={s.recipient.avatarUrl} alt="" /> : initials(s.recipient ? displayName(s.recipient) : "Public")) : (s.owner?.avatarUrl ? <img src={s.owner.avatarUrl} alt="" /> : initials(displayName(s.owner)))}
                </div>
                <div><small>{outgoing ? "Sent to" : "Received from"}</small><strong>{counterpart}</strong></div>
              </div>

              <div className="shared-permissions-cell">
                <small>Access</small>
                {s.manageable ? (
                  <div className="shared-permission-controls">
                    {permissionOptions.map(([key, label, Icon]) => (
                      <label className={`shared-permission-chip ${s[key] ? "checked" : ""}`} key={key} title={label}>
                        <input type="checkbox" checked={Boolean(s[key])} onChange={(e) => update(s.id, key, e.target.checked)} />
                        <Icon size={12} />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="shared-permission-chips">
                    {permissionLabel(s).map((label) => <span key={label}>{label}</span>)}
                  </div>
                )}
              </div>

              <div className="shared-item-actions">
                {items.length ? <FileActionsMenu items={items} /> : <span className="muted">—</span>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
