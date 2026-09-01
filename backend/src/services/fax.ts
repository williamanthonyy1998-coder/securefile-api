import { env } from '../config/env';

export function faxConfigured(){
  return Boolean(env.PHAXIO_API_KEY && env.PHAXIO_API_SECRET);
}

function authHeader(){
  return 'Basic ' + Buffer.from(`${env.PHAXIO_API_KEY}:${env.PHAXIO_API_SECRET}`).toString('base64');
}

function base(){ return env.PHAXIO_BASE_URL.replace(/\/$/,''); }

async function providerFetch(url:string, init:RequestInit, timeoutMs=30_000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    return await fetch(url,{...init,signal:controller.signal});
  }catch(e:any){
    if(e?.name==='AbortError') throw new Error('Fax provider request timed out. Please try again.');
    throw e;
  }finally{ clearTimeout(timer); }
}

async function providerJson(response:Response){
  const data:any=await response.json().catch(()=>({}));
  if(!response.ok || data?.success===false){
    throw new Error(data?.message || data?.error_message || `Fax provider error (${response.status})`);
  }
  return data?.data || data;
}

export async function sendPhaxioFax(input:{to:string;buffer:Buffer;filename:string;headerText?:string;callbackUrl?:string;callerId?:string;tag?:Record<string,string>}){
  if(!faxConfigured()) throw new Error('Fax provider is not configured. Add PHAXIO_API_KEY and PHAXIO_API_SECRET to .env.');
  if(input.buffer.length>20*1024*1024) throw new Error('Fax content must be 20 MB or smaller.');

  const form=new FormData();
  form.append('to',input.to);
  form.append('file',new Blob([new Uint8Array(input.buffer)]),input.filename);
  if(input.headerText) form.append('header_text',input.headerText.slice(0,50));
  if(input.callbackUrl) form.append('callback_url',input.callbackUrl);
  if(input.callerId) form.append('caller_id',input.callerId);
  if(input.tag) for(const [k,v] of Object.entries(input.tag)) form.append(`tag[${k}]`,v);

  const r=await providerFetch(`${base()}/faxes`,{method:'POST',headers:{Authorization:authHeader()},body:form});
  return providerJson(r);
}

export async function getPhaxioFaxFile(faxId:string){
  if(!faxConfigured()) throw new Error('Fax provider is not configured.');
  const r=await providerFetch(`${base()}/faxes/${encodeURIComponent(faxId)}/file`,{headers:{Authorization:authHeader()}},45_000);
  if(!r.ok) throw new Error(`Unable to retrieve received fax (${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}

export async function getPhaxioFax(faxId:string){
  if(!faxConfigured()) throw new Error('Fax provider is not configured.');
  const r=await providerFetch(`${base()}/faxes/${encodeURIComponent(faxId)}`,{headers:{Authorization:authHeader()}});
  return providerJson(r);
}

export async function provisionPhaxioNumber(input:{countryCode:number;areaCode:number;callbackUrl?:string}){
  if(!faxConfigured()) throw new Error('Fax provider is not configured. Add PHAXIO_API_KEY and PHAXIO_API_SECRET to .env.');
  const form=new FormData();
  form.append('country_code',String(input.countryCode));
  form.append('area_code',String(input.areaCode));
  if(input.callbackUrl) form.append('callback_url',input.callbackUrl);
  const r=await providerFetch(`${base()}/phone_numbers`,{method:'POST',headers:{Authorization:authHeader()},body:form});
  return providerJson(r);
}

export async function releasePhaxioNumber(phoneNumber:string){
  if(!faxConfigured()) throw new Error('Fax provider is not configured.');
  const r=await providerFetch(`${base()}/phone_numbers/${encodeURIComponent(phoneNumber)}`,{method:'DELETE',headers:{Authorization:authHeader()}});
  if(!r.ok){ const data:any=await r.json().catch(()=>({})); throw new Error(data?.message || `Unable to release fax number (${r.status})`); }
  return true;
}
