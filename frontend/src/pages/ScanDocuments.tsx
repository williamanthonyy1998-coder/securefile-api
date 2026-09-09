import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import ScannerModule from "../components/scan/ScannerModule";

export default function ScanDocuments() {
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
  if (!features.scanner)
    return (
      <>
        <div className="page-head">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1>Scan Documents</h1>
            <p>Connect the Windows scanner bridge, scan as many pages as you need, combine them into one PDF, name it, and save it privately.</p>
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
          <h1>Scan Documents</h1>
          <p>Connect the Windows scanner bridge, scan as many pages as you need, combine them into one PDF, name it, and save it privately.</p>
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
        <ScannerModule setErr={setErr} />
      </div>
    </>
  );
}
