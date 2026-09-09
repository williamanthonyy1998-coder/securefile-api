import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { RefreshCw } from "lucide-react";
import RequestsPanel from "../components/requests/RequestsPanel";

export default function Requests() {
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
      const [u, d] = await Promise.all([api("/users"), api("/workspace/requests")]);
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
          <h1>Requests</h1>
          <p>Request a file or folder by name from the person who controls it.</p>
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
      <RequestsPanel
        data={data}
        users={users}
        refresh={() => setRefresh((x) => x + 1)}
        setErr={setErr}
      />
    </>
  );
}
