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
  const r=await fetch(remoteUrl(key),{method:'POST',headers:{...headers(contentType),'x-upsert':'true'},body:buffer});
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
