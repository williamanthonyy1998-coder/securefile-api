import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { RefreshCw } from "lucide-react";
import TasksPanel from "../components/tasks/TasksPanel";

export default function TaskManagement() {
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
      const [u, d] = await Promise.all([api("/users"), api("/workspace/tasks")]);
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
          <h1>Task Management</h1>
          <p>Assign, track and complete work with page-level instructions.</p>
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
      <TasksPanel
        data={data}
        users={users}
        refresh={() => setRefresh((x) => x + 1)}
        setErr={setErr}
      />
    </>
  );
}
