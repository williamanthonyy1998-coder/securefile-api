import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import {
  Send,
  RefreshCw,
  Download,
  ExternalLink,
  PhoneIncoming,
  PhoneOutgoing,
} from "lucide-react";

export default function FaxUpload({ setErr }: any) {
  const navigate = useNavigate();
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

  // Fax delivery/receive events are already pushed through SecureFile's SSE
  // notification channel. Reload only when a fax notification arrives; there
  // is no interval/polling here.
  useEffect(() => {
    const onRealtimeFax = (event: Event) => {
      try {
        const n: any = JSON.parse((event as CustomEvent).detail || "{}");
        const title = String(n.title || "").toLowerCase();
        if (title.includes("fax")) load();
      } catch {}
    };
    window.addEventListener("sf:notification", onRealtimeFax);
    return () => window.removeEventListener("sf:notification", onRealtimeFax);
  }, []);

  async function provision() {
    try {
      setBusy(true);
      if (countryCode.length < 1 || countryCode.length > 3)
        return setErr("Enter a valid country code.");
      if (areaCode.length !== 3)
        return setErr("Enter a valid 3-digit area code.");
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
        // Send the browser-selected file directly to the fax API. This avoids
        // an unnecessary upload -> metadata -> second API request. The backend
        // stores a private FAX copy after the provider accepts the fax.
        const form = new FormData();
        form.append("to", to.trim());
        form.append("headerText", header);
        form.append("file", uploadFile!);
        await api("/fax/send", { method: "POST", body: form });
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

  function openFile(id: string) {
    navigate(`/files/${encodeURIComponent(id)}/view`);
  }

  if (loading)
    return (
      <div className="panel">
        <p className="muted">Loading your fax workspace...</p>
      </div>
    );

  return (
    <div className="fax-workspace">
      <div className="fax-top-grid">
        <div className="panel fax-number-panel">
          <div className="fax-card-head">
            <div>
              <p className="eyebrow">Receive faxes</p>
              <h2>My personal fax number</h2>
            </div>
            <PhoneIncoming size={22} />
          </div>
          <p className="muted">
            Anyone can send a fax to this number. SecureFile receives the
            document through the fax provider and saves it privately to your
            account.
          </p>
          {line?.phoneNumber ? (
            <>
              <div className="fax-number-value">{line.phoneNumber}</div>
              <div className="fax-ready">
                <span className="fax-ready-dot" /> Ready to receive faxes
              </div>
              <p className="fax-help">
                Give this number to the person or organization sending you a
                fax. Incoming documents will appear in <b>My fax history</b>{" "}
                automatically.
              </p>
            </>
          ) : (
            <>
              <div className="grid2 fax-provision-grid">
                <label>
                  Country code
                  <input
                    value={countryCode}
                    onChange={(e) =>
                      setCountryCode(
                        e.target.value.replace(/\D/g, "").slice(0, 3),
                      )
                    }
                    placeholder="1"
                    inputMode="numeric"
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
                    inputMode="numeric"
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
                This provisions a real receiving number from the configured fax
                provider and may create a provider charge.
              </p>
            </>
          )}
        </div>

        <div className="panel fax-send-panel">
          <div className="fax-card-head">
            <div>
              <p className="eyebrow">Send faxes</p>
              <h2>Send a fax</h2>
            </div>
            <PhoneOutgoing size={22} />
          </div>
          <label>
            Recipient fax number
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="+14155551234"
              inputMode="tel"
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
          <p className="muted fax-help">
            Your personal SecureFile fax number is used as the caller ID when
            the provider supports it.
          </p>
        </div>
      </div>

      <div className="panel fax-history-panel">
        <div
          className="toolbar fax-history-head"
          style={{ justifyContent: "space-between" }}
        >
          <div>
            <p className="eyebrow">Fax inbox & sent items</p>
            <h2 style={{ margin: 0 }}>My fax history</h2>
            <p className="muted">
              Received faxes are stored privately. Sent faxes show delivery
              status and remain available as private FAX files.
            </p>
          </div>
          <button
            className="btn secondary small"
            onClick={load}
            disabled={loading || busy}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        <div className="fax-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Direction</th>
                <th>Number</th>
                <th>Document</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j: any) => (
                <tr key={j.id}>
                  <td>
                    <span className="fax-direction">
                      <span
                        className={j.direction === "INBOUND" ? "in" : "out"}
                      >
                        {j.direction === "INBOUND" ? (
                          <PhoneIncoming size={14} />
                        ) : (
                          <PhoneOutgoing size={14} />
                        )}
                      </span>
                      {j.direction === "INBOUND" ? "Received" : "Sent"}
                    </span>
                  </td>
                  <td>
                    {j.direction === "INBOUND"
                      ? j.senderNumber || "Unknown"
                      : j.recipientNumber || "—"}
                  </td>
                  <td>
                    <b>{j.file?.name || "Fax transmission"}</b>
                    {j.pages ? (
                      <small className="table-sub">
                        {j.pages} page{j.pages === 1 ? "" : "s"}
                      </small>
                    ) : null}
                  </td>
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
                  <td>
                    {j.fileId ? (
                      <div className="fax-row-actions">
                        <button
                          className="icon-btn"
                          title="Open document"
                          onClick={() => openFile(j.fileId)}
                        >
                          <ExternalLink size={14} />
                        </button>
                        <button
                          className="icon-btn"
                          title="Download document"
                          onClick={async () => {
                            try {
                              const { downloadPrivateFile } =
                                await import("../../lib/api");
                              await downloadPrivateFile(
                                j.fileId,
                                j.file?.name || "fax.pdf",
                              );
                            } catch (e: any) {
                              setErr(e.message);
                            }
                          }}
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!jobs.length && (
                <tr>
                  <td colSpan={6} className="muted">
                    No fax activity yet. Provision your personal number to start
                    receiving and sending faxes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
