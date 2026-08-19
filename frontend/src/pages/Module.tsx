import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Check, FileUp, RefreshCw, Send, Trash2, UserCheck, X, Search, Paperclip, Smile, MoreVertical, Mail, Users, Phone, Video, ArrowLeft, CheckCheck, MessageSquare, Settings as SettingsIcon } from 'lucide-react';

const META: Record<string,[string,string]> = {
  shared:['Shared','Manage resources shared with you or by you.'],
  requests:['Requests','Request access to files and folders.'],
  approvals:['Approvals','Create and respond to approval workflows.'],
  'assigning-works':['Assigning Works','Assign work and track progress.'],
  chat:['Chat','Company-scoped direct and group messaging.'],
  'scan-documents':['Scan Documents','Upload scanned PDFs when Scanner is active.'],
  'fax-documents':['Fax Documents','Upload fax documents when Fax is active.'],
  ai:['AI Chat Bot','Ask the configured AI provider for help.'],
  settings:['Settings','Review company and subscription settings.']
};

export default function Module(){
  const {name='shared'}=useParams();
  const [data,setData]=useState<any[]>([]),[users,setUsers]=useState<any[]>([]),[files,setFiles]=useState<any[]>([]),[folders,setFolders]=useState<any[]>([]);
  const [err,setErr]=useState(''),[notice,setNotice]=useState(''),[input,setInput]=useState(''),[recipient,setRecipient]=useState('');
  const [resource,setResource]=useState(''),[resourceType,setResourceType]=useState<'file'|'folder'>('file'),[selectedApprover,setSelectedApprover]=useState('');
  const [ai,setAi]=useState(''),[groupName,setGroupName]=useState(''),[groupUsers,setGroupUsers]=useState<string[]>([]);
  const [solutionTask,setSolutionTask]=useState<any>(null); const solutionRef=useRef<HTMLInputElement>(null);

  async function load(){
    try{
      setErr('');
      const endpoint:any={shared:'/sharing',requests:'/workspace/requests',approvals:'/workspace/approvals','assigning-works':'/workspace/tasks',chat:'/workspace/messages'}[name||''];
      if(endpoint){const d=await api(endpoint);setData(Array.isArray(d)?d:[]);}
      if(['chat','requests','approvals','assigning-works'].includes(name||''))setUsers(await api('/users'));
      if(['requests','approvals','assigning-works'].includes(name||'')){const [f,fo]=await Promise.all([api('/files'),api('/folders')]);setFiles(f||[]);setFolders(fo||[]);}
    }catch(e:any){setErr(e.message||'Unable to load this module.');}
  }
  useEffect(()=>{load();},[name]);

  async function post(path:string,body:any){
    try{await api(path,{method:'POST',body:JSON.stringify(body)});setNotice('Saved successfully.');setInput('');load();}
    catch(e:any){setErr(e.message);}
  }
  async function patch(path:string,body:any){
    try{await api(path,{method:'PATCH',body:JSON.stringify(body)});setNotice('Updated successfully.');load();}
    catch(e:any){setErr(e.message);}
  }
  async function upload(kind:'scan'|'fax'){
    const el=document.getElementById('module-file') as HTMLInputElement;const f=el?.files?.[0];if(!f)return;
    const fd=new FormData();fd.append('file',f);
    try{await api('/files/'+kind,{method:'POST',body:fd});setNotice('Document uploaded.');}catch(e:any){setErr(e.message);}
    if(el)el.value='';load();
  }
  async function askAI(){
    if(!input.trim())return;
    try{const d=await api('/workspace/ai',{method:'POST',body:JSON.stringify({message:input})});setAi(d.answer||'');setInput('');}catch(e:any){setErr(e.message);}
  }
  async function solution(){
    const f=solutionRef.current?.files?.[0];if(!f||!solutionTask)return;
    const fd=new FormData();fd.append('file',f);
    try{await api('/workspace/tasks/'+solutionTask.id+'/solution',{method:'POST',body:fd});setNotice('Solution submitted.');setSolutionTask(null);load();}catch(e:any){setErr(e.message);}
  }

  const [title,description]=META[name||'']||[name||'Module','Workspace module'];

  return <><div className="page-head"><div><p className="eyebrow">Workspace</p><h1>{title}</h1><p>{description}</p></div><button className="btn secondary" onClick={load}><RefreshCw size={15}/> Refresh</button></div>
    {err&&<div className="error" style={{marginBottom:16}}>{err}</div>}{notice&&<div className="success" style={{marginBottom:16}}>{notice}</div>}
    {name==='shared'&&<Shares data={data} onRefresh={load} setErr={setErr}/>}
    {name==='requests'&&<Requests data={data} users={users} files={files} folders={folders} recipient={recipient} setRecipient={setRecipient} resource={resource} setResource={setResource} resourceType={resourceType} setResourceType={setResourceType} input={input} setInput={setInput} post={post}/>}
    {name==='approvals'&&<Approvals data={data} patch={patch}/>}
    {name==='assigning-works'&&<Tasks data={data} users={users} files={files} folders={folders} recipient={recipient} setRecipient={setRecipient} resource={resource} setResource={setResource} resourceType={resourceType} setResourceType={setResourceType} input={input} setInput={setInput} patch={patch} setSolutionTask={setSolutionTask} post={post}/>}
    {name==='chat'&&<Chat data={data} users={users} recipient={recipient} setRecipient={setRecipient} input={input} setInput={setInput} post={post} groupName={groupName} setGroupName={setGroupName} groupUsers={groupUsers} setGroupUsers={setGroupUsers}/>}
    {(name==='scan-documents'||name==='fax-documents')&&<div className="panel"><h2>{name==='scan-documents'?'Scanner':'Fax'} documents</h2><p className="muted">Add-on entitlement is enforced by the API.</p><div className="toolbar"><input id="module-file" type="file" accept={name==='scan-documents'?'.pdf':'application/pdf,image/*'}/><button className="btn" onClick={()=>upload(name==='scan-documents'?'scan':'fax')}><FileUp size={15}/> Upload</button></div></div>}
    {name==='ai'&&<div className="panel"><h2>AI assistant</h2><div className="toolbar"><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&askAI()} placeholder="Ask about SecureFile..."/><button className="btn" onClick={askAI}><Send size={15}/> Ask</button></div>{ai&&<div className="data" style={{marginTop:15}}>{ai}</div>}</div>}
    {name==='settings'&&<Settings/>}
    {solutionTask&&<div className="modal-backdrop"><div className="modal"><div className="modal-head"><h2>Submit solution</h2><button className="close-btn" onClick={()=>setSolutionTask(null)}><X size={18}/></button></div><p>{solutionTask.title}</p><input ref={solutionRef} type="file"/><div className="modal-actions"><button className="btn secondary" onClick={()=>setSolutionTask(null)}>Cancel</button><button className="btn" onClick={solution}>Upload solution</button></div></div></div>}
  </>;
}

function ResourcePicker({files,folders,resource,resourceType,setResource,setResourceType}:any){
  return <div className="grid2"><label>Resource type<select value={resourceType} onChange={e=>{setResourceType(e.target.value);setResource('')}}><option value="file">File</option><option value="folder">Folder</option></select></label><label>{resourceType==='file'?'File':'Folder'}<select value={resource} onChange={e=>setResource(e.target.value)}><option value="">Select</option>{(resourceType==='file'?files:folders).map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>;
}

function Shares({data,onRefresh,setErr}:any){
 const [editing,setEditing]=useState<any>(null);
 const [permissions,setPermissions]=useState<any>({view:true,download:false,upload:false,edit:false,delete:false,share:false});
 const [expiresAt,setExpiresAt]=useState('');
 function openEdit(s:any){
   setEditing(s);
   setPermissions({view:!!s.canView,download:!!s.canDownload,upload:!!s.canUpload,edit:!!s.canEdit,delete:!!s.canDelete,share:!!s.canShare});
   setExpiresAt(s.expiresAt?new Date(s.expiresAt).toISOString().slice(0,16):'');
 }
 async function saveEdit(){
   if(!editing)return;
   try{
     await api('/sharing/'+editing.id,{method:'PATCH',body:JSON.stringify({...Object.fromEntries(Object.entries(permissions).map(([k,v])=>['can'+k.charAt(0).toUpperCase()+k.slice(1),v])),expiresAt:expiresAt?new Date(expiresAt).toISOString():null})});
     setEditing(null);onRefresh();
   }catch(e:any){setErr(e.message);}
 }
 async function revoke(id:string){if(!confirm('Revoke this share? The recipient will immediately lose access.'))return;try{await api('/sharing/'+id,{method:'DELETE'});onRefresh();}catch(e:any){setErr(e.message);}}
 const labels:[string,string][]=[['view','View'],['download','Download'],['upload','Upload'],['edit','Edit'],['delete','Delete'],['share','Share']];
 return <><div className="panel">
   <div className="section-title-row"><div><h2>Shared access</h2><p className="muted">Manage every file and folder shared with you or by you.</p></div></div>
   <div className="share-info"><span><b>{data.length}</b> active share{data.length===1?'':'s'}</span><span>Permissions can be changed anytime.</span></div>
   <div className="company-table-wrap"><table><thead><tr><th>Resource</th><th>Type</th><th>Recipient</th><th>Permissions</th><th>Expires</th><th>Action</th></tr></thead><tbody>{data.map((s:any)=><tr key={s.id}>
     <td><strong>{s.file?.name||s.folder?.name||'Resource'}</strong><small className="table-sub">{s.file?'File':'Folder'}</small></td>
     <td><span className="status-pill">{s.type}</span></td>
     <td>{s.recipient?.uniqueName||s.recipient?.email||'Public link'}</td>
     <td><div className="permission-chips">{labels.filter(([k])=>s['can'+k.charAt(0).toUpperCase()+k.slice(1)]).map(([,v])=><span key={v}>{v}</span>)}</div></td>
     <td>{s.expiresAt?new Date(s.expiresAt).toLocaleString():'Never'}</td>
     <td><div className="row-actions"><button className="icon-btn" title="Edit permissions" onClick={()=>openEdit(s)}><SettingsIcon size={14}/></button><button className="icon-btn danger" title="Revoke access" onClick={()=>revoke(s.id)}><Trash2 size={14}/></button></div></td>
   </tr>)}</tbody></table></div>
   {!data.length&&<div className="empty-company"><h3>No shares yet</h3><p>When you share a file or folder, its access controls will appear here.</p></div>}
 </div>
 {editing&&<div className="modal-backdrop"><div className="modal share-edit-modal"><div className="modal-head"><div><p className="eyebrow">Access control</p><h2>Manage shared access</h2><p className="muted">{editing.file?.name||editing.folder?.name||'Shared resource'} → {editing.recipient?.uniqueName||editing.recipient?.email||'Public link'}</p></div><button className="close-btn" onClick={()=>setEditing(null)}><X size={18}/></button></div>
   <div className="modal-section">Permissions</div><div className="permission-list">{labels.map(([key,label])=><label className="checkline" key={key}><input type="checkbox" checked={!!permissions[key]} disabled={key==='view'} onChange={e=>setPermissions({...permissions,[key]:e.target.checked})}/><span><b>{label}</b><small className="permission-help">{key==='view'?'Can open and view the resource.':key==='download'?'Can download a copy.':key==='upload'?'Can upload into the shared resource.':key==='edit'?'Can modify the resource.':key==='delete'?'Can delete the resource.':'Can share the resource with others.'}</small></span></label>)}</div>
   <div className="modal-section">Expiration</div><label>Access expires<input type="datetime-local" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)}/></label><p className="muted" style={{fontSize:12}}>Leave blank for no expiration.</p>
   <div className="modal-actions"><button className="btn secondary" onClick={()=>setEditing(null)}>Cancel</button><button className="btn" onClick={saveEdit}>Save permissions</button></div>
 </div></div>}
 </>;
}

function Requests({data,users,files,folders,recipient,setRecipient,resource,setResource,resourceType,setResourceType,input,setInput,post}:any){
 const [canDownload,setCanDownload]=useState(false);
 const me=localStorage.getItem('sf_user_id');
 const targets=users.filter((u:any)=>u.id!==me);
 return <div className="grid2">
   <div className="panel">
     <h2>Request access</h2>
     <p className="muted">Ask the person who controls the resource. Your request will appear only in their Approvals queue.</p>
     <ResourcePicker {...{files,folders,resource,setResource,resourceType,setResourceType}}/>
     <label>Send request to<select value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="">Select approver</option>{targets.map((u:any)=><option key={u.id} value={u.id}>{u.uniqueName} · {u.role}</option>)}</select></label>
     <label className="checkline"><input type="checkbox" checked={canDownload} onChange={e=>setCanDownload(e.target.checked)}/><span><b>Allow download</b><small className="permission-help">Request download permission in addition to viewing.</small></span></label>
     <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Why do you need access?"/>
     <button className="btn" disabled={!recipient||!resource} onClick={async()=>{await post('/workspace/requests',{targetUserId:recipient,[resourceType+'Id']:resource,canDownload,note:input});setRecipient('');setResource('');setCanDownload(false)}}>Submit request</button>
   </div>
   <div className="panel">
     <div className="section-title-row"><div><h2>My requests</h2><p className="muted">Requests you have sent. You cannot approve your own request.</p></div></div>
     <div className="company-table-wrap"><table><thead><tr><th>Resource</th><th>Requested to</th><th>Access</th><th>Status</th><th>Created</th></tr></thead><tbody>{data.map((x:any)=><tr key={x.id}><td><strong>{x.file?.name||x.folder?.name||'Resource'}</strong><small className="table-sub">{x.file?'File':'Folder'}</small></td><td>{x.targetUser?.uniqueName||x.targetUser?.email||'—'}</td><td>{x.canDownload?'View + Download':'View'}</td><td><span className={`status-pill ${x.status==='APPROVED'?'success':x.status==='REJECTED'?'danger':''}`}>{x.status}</span></td><td>{new Date(x.createdAt).toLocaleString()}</td></tr>)}{!data.length&&<tr><td colSpan={5}><div className="empty-state">You have not sent any access requests.</div></td></tr>}</tbody></table></div>
   </div>
 </div>;
}

function Approvals({data,patch}:any){
 const me=localStorage.getItem('sf_user_id');
 const incoming=data.filter((x:any)=>x.approverId===me);
 return <div className="panel">
   <div className="section-title-row"><div><h2>Approval queue</h2><p className="muted">Only requests assigned to you appear here. Approve or reject them from this queue.</p></div></div>
   <div className="company-table-wrap"><table><thead><tr><th>Requester</th><th>Resource</th><th>Requested access</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead><tbody>{incoming.map((x:any)=><tr key={x.id}><td><strong>{x.requester?.uniqueName||x.requester?.email}</strong><small className="table-sub">{x.requester?.email}</small></td><td><strong>{x.file?.name||x.folder?.name||'Resource'}</strong><small className="table-sub">{x.file?'File':'Folder'}</small></td><td>{x.accessRequest?.canDownload?'View + Download':'View'}</td><td>{x.note||'Access requested'}</td><td><span className={`status-pill ${x.status==='APPROVED'?'success':x.status==='REJECTED'?'danger':''}`}>{x.status}</span></td><td>{x.status==='PENDING'?<div className="row-actions"><button className="btn small" onClick={()=>patch('/workspace/approvals/'+x.id,{status:'APPROVED'})}><Check size={13}/> Approve</button><button className="btn small secondary" onClick={()=>patch('/workspace/approvals/'+x.id,{status:'REJECTED'})}>Reject</button></div>:<span className="muted">Resolved</span>}</td></tr>)}{!incoming.length&&<tr><td colSpan={6}><div className="empty-state">No requests are waiting for your approval.</div></td></tr>}</tbody></table></div>
 </div>;
}

function Tasks({data,users,files,folders,resourceType,recipient,setRecipient,resource,setResource,setResourceType,input,setInput,patch,setSolutionTask,post}:any){
 return <div className="grid2"><div className="panel"><h2>Assign work</h2><label>Assignee<select value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="">Select employee/client</option>{users.filter((u:any)=>u.role!=='COMPANY_ADMIN').map((u:any)=><option key={u.id} value={u.id}>{u.uniqueName}</option>)}</select></label><input value={input} onChange={e=>setInput(e.target.value)} placeholder="Task title"/><ResourcePicker {...{files,folders,resource,setResource,resourceType,setResourceType}}/><button className="btn" onClick={()=>postTask()} >Assign</button></div><div className="panel"><h2>Work queue</h2><table><thead><tr><th>Task</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{data.map((t:any)=><tr key={t.id}><td>{t.title}</td><td><select value={t.status} onChange={e=>patch('/workspace/tasks/'+t.id,{status:e.target.value})}>{['PENDING','STARTED','PARTIALLY_COMPLETED','COMPLETED'].map(s=><option key={s}>{s}</option>)}</select></td><td>{new Date(t.createdAt).toLocaleString()}</td><td><button className="icon-btn" onClick={()=>setSolutionTask(t)}><FileUp size={14}/></button></td></tr>)}</tbody></table></div></div>;
 function postTask(){ post('/workspace/tasks',{assigneeId:recipient,title:input,[resourceType+'Id']:resource||undefined}); }
}

function Chat({data,users,recipient,setRecipient,input,setInput,post,groupName,setGroupName,groupUsers,setGroupUsers}:any){
 const [mode,setMode]=useState<'direct'|'group'>('direct');
 const [selected,setSelected]=useState<any>(null); const [groups,setGroups]=useState<any[]>([]); const [messages,setMessages]=useState<any[]>(data||[]);
 const [query,setQuery]=useState(''); const [draft,setDraft]=useState(''); const [emailOpen,setEmailOpen]=useState(false); const [emailTo,setEmailTo]=useState('');
 const [emailSubject,setEmailSubject]=useState(''); const [emailBody,setEmailBody]=useState(''); const [emailStatus,setEmailStatus]=useState(''); const [emailConfigured,setEmailConfigured]=useState<boolean|null>(null);
 const me=localStorage.getItem('sf_user_id');
 async function loadGroups(){try{setGroups(await api('/workspace/groups'));}catch{}}
 async function loadEmailStatus(){try{const x=await api('/workspace/email/status');setEmailConfigured(Boolean(x.configured));}catch{setEmailConfigured(false)}}
 async function loadConversation(target:any){setSelected(target);try{const url=target.kind==='group'?`/workspace/messages?groupId=${encodeURIComponent(target.id)}`:`/workspace/messages?withUser=${encodeURIComponent(target.id)}`;setMessages(await api(url));}catch(e:any){setEmailStatus(e.message)}}
 useEffect(()=>{loadGroups();loadEmailStatus()},[]); useEffect(()=>{if(selected)loadConversation(selected)},[]); useEffect(()=>{if(!selected)return;const t=setInterval(()=>loadConversation(selected),3000);return()=>clearInterval(t)},[selected]);
 const people=users.filter((u:any)=>u.id!==me&&(!query||`${u.uniqueName} ${u.email}`.toLowerCase().includes(query.toLowerCase()))); const visibleGroups=groups.filter((g:any)=>!query||g.name.toLowerCase().includes(query.toLowerCase()));
 async function send(){if(!draft.trim()||!selected)return;try{await api('/workspace/messages',{method:'POST',body:JSON.stringify(selected.kind==='group'?{groupId:selected.id,body:draft}:{recipientId:selected.id,body:draft})});setDraft('');loadConversation(selected)}catch(e:any){setEmailStatus(e.message)}}
 function openEmail(target?:any){setEmailStatus('');setEmailTo(target?.email||'');setEmailSubject(target?`Message for ${target.uniqueName}`:'');setEmailBody('');setEmailOpen(true)}
 async function sendEmail(){if(!emailTo.trim()||!emailSubject.trim()||!emailBody.trim())return setEmailStatus('Please complete To, Subject and Message.');try{setEmailStatus('Sending...');const payload:any={recipientEmail:emailTo.trim(),subject:emailSubject.trim(),body:emailBody.trim()};if(selected?.kind==='direct'&&selected.id)payload.recipientId=selected.id;const r=await api('/workspace/email',{method:'POST',body:JSON.stringify(payload)});setEmailStatus(r?.delivery?.delivered?'Email sent successfully.':'Email was accepted by SecureFile but the email provider is not configured for delivery.');if(r?.delivery?.delivered){setEmailSubject('');setEmailBody('');setEmailOpen(false)}}catch(e:any){setEmailStatus(e.message)}}
 const selectedName=selected?.kind==='group'?selected.name:(selected?.uniqueName||'Select a conversation');
 return <div className="chat-shell">
   <aside className="chat-list">
     <div className="chat-list-head"><div><span className="eyebrow">Workspace</span><h2>Messages</h2><small className="chat-subtitle">Secure chat & email</small></div><div className="chat-list-actions"><button className="btn small email-top-btn" onClick={()=>openEmail()}><Mail size={14}/> Email</button><button className="icon-btn" title="New group" onClick={()=>{setMode('group');setSelected(null)}}><Users size={16}/></button></div></div>
     <div className="chat-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search people or groups"/></div>
     <div className="chat-tabs"><button className={mode==='direct'?'active':''} onClick={()=>setMode('direct')}>People</button><button className={mode==='group'?'active':''} onClick={()=>setMode('group')}>Groups</button></div>
     <div className="chat-list-scroll">{mode==='direct'?people.map((u:any)=><button className={`chat-contact ${selected?.id===u.id?'selected':''}`} key={u.id} onClick={()=>loadConversation({...u,kind:'direct'})}><span className="chat-avatar">{u.uniqueName?.slice(0,1).toUpperCase()}</span><span className="chat-contact-copy"><strong>{u.uniqueName}</strong><small>{u.email}</small></span><span className="presence-dot"/></button>):visibleGroups.map((g:any)=><button className={`chat-contact ${selected?.id===g.id?'selected':''}`} key={g.id} onClick={()=>loadConversation({...g,kind:'group'})}><span className="chat-avatar group">{g.name?.slice(0,1).toUpperCase()}</span><span className="chat-contact-copy"><strong>{g.name}</strong><small>{g.members?.length||0} members</small></span></button>)}{mode==='direct'&&!people.length&&<div className="chat-empty-small">No people found.</div>}{mode==='group'&&!visibleGroups.length&&<div className="chat-empty-small">No groups yet.</div>}</div>
     {mode==='group'&&<div className="chat-create-group"><input value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="Group name"/><div className="chat-member-picker">{users.filter((u:any)=>u.id!==me).map((u:any)=><label key={u.id}><input type="checkbox" checked={groupUsers.includes(u.id)} onChange={e=>setGroupUsers(e.target.checked?[...groupUsers,u.id]:groupUsers.filter((id:string)=>id!==u.id))}/>{u.uniqueName}</label>)}</div><button className="btn" onClick={async()=>{try{const g=await api('/workspace/groups',{method:'POST',body:JSON.stringify({name:groupName,userIds:groupUsers})});setGroupName('');setGroupUsers([]);await loadGroups();loadConversation({...g,kind:'group'})}catch(e:any){setEmailStatus(e.message)}}}>Create group</button></div>}
   </aside>
   <section className="chat-conversation">
     {selected?<>
       <header className="chat-conversation-head"><div className="chat-person"><span className="chat-avatar large">{selectedName.slice(0,1).toUpperCase()}</span><div><strong>{selectedName}</strong><small>{selected.kind==='group'?'Group conversation':selected.email}</small></div></div><div className="chat-head-actions">{selected.kind==='direct'&&<button className="btn small email-conversation-btn" onClick={()=>openEmail(selected)}><Mail size={14}/> Email</button>}<button className="icon-btn" title="Audio call"><Phone size={17}/></button><button className="icon-btn" title="Video call"><Video size={17}/></button><button className="icon-btn" title="More"><MoreVertical size={17}/></button></div></header>
       {selected.kind==='direct'&&<div className="email-strip"><Mail size={14}/><span>Need to send this person an actual email?</span><button onClick={()=>openEmail(selected)}>Compose email</button>{emailConfigured===false&&<small>Email delivery is not configured</small>}</div>}
       <div className="chat-messages">{messages.map((m:any)=>{const mine=m.senderId===me;return <div className={`chat-bubble-row ${mine?'mine':''}`} key={m.id}><div className={`chat-bubble ${mine?'mine':''}`}><p>{m.body}</p><footer><span>{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>{mine&&<CheckCheck size={14}/>}</footer></div></div>})}{!messages.length&&<div className="chat-empty"><span className="chat-avatar large">{selectedName.slice(0,1).toUpperCase()}</span><h3>Start the conversation</h3><p>Send a message or use <b>Email</b> to send to their real inbox.</p></div>}</div>
       <div className="chat-composer"><div className="chat-composer-tools"><button className="icon-btn" title="Attach file"><Paperclip size={18}/></button><button className="icon-btn" title="Emoji"><Smile size={18}/></button></div><textarea value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Write a message..." rows={1}/><button className="btn chat-send" onClick={send}><Send size={16}/></button></div>
     </>:<div className="chat-welcome"><div className="chat-welcome-icon"><MessageSquare size={32}/></div><h2>Your conversations</h2><p>Choose a person or group for secure chat, or compose an actual email.</p><div className="chat-welcome-actions"><span><Check size={14}/> Secure company messaging</span><button className="btn small" onClick={()=>openEmail()}><Mail size={14}/> Compose email</button></div></div>}
   </section>
   {emailOpen&&<div className="modal-backdrop"><div className="modal email-compose"><div className="modal-head"><div><p className="eyebrow">Mail</p><h2>Compose email</h2><p className="muted">Send an actual email to any valid address.</p></div><button className="close-btn" onClick={()=>setEmailOpen(false)}><X size={18}/></button></div><label>To<input type="email" value={emailTo} onChange={e=>setEmailTo(e.target.value)} placeholder="recipient@example.com" autoFocus/></label><label>Subject<input value={emailSubject} onChange={e=>setEmailSubject(e.target.value)} placeholder="Subject"/></label><label>Message<textarea value={emailBody} onChange={e=>setEmailBody(e.target.value)} placeholder="Write your email..." rows={10}/></label>{emailStatus&&<div className={emailStatus.includes('successfully')?'success':'error'}>{emailStatus}</div>}<div className="email-provider-note">{emailConfigured===true?<><span className="provider-ok">●</span> Email delivery is configured.</>:<><span>●</span> Email delivery is not configured yet. Set <b>EMAIL_PROVIDER=resend</b>, <b>EMAIL_FROM</b> and <b>RESEND_API_KEY</b> in the server .env.</>}</div><div className="modal-actions"><button className="btn secondary" onClick={()=>setEmailOpen(false)}>Cancel</button><button className="btn" onClick={sendEmail}><Mail size={15}/> Send email</button></div></div></div>}
 </div>;
}
function Settings(){
 const [m,setM]=useState<any>(null),[err,setErr]=useState('');
 useEffect(()=>{api('/companies/me').then(setM).catch((e:any)=>setErr(e.message));},[]);
 return <div className="grid2"><div className="panel"><h2>Company profile</h2>{err&&<div className="error">{err}</div>}<p><b>Name:</b> {m?.name||'—'}</p><p><b>Contact:</b> {m?.contactEmail||'—'}</p><p><b>Tenant:</b> {m?.slug||'—'}</p></div><div className="panel"><h2>Subscription</h2><p><b>Status:</b> {m?.subscription?.status||'—'}</p><p><b>Users:</b> {m?.subscription?.users||0}</p><p><b>Storage:</b> {m?.subscription?.storageGb||0} GB</p><p><b>Expires:</b> {m?.subscription?.expiresAt?new Date(m.subscription.expiresAt).toLocaleString():'—'}</p><p><b>Add-ons:</b> {Object.entries(m?.subscription?.addons||{}).filter(([,v])=>v).map(([k])=>k).join(', ')||'None'}</p></div></div>;
}
