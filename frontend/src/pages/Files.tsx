import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, directUpload, getSignedFileUrl } from '../lib/api';
import { Download, Edit3, Eye, FolderPlus, Share2, Trash2, UploadCloud, X, Folder, ChevronRight, Copy, ZoomIn, ZoomOut, RotateCcw, Maximize2, ExternalLink, ClipboardPlus, Move } from 'lucide-react';

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
  const [taskFile, setTaskFile] = useState<any>(null);
  const [taskUsers, setTaskUsers] = useState<any[]>([]);
  const [taskForm, setTaskForm] = useState<any>({assigneeId:'',title:'',description:'',startPage:'',endPage:'',priority:'MEDIUM',dueAt:''});
  const [fileTasks, setFileTasks] = useState<any[]>([]);
  const [addons, setAddons] = useState<any>({preview:false,rename:false});
  const [moveItem, setMoveItem] = useState<any>(null);
  const [moveTarget, setMoveTarget] = useState('');
  const [moving, setMoving] = useState(false);

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
  useEffect(() => { api('/companies/me').then((c:any)=>setAddons(c.subscription?.addons||{})).catch(()=>{}); }, []);

  async function upload() {
    const f = ref.current?.files?.[0];
    if (!f) return;
    try { await directUpload(f,{folderId:folderId||undefined,source:'UPLOAD'}); setNotice('File uploaded.'); }
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
    try { setFileTasks(await api(`/workspace/tasks?fileId=${encodeURIComponent(f.id)}`)); } catch { setFileTasks([]); }
    setPreviewZoom(1);
    try {
      const signed=await getSignedFileUrl(String(f.id),'preview');
      if(!signed)throw new Error('Preview URL was not returned.');
      setPreview(signed);
    } catch(e:any){setPreview('');setError(e.message);}
  }

  async function download(f:any) {
    try {
      const signed=await getSignedFileUrl(String(f.id),'download');
      if(!signed)throw new Error('Download URL was not returned.');
      const a=document.createElement('a'); a.href=signed; a.target='_blank'; a.rel='noopener'; a.style.display='none'; document.body.appendChild(a); a.click(); a.remove();
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

  async function openTask(f:any){
    try{setTaskUsers(await api('/users'));setTaskFile(f);setTaskForm({assigneeId:'',title:`Review ${f.name}`,description:'',startPage:'',endPage:'',priority:'MEDIUM',dueAt:''});}catch(e:any){setError(e.message)}
  }
  async function createTask(){
    if(!taskFile)return;
    try{await api('/workspace/tasks',{method:'POST',body:JSON.stringify({...taskForm,fileId:taskFile.id,startPage:taskForm.startPage?+taskForm.startPage:undefined,endPage:taskForm.endPage?+taskForm.endPage:undefined,dueAt:taskForm.dueAt?new Date(taskForm.dueAt).toISOString():undefined})});setNotice('Task assigned.');setTaskFile(null);if(selected?.id===taskFile.id)setFileTasks(await api(`/workspace/tasks?fileId=${encodeURIComponent(taskFile.id)}`));}catch(e:any){setError(e.message)}
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

  async function openMove(item:any,type:'FILE'|'FOLDER'){
    setMoveItem({item,type});setMoveTarget(type==='FILE'?(item.folderId||''):(item.parentId||''));
  }
  async function confirmMove(){
    if(!moveItem)return;
    try{setMoving(true);setError('');const path=moveItem.type==='FILE'?`/files/${moveItem.item.id}`:`/folders/${moveItem.item.id}`;await api(path,{method:'PATCH',body:JSON.stringify({folderId:moveItem.type==='FILE'?(moveTarget||null):undefined,parentId:moveItem.type==='FOLDER'?(moveTarget||null):undefined})});setNotice(`${moveItem.type==='FILE'?'File':'Folder'} moved successfully.`);setMoveItem(null);setMoveTarget('');await load();}
    catch(e:any){setError(e.message)}finally{setMoving(false)}
  }

  const currentFolder = useMemo(()=>folders.find(f=>f.id===folderId),[folders,folderId]);

  return <>
    <div className="page-head">
      <div><p className="eyebrow">Workspace</p><h1>Files</h1><p>{sp.get('q') ? `Search results for “${sp.get('q')}”` : 'Secure files, folders, sharing and permission-based access.'}</p></div>
      <div className="toolbar"><input ref={ref} type="file" onChange={upload}/><button className="btn" onClick={() => ref.current?.click()}><UploadCloud size={16}/> Upload</button></div>
    </div>

    {error&&<div className="error" style={{marginBottom:16}}>{error}</div>}
    {notice&&<div className="success" style={{marginBottom:16}}>{notice}</div>}

    <div className={addons.preview?"grid2":""}>
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
              <tr key={`folder-${f.id}`}><td><button className="link-button" onClick={()=>setFolderId(f.id)}><Folder size={15} style={{verticalAlign:'middle',marginRight:6}}/>{f.name}{f.isPersonal&&<span className="folder-badge">Personal</span>}</button></td><td>{f.isPersonal?'Personal folder':'Folder'}</td><td>—</td><td>—</td><td><div className="row-actions">{!f.isPersonal&&<button className="icon-btn" title="Share" onClick={()=>openFolderShare(f)}><Share2 size={14}/></button>}{f.isPersonal&&<button className="icon-btn" title="Share personal folder" onClick={()=>openFolderShare(f)}><Share2 size={14}/></button>}{!f.isPersonal&&<><button className="icon-btn" title="Move folder" onClick={()=>openMove(f,'FOLDER')}><Move size={14}/></button>{addons.rename&&<button className="icon-btn" onClick={()=>renameFolder(f)}><Edit3 size={14}/></button>}<button className="icon-btn danger" onClick={()=>deleteFolder(f)}><Trash2 size={14}/></button></>}</div></td></tr>
            )}
            {files.map(f=><tr key={f.id}>
              <td><button className="link-button file-name-button" onClick={()=>openPreview(f)} title="Click to preview">{f.name}</button><small style={{display:'block',color:'#8a96a8'}}>{f.folder?.name||'No folder'}</small></td>
              <td>{f.mimeType}</td><td>{(Number(f.sizeBytes)/1024).toFixed(1)} KB</td><td>{f.source||'UPLOAD'}</td>
              <td><div className="row-actions">
                {addons.preview&&<><button className="icon-btn" title="Preview" onClick={()=>openPreview(f)}><Eye size={14}/></button><button className="icon-btn" title="Open in new page" onClick={()=>openFilePage(f)}><ExternalLink size={14}/></button></>}
                <button className="icon-btn" title="Download" onClick={()=>download(f)}><Download size={14}/></button>
                {addons.rename&&<button className="icon-btn" title="Rename" onClick={()=>renameFile(f)}><Edit3 size={14}/></button>}
                <button className="icon-btn" title="Move file" onClick={()=>openMove(f,'FILE')}><Move size={14}/></button>
                <button className="icon-btn" title="Share" onClick={()=>openShare(f)}><Share2 size={14}/></button>
                {localStorage.getItem('sf_role')==='COMPANY_ADMIN'&&<button className="icon-btn" title="Assign task" onClick={()=>openTask(f)}><ClipboardPlus size={14}/></button>}
                <button className="icon-btn danger" title="Delete" onClick={()=>deleteFile(f)}><Trash2 size={14}/></button>
              </div></td>
            </tr>)}
          </tbody>
        </table>
        {!files.length && !folders.filter(f=>f.parentId===folderId && !sp.get('q')).length && <div className="empty-company"><h3>No files here</h3><p>Upload a file or create a folder to get started.</p></div>}
      </div>


      {addons.preview&&<>
      <div className="panel preview">
        <div className="preview-head"><div><h2>Preview</h2>{selected&&<div className="preview-name" title={selected.name}>{selected.name}</div>}</div>{selected&&<div className="preview-controls">
          <button className="icon-btn" title="Zoom out" onClick={()=>setPreviewZoom(z=>Math.max(.5,Number((z-.1).toFixed(2))))}><ZoomOut size={15}/></button>
          <span className="zoom-value">{Math.round(previewZoom*100)}%</span>
          <button className="icon-btn" title="Zoom in" onClick={()=>setPreviewZoom(z=>Math.min(3,Number((z+.1).toFixed(2))))}><ZoomIn size={15}/></button>
          <button className="icon-btn" title="Reset zoom" onClick={()=>setPreviewZoom(1)}><RotateCcw size={15}/></button>
          <button className="icon-btn" title="Open file page" onClick={()=>openFilePage(selected)}><Maximize2 size={15}/></button>
          <button className="icon-btn" title="Close preview" onClick={()=>{setSelected(null);setPreview('');setPreviewZoom(1)}}><X size={15}/></button>
        </div>}</div>
        {selected?<><div className="preview-canvas">{preview?(selected.mimeType.startsWith('image/')?<img src={preview} className="preview-image" style={{transform:`scale(${previewZoom})`}}/>:<iframe title="preview" src={preview} className="preview-frame" style={{transform:`scale(${previewZoom})`,transformOrigin:'top left',width:`${100/previewZoom}%`,height:`${550/previewZoom}px`}}/>):<div className="preview-unavailable"><p>Preview unavailable. Check that the Preview add-on is active.</p><button className="btn small" onClick={()=>download(selected)}><Download size={15}/> Download file</button></div>}</div><div className="panel" style={{marginTop:12}}><h3 style={{marginTop:0}}>Assigned tasks</h3>{fileTasks.map((t:any)=><div key={t.id} style={{padding:'9px 0',borderBottom:'1px solid #edf0f4'}}><b>{t.title}</b><small className="table-sub">{t.assignee?.uniqueName||'Assignee'} · {t.startPage||t.endPage?`Pages ${t.startPage||1}–${t.endPage||'end'}`:'All pages'} · {t.status}</small></div>)}{!fileTasks.length&&<p className="muted">No tasks assigned to this file.</p>}</div></>:<div className="preview-unavailable"><p>Select a file to preview it.</p></div>}
      </div>
      </>}
    </div>

    {moveItem&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&!moving&&setMoveItem(null)}><div className="modal"><div className="modal-head"><div><p className="eyebrow">File Management</p><h2>Move {moveItem.type==='FILE'?'file':'folder'}</h2><p className="muted">{moveItem.item.name}</p></div><button className="close-btn" disabled={moving} onClick={()=>setMoveItem(null)}><X size={18}/></button></div><p className="muted">Choose the destination. Leaving the destination as root moves it out of the current folder.</p><label>Destination folder<select value={moveTarget} onChange={e=>setMoveTarget(e.target.value)}><option value="">Root / My visible files</option>{folders.filter(f=>{if(f.isPersonal&&moveItem.type==='FOLDER')return false;if(moveItem.type==='FILE')return true;if(f.id===moveItem.item.id)return false;let cursor=f.parentId;while(cursor){if(cursor===moveItem.item.id)return false;const parent=folders.find(x=>x.id===cursor);cursor=parent?.parentId||'';}return true;}).map(f=><option key={f.id} value={f.id}>{f.name}{f.isPersonal?' (Personal)':''}</option>)}</select></label><div className="modal-actions"><button className="btn secondary" disabled={moving} onClick={()=>setMoveItem(null)}>Cancel</button><button className="btn" disabled={moving} onClick={confirmMove}>{moving?'Moving...':'Move here'}</button></div></div></div>}

    {taskFile&&<div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><p className="eyebrow">Task Management</p><h2>Assign task</h2><p className="muted">{taskFile.name}</p></div><button className="close-btn" onClick={()=>setTaskFile(null)}><X size={18}/></button></div><label>Assignee<select value={taskForm.assigneeId} onChange={e=>setTaskForm({...taskForm,assigneeId:e.target.value})}><option value="">Select employee/client</option>{taskUsers.filter((u:any)=>u.id!==localStorage.getItem('sf_user_id')&&(u.role==='EMPLOYEE'||u.role==='CLIENT')).map((u:any)=><option key={u.id} value={u.id}>{u.uniqueName} — {u.email}</option>)}</select></label><label>Task title<input value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})}/></label><label>Instructions<textarea rows={4} value={taskForm.description} onChange={e=>setTaskForm({...taskForm,description:e.target.value})}/></label><div className="grid2"><label>Start page<input type="number" min="1" value={taskForm.startPage} onChange={e=>setTaskForm({...taskForm,startPage:e.target.value})}/></label><label>End page<input type="number" min="1" value={taskForm.endPage} onChange={e=>setTaskForm({...taskForm,endPage:e.target.value})}/></label></div><div className="grid2"><label>Priority<select value={taskForm.priority} onChange={e=>setTaskForm({...taskForm,priority:e.target.value})}>{['LOW','MEDIUM','HIGH','URGENT'].map(x=><option key={x}>{x}</option>)}</select></label><label>Due date/time<input type="datetime-local" value={taskForm.dueAt} onChange={e=>setTaskForm({...taskForm,dueAt:e.target.value})}/></label></div><div className="modal-actions"><button className="btn secondary" onClick={()=>setTaskFile(null)}>Cancel</button><button className="btn" disabled={!taskForm.assigneeId||!taskForm.title.trim()} onClick={createTask}>Assign task</button></div></div></div>}
    {(shareFile||shareFolder)&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&(setShareFile(null),setShareFolder(null))}>
      <div className="modal"><div className="modal-head"><div><p className="eyebrow">Sharing</p><h2>Share {(shareFile||shareFolder).name}</h2></div><button className="close-btn" onClick={()=>{setShareFile(null);setShareFolder(null)}}><X size={18}/></button></div>
        <label>Share type<select value={shareType} onChange={e=>setShareType(e.target.value)}><option value="INTERNAL">Internal company user</option><option value="PUBLIC">Public link</option></select></label>
        {shareType==='INTERNAL'&&<label>Recipient<select value={shareRecipient} onChange={e=>setShareRecipient(e.target.value)}><option value="">Choose a user</option>{users.filter(u=>u.id!==localStorage.getItem('sf_user_id')).map(u=><option key={u.id} value={u.id}>{u.uniqueName} — {u.email}</option>)}</select></label>}
        <div className="modal-section">Permissions</div><div className="permission-checks" style={{paddingLeft:0}}>{(['view','download','upload','edit','delete',...(addons.reshare ? ['share'] : [])] as Array<keyof typeof sharePerms>).map(k => (
  <label className="tiny-check" key={k}>
    <input
      type="checkbox"
      checked={!!sharePerms[k]}
      onChange={e => setSharePerms({...sharePerms, [k]: e.target.checked})}
    />
    {k}
  </label>
))}</div>
        {shareType==='PUBLIC'&&<><label>Password (optional)<input type="password" value={sharePassword} onChange={e=>setSharePassword(e.target.value)} placeholder="Protect this link"/></label><label>Expires (optional)<input type="datetime-local" value={shareExpiry} onChange={e=>setShareExpiry(e.target.value)}/></label></>}
        {publicToken&&<div className="success">Public token created. <button className="link-button" onClick={()=>navigator.clipboard.writeText(`${window.location.origin}/public-share/${publicToken}`)}><Copy size={14}/> Copy public link</button></div>}
        <div className="modal-actions"><button className="btn secondary" onClick={()=>setShareFile(null)}>Close</button><button className="btn" onClick={createShare}><Share2 size={15}/> Create share</button></div>
      </div>
    </div>}
  </>;
}
