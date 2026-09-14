import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CheckCircle2,
  Download,
  Eye,
  FileText,
  FolderOpen,
  KeyRound,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  Upload,
  Pencil,
  Trash2,
  Share2,
} from "lucide-react";
import { api, API, token as getAuthToken } from "../lib/api";

type ShareData = {
  file?: { id: string; name: string; mimeType?: string } | null;
  folder?: { id: string; name: string } | null;
  permissions?: Record<string, boolean>;
  downloadUrl?: string | null;
  contentUrl?: string | null;
  requiresLogin?: boolean;
  loginUrl?: string | null;
};

type FolderAccessData = {
  folder: { id: string; name: string; parentId?: string | null };
  permissions?: Record<string, boolean>;
};

function typeLabel(mime = "") {
  if (mime.includes("pdf")) return "PDF document";
  if (mime.startsWith("image/")) return "Image";
  if (mime.includes("word") || mime.includes("document")) return "Document";
  if (mime.includes("sheet") || mime.includes("excel")) return "Spreadsheet";
  if (mime.startsWith("text/")) return "Text file";
  return "Shared file";
}

const PERMISSIONS = [
  ["view", "View", Eye],
  ["download", "Download", Download],
  ["upload", "Upload", Upload],
  ["edit", "Edit", Pencil],
  ["delete", "Delete", Trash2],
  ["share", "Re-share", Share2],
] as const;

export default function PublicShare() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [data, setData] = useState<ShareData | null>(null);
  const [folderAccess, setFolderAccess] = useState<FolderAccessData | null>(null);
  const [contentUrl, setContentUrl] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [folderLoading, setFolderLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);

  async function unlock() {
    if (!token) return;
    try {
      setLoading(true);
      setErr("");
      const d = await api(`/public/shares/${encodeURIComponent(token)}/unlock`, {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setData(d);
    } catch (e: any) {
      setErr(e.message || "Unable to open this share.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token || data || loading) return;
    unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!data?.folder || !getAuthToken()) return;
    let cancelled = false;
    (async () => {
      try {
        setFolderLoading(true);
        const result = await api(`/public/shares/${encodeURIComponent(token)}/folder`, {
          method: "GET",
          headers: { "X-Silent-Alert": "true" },
        });
        if (!cancelled) setFolderAccess(result);
      } catch (e: any) {
        if (!cancelled) setErr(e.message || "Sign in with an authorized SecureFile account to continue.");
      } finally {
        if (!cancelled) setFolderLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [data?.folder?.id, token]);

  useEffect(() => {
    if (!data?.contentUrl || !data.permissions?.view) return;
    let cancelled = false;
    (async () => {
      try {
        setContentLoading(true);
        setErr("");
        const headers = new Headers();
        if (password) headers.set("X-Share-Password", password);
        const response = await fetch(
          `${API}/public/shares/${encodeURIComponent(token)}/content`,
          { method: "GET", headers, cache: "no-store" },
        );
        if (!response.ok) {
          const text = await response.text();
          let message = "Preview is unavailable for this share.";
          try { message = JSON.parse(text)?.error || message; } catch {}
          throw new Error(message);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        if (!cancelled) setContentUrl(url);
        else URL.revokeObjectURL(url);
      } catch (e: any) {
        if (!cancelled) setErr(e.message || "Preview is unavailable.");
      } finally {
        if (!cancelled) setContentLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [data?.contentUrl, data?.permissions?.view, password, token]);

  useEffect(() => () => {
    if (contentUrl) URL.revokeObjectURL(contentUrl);
  }, [contentUrl]);

  async function download() {
    if (!data?.downloadUrl || !data.permissions?.download) return;
    try {
      setErr("");
      const headers = new Headers();
      if (password) headers.set("X-Share-Password", password);
      const r = await fetch(
        `${API}/public/shares/${encodeURIComponent(token)}/download`,
        { method: "GET", headers, cache: "no-store" },
      );
      if (!r.ok) {
        const text = await r.text();
        let message = "Download is not permitted for this share.";
        try { message = JSON.parse(text)?.error || message; } catch {}
        throw new Error(message);
      }
      const b = await r.blob();
      const u = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = u;
      a.download = data.file?.name || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    } catch (e: any) {
      setErr(e.message || "Download failed.");
    }
  }

  const file = data?.file;
  const folder = data?.folder;
  const loginHref = data?.loginUrl || `/login?returnTo=/public-share/${encodeURIComponent(token)}`;
  const signupHref = `/signup?returnTo=/public-share/${encodeURIComponent(token)}`;

  const visiblePermissions = useMemo(() => {
    const source = folderAccess?.permissions || data?.permissions || {};
    return PERMISSIONS.filter(([key]) => source[key]);
  }, [data?.permissions, folderAccess?.permissions]);

  return (
    <div className="public-share-page">
      <div className="public-share-glow public-share-glow-one" />
      <div className="public-share-glow public-share-glow-two" />

      <main className="public-share-card">
        <header className="public-share-brand">
          <div className="public-share-brand-mark"><ShieldCheck size={19} /></div>
          <span>SecureFile</span>
          <em>SECURE SHARE</em>
        </header>

        <section className="public-share-header">
          <div className="public-share-resource-icon">
            {folder ? <FolderOpen size={24} /> : <FileText size={24} />}
          </div>
          <div className="public-share-title-wrap">
            <p className="eyebrow">{folder ? "Shared folder" : "Shared file"}</p>
            <h1 title={file?.name || folder?.name}>{file?.name || folder?.name || "Shared resource"}</h1>
            {file?.mimeType && <p className="public-share-type">{typeLabel(file.mimeType)} · Secure access</p>}
          </div>
          <span className="public-share-status"><CheckCircle2 size={13} /> Protected</span>
        </section>

        {!data && (
          <section className="public-share-gate">
            <div className="public-share-lock"><LockKeyhole size={21} /></div>
            <span className="public-share-kicker">SECURE ACCESS</span>
            <h2>{loading ? "Opening secure share" : "This share is protected"}</h2>
            <p>{loading ? "Verifying the secure link and preparing the shared resource…" : "Enter the password configured by the owner to continue."}</p>
            <label>
              Share password
              <input
                autoFocus
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") unlock(); }}
                placeholder="Enter password"
              />
            </label>
            {err && <div className="public-share-error">{err}</div>}
            <button className="btn public-share-primary" onClick={unlock} disabled={loading}>
              <KeyRound size={16} /> {loading ? "Verifying access…" : "Open secure share"}
            </button>
          </section>
        )}

        {data && (
          <>
            {err && <div className="public-share-error">{err}</div>}

            <section className="public-share-permissions">
              <div>
                <span className="public-share-kicker">ACCESS POLICY</span>
                <strong>{folder ? "Authenticated folder access" : "File access granted"}</strong>
                <small>{folder ? "Sign in to use the permissions below." : "Permissions are enforced by SecureFile."}</small>
              </div>
              <div className="public-share-permission-list">
                {visiblePermissions.length ? visiblePermissions.map(([key, label, Icon]) => (
                  <span className="public-share-permission active" key={key}><Icon size={13} />{label}</span>
                )) : <span className="public-share-permission">No access granted</span>}
              </div>
            </section>

            {folder && (
              <section className="public-share-folder-gate">
                <div className="public-share-folder-gate-icon"><LogIn size={21} /></div>
                <span className="public-share-kicker">MEMBER ACCESS</span>
                <h2>{folderAccess ? "Folder access is ready" : "Sign in to access this folder"}</h2>
                <p>
                  {folderAccess
                    ? "Your SecureFile account is authenticated. Open the folder to continue working with the permissions granted by the owner."
                    : "Folder links never expose workspace contents anonymously. Use a registered SecureFile account to continue."}
                </p>
                {folderAccess ? (
                  <button className="btn public-share-primary" onClick={() => navigate(`/files?folderId=${encodeURIComponent(folderAccess.folder.id)}`)}>
                    <FolderOpen size={16} /> Open folder in SecureFile
                  </button>
                ) : (
                  <div className="public-share-auth-actions">
                    <Link className="btn public-share-primary" to={loginHref}><LogIn size={16} /> Sign in to SecureFile</Link>
                    <Link className="public-share-secondary-link" to={signupHref}>New to SecureFile? Create an account</Link>
                  </div>
                )}
                {folderLoading && <div className="public-share-inline-loading"><span className="sf-spinner" /> Checking your SecureFile account…</div>}
              </section>
            )}

            {file && data.permissions?.view && (
              <section className="public-share-preview-section">
                <div className="public-share-section-head">
                  <div>
                    <span className="public-share-kicker">VIEWER</span>
                    <h2>File preview</h2>
                  </div>
                  {data.permissions?.download && (
                    <button className="btn small" onClick={download}><Download size={15} /> Download</button>
                  )}
                </div>
                <div className="public-share-preview">
                  {contentLoading && <div className="public-share-loading"><span className="sf-spinner" /> Loading secure preview…</div>}
                  {!contentLoading && contentUrl && file.mimeType?.startsWith("image/") && <img src={contentUrl} alt={file.name} />}
                  {!contentLoading && contentUrl && file.mimeType?.includes("pdf") && <iframe title="Secure file preview" src={`${contentUrl}#toolbar=0&navpanes=0&scrollbar=1`} />}
                  {!contentLoading && contentUrl && file.mimeType?.startsWith("text/") && <iframe title="Secure text preview" src={contentUrl} />}
                  {!contentLoading && contentUrl && !((file.mimeType || "").startsWith("image/") || (file.mimeType || "").includes("pdf") || (file.mimeType || "").startsWith("text/")) && (
                    <div className="public-share-unavailable"><FileText size={28} /><strong>Preview is not available in this browser</strong><span>{typeLabel(file.mimeType)}</span>{data.permissions?.download && <button className="btn" onClick={download}><Download size={15} /> Download file</button>}</div>
                  )}
                  {!contentLoading && !contentUrl && <div className="public-share-unavailable"><Eye size={28} /><strong>Preview unavailable</strong><span>The owner has allowed viewing, but the secure preview could not be loaded.</span><button className="btn secondary" onClick={() => { setData(null); setErr(""); setTimeout(unlock, 0); }}>Try again</button></div>}
                </div>
              </section>
            )}

            {file && !data.permissions?.view && (
              <section className="public-share-denied">
                <LockKeyhole size={24} />
                <strong>Viewing is not permitted</strong>
                <span>The owner did not grant view access to this public share.</span>
                {data.permissions?.download && <button className="btn" onClick={download}><Download size={15} /> Download file</button>}
              </section>
            )}
          </>
        )}

        <footer className="public-share-footer">
          <span><ShieldCheck size={14} /> Protected by SecureFile permissions</span>
          <span>{data?.permissions?.download ? "Download enabled" : data?.folder ? "Sign-in required · Download disabled" : "View only · Download disabled"}</span>
        </footer>
      </main>
    </div>
  );
}
