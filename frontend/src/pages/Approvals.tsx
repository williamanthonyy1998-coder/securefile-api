import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { RefreshCw } from "lucide-react";
import ApprovalsPanel from "../components/approvals/ApprovalsPanel";

export default function Approvals() {
  const [data, setData] = useState<any[]>([]),
    [users, setUsers] = useState<any[]>([]),
    [err, setErr] = useState(""),
    [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    load();
  }, [refresh]);
  async function load() {
    try {
      setErr("");
      const [u, d] = await Promise.all([api("/users"), api("/workspace/approvals")]);
      setUsers(u || []);
      setData(d || []);
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Approvals</h1>
          <p>Review incoming requests and fulfill them with the correct file or folder.</p>
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
      <ApprovalsPanel
        data={data}
        refresh={() => setRefresh((x) => x + 1)}
        setErr={setErr}
      />
    </>
  );
}
