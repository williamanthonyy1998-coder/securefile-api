import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, API, token } from '../lib/api';
import { Download, Edit3, Eye, FolderPlus, Share2, Trash2, UploadCloud, X, Folder, ChevronRight, Copy, ZoomIn, ZoomOut, RotateCcw, Maximize2, ExternalLink } from 'lucide-react';

const emptyPerms = { view: true, download: false, upload: false, edit: false, delete: false, share: false };

export default function Files() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const ref = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [folderId, setFolderId] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [preview, setPreview] = useState('');
  const [previewZoom, setPreviewZoom] = useState(1);
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [shareFile, setShareFile] = useState<any>(null); const [shareFolder, setShareFolder] = useState<any>(null);
  const [shareType, setShareType] = useState('INTERNAL');
  const [shareRecipient, setShareRecipient] = useState('');
  const [sharePerms, setSharePerms] = useState({...emptyPerms});
  const [sharePassword, setSharePassword] = useState('');
  const [shareExpiry, setShareExpiry] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [publicToken, setPublicToken] = useState('');

  async function load() {
    try {
      setError('');
      const q = sp.get('q') || '';
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      else if (folderId) params.set('folderId', folderId);
      const [f, fo] = await Promise.all([
        api(`/files${params.toString() ? `?${params}` : ''}`),
        api('/folders')
      ]);
      setFiles(Array.isArray(f) ? f : []);
      setFolders(Array.isArray(fo) ? fo : []);
    } catch (e:any) { setError(e.message || 'Unable to load files.'); }
  }

  useEffect(() => { load(); }, [folderId, sp]);

  async function upload() {
    const f = ref.current?.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('file', f);
    if (folderId) fd.append('folderId', folderId);
    try { await api('/files/upload', {method:'POST',body:fd}); setNotice('File uploaded.'); }
    catch(e:any) { setError(e.message); }
    if (ref.current) ref.current.value = '';
    load();
  }

  async function createFolder() {
    if (!folderName.trim()) return;
    try { await api('/folders',{method:'POST',body:JSON.stringify({name:folderName,parentId:folderId||undefined})}); setFolderName(''); setNotice('Folder created.'); load(); }
    catch(e:any){ setError(e.message); }
  }

  async function renameFile(f:any) {
    const name = window.prompt('New file name', f.name);
    if (!name || name === f.name) return;
    try { await api(`/files/${f.id}`,{method:'PATCH',body:JSON.stringify({name})}); setNotice('File renamed.'); load(); }
    catch(e:any){setError(e.message);}
  }

  async function deleteFile(f:any) {
    if (!confirm(`Delete "${f.name}"?`)) return;
    try { await api(`/files/${f.id}`,{method:'DELETE'}); if(selected?.id===f.id){setSelected(null);setPreview('')} setNotice('File deleted.'); load(); }
    catch(e:any){setError(e.message);}
  }

  async function renameFolder(f:any) {
    const name = window.prompt('New folder name', f.name);
    if (!name || name === f.name) return;
    try { await api(`/folders/${f.id}`,{method:'PATCH',body:JSON.stringify({name})}); setNotice('Folder renamed.'); load(); }
    catch(e:any){setError(e.message);}
  }

  async function deleteFolder(f:any) {
    if (!confirm(`Delete folder "${f.name}" and its empty child structure?`)) return;
    try { await api(`/folders/${f.id}`,{method:'DELETE'}); if(folderId===f.id)setFolderId(''); setNotice('Folder deleted.'); load(); }
    catch(e:any){setError(e.message);}
  }

  async function openPreview(f:any) {
    setSelected(f);
    setPreviewZoom(1);
    try {
      const r = await fetch(`${API}/files/${f.id}/preview`,{headers:{Authorization:`Bearer ${token()}`}});
      if(!r.ok){ const t=await r.text(); throw new Error(t || `Preview failed (${r.status})`); }
      const blob=await r.blob(); setPreview(URL.createObjectURL(blob));
    } catch(e:any){setPreview('');setError(e.message);}
  }

  async function download(f:any) {
    try {
      const r=await fetch(`${API}/files/${f.id}/download`,{headers:{Authorization:`Bearer ${token()}`}});
      if(!r.ok) { let msg='Download failed or permission denied.'; try { const j=await r.json(); msg=j?.error||msg; } catch {} throw new Error(msg); }
      const disposition=r.headers.get('content-disposition')||'';
      const utf=disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const basic=disposition.match(/filename=\"?([^\";]+)\"?/i);
      const serverName=utf ? decodeURIComponent(utf[1]) : (basic ? basic[1] : '');
      const filename=f.name || serverName || 'download';
      const b=await r.blob(),u=URL.createObjectURL(b),a=document.createElement('a');
      a.href=u;a.download=filename;a.style.display='none';document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(u),1000);
    } catch(e:any){setError(e.message);}
  }

  function openFilePage(f:any) {
    navigate(`/files/${encodeURIComponent(f.id)}/view`);
  }

  async function openShare(f:any) {
    try { setUsers(await api('/users')); setShareFile(f); setPublicToken(''); setShareType('INTERNAL'); setShareRecipient(''); setSharePerms({...emptyPerms}); setSharePassword(''); setShareExpiry(''); }
    catch(e:any){setError(e.message);}
  }

  async function openFolderShare(f:any) {
    try { setUsers(await api('/users')); setShareFolder(f); setShareFile(null); setPublicToken(''); setShareType('INTERNAL'); setShareRecipient(''); setSharePerms({...emptyPerms}); setSharePassword(''); setShareExpiry(''); }
    catch(e:any){setError(e.message);}
  }

  async function createShare() {
    if (!shareFile && !shareFolder) return;
    try {
      const d=await api('/sharing',{method:'POST',body:JSON.stringify({
        fileId:shareFile?.id,folderId:shareFolder?.id,type:shareType,recipientId:shareType==='INTERNAL'?shareRecipient:undefined,
        permissions:sharePerms,password:sharePassword||undefined,expiresAt:shareExpiry||undefined
      })});
      setPublicToken(d.publicToken||'');
      setNotice('Share created.');
      if(shareType==='INTERNAL'){setShareFile(null);setShareFolder(null);}
    } catch(e:any){setError(e.message);}
  }

  const currentFolder = useMemo(()=>folders.find(f=>f.id===folderId),[folders,folderId]);

  return <>
    <div className="page-head">
      <div><p className="eyebrow">Workspace</p><h1>Files</h1><p>{sp.get('q') ? `Search results for “${sp.get('q')}”` : 'Secure files, folders, sharing and permission-based access.'}</p></div>
      <div className="toolbar"><input ref={ref} type="file" onChange={upload}/><button className="btn" onClick={() => ref.current?.click()}><UploadCloud size={16}/> Upload</button></div>
    </div>

    {error&&<div className="error" style={{marginBottom:16}}>{error}</div>}
    {notice&&<div className="success" style={{marginBottom:16}}>{notice}</div>}

    <div className="grid2">
      <div className="panel">
        <div className="toolbar" style={{marginBottom:12}}>
          <select value={folderId} onChange={e=>setFolderId(e.target.value)}>
            <option value="">All visible files</option>
            {folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <input value={folderName} onChange={e=>setFolderName(e.target.value)} placeholder="New folder name"/>
          <button className="btn small" onClick={createFolder}><FolderPlus size={15}/> Create</button>
        </div>

        {currentFolder && <div className="breadcrumb"><Folder size={15}/> {currentFolder.name} <ChevronRight size={14}/><button className="link-button" onClick={()=>setFolderId('')}>All files</button></div>}

        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Source</th><th>Actions</th></tr></thead>
          <tbody>
            {folders.filter(f=>f.parentId===folderId && !sp.get('q')).map(f=>
              <tr key={`folder-${f.id}`}><td><button className="link-button" onClick={()=>setFolderId(f.id)}><Folder size={15} style={{verticalAlign:'middle',marginRight:6}}/>{f.name}</button></td><td>Folder</td><td>—</td><td>—</td><td><button className="icon-btn" title="Share" onClick={()=>openFolderShare(f)}><Share2 size={14}/></button><button className="icon-btn" onClick={()=>renameFolder(f)}><Edit3 size={14}/></button><button className="icon-btn danger" onClick={()=>deleteFolder(f)}><Trash2 size={14}/></button></td></tr>
            )}
            {files.map(f=><tr key={f.id}>
              <td><button className="link-button file-name-button" onClick={()=>openPreview(f)} onDoubleClick={()=>openFilePage(f)} title="Double-click to open">{f.name}</button><small style={{display:'block',color:'#8a96a8'}}>{f.folder?.name||'No folder'}</small></td>
              <td>{f.mimeType}</td><td>{(Number(f.sizeBytes)/1024).toFixed(1)} KB</td><td>{f.source||'UPLOAD'}</td>
              <td><div className="row-actions">
                <button className="icon-btn" title="Preview" onClick={()=>openPreview(f)}><Eye size={14}/></button><button className="icon-btn" title="Open in new page" onClick={()=>openFilePage(f)}><ExternalLink size={14}/></button>
                <button className="icon-btn" title="Download" onClick={()=>download(f)}><Download size={14}/></button>
                <button className="icon-btn" title="Rename" onClick={()=>renameFile(f)}><Edit3 size={14}/></button>
                <button className="icon-btn" title="Share" onClick={()=>openShare(f)}><Share2 size={14}/></button>
                <button className="icon-btn danger" title="Delete" onClick={()=>deleteFile(f)}><Trash2 size={14}/></button>
              </div></td>
            </tr>)}
          </tbody>
        </table>
        {!files.length && !folders.filter(f=>f.parentId===folderId && !sp.get('q')).length && <div className="empty-company"><h3>No files here</h3><p>Upload a file or create a folder to get started.</p></div>}
      </div>

      <div className="panel preview">
        <div className="preview-head"><div><h2>Preview</h2>{selected&&<div className="preview-name" title={selected.name}>{selected.name}</div>}</div>{selected&&<div className="preview-controls">
          <button className="icon-btn" title="Zoom out" onClick={()=>setPreviewZoom(z=>Math.max(.5,Number((z-.1).toFixed(2))))}><ZoomOut size={15}/></button>
          <span className="zoom-value">{Math.round(previewZoom*100)}%</span>
          <button className="icon-btn" title="Zoom in" onClick={()=>setPreviewZoom(z=>Math.min(3,Number((z+.1).toFixed(2))))}><ZoomIn size={15}/></button>
          <button className="icon-btn" title="Reset zoom" onClick={()=>setPreviewZoom(1)}><RotateCcw size={15}/></button>
          <button className="icon-btn" title="Open file page" onClick={()=>openFilePage(selected)}><Maximize2 size={15}/></button>
          <button className="icon-btn" title="Close preview" onClick={()=>{setSelected(null);setPreview('');setPreviewZoom(1)}}><X size={15}/></button>
        </div>}</div>
        {selected?<><div className="preview-canvas">{preview?(selected.mimeType.startsWith('image/')?<img src={preview} className="preview-image" style={{transform:`scale(${previewZoom})`}}/>:<iframe title="preview" src={preview} className="preview-frame" style={{transform:`scale(${previewZoom})`,transformOrigin:'top left',width:`${100/previewZoom}%`,height:`${550/previewZoom}px`}}/>):<div className="preview-unavailable"><p>Preview unavailable. Check that the Preview add-on is active.</p><button className="btn small" onClick={()=>download(selected)}><Download size={15}/> Download file</button></div>}</div></>:<div className="preview-unavailable"><p>Select a file to preview it.</p></div>}
      </div>
    </div>

    {(shareFile||shareFolder)&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&(setShareFile(null),setShareFolder(null))}>
      <div className="modal"><div className="modal-head"><div><p className="eyebrow">Sharing</p><h2>Share {(shareFile||shareFolder).name}</h2></div><button className="close-btn" onClick={()=>{setShareFile(null);setShareFolder(null)}}><X size={18}/></button></div>
        <label>Share type<select value={shareType} onChange={e=>setShareType(e.target.value)}><option value="INTERNAL">Internal company user</option><option value="PUBLIC">Public link</option></select></label>
        {shareType==='INTERNAL'&&<label>Recipient<select value={shareRecipient} onChange={e=>setShareRecipient(e.target.value)}><option value="">Choose a user</option>{users.filter(u=>u.id!==localStorage.getItem('sf_user_id')).map(u=><option key={u.id} value={u.id}>{u.uniqueName} — {u.email}</option>)}</select></label>}
        <div className="modal-section">Permissions</div><div className="permission-checks" style={{paddingLeft:0}}>{(['view','download','upload','edit','delete','share'] as const).map(k=><label className="tiny-check" key={k}><input type="checkbox" checked={!!sharePerms[k]} onChange={e=>setSharePerms({...sharePerms,[k]:e.target.checked})}/>{k}</label>)}</div>
        {shareType==='PUBLIC'&&<><label>Password (optional)<input type="password" value={sharePassword} onChange={e=>setSharePassword(e.target.value)} placeholder="Protect this link"/></label><label>Expires (optional)<input type="datetime-local" value={shareExpiry} onChange={e=>setShareExpiry(e.target.value)}/></label></>}
        {publicToken&&<div className="success">Public token created. <button className="link-button" onClick={()=>navigator.clipboard.writeText(`${window.location.origin}/public-share/${publicToken}`)}><Copy size={14}/> Copy public link</button></div>}
        <div className="modal-actions"><button className="btn secondary" onClick={()=>setShareFile(null)}>Close</button><button className="btn" onClick={createShare}><Share2 size={15}/> Create share</button></div>
      </div>
    </div>}
  </>;
}
