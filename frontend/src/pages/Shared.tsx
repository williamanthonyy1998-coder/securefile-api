import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { RefreshCw } from "lucide-react";
import SharedPanel from "../components/shared/SharedPanel";

export default function Shared() {
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
      setData(await api("/sharing"));
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Shared</h1>
          <p>Manage resources shared with you or by you.</p>
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
      <SharedPanel
        data={data}
        refresh={() => setRefresh((x) => x + 1)}
        setErr={setErr}
      />
    </>
  );
}
