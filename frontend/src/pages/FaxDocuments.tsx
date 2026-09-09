import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import FaxUpload from "../components/fax/FaxUpload";

export default function FaxDocuments() {
  const [features, setFeatures] = useState<any>({});
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("sf_addons") || "{}");
      if (saved && typeof saved === "object") setFeatures(saved);
    } catch {}
  }, []);
  if (!features.fax)
    return (
      <>
        <div className="page-head">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1>Fax Documents</h1>
            <p>Receive faxes on your personal SecureFile number and send documents to any fax number.</p>
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
          <h1>Fax Documents</h1>
          <p>Receive faxes on your personal SecureFile number and send documents to any fax number.</p>
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
      <div key={refresh}>
        <FaxUpload setErr={setErr} />
      </div>
    </>
  );
}
