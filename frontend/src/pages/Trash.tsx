import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { RefreshCw, RotateCcw, Trash2, FileText, Folder, ShieldCheck } from 'lucide-react';
import { sfConfirm } from "../lib/dialogs";

export default function Trash() {
  const [data, setData] = useState<any>({ files: [], folders: [] });
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setData(await api('/trash', { headers: { "X-Silent-Alert": "true" } }));
    } catch {
      // api() surfaces the error through the global side toast.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  async function restore(type:string,id:string){
    setBusyId(`${type}-${id}`);
    try {
      await api(`/trash/${type.toLowerCase()}/${id}/restore`,{method:'POST'});
      await load();
    } catch {} finally {
      setBusyId("");
    }
  }

  async function permanent(type:string,id:string,name:string){
    if(!(await sfConfirm(`Permanently delete “${name}”? This cannot be undone.`, { title: "Permanent deletion", danger: true, confirmLabel: "Delete permanently" }))) return;
    setBusyId(`${type}-${id}-delete`);
    try {
      await api(`/trash/${type.toLowerCase()}/${id}`,{method:'DELETE'});
      await load();
    } catch {} finally {
      setBusyId("");
    }
  }

  const expiry=(d:string)=>{
    const t=new Date(d).getTime()+30*86400000;
    return new Date(t).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
  };

  const total = data.files.length + data.folders.length;

  return <div className="trash-page-panel">
    <div className="page-head">
      <div>
        <p className="eyebrow">Workspace</p>
        <h1>Trash</h1>
        <p>Deleted files and folders are retained for 30 days before permanent deletion.</p>
      </div>
      <button className="btn secondary" onClick={() => void load()} disabled={loading} aria-busy={loading}>
        <RefreshCw size={15}/> {loading ? "Refreshing…" : "Refresh"}
      </button>
    </div>

    <div className="trash-overview-grid">
      <div className="trash-overview-card">
        <div className="trash-overview-icon"><Trash2 size={17}/></div>
        <div><strong>{total}</strong><span>Items in trash</span></div>
      </div>
      <div className="trash-overview-card">
        <div className="trash-overview-icon"><FileText size={17}/></div>
        <div><strong>{data.files.length}</strong><span>Deleted files</span></div>
      </div>
      <div className="trash-overview-card">
        <div className="trash-overview-icon"><Folder size={17}/></div>
        <div><strong>{data.folders.length}</strong><span>Deleted folders</span></div>
      </div>
      <div className="trash-overview-card trash-policy-card">
        <div className="trash-overview-icon"><ShieldCheck size={17}/></div>
        <div><strong>30 days</strong><span>Automatic retention</span></div>
      </div>
    </div>

    <div className="trash-table-panel">
      <div className="trash-panel-head">
        <div>
          <h2>Recently deleted</h2>
          <p>Restore an item within the retention period, or permanently remove it.</p>
        </div>
        <span className="trash-count-pill">{total} {total === 1 ? 'item' : 'items'}</span>
      </div>

      <div className="company-table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Deleted</th><th>Retention</th><th className="trash-action-head">Action</th></tr></thead>
          <tbody>
            {loading && !total ? Array.from({length:5}).map((_,i)=><tr key={`sk-${i}`}><td colSpan={4}><div className="trash-row-skeleton"><span/><span/><span/></div></td></tr>) : null}
            {data.folders.map((x:any)=><tr key={`folder-${x.id}`}>
              <td><div className="trash-item-cell"><div className="trash-item-icon"><Folder size={17}/></div><div className="trash-item-copy"><strong title={x.name}>{x.name}</strong><small>Folder</small></div></div></td>
              <td>{new Date(x.deletedAt).toLocaleString()}</td><td><span className="trash-retention">Auto-deletes {expiry(x.deletedAt)}</span></td>
              <td><div className="trash-actions"><button className="btn small" aria-busy={busyId===`FOLDER-${x.id}`} disabled={!!busyId} onClick={()=>restore('FOLDER',x.id)}><RotateCcw size={13}/> {busyId===`FOLDER-${x.id}` ? "Restoring…" : "Restore"}</button><button className="icon-btn danger" aria-busy={busyId===`FOLDER-${x.id}-delete`} disabled={!!busyId} title="Delete permanently" onClick={()=>permanent('FOLDER',x.id,x.name)}><Trash2 size={14}/></button></div></td>
            </tr>)}
            {data.files.map((x:any)=><tr key={`file-${x.id}`}>
              <td><div className="trash-item-cell"><div className="trash-item-icon"><FileText size={17}/></div><div className="trash-item-copy"><strong title={x.name}>{x.name}</strong><small>File · {x.mimeType || 'Document'}</small></div></div></td>
              <td>{new Date(x.deletedAt).toLocaleString()}</td><td><span className="trash-retention">Auto-deletes {expiry(x.deletedAt)}</span></td>
              <td><div className="trash-actions"><button className="btn small" aria-busy={busyId===`FILE-${x.id}`} disabled={!!busyId} onClick={()=>restore('FILE',x.id)}><RotateCcw size={13}/> {busyId===`FILE-${x.id}` ? "Restoring…" : "Restore"}</button><button className="icon-btn danger" aria-busy={busyId===`FILE-${x.id}-delete`} disabled={!!busyId} title="Delete permanently" onClick={()=>permanent('FILE',x.id,x.name)}><Trash2 size={14}/></button></div></td>
            </tr>)}
            {!loading && !total && <tr><td colSpan={4}><div className="trash-empty"><div className="trash-empty-icon"><Trash2 size={20}/></div><strong>Trash is empty</strong><span>Deleted files and folders will appear here for up to 30 days.</span></div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </div>;
}
