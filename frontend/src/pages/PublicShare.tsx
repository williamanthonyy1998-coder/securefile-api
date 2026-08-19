import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, API } from '../lib/api';
import { Download, LockKeyhole } from 'lucide-react';

export default function PublicShare() {
  const { token = '' } = useParams();
  const [password, setPassword] = useState('');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function unlock() {
    try {
      setLoading(true); setErr('');
      const d = await api(`/public/shares/${encodeURIComponent(token)}/unlock`, {method:'POST',body:JSON.stringify({password})});
      setData(d);
    } catch(e:any){setErr(e.message);}
    finally{setLoading(false);}
  }

  async function download() {
    try {
      const r = await fetch(`${API}/public/shares/${encodeURIComponent(token)}/download`, {
        headers: password ? {'x-share-password': password} : {}
      });
      if(!r.ok) throw new Error(await r.text() || 'Download unavailable');
      const b=await r.blob(),u=URL.createObjectURL(b),a=document.createElement('a');
      a.href=u;a.download=data?.file?.name||'download';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
    } catch(e:any){setErr(e.message);}
  }

  return <div className="auth"><div className="form-card">
    <p className="eyebrow">SecureFile public share</p>
    <h1>{data?.file?.name || data?.folder?.name || 'Shared resource'}</h1>
    <p className="muted">This link is protected by the share permissions set by the owner.</p>
    {err&&<div className="error">{err}</div>}
    {!data && <><label>Password (if required)<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter share password"/></label><button className="btn" onClick={unlock} disabled={loading}><LockKeyhole size={16}/> {loading?'Checking...':'Open share'}</button></>}
    {data?.file && data.downloadUrl && <button className="btn" onClick={download}><Download size={16}/> Download file</button>}
    {data?.folder && <div className="success">This share points to the folder <b>{data.folder.name}</b>. Sign in to SecureFile to work with folder permissions.</div>}
  </div></div>;
}
