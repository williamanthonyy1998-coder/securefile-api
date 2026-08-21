import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, ZoomIn, ZoomOut, RotateCcw, FileText } from 'lucide-react';
import { api, getSignedFileUrl } from '../lib/api';

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
        const signed=await getSignedFileUrl(String(id),'preview');
        if(!signed)throw new Error('Preview URL was not returned.');
        setUrl(signed);
      }catch(e:any){setError(e.message||'Unable to open file.');}
      finally{setLoading(false);}
    })();
    return ()=>{if(objectUrl)URL.revokeObjectURL(objectUrl)};
  },[id]);

  async function download(){
    if(!file)return;
    try{
      const signed=await getSignedFileUrl(String(id),'download');
      if(!signed)throw new Error('Download URL was not returned.');
      const a=document.createElement('a'); a.href=signed; a.target='_blank'; a.rel='noopener'; a.style.display='none'; document.body.appendChild(a); a.click(); a.remove();
    }catch(e:any){setError(e.message||'Download failed.');}
  }

  const image=!!file?.mimeType?.startsWith('image/');
  const pdf=file?.mimeType==='application/pdf';
  return <div className="file-viewer-page">
    <header className="file-viewer-header"><button className="btn secondary small" onClick={()=>navigate(-1)}><ArrowLeft size={15}/> Back</button><div className="file-viewer-title"><FileText size={18}/><strong>{file?.name||'File'}</strong></div><div className="preview-controls"><button className="icon-btn" title="Zoom out" onClick={()=>setZoom(z=>Math.max(.5,Number((z-.1).toFixed(2))))}><ZoomOut size={15}/></button><span className="zoom-value">{Math.round(zoom*100)}%</span><button className="icon-btn" title="Zoom in" onClick={()=>setZoom(z=>Math.min(3,Number((z+.1).toFixed(2))))}><ZoomIn size={15}/></button><button className="icon-btn" title="Reset zoom" onClick={()=>setZoom(1)}><RotateCcw size={15}/></button><button className="btn small" onClick={download}><Download size={15}/> Download</button></div></header>
    <main className="file-viewer-main">{loading?<div className="preview-unavailable">Opening file...</div>:error?<div className="preview-unavailable"><h2>Unable to preview this file</h2><p>{error}</p>{file&&<button className="btn" onClick={download}><Download size={15}/> Download {file.name}</button>}</div>:<div className="file-viewer-canvas">{image?<img src={url} className="viewer-image" style={{transform:`scale(${zoom})`}}/>:pdf?<iframe title={file.name} src={url} className="viewer-pdf" style={{transform:`scale(${zoom})`,transformOrigin:'top left',width:`${100/zoom}%`,height:`${100/zoom}%`}}/>:<div className="preview-unavailable"><h2>{file.name}</h2><p>This file type cannot be rendered directly in the browser.</p><button className="btn" onClick={download}><Download size={15}/> Download file</button></div>}</div>}</main>
  </div>;
}
