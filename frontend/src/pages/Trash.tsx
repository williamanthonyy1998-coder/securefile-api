import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { RefreshCw, RotateCcw, Trash2, FileText, Folder } from 'lucide-react';

export default function Trash() {
  const [data, setData] = useState<any>({ files: [], folders: [] });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => { try { setError(''); setData(await api('/trash')); } catch (e:any) { setError(e.message); } };
  useEffect(() => { load(); }, []);
  async function restore(type:string,id:string){try{await api(`/trash/${type.toLowerCase()}s/${id}/restore`,{method:'POST'});setNotice('Restored successfully.');load();}catch(e:any){setError(e.message)}}
  async function permanent(type:string,id:string,name:string){if(!confirm(`Permanently delete “${name}”? This cannot be undone.`))return;try{await api(`/trash/${type.toLowerCase()}s/${id}`,{method:'DELETE'});setNotice('Permanently deleted.');load();}catch(e:any){setError(e.message)}}
  const expiry=(d:string)=>{const t=new Date(d).getTime()+30*86400000;return `Auto-deletes ${new Date(t).toLocaleDateString()}`};
  return <>
    <div className="page-head"><div><p className="eyebrow">Workspace</p><h1>Trash</h1><p>Deleted files and folders stay here for 30 days before permanent deletion.</p></div><button className="btn secondary" onClick={load}><RefreshCw size={15}/> Refresh</button></div>
    {error&&<div className="error" style={{marginBottom:16}}>{error}</div>}{notice&&<div className="success" style={{marginBottom:16}}>{notice}</div>}
    <div className="panel"><div className="section-title-row"><div><h2>Recently deleted</h2><p className="muted">Restore an item anytime within 30 days, or permanently delete it now.</p></div></div>
      <div className="company-table-wrap"><table><thead><tr><th>Item</th><th>Deleted</th><th>Retention</th><th>Action</th></tr></thead><tbody>
        {data.folders.map((x:any)=><tr key={`folder-${x.id}`}><td><Folder size={16} style={{verticalAlign:'middle',marginRight:8}}/><strong>{x.name}</strong><small className="table-sub">Folder</small></td><td>{new Date(x.deletedAt).toLocaleString()}</td><td>{expiry(x.deletedAt)}</td><td><div className="row-actions"><button className="btn small" onClick={()=>restore('folder',x.id)}><RotateCcw size={13}/> Restore</button><button className="icon-btn danger" title="Delete permanently" onClick={()=>permanent('folder',x.id,x.name)}><Trash2 size={14}/></button></div></td></tr>)}
        {data.files.map((x:any)=><tr key={`file-${x.id}`}><td><FileText size={16} style={{verticalAlign:'middle',marginRight:8}}/><strong>{x.name}</strong><small className="table-sub">File · {x.mimeType}</small></td><td>{new Date(x.deletedAt).toLocaleString()}</td><td>{expiry(x.deletedAt)}</td><td><div className="row-actions"><button className="btn small" onClick={()=>restore('file',x.id)}><RotateCcw size={13}/> Restore</button><button className="icon-btn danger" title="Delete permanently" onClick={()=>permanent('file',x.id,x.name)}><Trash2 size={14}/></button></div></td></tr>)}
        {!data.files.length&&!data.folders.length&&<tr><td colSpan={4}><div className="empty-state">Trash is empty.</div></td></tr>}
      </tbody></table></div>
    </div>
  </>;
}
