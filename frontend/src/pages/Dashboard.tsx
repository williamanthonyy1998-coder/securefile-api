import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Dashboard() {
  const [d, setD] = useState<any>();
  
  useEffect(() => {
    api("/companies/stats").then(setD).catch(console.error);
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Dashboard</h1>
          <p>Everything your team needs in one place.</p>
        </div>
      </div>
      <div className="cards">
        {[
          ["Users", d?.users || 0],
          ["Files", d?.files || 0],
          ["Folders", d?.folders || 0],
          ["Unread notifications", d?.unreadNotifications || 0],
        ].map((x) => (
          <div className="stat" key={x[0]}>
            <span>{x[0]}</span>
            <strong>{x[1]}</strong>
          </div>
        ))}
      </div>
      <div className="panel">
        <h2>Storage</h2>
        <p>
          {(Number(d?.storageUsedBytes || 0) / 1073741824).toFixed(2)} GB used
          of {d?.storageLimitGb || 0} GB
        </p>
        <div className="bar">
          <i
            style={{
              width: `${Math.min(100, (Number(d?.storageUsedBytes || 0) / 1073741824 / (d?.storageLimitGb || 1)) * 100)}%`,
            }}
          />
        </div>
      </div>
    </>
  );
}
