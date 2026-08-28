import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env';

export const remoteStorageConfigured = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.SUPABASE_STORAGE_BUCKET);

function localPath(key:string){ return path.join(env.UPLOAD_DIR, key); }
function headers(contentType?:string){
  return {
    Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    apikey:env.SUPABASE_SERVICE_ROLE_KEY!,
    ...(contentType ? {'Content-Type':contentType} : {})
  };
}
function remoteUrl(key:string){
  return `${env.SUPABASE_URL!.replace(/\/$/,'')}/storage/v1/object/${encodeURIComponent(env.SUPABASE_STORAGE_BUCKET!)}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export async function putObject(key:string, buffer:Buffer, contentType:string){
  if(!remoteStorageConfigured){ fs.mkdirSync(env.UPLOAD_DIR,{recursive:true}); fs.writeFileSync(localPath(key),buffer); return; }
  const r=await fetch(remoteUrl(key),{method:'POST',headers:{...headers(contentType),'x-upsert':'true'},body:new Uint8Array(buffer)});
  if(!r.ok) throw new Error(`Storage upload failed: ${r.status} ${await r.text()}`);
}
export async function getObject(key:string){
  if(!remoteStorageConfigured){ const p=localPath(key); if(!fs.existsSync(p)) return null; return fs.readFileSync(p); }
  const r=await fetch(remoteUrl(key),{headers:headers()});
  if(r.status===404) return null;
  if(!r.ok) throw new Error(`Storage download failed: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
export async function deleteObject(key:string){
  if(!remoteStorageConfigured){ fs.rmSync(localPath(key),{force:true}); return; }
  const r=await fetch(remoteUrl(key),{method:'DELETE',headers:headers()});
  if(!r.ok && r.status!==404) throw new Error(`Storage delete failed: ${r.status}`);
}

export async function objectExists(key:string,expectedSize?:number){
  if(!remoteStorageConfigured){const p=localPath(key);return fs.existsSync(p)&&(expectedSize===undefined||fs.statSync(p).size===expectedSize);}
  const r=await fetch(remoteUrl(key),{method:'HEAD',headers:headers()});
  if(r.status===404)return false;
  if(!r.ok)throw new Error(`Storage metadata check failed: ${r.status}`);
  if(expectedSize!==undefined){const actual=Number(r.headers.get('content-length')||-1);if(actual>=0&&actual!==expectedSize)return false;}
  return true;
}

export async function createSignedUploadUrl(key:string){
  if(!remoteStorageConfigured) throw new Error('Remote storage is required for direct uploads. Configure Supabase Storage.');
  const base=env.SUPABASE_URL!.replace(/\/$/,'');
  const bucket=encodeURIComponent(env.SUPABASE_STORAGE_BUCKET!);
  const pathPart=key.split('/').map(encodeURIComponent).join('/');
  const r=await fetch(`${base}/storage/v1/object/upload/sign/${bucket}/${pathPart}`,{method:'POST',headers:{...headers(),'Content-Type':'application/json','x-upsert':'false'},body:'{}'});
  const data:any=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(`Storage signed upload failed: ${r.status} ${data?.message||data?.error||''}`.trim());
  const relative=String(data?.url||'');
  if(!relative) throw new Error('Storage did not return a signed upload URL.');
  const signedUrl=relative.startsWith('http')?relative:`${base}${relative}`;
  return {signedUrl,key,expiresIn:7200};
}

export async function createSignedReadUrl(key:string,downloadName?:string){
  if(!remoteStorageConfigured) throw new Error('Remote storage is required for signed file access. Configure Supabase Storage.');
  const base=env.SUPABASE_URL!.replace(/\/$/,'');
  const bucket=encodeURIComponent(env.SUPABASE_STORAGE_BUCKET!);
  const pathPart=key.split('/').map(encodeURIComponent).join('/');
  const r=await fetch(`${base}/storage/v1/object/sign/${bucket}/${pathPart}`,{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({expiresIn:300})});
  const data:any=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(`Storage signed URL failed: ${r.status} ${data?.message||data?.error||''}`.trim());
  const relative=String(data?.signedURL||data?.signedUrl||'');
  if(!relative) throw new Error('Storage did not return a signed file URL.');
  const signedUrl=new URL(relative.startsWith('http')?relative:`${base}${relative}`);
  if(downloadName) signedUrl.searchParams.set('download',downloadName);
  return {signedUrl:signedUrl.toString(),expiresIn:300};
}
