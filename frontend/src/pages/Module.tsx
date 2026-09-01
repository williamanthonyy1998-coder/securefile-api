import {useEffect,useRef,useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {api,directUpload} from '../lib/api';
import {jpegPagesToPdfBlob} from '../utils/jpegPdf';
import {Check,Trash2,RefreshCw,Send,RotateCcw,ShieldCheck,Clock,FileUp,X,ScanLine,Wifi,WifiOff,ChevronLeft,ChevronRight,Camera,Bluetooth,Flashlight,FlashlightOff,Link2Off,Download,ExternalLink,PhoneIncoming,PhoneOutgoing} from 'lucide-react';

const META:any={shared:['Shared','Manage resources shared with you or by you.'],requests:['Requests','Request a file or folder by name from the person who controls it.'],approvals:['Approvals','Review incoming requests and fulfill them with the correct file or folder.'],'task-management':['Task Management','Assign, track and complete work with page-level instructions.'],trash:['Trash','Recover deleted files and folders for 30 days.'],chat:['Chat','Company-scoped secure messaging.'],'scan-documents':['Scan Documents','Connect the Windows scanner bridge, scan as many pages as you need, combine them into one PDF, name it, and save it privately.'],'fax-documents':['Fax Documents','Receive faxes on your personal SecureFile number and send documents to any fax number.'],ai:['AI Chat Bot','Ask the configured SecureFile assistant.'],settings:['Settings','Review company and subscription settings.']};

export default function Module(){const{name='shared'}=useParams();const [features,setFeatures]=useState<any>({});const [data,setData]=useState<any[]>([]),[users,setUsers]=useState<any[]>([]),[err,setErr]=useState(''),[notice,setNotice]=useState('');const [refresh,setRefresh]=useState(0);const title= META[name]?.[0]||name;const desc=META[name]?.[1]||'Workspace module';
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('sf_addons')||'{}');if(saved&&typeof saved==='object')setFeatures(saved);}catch{}},[]);
 useEffect(()=>{load()},[name,refresh]);async function load(){try{setErr('');const needsUsers=['requests','approvals','task-management'].includes(name||'');const endpoint:any={shared:'/sharing',requests:'/workspace/requests',approvals:'/workspace/approvals','task-management':'/workspace/tasks'}[name||''];const jobs:any[]=[];if(needsUsers)jobs.push(api('/users'));if(endpoint)jobs.push(api(endpoint));if(jobs.length){const out=await Promise.all(jobs);let i=0;if(needsUsers)setUsers(out[i++]||[]);if(endpoint)setData(out[i++]||[]);}}catch(e:any){setErr(e.message)}}
 async function action(path:string,method='POST',body?:any){try{await api(path,{method,body:body?JSON.stringify(body):undefined});setNotice('Updated successfully.');setRefresh(x=>x+1)}catch(e:any){setErr(e.message)}}
 const gated=(name==='scan-documents'&&!features.scanner)||(name==='fax-documents'&&!features.fax);
 if(gated)return <><div className="page-head"><div><p className="eyebrow">Workspace</p><h1>{title}</h1><p>{desc}</p></div></div><div className="panel"><h2>Feature not included in your plan</h2><p className="muted">This module is hidden from your workspace because the required add-on is not included in your current SecureFile subscription.</p></div></>;
 return <><div className="page-head"><div><p className="eyebrow">Workspace</p><h1>{title}</h1><p>{desc}</p></div><button className="btn secondary" onClick={()=>setRefresh(x=>x+1)}><RefreshCw size={15}/> Refresh</button></div>{err&&<div className="error" style={{marginBottom:16}}>{err}</div>}{notice&&<div className="success" style={{marginBottom:16}}>{notice}</div>}
 {name==='requests'&&<Requests data={data} users={users} refresh={()=>setRefresh(x=>x+1)} setErr={setErr}/>} {name==='approvals'&&<Approvals data={data} refresh={()=>setRefresh(x=>x+1)} setErr={setErr}/>} {name==='task-management'&&<Tasks data={data} users={users} refresh={()=>setRefresh(x=>x+1)} setErr={setErr}/>} {name==='trash'&&<Trash refresh={()=>setRefresh(x=>x+1)} setErr={setErr}/>} {name==='shared'&&<Shared data={data} refresh={()=>setRefresh(x=>x+1)} setErr={setErr}/>} {name==='chat'&&<Chat users={users}/>} {name==='scan-documents'&&<UploadModule kind="scan" setErr={setErr}/>} {name==='fax-documents'&&<UploadModule kind="fax" setErr={setErr}/>} {name==='ai'&&<AI setErr={setErr}/>} {name==='settings'&&<Settings/>}</>}

function Requests({data,users,refresh,setErr}:any){const [type,setType]=useState('FILE'),[name,setName]=useState(''),[approver,setApprover]=useState(''),[note,setNote]=useState(''),[download,setDownload]=useState(false);const me=localStorage.getItem('sf_user_id');async function submit(){try{await api('/workspace/requests',{method:'POST',body:JSON.stringify({requestedType:type,requestedName:name,targetUserId:approver,note,canDownload:download})});setName('');setApprover('');setNote('');setDownload(false);refresh()}catch(e:any){setErr(e.message)}}return <div className="grid2"><div className="panel"><h2>Request access</h2><p className="muted">You do not need to choose a file you already have. Tell the person what you need; they will select the actual resource when approving.</p><label>Requested item type<select value={type} onChange={e=>setType(e.target.value)}><option value="FILE">File</option><option value="FOLDER">Folder</option></select></label><label>File / folder name<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. March Claims Report.pdf"/></label><label>Send request to<select value={approver} onChange={e=>setApprover(e.target.value)}><option value="">Select authorized person</option>{users.filter((u:any)=>u.id!==me&&u.status==='ACTIVE').map((u:any)=><option key={u.id} value={u.id}>{u.uniqueName} — {u.role}</option>)}</select></label><label>Why do you need it?<textarea rows={4} value={note} onChange={e=>setNote(e.target.value)} placeholder="Explain what you need and why."/></label><label className="checkline"><input type="checkbox" checked={download} onChange={e=>setDownload(e.target.checked)}/> Request download permission too</label><button className="btn" disabled={!name.trim()||!approver} onClick={submit}>Submit request</button></div><div className="panel"><h2>My requests</h2><p className="muted">Only requests you submitted. You cannot approve your own requests.</p><table><thead><tr><th>Requested</th><th>Approver</th><th>Access</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.map((x:any)=><tr key={x.id}><td><b>{x.requestedName}</b><small className="table-sub">{x.requestedType}</small></td><td>{x.targetUser?.uniqueName||x.targetUser?.email||'—'}</td><td>{x.canDownload?'View + Download':'View'}</td><td><span className={`status-pill ${x.status==='APPROVED'?'active':x.status==='REJECTED'?'danger':''}`}>{x.status}</span></td><td>{x.status==='PENDING'&&<button className="icon-btn danger" title="Delete request" onClick={async()=>{if(confirm('Delete this pending request?')){try{await api('/workspace/requests/'+x.id,{method:'DELETE'});refresh()}catch(e:any){setErr(e.message)}}}}><Trash2 size={14}/></button>}</td></tr>)}{!data.length&&<tr><td colSpan={5} className="muted">No requests yet.</td></tr>}</tbody></table></div></div>}

function Approvals({data,refresh,setErr}:any){const [open,setOpen]=useState<any>(null),[resources,setResources]=useState<any[]>([]),[q,setQ]=useState('');async function select(a:any){setOpen(a);try{setResources(await api('/workspace/approvals/'+a.id+'/resources?q='+encodeURIComponent(a.accessRequest?.requestedName||'')))}catch(e:any){setErr(e.message)}}async function resolve(status:string,r?:any){try{await api('/workspace/approvals/'+open.id,{method:'PATCH',body:JSON.stringify({status,fileId:r?.type==='FILE'?r.id:undefined,folderId:r?.type==='FOLDER'?r.id:undefined})});setOpen(null);refresh()}catch(e:any){setErr(e.message)}}return <div className="panel"><h2>Incoming approval requests</h2><p className="muted">Only requests assigned to you appear here. The requester never gets approval controls.</p><table><thead><tr><th>Requester</th><th>Requested item</th><th>Reason</th><th>Access</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.map((a:any)=><tr key={a.id}><td><b>{a.requester?.uniqueName}</b><small className="table-sub">{a.requester?.email}</small></td><td><b>{a.accessRequest?.requestedName}</b><small className="table-sub">{a.accessRequest?.requestedType}</small></td><td>{a.note||'—'}</td><td>{a.canDownload?'View + Download':'View'}</td><td>{a.status}</td><td>{a.status==='PENDING'?<button className="btn small" onClick={()=>select(a)}><ShieldCheck size={13}/> Review</button>:<span className="muted">Resolved</span>}</td></tr>)}{!data.length&&<tr><td colSpan={6} className="muted">No pending requests.</td></tr>}</tbody></table>{open&&<div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><p className="eyebrow">Approval</p><h2>Fulfill request</h2><p className="muted">Requester asked for: <b>{open.accessRequest?.requestedName}</b></p></div><button className="close-btn" onClick={()=>setOpen(null)}><X size={18}/></button></div><label>Search actual resource<input value={q} onChange={async e=>{setQ(e.target.value);try{setResources(await api('/workspace/approvals/'+open.id+'/resources?q='+encodeURIComponent(e.target.value)))}catch{}}} placeholder="Search files/folders you control"/></label><div className="data" style={{maxHeight:240}}>{resources.map(r=><button key={r.type+r.id} className="link-button" style={{display:'block',padding:'10px 0',width:'100%'}} onClick={()=>resolve('APPROVED',r)}>{r.name} <small>({r.type})</small></button>)}{!resources.length&&<span className="muted">No matching resources you are authorized to share.</span>}</div><div className="modal-actions"><button className="btn secondary" onClick={()=>setOpen(null)}>Cancel</button><button className="btn secondary" onClick={()=>resolve('REJECTED')}>Reject</button></div></div></div>}</div>}

function Tasks({data,users,refresh,setErr}:any){const [assignee,setAssignee]=useState(''),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[resourceType,setResourceType]=useState('FILE'),[resourceId,setResourceId]=useState(''),[resources,setResources]=useState<any[]>([]),[start,setStart]=useState(''),[end,setEnd]=useState(''),[priority,setPriority]=useState('MEDIUM'),[dueAt,setDueAt]=useState('');const admin=localStorage.getItem('sf_role')==='COMPANY_ADMIN';useEffect(()=>{if(admin)Promise.all([api('/files'),api('/folders')]).then(([f,fo])=>setResources([...(f||[]).map((x:any)=>({...x,type:'FILE'})),...(fo||[]).map((x:any)=>({...x,type:'FOLDER'}))])).catch(()=>{})},[admin]);async function create(){try{await api('/workspace/tasks',{method:'POST',body:JSON.stringify({assigneeId:assignee,title,description,fileId:resourceType==='FILE'&&resourceId?resourceId:undefined,folderId:resourceType==='FOLDER'&&resourceId?resourceId:undefined,startPage:resourceType==='FILE'&&start?+start:undefined,endPage:resourceType==='FILE'&&end?+end:undefined,priority,dueAt:dueAt?new Date(dueAt).toISOString():undefined})});setTitle('');setDescription('');setResourceId('');setStart('');setEnd('');setDueAt('');refresh()}catch(e:any){setErr(e.message)}}async function status(id:string,status:string){try{await api('/workspace/tasks/'+id+'/status',{method:'PATCH',body:JSON.stringify({status})});refresh()}catch(e:any){setErr(e.message)}}return <div className="grid2"><div className="panel">{admin?<><h2>Assign task</h2><label>Assignee<select value={assignee} onChange={e=>setAssignee(e.target.value)}><option value="">Select employee/client</option>{users.filter((u:any)=>u.role==='EMPLOYEE'||u.role==='CLIENT').map((u:any)=><option key={u.id} value={u.id}>{u.uniqueName} — {u.email}</option>)}</select></label><label>Task title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Review contract pages"/></label><label>Instructions<textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe exactly what needs to be done."/></label><div className="grid2"><label>Resource type<select value={resourceType} onChange={e=>{setResourceType(e.target.value);setResourceId('');if(e.target.value==='FOLDER'){setStart('');setEnd('')}}}><option value="FILE">File</option><option value="FOLDER">Folder</option></select></label><label>{resourceType==='FILE'?'File':'Folder'}<select value={resourceId} onChange={e=>setResourceId(e.target.value)}><option value="">Select {resourceType.toLowerCase()}</option>{resources.filter((r:any)=>r.type===resourceType).map((r:any)=><option key={r.type+r.id} value={r.id}>{r.name}</option>)}</select></label></div><div className="grid2"><label>Start page<input type="number" min="1" value={start} onChange={e=>setStart(e.target.value)}/></label><label>End page<input type="number" min="1" value={end} onChange={e=>setEnd(e.target.value)}/></label></div><div className="grid2"><label>Priority<select value={priority} onChange={e=>setPriority(e.target.value)}>{['LOW','MEDIUM','HIGH','URGENT'].map(x=><option key={x}>{x}</option>)}</select></label><label>Due date/time<input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></label></div><button className="btn" disabled={!assignee||!title} onClick={create}>Assign task</button></>:<><h2>My assigned work</h2><p className="muted">Only the person assigned the task can update its status.</p></>}</div><div className="panel"><h2>{admin?'Task queue':'My tasks'}</h2><table><thead><tr><th>Task</th><th>Resource</th><th>Pages</th><th>Priority</th><th>Status</th><th>Due</th></tr></thead><tbody>{data.map((t:any)=><tr key={t.id}><td><b>{t.title}</b><small className="table-sub">{t.assignee?.uniqueName}</small></td><td>{t.file?.name||t.folder?.name||'—'}</td><td>{t.startPage||t.endPage?`${t.startPage||1}–${t.endPage||'end'}`:'All'}</td><td>{t.priority}</td><td>{admin?<span className="status-pill">{t.status}</span>:<select value={t.status} onChange={e=>status(t.id,e.target.value)}>{['PENDING','STARTED','PARTIALLY_COMPLETED','COMPLETED'].map(x=><option key={x}>{x}</option>)}</select>}</td><td>{t.dueAt?new Date(t.dueAt).toLocaleString():'No deadline'}</td></tr>)}{!data.length&&<tr><td colSpan={6} className="muted">No active tasks.</td></tr>}</tbody></table></div></div>}

function Trash({refresh,setErr}:any){const [data,setData]=useState<any>({files:[],folders:[]});async function load(){try{setData(await api('/trash'))}catch(e:any){setErr(e.message)}}useEffect(()=>{load()},[refresh]);async function restore(x:any){try{await api(`/trash/${x.type}/${x.id}/restore`);load()}catch(e:any){setErr(e.message)}}async function perm(x:any){if(!confirm(`Permanently delete ${x.name}? This cannot be undone.`))return;try{await api(`/trash/${x.type}/${x.id}`,{method:'DELETE'});load()}catch(e:any){setErr(e.message)}}const rows=[...data.files,...data.folders];return <div className="panel"><div className="toolbar" style={{justifyContent:'space-between'}}><div><h2 style={{margin:0}}>Trash</h2><p className="muted">Deleted files and folders remain recoverable for 30 days.</p></div><button className="btn secondary" onClick={load}><RefreshCw size={14}/> Refresh</button></div><table><thead><tr><th>Name</th><th>Type</th><th>Deleted</th><th>Expires</th><th>Action</th></tr></thead><tbody>{rows.map((x:any)=><tr key={x.type+x.id}><td><b>{x.name}</b></td><td>{x.type}</td><td>{x.deletedAt?new Date(x.deletedAt).toLocaleString():'—'}</td><td>{x.deletedAt?new Date(new Date(x.deletedAt).getTime()+30*86400000).toLocaleDateString():'—'}</td><td><div className="row-actions"><button className="btn small" onClick={()=>restore(x)}><RotateCcw size={13}/> Restore</button><button className="icon-btn danger" title="Delete permanently" onClick={()=>perm(x)}><Trash2 size={14}/></button></div></td></tr>)}{!rows.length&&<tr><td colSpan={5} className="muted">Trash is empty.</td></tr>}</tbody></table></div>}

function Shared({data,refresh,setErr}:any){const me=localStorage.getItem('sf_user_id');async function update(id:string,key:string,value:boolean){try{await api(`/sharing/${id}`,{method:'PATCH',body:JSON.stringify({[key]:value})});refresh()}catch(e:any){setErr(e.message)}}async function remove(id:string){if(!confirm('Remove this share? The recipient will immediately lose access.'))return;try{await api(`/sharing/${id}`,{method:'DELETE'});refresh()}catch(e:any){setErr(e.message)}}return <div className="panel"><h2>Shared resources</h2><p className="muted">Manage resources shared with you or by you. Owners can change permissions or revoke access.</p><table><thead><tr><th>Resource</th><th>Shared by</th><th>Shared with</th><th>Permissions</th><th>Action</th></tr></thead><tbody>{data.map((s:any)=>{const mine=Boolean(s.manageable);return <tr key={s.id}><td><b>{s.file?.name||s.folder?.name||'Resource'}</b><small className="table-sub">{s.type}</small></td><td>{s.owner?.uniqueName||s.owner?.email||'—'}</td><td>{s.recipient?.uniqueName||s.recipient?.email||'Public link'}</td><td>{mine?<div className="share-perms">{[['canView','View'],['canDownload','Download'],['canUpload','Upload'],['canEdit','Edit'],['canDelete','Delete'],['canShare','Re-share']].map(([key,label]:any)=><label className="checkline" key={key}><input type="checkbox" checked={!!s[key]} onChange={e=>update(s.id,key,e.target.checked)}/>{label}</label>)}</div>:<span className="muted">{s.canView?'View ':''}{s.canDownload?'Download ':''}{s.canUpload?'Upload ':''}{s.canEdit?'Edit ':''}{s.canDelete?'Delete ':''}{s.canShare?'Re-share':''}</span>}</td><td>{mine?<button className="icon-btn danger" title="Revoke access" onClick={()=>remove(s.id)}><Trash2 size={14}/></button>:<span className="muted">—</span>}</td></tr>})}{!data.length&&<tr><td colSpan={5} className="muted">No shared resources yet.</td></tr>}</tbody></table></div>}

function SimpleTable({title,data}:any){return <div className="panel"><h2>{title}</h2><table><tbody>{data.map((x:any)=><tr key={x.id}><td>{x.file?.name||x.folder?.name||x.name||x.id}</td><td>{x.recipient?.uniqueName||x.type||''}</td></tr>)}{!data.length&&<tr><td className="muted">Nothing to show.</td></tr>}</tbody></table></div>}
function UploadModule({kind,setErr}:any){
  if(kind==='fax') return <FaxUpload setErr={setErr}/>;
  return <ScannerModule setErr={setErr}/>;
}

function FaxUpload({setErr}:any){
  const navigate=useNavigate();
  const [line,setLine]=useState<any>(null),[jobs,setJobs]=useState<any[]>([]),[files,setFiles]=useState<any[]>([]),[to,setTo]=useState(''),[header,setHeader]=useState(''),[fileId,setFileId]=useState(''),[uploadFile,setUploadFile]=useState<File|null>(null),[mode,setMode]=useState<'existing'|'upload'>('existing'),[countryCode,setCountryCode]=useState('1'),[areaCode,setAreaCode]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);

  async function load(){
    try{
      setLoading(true);
      const [fax,fileList]=await Promise.all([api('/fax'),api('/files')]);
      setLine(fax.line);
      setJobs(fax.jobs||[]);
      setFiles((fileList||[]).filter((f:any)=>!f.deletedAt));
    }catch(e:any){setErr(e.message)}finally{setLoading(false)}
  }

  useEffect(()=>{load()},[]);

  // Fax delivery/receive events are already pushed through SecureFile's SSE
  // notification channel. Reload only when a fax notification arrives; there
  // is no interval/polling here.
  useEffect(()=>{
    const onRealtimeFax=(event:Event)=>{
      try{
        const n:any=JSON.parse((event as CustomEvent).detail||'{}');
        const title=String(n.title||'').toLowerCase();
        if(title.includes('fax')) load();
      }catch{}
    };
    window.addEventListener('sf:notification',onRealtimeFax);
    return()=>window.removeEventListener('sf:notification',onRealtimeFax);
  },[]);

  async function provision(){
    try{
      setBusy(true);
      if(countryCode.length<1||countryCode.length>3)return setErr('Enter a valid country code.');
      if(areaCode.length!==3)return setErr('Enter a valid 3-digit area code.');
      await api('/fax/number/provision',{method:'POST',body:JSON.stringify({countryCode:+countryCode,areaCode:+areaCode})});
      await load();
    }catch(e:any){setErr(e.message)}finally{setBusy(false)}
  }

  async function send(){
    try{
      if(!to.trim())return setErr('Enter the destination fax number.');
      if(mode==='existing'&&!fileId)return setErr('Choose a SecureFile document.');
      if(mode==='upload'&&!uploadFile)return setErr('Choose a document to fax.');
      setBusy(true);

      if(mode==='existing'){
        await api('/fax/send',{method:'POST',body:JSON.stringify({to:to.trim(),fileId,headerText:header})});
      }else{
        // Send the browser-selected file directly to the fax API. This avoids
        // an unnecessary upload -> metadata -> second API request. The backend
        // stores a private FAX copy after the provider accepts the fax.
        const form=new FormData();
        form.append('to',to.trim());
        form.append('headerText',header);
        form.append('file',uploadFile!);
        await api('/fax/send',{method:'POST',body:form});
      }

      setTo('');setHeader('');setFileId('');setUploadFile(null);
      await load();
    }catch(e:any){setErr(e.message)}finally{setBusy(false)}
  }

  function openFile(id:string){navigate(`/files/${encodeURIComponent(id)}/view`)}

  if(loading)return <div className="panel"><p className="muted">Loading your fax workspace...</p></div>;

  return <div className="fax-workspace">
    <div className="fax-top-grid">
      <div className="panel fax-number-panel">
        <div className="fax-card-head">
          <div><p className="eyebrow">Receive faxes</p><h2>My personal fax number</h2></div>
          <PhoneIncoming size={22}/>
        </div>
        <p className="muted">Anyone can send a fax to this number. SecureFile receives the document through the fax provider and saves it privately to your account.</p>
        {line?.phoneNumber?<>
          <div className="fax-number-value">{line.phoneNumber}</div>
          <div className="fax-ready"><span className="fax-ready-dot"/> Ready to receive faxes</div>
          <p className="fax-help">Give this number to the person or organization sending you a fax. Incoming documents will appear in <b>My fax history</b> automatically.</p>
        </>:<>
          <div className="grid2 fax-provision-grid"><label>Country code<input value={countryCode} onChange={e=>setCountryCode(e.target.value.replace(/\D/g,'').slice(0,3))} placeholder="1" inputMode="numeric"/></label><label>Area code<input value={areaCode} onChange={e=>setAreaCode(e.target.value.replace(/\D/g,'').slice(0,3))} placeholder="e.g. 212" inputMode="numeric"/></label></div>
          <button className="btn" disabled={busy||areaCode.length!==3} onClick={provision}>{busy?'Provisioning...':'Get my fax number'}</button>
          <p className="muted" style={{marginTop:8}}>This provisions a real receiving number from the configured fax provider and may create a provider charge.</p>
        </>}
      </div>

      <div className="panel fax-send-panel">
        <div className="fax-card-head">
          <div><p className="eyebrow">Send faxes</p><h2>Send a fax</h2></div>
          <PhoneOutgoing size={22}/>
        </div>
        <label>Recipient fax number<input value={to} onChange={e=>setTo(e.target.value)} placeholder="+14155551234" inputMode="tel"/></label>
        <label>Header text <small className="muted">(optional, max 50 characters)</small><input maxLength={50} value={header} onChange={e=>setHeader(e.target.value)} placeholder="SecureFile"/></label>
        <div className="toolbar"><button className={`btn small ${mode==='existing'?'':'secondary'}`} onClick={()=>setMode('existing')}>SecureFile file</button><button className={`btn small ${mode==='upload'?'':'secondary'}`} onClick={()=>setMode('upload')}>Upload document</button></div>
        {mode==='existing'?<label>Document<select value={fileId} onChange={e=>setFileId(e.target.value)}><option value="">Choose a file</option>{files.map((f:any)=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>:<label>Document<input type="file" accept="application/pdf,.pdf,.doc,.docx,.jpg,.jpeg,.png,.tif,.tiff" onChange={e=>setUploadFile(e.target.files?.[0]||null)}/></label>}
        <button className="btn" disabled={busy||!line?.phoneNumber||!to||((mode==='existing'&&!fileId)||(mode==='upload'&&!uploadFile))} onClick={send}><Send size={15}/>{busy?'Sending...':'Send fax'}</button>
        <p className="muted fax-help">Your personal SecureFile fax number is used as the caller ID when the provider supports it.</p>
      </div>
    </div>

    <div className="panel fax-history-panel">
      <div className="toolbar fax-history-head" style={{justifyContent:'space-between'}}>
        <div><p className="eyebrow">Fax inbox & sent items</p><h2 style={{margin:0}}>My fax history</h2><p className="muted">Received faxes are stored privately. Sent faxes show delivery status and remain available as private FAX files.</p></div>
        <button className="btn secondary small" onClick={load} disabled={loading||busy}><RefreshCw size={14}/> Refresh</button>
      </div>
      <div className="fax-table-wrap"><table><thead><tr><th>Direction</th><th>Number</th><th>Document</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>{jobs.map((j:any)=><tr key={j.id}>
        <td><span className="fax-direction"><span className={j.direction==='INBOUND'?'in':'out'}>{j.direction==='INBOUND'?<PhoneIncoming size={14}/>:<PhoneOutgoing size={14}/>}</span>{j.direction==='INBOUND'?'Received':'Sent'}</span></td>
        <td>{j.direction==='INBOUND'?j.senderNumber||'Unknown':j.recipientNumber||'—'}</td>
        <td><b>{j.file?.name||'Fax transmission'}</b>{j.pages?<small className="table-sub">{j.pages} page{j.pages===1?'':'s'}</small>:null}</td>
        <td><span className={`status-pill ${j.status==='SENT'||j.status==='RECEIVED'?'active':j.status==='FAILED'?'danger':''}`}>{j.status}</span>{j.errorMessage&&<small className="table-sub">{j.errorMessage}</small>}</td>
        <td>{new Date(j.createdAt).toLocaleString()}</td>
        <td>{j.fileId?<div className="fax-row-actions"><button className="icon-btn" title="Open document" onClick={()=>openFile(j.fileId)}><ExternalLink size={14}/></button><button className="icon-btn" title="Download document" onClick={async()=>{try{const {downloadPrivateFile}=await import('../lib/api');await downloadPrivateFile(j.fileId,j.file?.name||'fax.pdf')}catch(e:any){setErr(e.message)}}}><Download size={14}/></button></div>:<span className="muted">—</span>}</td>
      </tr>)}{!jobs.length&&<tr><td colSpan={6} className="muted">No fax activity yet. Provision your personal number to start receiving and sending faxes.</td></tr>}</tbody></table></div>
    </div>
  </div>
}

type ScanPage={id:string,name:string,mimeType:string,data:string};
type CameraScannerState='idle'|'starting'|'ready'|'capturing';
const SCANNER_BRIDGE=(import.meta.env.VITE_SCANNER_BRIDGE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');

function MobileCameraScanner({onPage,onError,busy}:any){
  const videoRef=useRef<HTMLVideoElement|null>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const [state,setState]=useState<CameraScannerState>('idle');
  const [cameraError,setCameraError]=useState('');
  const [torch,setTorch]=useState(false);
  const [torchSupported,setTorchSupported]=useState(false);

  useEffect(()=>()=>{streamRef.current?.getTracks().forEach(t=>t.stop())},[]);

  async function startCamera(){
    try{
      setCameraError('');setState('starting');
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera scanning is not supported by this browser. Please use the latest Chrome, Safari, or Edge over HTTPS.');
      streamRef.current?.getTracks().forEach(t=>t.stop());
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
      streamRef.current=stream;
      const track=stream.getVideoTracks()[0];
      const caps=(track.getCapabilities?.()||{}) as any;
      setTorchSupported(Boolean(caps.torch));
      if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}
      setState('ready');
    }catch(e:any){setState('idle');setCameraError(e?.name==='NotAllowedError'?'Camera permission was denied. Allow camera access for SecureFile and try again.':e?.message||'Unable to start the camera.');}
  }
  function stopCamera(){streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;if(videoRef.current)videoRef.current.srcObject=null;setTorch(false);setState('idle')}
  async function toggleTorch(){
    const track=streamRef.current?.getVideoTracks()[0]; if(!track||!torchSupported)return;
    try{await track.applyConstraints({advanced:[{torch:!torch}]} as any);setTorch(v=>!v)}catch{setCameraError('This phone camera does not allow the flashlight to be controlled from the browser.')}
  }
  async function capture(){
    const video=videoRef.current;if(!video||video.readyState<2)return;
    try{
      setState('capturing');
      const canvas=document.createElement('canvas');
      canvas.width=video.videoWidth||1280;canvas.height=video.videoHeight||1920;
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Camera capture is unavailable.');
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not capture the camera frame.')),'image/jpeg',0.94));
      const reader=new FileReader();
      const data=await new Promise<string>((resolve,reject)=>{reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');reader.onerror=()=>reject(new Error('Could not read the captured page.'));reader.readAsDataURL(blob)});
      if(!data)throw new Error('Camera returned an empty image.');
      onPage({id:crypto.randomUUID(),name:`camera-page-${Date.now()}.jpg`,mimeType:'image/jpeg',data});
      setState('ready');
    }catch(e:any){setCameraError(e?.message||'Could not capture this page.');setState('ready')}
  }
  return <div className="mobile-camera-card">
    <div className="mobile-scan-heading"><div><h3>Scan with phone camera</h3><p className="muted">Use the rear camera to capture one or more document pages directly in SecureFile.</p></div><Camera size={20}/></div>
    {cameraError&&<div className="camera-error">{cameraError}</div>}
    {state==='idle'?<button className="btn mobile-primary-action" disabled={busy} onClick={startCamera}><Camera size={17}/> Open Camera Scanner</button>:<>
      <div className="camera-viewfinder"><video ref={videoRef} playsInline muted autoPlay/><div className="camera-corners"/><span className="camera-guide-label">Fit the full page inside the guide</span></div>
      <div className="camera-toolbar"><button className="btn" disabled={state!=='ready'||busy} onClick={capture}><Camera size={17}/> Capture Page</button>{torchSupported&&<button className="btn secondary" disabled={state!=='ready'} onClick={toggleTorch}>{torch?<FlashlightOff size={16}/>:<Flashlight size={16}/>} {torch?'Flash off':'Flash'}</button>}<button className="btn secondary" onClick={stopCamera}>Close</button></div>
      <p className="camera-hint">Capture each page, review the thumbnails below, then create one PDF.</p>
    </>}
  </div>
}

function BluetoothScanner({onPage,onError,busy}:any){
  const [device,setDevice]=useState<any>(null);const [connected,setConnected]=useState(false);const [status,setStatus]=useState('Not connected');const [supported,setSupported]=useState(true);const bufferRef=useRef<Uint8Array>(new Uint8Array());const listenersRef=useRef<any[]>([]);
  useEffect(()=>{setSupported(Boolean((navigator as any).bluetooth));return()=>{void disconnect()}},[]);
  function appendBytes(incoming:Uint8Array){
    let buf=new Uint8Array(bufferRef.current.length+incoming.length);buf.set(bufferRef.current);buf.set(incoming,bufferRef.current.length);bufferRef.current=buf;
    while(true){
      let start=-1,end=-1;for(let i=0;i<buf.length-1;i++){if(buf[i]===0xff&&buf[i+1]===0xd8){start=i;break}}
      if(start<0){if(buf.length>1024*1024*8)bufferRef.current=buf.slice(-1024);return}
      for(let i=start+2;i<buf.length-1;i++){if(buf[i]===0xff&&buf[i+1]===0xd9){end=i+2;break}}
      if(end<0){bufferRef.current=buf.slice(start);return}
      const jpeg=buf.slice(start,end);buf=buf.slice(end);bufferRef.current=buf;
      let binary='';const chunk=0x8000;for(let i=0;i<jpeg.length;i+=chunk)binary+=String.fromCharCode(...jpeg.subarray(i,i+chunk));
      onPage({id:crypto.randomUUID(),name:`bluetooth-scan-${Date.now()}.jpg`,mimeType:'image/jpeg',data:btoa(binary)});
    }
  }
  async function discover(server:any){
    const services=await server.getPrimaryServices();let count=0;
    for(const service of services){
      const chars=await service.getCharacteristics();
      for(const ch of chars){
        if(ch.properties.notify||ch.properties.indicate){await ch.startNotifications();const handler=(ev:any)=>{const v=ev.target?.value;if(v)appendBytes(new Uint8Array(v.buffer,v.byteOffset,v.byteLength))};ch.addEventListener('characteristicvaluechanged',handler);listenersRef.current.push({ch,handler});count++}
        else if(ch.properties.read){try{const v=await ch.readValue();if(v?.byteLength)appendBytes(new Uint8Array(v.buffer,v.byteOffset,v.byteLength))}catch{/* proprietary/read-on-demand characteristic */}}
      }
    }
    return count;
  }
  async function connect(){
    try{
      if(!supported)throw new Error('Bluetooth is not available in this mobile browser. Use Chrome/Edge on Android with a BLE scanner, or use the phone camera scanner.');
      setStatus('Choose your Bluetooth scanner…');
      const d=await (navigator as any).bluetooth.requestDevice({acceptAllDevices:true});
      setDevice(d);d.addEventListener?.('gattserverdisconnected',()=>{setConnected(false);setStatus('Scanner disconnected')});
      setStatus('Connecting…');const server=await d.gatt.connect();
      const count=await discover(server);setConnected(true);setStatus(count?`Connected • listening on ${count} scan channel${count===1?'':'s'}`:'Connected • scanner protocol not exposed by this device');
      if(!count)onError('Bluetooth scanner connected, but it does not expose scan data through a browser-readable BLE characteristic. Many scanners use proprietary Bluetooth profiles; use the phone camera scanner or the vendor/WIA bridge for those devices.');
    }catch(e:any){setConnected(false);setStatus('Not connected');if(e?.name!=='NotFoundError')onError(e?.message||'Unable to connect to the Bluetooth scanner.')}
  }
  async function disconnect(){for(const {ch,handler} of listenersRef.current){try{ch.removeEventListener('characteristicvaluechanged',handler);await ch.stopNotifications()}catch{}}listenersRef.current=[];try{if(device?.gatt?.connected)device.gatt.disconnect()}catch{}setConnected(false);setDevice(null);setStatus('Not connected');bufferRef.current=new Uint8Array()}
  return <div className="mobile-bluetooth-card">
    <div className="mobile-scan-heading"><div><h3>Bluetooth scanner</h3><p className="muted">Connect a BLE scanner from the phone browser when the scanner exposes its scan data over Web Bluetooth.</p></div><Bluetooth size={20}/></div>
    <div className={`bluetooth-status ${connected?'connected':''}`}><span className="status-dot"/>{status}</div>
    {!supported&&<div className="camera-error">Web Bluetooth is not available here. Camera scanning remains available.</div>}
    <div className="camera-toolbar"><button className="btn" disabled={busy||connected||!supported} onClick={connect}><Bluetooth size={16}/> Connect Bluetooth Scanner</button>{connected&&<button className="btn secondary" onClick={disconnect}><Link2Off size={16}/> Disconnect</button>}</div>
    <p className="camera-hint">Note: standard Bluetooth document scanners often use proprietary profiles. Chrome can only receive scan images when the device exposes a BLE GATT data characteristic.</p>
  </div>
}

function ScannerModule({setErr}:any){
  const [bridgeOk,setBridgeOk]=useState<boolean|null>(null);const [pages,setPages]=useState<ScanPage[]>([]);const [busy,setBusy]=useState(false);const [saving,setSaving]=useState(false);const [source,setSource]=useState<'ADF'|'FLATBED'>('ADF');const [batchPages,setBatchPages]=useState(25);const [resolution,setResolution]=useState(300);const [colorMode,setColorMode]=useState('COLOR');const [duplex,setDuplex]=useState(false);const [folderId,setFolderId]=useState('');const [folders,setFolders]=useState<any[]>([]);const [pdfName,setPdfName]=useState('Scanned Document.pdf');const [bridgeMessage,setBridgeMessage]=useState('Checking scanner bridge...');
  const [devices,setDevices]=useState<any[]>([]);const [selectedDevice,setSelectedDevice]=useState<any>(null);const [driver,setDriver]=useState<'AUTO'|'WIA'|'TWAIN'|'ESCL'>('AUTO');const [loadingDevices,setLoadingDevices]=useState(false);
  async function checkBridge(){try{const r=await fetch(`${SCANNER_BRIDGE}/health`,{signal:AbortSignal.timeout(2500)});if(!r.ok)throw new Error();const h:any=await r.json().catch(()=>({}));setBridgeOk(true);setBridgeMessage(h.naps2Installed?'Universal scanner bridge connected':'WIA scanner bridge connected')}catch{setBridgeOk(false);setBridgeMessage('Scanner bridge not connected. Start scanner-bridge on this Windows PC.')}}
  async function refreshDevices(){setLoadingDevices(true);try{const r=await fetch(`${SCANNER_BRIDGE}/devices`,{signal:AbortSignal.timeout(30000)});const d:any=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error||'Unable to list scanners.');const list=Array.isArray(d.devices)?d.devices:[];setDevices(list);if(list.length&&!selectedDevice)setSelectedDevice(list[0]);if(!list.length)setSelectedDevice(null);setBridgeOk(true);setBridgeMessage(list.length?`${list.length} scanner device${list.length===1?'':'s'} available.`:'Bridge connected, but no scanner was detected.')}catch(e:any){setErr(e.message||'Unable to list scanner devices.');setBridgeOk(false);setBridgeMessage('Scanner device discovery failed.')}finally{setLoadingDevices(false)}}
  useEffect(()=>{checkBridge();refreshDevices();api('/folders').then((x:any)=>setFolders(Array.isArray(x)?x:[])).catch(()=>{})},[]);
  async function scan(){try{setErr('');setBusy(true);const health=await fetch(`${SCANNER_BRIDGE}/health`,{signal:AbortSignal.timeout(2500)});if(!health.ok)throw new Error('Scanner bridge is not connected. Start the SecureFile Scanner Bridge on this Windows workstation.');if(!selectedDevice)throw new Error('Select a scanner device first. Click Refresh scanners if the device is not listed.');const effectiveDriver=driver==='AUTO'?'auto':driver.toLowerCase();const deviceValue=String(selectedDevice.id||selectedDevice.name||'');const deviceName=String(selectedDevice.name||'');const r=await fetch(`${SCANNER_BRIDGE}/scan`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({driver:effectiveDriver,device:deviceValue,deviceName,source,pages:source==='FLATBED'?1:Math.max(1,Math.min(100,batchPages)),resolutionDpi:resolution,colorMode,duplex:source==='ADF'&&duplex})});const d:any=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error||'Scanner failed.');const incoming=(d.pages||[]).map((x:any)=>({id:crypto.randomUUID(),name:x.name,mimeType:x.mimeType||'image/jpeg',data:x.data})) as ScanPage[];if(!incoming.length)throw new Error('The scanner returned no pages.');setPages(prev=>[...prev,...incoming]);setBridgeOk(true);setBridgeMessage(`${incoming.length} page${incoming.length===1?'':'s'} scanned successfully via ${String(d.driver||effectiveDriver).toUpperCase()}.`)}catch(e:any){setErr(e.message||'Scanner failed.');setBridgeMessage('Scanner error. Check the selected device, driver, paper, and bridge.')}finally{setBusy(false)}}
  function addCameraPage(page:ScanPage){setPages(prev=>[...prev,page]);setErr('')}
  function removePage(id:string){setPages(prev=>prev.filter(p=>p.id!==id))}function movePage(index:number,direction:-1|1){setPages(prev=>{const next=[...prev],to=index+direction;if(to<0||to>=next.length)return prev;[next[index],next[to]]=[next[to],next[index]];return next})}function clearPages(){if(confirm('Remove all scanned pages from this draft?'))setPages([])}
  async function savePdf(){if(!pages.length)return;try{setSaving(true);setErr('');const name=(pdfName.trim()||'Scanned Document').replace(/\.pdf$/i,'')+'.pdf';const pdfBlob=jpegPagesToPdfBlob(pages);const pdfFile=new File([pdfBlob],name,{type:'application/pdf'});await directUpload(pdfFile,{folderId:folderId||undefined,source:'SCAN',name});setPages([]);setPdfName('Scanned Document.pdf');setErr('');setBridgeMessage(`Saved ${name} to SecureFile.`)}catch(e:any){setErr(e.message||'Unable to create or save PDF.')}finally{setSaving(false)}}
  return <div className="scanner-workspace">
    <div className="panel desktop-scanner-panel">
      <div className="scanner-status-row"><div><h2 style={{marginBottom:4}}>Physical Scanner</h2><p className="muted">The browser connects to the SecureFile Scanner Bridge running on the same Windows PC as the scanner.</p></div><span className={`scanner-status ${bridgeOk===true?'ok':bridgeOk===false?'bad':''}`}>{bridgeOk===true?<Wifi size={14}/>:<WifiOff size={14}/>} {bridgeMessage}</span></div>
      <div className="scanner-controls grid2"><label>Scanner / device<select value={selectedDevice?JSON.stringify({id:selectedDevice.id,name:selectedDevice.name,driver:selectedDevice.driver}):''} onChange={e=>{try{const v=JSON.parse(e.target.value);setSelectedDevice(devices.find((d:any)=>d.id===v.id&&d.name===v.name&&d.driver===v.driver)||null)}catch{setSelectedDevice(null)}}}><option value="">Select scanner device</option>{devices.map((d:any,i:number)=><option key={`${d.driver}-${d.id}-${i}`} value={JSON.stringify({id:d.id,name:d.name,driver:d.driver})}>{d.name}{d.manufacturer?` — ${d.manufacturer}`:''} ({String(d.driver||'WIA').toUpperCase()})</option>)}</select></label><label>Driver<select value={driver} onChange={e=>setDriver(e.target.value as any)}><option value="AUTO">Auto (recommended)</option><option value="WIA">WIA</option><option value="TWAIN">TWAIN</option><option value="ESCL">eSCL / Network</option></select><small className="muted">TWAIN/eSCL use NAPS2. WIA has a direct Windows fallback.</small></label><label>Scanner source<select value={source} onChange={e=>setSource(e.target.value as any)}><option value="ADF">ADF / Document Feeder</option><option value="FLATBED">Flatbed</option></select></label><label>Pages per scan batch<input type="number" min="1" max="100" value={batchPages} disabled={source==='FLATBED'} onChange={e=>setBatchPages(Math.max(1,Math.min(100,+e.target.value||1)))}/><small className="muted">ADF scans up to 100 pages per batch. Use Scan More for any total page count.</small></label><label>Resolution<select value={resolution} onChange={e=>setResolution(+e.target.value)}><option value="150">150 DPI</option><option value="200">200 DPI</option><option value="300">300 DPI</option><option value="600">600 DPI</option></select></label><label>Color mode<select value={colorMode} onChange={e=>setColorMode(e.target.value)}><option value="COLOR">Color</option><option value="GRAY">Grayscale</option><option value="BW">Black & White</option></select></label></div>
      {source==='ADF'&&<label className="checkline scanner-duplex"><input type="checkbox" checked={duplex} onChange={e=>setDuplex(e.target.checked)}/> Scan both sides (duplex) when the scanner driver supports it</label>}
      <div className="toolbar scanner-actions"><button className="btn secondary" disabled={busy||loadingDevices} onClick={refreshDevices}><RefreshCw size={15}/>{loadingDevices?'Finding scanners...':'Refresh scanners'}</button><button className="btn" disabled={busy||saving||!selectedDevice} onClick={scan}><ScanLine size={16}/>{busy?'Scanning...':pages.length?'Scan More Pages':'Start Scan'}</button><button className="btn secondary" disabled={busy} onClick={checkBridge}>Check connection</button><span className="muted">{pages.length} page{pages.length===1?'':'s'} in current PDF</span></div>
    </div>

    <div className="mobile-scanner-panel">
      <div className="mobile-scanner-title"><div><p className="eyebrow">Mobile scanning</p><h2>Scan from your phone</h2><p className="muted">Choose your phone camera or connect a compatible BLE scanner. Both methods add pages to the same PDF draft.</p></div><ScanLine size={24}/></div>
      <MobileCameraScanner busy={busy||saving} onPage={addCameraPage} onError={setErr}/>
      <BluetoothScanner busy={busy||saving} onPage={addCameraPage} onError={setErr}/>
    </div>

    <div className="panel"><div className="scanner-preview-head"><div><h2>Scanned Pages</h2><p className="muted">Review, remove, or reorder pages before creating the final PDF.</p></div>{pages.length>0&&<button className="btn secondary" onClick={clearPages}>Clear all</button>}</div>{!pages.length?<div className="scanner-empty"><ScanLine size={34}/><b>No scanned pages yet</b><span>Use the Windows scanner above or scan from your phone.</span></div>:<div className="scan-pages-grid">{pages.map((p,i)=><div className="scan-page-card" key={p.id}><div className="scan-page-image"><img src={`data:${p.mimeType};base64,${p.data}`} alt={`Scanned page ${i+1}`}/><span>Page {i+1}</span></div><div className="scan-page-actions"><button className="icon-btn" title="Move left" disabled={i===0} onClick={()=>movePage(i,-1)}><ChevronLeft size={14}/></button><button className="icon-btn" title="Move right" disabled={i===pages.length-1} onClick={()=>movePage(i,1)}><ChevronRight size={14}/></button><button className="icon-btn danger" title="Remove page" onClick={()=>removePage(p.id)}><Trash2 size={14}/></button></div></div>)}</div>}</div>
    <div className="panel scanner-save-panel"><div><h2>Save as one PDF</h2><p className="muted">Other company users cannot see the saved file unless you share it or grant permission. Company Admins retain administrative access.</p></div><div className="grid2"><label>PDF file name<input value={pdfName} onChange={e=>setPdfName(e.target.value)} placeholder="e.g. Patient Records August 21.pdf"/></label><label>Save in folder<select value={folderId} onChange={e=>setFolderId(e.target.value)}><option value="">My visible root</option>{folders.map(f=><option key={f.id} value={f.id}>{f.name}{f.isPersonal?' (Personal)':''}</option>)}</select></label></div><div className="toolbar"><button className="btn" disabled={!pages.length||saving} onClick={savePdf}>{saving?'Creating PDF...':'Create PDF & Save'}</button><span className="muted">{pages.length?`${pages.length} pages will be combined into ${((pdfName.trim()||'Scanned Document').replace(/\.pdf$/i,'')+'.pdf')}`:'Scan pages first.'}</span></div></div>
  </div>
}

function AI({setErr}:any){const [q,setQ]=useState(''),[messages,setMessages]=useState<any[]>([]),[busy,setBusy]=useState(false),[webSearch,setWebSearch]=useState(true);async function ask(){const text=q.trim();if(!text||busy)return;const history=messages.map(x=>({role:x.role,content:x.content}));setMessages(m=>[...m,{role:'user',content:text}]);setQ('');setBusy(true);try{const d=await api('/workspace/ai',{method:'POST',body:JSON.stringify({message:text,history,webSearchEnabled:webSearch})});setMessages(m=>[...m,{role:'assistant',content:d.answer,sources:d.sources||[],webSearched:Boolean(d.webSearched)}]);}catch(e:any){setErr(e.message);setMessages(m=>[...m,{role:'assistant',content:'I could not complete that request. Please try again.'}]);}finally{setBusy(false)}}return <div className="ai-shell"><div className="panel ai-panel"><div className="ai-head"><div><h2 style={{marginBottom:4}}>SecureFile AI</h2><p className="muted">Your private SecureFile assistant. It only uses resources available to your current login.</p></div><label className="ai-web-toggle"><input type="checkbox" checked={webSearch} onChange={e=>setWebSearch(e.target.checked)}/><span>Web search when needed</span></label></div><div className="ai-safety">🔒 Your SecureFile data stays scoped to your account. Other users' private files and workspace data are not included.</div><div className="ai-messages">{!messages.length&&<div className="ai-empty"><Send size={24}/><h3>Ask SecureFile AI</h3><p>Try: “What files do I have?”, “What tasks are due?”, “How do I send a fax?” or ask a general question.</p></div>}{messages.map((m,i)=><div key={i} className={`ai-message ${m.role==='user'?'user':'assistant'}`}><div className="ai-bubble">{m.content}</div>{m.webSearched&&m.sources?.length>0&&<div className="ai-sources"><span>Web sources</span>{m.sources.map((x:any,j:number)=><a key={j} href={x.url} target="_blank" rel="noreferrer">{x.url}</a>)}</div>}</div>)}{busy&&<div className="ai-message assistant"><div className="ai-bubble ai-typing">Thinking…</div></div>}</div><div className="ai-composer"><textarea value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask()}}} placeholder="Ask about your SecureFile workspace or anything else…" rows={2}/><button className="btn" disabled={!q.trim()||busy} onClick={ask}><Send size={15}/>{busy?'Thinking…':'Ask'}</button></div></div></div>}
function Chat({users: initialUsers}:any){
  const [users,setUsers]=useState<any[]>(initialUsers||[]);
  const me=localStorage.getItem('sf_user_id');
  const [mode,setMode]=useState<'chat'|'group'|'mail'>('chat');
  const [to,setTo]=useState(''),[groupId,setGroupId]=useState(''),[body,setBody]=useState('');
  const [messages,setMessages]=useState<any[]>([]),[groups,setGroups]=useState<any[]>([]);
  const [groupName,setGroupName]=useState(''),[groupUsers,setGroupUsers]=useState<string[]>([]);
  const [emails,setEmails]=useState<any[]>([]),[mailBox,setMailBox]=useState<'inbox'|'sent'>('inbox');
  const [subject,setSubject]=useState(''),[mailBody,setMailBody]=useState(''),[mailRecipient,setMailRecipient]=useState('');
  const [recipientMode,setRecipientMode]=useState<'USER'|'EMAIL'>('USER');
  const [mailDetail,setMailDetail]=useState<any>(null);
  const people=users.filter((u:any)=>u.id!==me&&u.status==='ACTIVE');

  async function loadGroups(){try{setGroups(await api('/workspace/groups'))}catch{}}
  async function loadMessages(){try{
    if(mode==='chat'&&to)setMessages(await api('/workspace/messages?withUser='+encodeURIComponent(to)));
    else if(mode==='group'&&groupId)setMessages(await api('/workspace/messages?groupId='+encodeURIComponent(groupId)));
  }catch{}}
  async function loadEmails(){try{setEmails(await api('/workspace/emails?box='+mailBox))}catch{}}
  useEffect(()=>{Promise.all([initialUsers?.length?Promise.resolve(initialUsers):api('/users'),api('/workspace/groups')]).then(([u,g])=>{setUsers(u||[]);setGroups(g||[])}).catch(()=>{})},[]);
  useEffect(()=>{loadMessages()},[mode,to,groupId]);
  useEffect(()=>{if(mode==='mail')loadEmails()},[mode,mailBox]);

  async function send(){
    if(!body.trim())return;
    try{await api('/workspace/messages',{method:'POST',body:JSON.stringify({recipientId:mode==='chat'?to:undefined,groupId:mode==='group'?groupId:undefined,body:body.trim()})});setBody('');loadMessages();}
    catch(e:any){alert(e.message)}
  }
  async function createGroup(){
    if(!groupName.trim()||!groupUsers.length)return;
    try{const g=await api('/workspace/groups',{method:'POST',body:JSON.stringify({name:groupName,userIds:groupUsers})});setGroupName('');setGroupUsers([]);await loadGroups();setGroupId(g.id);setMode('group');}
    catch(e:any){alert(e.message)}
  }
  async function renameGroup(g:any){
    const name=window.prompt('New group name',g.name); if(!name?.trim())return;
    try{await api('/workspace/groups/'+g.id,{method:'PATCH',body:JSON.stringify({name:name.trim()})});loadGroups();}
    catch(e:any){alert(e.message)}
  }
  async function deleteGroup(g:any){
    if(!confirm(`Delete group "${g.name}"? Messages will be removed.`))return;
    try{await api('/workspace/groups/'+g.id,{method:'DELETE'});if(groupId===g.id)setGroupId('');loadGroups();}
    catch(e:any){alert(e.message)}
  }
  async function sendMail(){
    const emailMode=recipientMode==='EMAIL';
    const valid=emailMode?/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailRecipient.trim()):!!mailRecipient;
    if(!valid||!subject.trim()||!mailBody.trim())return;
    try{
      await api('/workspace/email',{method:'POST',body:JSON.stringify({recipientId:emailMode?undefined:mailRecipient,recipientEmail:emailMode?mailRecipient.trim().toLowerCase():undefined,subject:subject.trim(),body:mailBody.trim()})});
      setSubject('');setMailBody('');setMailRecipient('');setMailBox('sent');setMailDetail(null);await loadEmails();
    }catch(e:any){alert(e.message)}
  }
  return <div className="chat-shell">
    <div className="chat-sidebar">
      <div className="chat-tabs"><button className={mode==='chat'?'active':''} onClick={()=>setMode('chat')}>Chats</button><button className={mode==='group'?'active':''} onClick={()=>setMode('group')}>Groups</button><button className={mode==='mail'?'active':''} onClick={()=>setMode('mail')}>Mail</button></div>
      {mode==='chat'&&<>{people.map((u:any)=><button key={u.id} className={`chat-person ${to===u.id?'selected':''}`} onClick={()=>setTo(u.id)}><b>{u.uniqueName}</b><small>{u.email}</small></button>)}{!people.length&&<p className="muted">No active company users.</p>}</>}
      {mode==='group'&&<>
        {groups.map((g:any)=><div key={g.id} className={`chat-person ${groupId===g.id?'selected':''}`}><button className="link-button" style={{display:'block',width:'100%',textAlign:'left'}} onClick={()=>setGroupId(g.id)}><b>{g.name}</b><small>{g.members?.length||0} members</small></button><div className="row-actions"><button className="icon-btn" title="Rename" onClick={()=>renameGroup(g)}>✎</button><button className="icon-btn danger" title="Delete" onClick={()=>deleteGroup(g)}>×</button></div></div>)}
        <div className="group-create"><input placeholder="Group name" value={groupName} onChange={e=>setGroupName(e.target.value)}/>{people.map((u:any)=><label className="checkline" key={u.id}><input type="checkbox" checked={groupUsers.includes(u.id)} onChange={e=>setGroupUsers(v=>e.target.checked?[...v,u.id]:v.filter(x=>x!==u.id))}/>{u.uniqueName}</label>)}<button className="btn small" disabled={!groupName.trim()||!groupUsers.length} onClick={createGroup}>Create group</button></div>
      </>}
      {mode==='mail'&&<>
        <div className="mail-box-buttons"><button className={`btn small ${mailBox==='inbox'?'':'secondary'}`} onClick={()=>setMailBox('inbox')}>Inbox</button><button className={`btn small ${mailBox==='sent'?'':'secondary'}`} onClick={()=>setMailBox('sent')}>Sent</button></div>
        {emails.map((m:any)=><button key={m.id} className={`chat-person ${mailDetail?.id===m.id?'selected':''}`} onClick={()=>setMailDetail(m)}><b>{m.subject||'(No subject)'}</b><small>{mailBox==='sent'?m.recipientEmail:(m.sender?.email||'External sender')} · {new Date(m.createdAt).toLocaleDateString()}</small></button>)}
        {!emails.length&&<p className="muted">No emails in this mailbox.</p>}
      </>}
    </div>
    <div className="chat-main">
      {mode==='mail'?<div className="grid2 mail-layout">
        <div className="panel"><div className="toolbar"><h2 style={{margin:0}}>SecureFile Mail</h2><span className="muted">{mailBox==='inbox'?'Inbox':'Sent'}</span></div>
          <div className="mail-compose-tabs"><button className={`btn small ${recipientMode==='USER'?'':'secondary'}`} onClick={()=>setRecipientMode('USER')}>Company user</button><button className={`btn small ${recipientMode==='EMAIL'?'':'secondary'}`} onClick={()=>setRecipientMode('EMAIL')}>Email address</button></div>
          {recipientMode==='USER'?<label>Recipient<select value={mailRecipient} onChange={e=>setMailRecipient(e.target.value)}><option value="">Choose company user</option>{people.map((u:any)=><option key={u.id} value={u.id}>{u.uniqueName} — {u.email}</option>)}</select></label>:<label>Recipient email<input type="email" value={mailRecipient} onChange={e=>setMailRecipient(e.target.value)} placeholder="name@example.com"/></label>}
          <label>Subject<input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Subject"/></label><label>Message<textarea rows={10} value={mailBody} onChange={e=>setMailBody(e.target.value)} placeholder="Write your email..."/></label>
          <button className="btn" disabled={!mailRecipient||!subject.trim()||!mailBody.trim()|| (recipientMode==='EMAIL'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailRecipient))} onClick={sendMail}><Send size={14}/> Send email</button>
          <p className="muted" style={{marginTop:10}}>Incoming mail can be routed into this mailbox through the SecureFile inbound-email webhook.</p>
        </div>
        <div className="panel"><h2>{mailDetail?.subject||'Select an email'}</h2>{mailDetail?<><p className="muted"><b>From:</b> {mailDetail.sender?.email||'External sender'}<br/><b>To:</b> {mailDetail.recipientEmail}<br/><b>Date:</b> {new Date(mailDetail.createdAt).toLocaleString()}</p><div className="data mail-body">{mailDetail.body}</div></>:<p className="muted">Select an email from the mailbox.</p>}</div>
      </div>:<div className="panel chat-conversation"><h2>{mode==='chat'?(people.find((u:any)=>u.id===to)?.uniqueName||'Select a person'):(groups.find((g:any)=>g.id===groupId)?.name||'Select a group')}</h2><div className="data chat-messages">{messages.map((m:any)=><div className={`message-bubble ${m.senderId===me?'mine':''}`} key={m.id}><b>{m.sender?.uniqueName||'You'}</b><p>{m.body}</p><small>{new Date(m.createdAt).toLocaleString()}</small></div>)}{!messages.length&&<span className="muted">Select a chat or group to start messaging.</span>}</div><div className="toolbar"><input value={body} onChange={e=>setBody(e.target.value)} placeholder="Write a message..." onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}/><button className="btn" disabled={!(to||groupId)||!body.trim()} onClick={send}><Send size={14}/> Send</button></div></div>}
    </div>
  </div>
}
function Settings(){
 const [m,setM]=useState<any>(null),[users,setUsers]=useState(1),[storage,setStorage]=useState(1),[months,setMonths]=useState(1),[customMonths,setCustomMonths]=useState(1),[quote,setQuote]=useState<any>(null),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[notice,setNotice]=useState('');
 async function load(){try{setErr('');const c=await api('/companies/me');setM(c);setUsers(Number(c.subscription?.users||1));setStorage(Number(c.subscription?.storageGb||c.storageLimitGb||1));}catch(e:any){setErr(e.message)}}
 useEffect(()=>{load()},[]);
 const sub=m?.subscription; const isAdmin=localStorage.getItem('sf_role')==='COMPANY_ADMIN'; const planName=({STARTER:'Basic',BUSINESS:'Advanced',PROFESSIONAL:'Premium',CUSTOM:'Enterprise'} as any)[sub?.planCode||'CUSTOM']||'Enterprise';
 const extraRate=sub?.planCode==='STARTER'?5:sub?.planCode==='BUSINESS'?10:sub?.planCode==='PROFESSIONAL'?12:5;
 const expiresAt=sub?.expiresAt?new Date(sub.expiresAt):null;
 const expired=!!sub && (sub.status==='SUSPENDED'||sub.status==='CANCELED'||(expiresAt?expiresAt.getTime()<=Date.now():false));
 const daysLeft=expiresAt&&!expired?Math.max(0,Math.ceil((expiresAt.getTime()-Date.now())/86400000)):0;
 const changed=users>Number(sub?.users||0)||storage>Number(sub?.storageGb||0);
 async function getQuote(){try{setErr('');setNotice('');const d=await api('/subscriptions/change-quote',{method:'POST',body:JSON.stringify({users,storageGb:storage,months})});setQuote(d.quote)}catch(e:any){setErr(e.message)}}
 async function requestChange(){try{setBusy(true);setErr('');setNotice('');const d=await api('/subscriptions/checkout',{method:'POST',body:JSON.stringify({planCode:sub?.planCode||'CUSTOM',users,storageGb:storage,months})});setQuote(d.quote);if(d.checkoutUrl){window.location.href=d.checkoutUrl;return;}setNotice(d.warning||'Checkout is ready. Payment must be successfully confirmed before new limits or access are applied.');await load();}catch(e:any){setErr(e.message)}finally{setBusy(false)}}
 async function cancel(){if(!confirm('Cancel this SecureFile subscription now? Your workspace and data will be preserved, but all normal work will be suspended immediately. You can renew from Settings at any time.'))return;try{setBusy(true);setErr('');setNotice('');await api('/subscriptions/cancel',{method:'POST'});setNotice('Subscription canceled. Your workspace is now view-only. Renew from Settings to restore full access.');await load();}catch(e:any){setErr(e.message)}finally{setBusy(false)}}
 const canCheckout=expired||changed;
 return <div className="grid2">
   <div className="panel"><h2>Company</h2><p><b>{m?.name||'—'}</b></p><p>{m?.businessIndustry||'—'}</p><p>{m?.businessDescription||'—'}</p></div>
   <div className="panel"><h2>Subscription & Billing</h2><p>Plan: <b>{planName}</b></p><p>Status: <b className={`status-pill ${(sub?.status||'NONE').toLowerCase()}`}>{expired?'EXPIRED / VIEW-ONLY':(sub?.status||'—')}</b></p><p>Current users: <b>{sub?.users||0}</b></p><p>Current storage: <b>{sub?.storageGb||0} GB</b></p><p>Paid period: <b>{sub?.months||1} month{Number(sub?.months||1)!==1?'s':''}</b></p><p>Expires: <b>{expiresAt?expiresAt.toLocaleString():'—'}</b>{!expired&&expiresAt&&<span className="muted"> · {daysLeft} day{daysLeft===1?'':'s'} left</span>}</p>
     {expired&&<div className="notice" style={{marginTop:14}}><b>Your workspace is view-only.</b><p style={{margin:'6px 0 0'}}>Your data is preserved, but normal work is locked until a renewal payment is successfully confirmed.</p></div>}
          {sub?.pendingUsers&&<div className="notice" style={{marginTop:12}}>Payment pending: {sub.pendingUsers} users · {sub.pendingStorageGb} GB. Current limits remain active until payment is approved.</div>}
     {isAdmin&&<>
       {expired?<div className="modal-section" style={{marginTop:20}}>Renew subscription</div>:<div className="modal-section" style={{marginTop:20}}>Purchase additional capacity</div>}
       <label>Total users<input type="number" min={Number(sub?.users||1)} value={users} onChange={e=>{setUsers(Math.max(Number(sub?.users||1),+e.target.value||1));setQuote(null)}}/><small className="muted">Current plan: {planName}. Additional user rate: <b>${extraRate}/user/month</b>. Every added user receives the same {planName} features.</small></label>
       <label>Storage (GB)<input type="number" min={Number(sub?.storageGb||1)} value={storage} onChange={e=>{setStorage(Math.max(Number(sub?.storageGb||1),+e.target.value||1));setQuote(null)}}/><small className="muted">Additional storage is $0.30/GB/month beyond your included plan storage. The selected period is paid upfront.</small></label>
       <label>Purchase duration<select value={[1,3,6,12,24,36].includes(months)?months:0} onChange={e=>{const v=Number(e.target.value);if(v===0){setCustomMonths(customMonths);setMonths(customMonths)}else setMonths(v);setQuote(null)}}><option value={1}>1 month</option><option value={3}>3 months</option><option value={6}>6 months</option><option value={12}>12 months</option><option value={24}>24 months</option><option value={36}>36 months</option><option value={0}>Custom</option></select></label>
       {![1,3,6,12,24,36].includes(months)&&<label>Number of months<input type="number" min={1} max={120} value={customMonths} onChange={e=>{const v=Math.max(1,Math.min(120,+e.target.value||1));setCustomMonths(v);setMonths(v);setQuote(null)}}/></label>}
       <div className="toolbar">{!expired&&<button className="btn secondary" disabled={!changed||busy} onClick={getQuote}>Calculate price</button>}<button className="btn" disabled={!canCheckout||busy} onClick={requestChange}>{busy?'Processing...':expired?'Renew & restore access':'Pay & increase limits'}</button></div>
       {!expired&&<button className="btn secondary" style={{marginTop:10}} disabled={busy} onClick={cancel}>Cancel subscription</button>}
     </>}{!isAdmin&&<p className="muted" style={{marginTop:20}}>Only the Company Admin can renew or purchase additional users/storage.</p>}{quote&&<div className="success" style={{marginTop:14}}>Monthly equivalent: <b>${Number(quote.monthly).toFixed(2)}</b> · Upfront total for {months} month(s): <b>${Number(quote.total).toFixed(2)}</b>. Access/limits update only after successful payment.</div>}
     {notice&&<div className="success" style={{marginTop:14}}>{notice}</div>}{err&&<div className="error" style={{marginTop:14}}>{err}</div>}
   </div>
 </div>
}
