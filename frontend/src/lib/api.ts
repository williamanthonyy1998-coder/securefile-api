const API = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "/api" : "http://localhost:4000/api");

export function token() {
  return localStorage.getItem("sf_token") || "";
}

function dispatchAlert(type: 'success'|'error'|'info', message: string) {
  if (typeof window !== 'undefined' && message) window.dispatchEvent(new CustomEvent('sf:alert', { detail: { type, message } }));
}

function friendlySuccess(path: string, method: string, data: any) {
  if (data?.message && typeof data.message === 'string') return data.message;
  const p=path.toLowerCase();
  if (p.includes('/upload')) return 'File uploaded successfully.';
  if (p.includes('/move')) return 'Moved successfully.';
  if (p.includes('/share')) return 'Sharing updated successfully.';
  if (p.includes('/rename')) return 'Renamed successfully.';
  if (p.includes('/delete') || p.includes('/trash')) return 'Action completed successfully.';
  if (p.includes('/fax')) return method==='POST' ? 'Fax request submitted successfully.' : 'Fax action completed successfully.';
  if (p.includes('/scan')) return 'Scan action completed successfully.';
  if (p.includes('/checkout')) return 'Checkout session created. Redirecting to secure payment.';
  if (method==='POST') return 'Saved successfully.';
  if (method==='PATCH') return 'Updated successfully.';
  if (method==='DELETE') return 'Deleted successfully.';
  return 'Action completed successfully.';
}

export async function api(path: string, opts: RequestInit = {}) {
  const headers = new Headers(opts.headers);
  const silentAlert=headers.get('X-Silent-Alert')==='true';
  if (!(opts.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token()) headers.set("Authorization", `Bearer ${token()}`);

  const response = await fetch(API + path, { ...opts, headers });
  const text = await response.text();

  let data: any = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = { error: text }; }
  }

  if (!response.ok) {
    if(!silentAlert) dispatchAlert('error', data?.error || `Request failed (${response.status})`);
    if (response.status === 401) {
      localStorage.removeItem("sf_token");
      localStorage.removeItem("sf_role");
    }
    throw new Error(data?.error || `Request failed (${response.status})`);
  }

  const method=String(opts.method||'GET').toUpperCase();
  if (!silentAlert && !['GET','HEAD','OPTIONS'].includes(method) && !path.includes('/workspace/notifications')) dispatchAlert('success', friendlySuccess(path, method, data));
  return data;
}

export { API };


export async function directUpload(file: File, options:{folderId?:string;source?:'UPLOAD'|'SCAN'|'FAX';name?:string}={}) {
  try{
    if (import.meta.env.VITE_DIRECT_UPLOAD !== 'true') {
      const fd=new FormData(); fd.append('file',file); if(options.folderId)fd.append('folderId',options.folderId); if(options.source)fd.append('source',options.source);
      return api('/files/upload',{method:'POST',body:fd});
    }
    const ticket:any=await api('/files/upload-ticket',{method:'POST',headers:{'X-Silent-Alert':'true'},body:JSON.stringify({
      name:options.name||file.name,size:file.size,mimeType:file.type||'application/octet-stream',folderId:options.folderId,source:options.source||'UPLOAD'
    })});
    const put=await fetch(ticket.ticket.signedUrl,{method:'PUT',headers:{'Content-Type':file.type||'application/octet-stream','x-upsert':'false'},body:file});
    if(!put.ok) throw new Error(`Storage upload failed (${put.status}).`);
    const committed=await api('/files/commit-upload',{method:'POST',headers:{'X-Silent-Alert':'true'},body:JSON.stringify({
      storageKey:ticket.ticket.key,name:ticket.name,mimeType:ticket.mimeType,sizeBytes:ticket.sizeBytes,folderId:ticket.folderId,source:ticket.source
    })});
    dispatchAlert('success','File uploaded successfully.');
    return committed;
  }catch(e:any){ dispatchAlert('error',e?.message||'File upload failed.'); throw e; }
}

export async function getSignedFileUrl(fileId:string,mode:'preview'|'download'='preview') {
  const data:any=await api(`/files/${encodeURIComponent(fileId)}/signed-url?mode=${mode}`);
  return String(data.url||'');
}
