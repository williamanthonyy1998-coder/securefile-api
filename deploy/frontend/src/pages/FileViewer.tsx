import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, ZoomIn, ZoomOut, RotateCcw, FileText } from 'lucide-react';
import { API, api, token } from '../lib/api';

export default function FileViewer(){
  const { id } = useParams();
  const navigate = useNavigate();
  const [file,setFile]=useState<any>(null);
  const [url,setUrl]=useState('');
  const [zoom,setZoom]=useState(1);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let objectUrl='';
    (async()=>{
      try{
        setLoading(true); setError('');
        const meta=await api(`/files/${encodeURIComponent(String(id))}`);
        setFile(meta);
        const r=await fetch(`${API}/files/${encodeURIComponent(String(id))}/preview`,{headers:{Authorization:`Bearer ${token()}`}});
        if(!r.ok){ let msg='Preview unavailable.'; try{const j=await r.json();msg=j?.error||msg}catch{} throw new Error(msg); }
        objectUrl=URL.createObjectURL(await r.blob()); setUrl(objectUrl);
      }catch(e:any){setError(e.message||'Unable to open file.');}
      finally{setLoading(false);}
    })();
    return ()=>{if(objectUrl)URL.revokeObjectURL(objectUrl)};
  },[id]);

  async function download(){
    if(!file)return;
    const r=await fetch(`${API}/files/${encodeURIComponent(String(id))}/download`,{headers:{Authorization:`Bearer ${token()}`}});
    if(!r.ok){setError('Download failed or permission denied.');return;}
    const d=r.headers.get('content-disposition')||''; const u=d.match(/filename\*=UTF-8''([^;]+)/i); const b=d.match(/filename=\"?([^\";]+)\"?/i); const serverName=u?decodeURIComponent(u[1]):(b?b[1]:''); const name=file.name||serverName; const blob=await r.blob(),u2=URL.createObjectURL(blob),a=document.createElement('a');a.href=u2;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u2),1000);
  }

  const image=!!file?.mimeType?.startsWith('image/');
  const pdf=file?.mimeType==='application/pdf';
  return <div className="file-viewer-page">
    <header className="file-viewer-header"><button className="btn secondary small" onClick={()=>navigate(-1)}><ArrowLeft size={15}/> Back</button><div className="file-viewer-title"><FileText size={18}/><strong>{file?.name||'File'}</strong></div><div className="preview-controls"><button className="icon-btn" title="Zoom out" onClick={()=>setZoom(z=>Math.max(.5,Number((z-.1).toFixed(2))))}><ZoomOut size={15}/></button><span className="zoom-value">{Math.round(zoom*100)}%</span><button className="icon-btn" title="Zoom in" onClick={()=>setZoom(z=>Math.min(3,Number((z+.1).toFixed(2))))}><ZoomIn size={15}/></button><button className="icon-btn" title="Reset zoom" onClick={()=>setZoom(1)}><RotateCcw size={15}/></button><button className="btn small" onClick={download}><Download size={15}/> Download</button></div></header>
    <main className="file-viewer-main">{loading?<div className="preview-unavailable">Opening file...</div>:error?<div className="preview-unavailable"><h2>Unable to preview this file</h2><p>{error}</p>{file&&<button className="btn" onClick={download}><Download size={15}/> Download {file.name}</button>}</div>:<div className="file-viewer-canvas">{image?<img src={url} className="viewer-image" style={{transform:`scale(${zoom})`}}/>:pdf?<iframe title={file.name} src={url} className="viewer-pdf" style={{transform:`scale(${zoom})`,transformOrigin:'top left',width:`${100/zoom}%`,height:`${100/zoom}%`}}/>:<div className="preview-unavailable"><h2>{file.name}</h2><p>This file type cannot be rendered directly in the browser.</p><button className="btn" onClick={download}><Download size={15}/> Download file</button></div>}</div>}</main>
  </div>;
}
