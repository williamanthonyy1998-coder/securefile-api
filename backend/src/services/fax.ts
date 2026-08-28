import { env } from '../config/env';

export function faxConfigured(){ return Boolean(env.PHAXIO_API_KEY && env.PHAXIO_API_SECRET); }

function authHeader(){
  return 'Basic ' + Buffer.from(`${env.PHAXIO_API_KEY}:${env.PHAXIO_API_SECRET}`).toString('base64');
}

function base(){ return env.PHAXIO_BASE_URL.replace(/\/$/,''); }

export async function sendPhaxioFax(input:{to:string;buffer:Buffer;filename:string;headerText?:string;callbackUrl?:string;callerId?:string;tag?:Record<string,string>}){
  if(!faxConfigured()) throw new Error('Fax provider is not configured. Add PHAXIO_API_KEY and PHAXIO_API_SECRET to .env.');
  const form=new FormData();
  form.append('to',input.to);
  form.append('file',new Blob([new Uint8Array(input.buffer)]),input.filename);
  if(input.headerText) form.append('header_text',input.headerText.slice(0,50));
  if(input.callbackUrl) form.append('callback_url',input.callbackUrl);
  if(input.callerId) form.append('caller_id',input.callerId);
  if(input.tag) for(const [k,v] of Object.entries(input.tag)) form.append(`tag[${k}]`,v);
  const r=await fetch(`${base()}/faxes`,{method:'POST',headers:{Authorization:authHeader()},body:form});
  const data:any=await r.json().catch(()=>({}));
  if(!r.ok || data?.success===false) throw new Error(data?.message || data?.error_message || `Fax provider error (${r.status})`);
  return data?.data || data;
}

export async function getPhaxioFaxFile(faxId:string){
  if(!faxConfigured()) throw new Error('Fax provider is not configured.');
  const r=await fetch(`${base()}/faxes/${encodeURIComponent(faxId)}/file`,{headers:{Authorization:authHeader()}});
  if(!r.ok) throw new Error(`Unable to retrieve received fax (${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}

export async function provisionPhaxioNumber(input:{countryCode:number;areaCode:number;callbackUrl?:string}){
  if(!faxConfigured()) throw new Error('Fax provider is not configured. Add PHAXIO_API_KEY and PHAXIO_API_SECRET to .env.');
  const form=new FormData();
  form.append('country_code',String(input.countryCode));
  form.append('area_code',String(input.areaCode));
  if(input.callbackUrl) form.append('callback_url',input.callbackUrl);
  const r=await fetch(`${base()}/phone_numbers`,{method:'POST',headers:{Authorization:authHeader()},body:form});
  const data:any=await r.json().catch(()=>({}));
  if(!r.ok || data?.success===false) throw new Error(data?.message || data?.error_message || `Unable to provision fax number (${r.status})`);
  return data?.data || data;
}

export async function releasePhaxioNumber(phoneNumber:string){
  if(!faxConfigured()) throw new Error('Fax provider is not configured.');
  const r=await fetch(`${base()}/phone_numbers/${encodeURIComponent(phoneNumber)}`,{method:'DELETE',headers:{Authorization:authHeader()}});
  if(!r.ok){ const data:any=await r.json().catch(()=>({})); throw new Error(data?.message || `Unable to release fax number (${r.status})`); }
  return true;
}
