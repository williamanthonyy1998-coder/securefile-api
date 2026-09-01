import { Router } from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import { db } from '../db';
import { auth, AuthedRequest } from '../middleware/auth';
import { activeSubscription } from '../middleware/subscription';
import { requireAddon } from '../services/entitlements';
import { env } from '../config/env';
import { getFileAccess } from '../services/access';
import { getObject, putObject, deleteObject } from '../services/storage';
import { notify } from '../services/notify';
import { NotificationType } from '@prisma/client';
import { provisionPhaxioNumber, sendPhaxioFax, faxConfigured } from '../services/fax';

const r = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Math.min(env.MAX_UPLOAD_MB, 20) * 1024 * 1024 } });

function e164(value:string){ return /^\+[1-9]\d{7,14}$/.test(value.trim()); }
function callbackUrl(){
  if(!env.PHAXIO_CALLBACK_URL) return undefined;
  const base=env.PHAXIO_CALLBACK_URL.replace(/\/$/,'');
  // Prefer Phaxio's signed callback verification. The legacy query token is
  // kept only as a compatibility fallback for older deployments.
  if(env.PHAXIO_CALLBACK_TOKEN) return base;
  return env.FAX_WEBHOOK_SECRET ? `${base}${base.includes('?')?'&':'?'}token=${encodeURIComponent(env.FAX_WEBHOOK_SECRET)}` : base;
}

r.get('/', auth, activeSubscription, async (req:AuthedRequest,res,next)=>{
  try{
    await requireAddon(req.user!.companyId!, 'fax');
    const [line,jobs]=await Promise.all([
      db.faxLine.findUnique({where:{userId:req.user!.id}}),
      db.faxJob.findMany({where:{userId:req.user!.id},orderBy:{createdAt:'desc'},take:100,include:{file:{select:{id:true,name:true,mimeType:true,sizeBytes:true}}}})
    ]);
    res.json({configured:faxConfigured(), line, jobs:jobs.map(j=>({...j,file:j.file?{...j.file,sizeBytes:String(j.file.sizeBytes)}:null}))});
  }catch(e){next(e)}
});

r.post('/number/provision', auth, activeSubscription, async (req:AuthedRequest,res,next)=>{
  try{
    const companyId=req.user!.companyId!;
    await requireAddon(companyId,'fax');
    if(!faxConfigured()) return res.status(503).json({error:'Fax provider is not configured.'});
    if(!env.PHAXIO_CALLBACK_URL) return res.status(503).json({error:'PHAXIO_CALLBACK_URL must be configured before receiving faxes.'});
    const existing=await db.faxLine.findUnique({where:{userId:req.user!.id}});
    if(existing?.active) return res.json(existing);
    const countryCode=Number(req.body.countryCode||1);
    const areaCode=Number(req.body.areaCode);
    if(!Number.isInteger(countryCode)||countryCode<1||countryCode>999)return res.status(400).json({error:'Invalid country code.'});
    if(!Number.isInteger(areaCode)||areaCode<100||areaCode>999)return res.status(400).json({error:'Enter a valid area code.'});
    const number:any=await provisionPhaxioNumber({countryCode,areaCode,callbackUrl:callbackUrl()});
    const phoneNumber=String(number.phone_number||number.phoneNumber||'').trim();
    if(!e164(phoneNumber)) return res.status(502).json({error:'Fax provider did not return a valid phone number.'});
    const line=await db.faxLine.upsert({where:{userId:req.user!.id},create:{companyId,userId:req.user!.id,phoneNumber,provider:'PHAXIO',providerRef:phoneNumber,countryCode,areaCode,active:true},update:{companyId,phoneNumber,provider:'PHAXIO',providerRef:phoneNumber,countryCode,areaCode,active:true}});
    await notify(req.user!.id,'Your SecureFile fax number is ready',`Your personal fax number is ${phoneNumber}.`,companyId, undefined, true);
    res.status(201).json(line);
  }catch(e){next(e)}
});

r.post('/send', auth, activeSubscription, upload.single('file'), async (req:AuthedRequest,res,next)=>{
  try{
    const companyId=req.user!.companyId!;
    await requireAddon(companyId,'fax');
    if(!faxConfigured()) return res.status(503).json({error:'Fax provider is not configured.'});

    const line=await db.faxLine.findUnique({where:{userId:req.user!.id}});
    if(!line?.active)return res.status(400).json({error:'You do not have a personal fax number yet. Provision one first.'});

    const to=String(req.body.to||'').trim();
    if(!e164(to))return res.status(400).json({error:'Recipient fax number must be in E.164 format, for example +14155551234.'});

    let buffer:Buffer|undefined;
    let filename='SecureFile Fax.pdf';
    let fileId:string|undefined;
    let uploadedMime='application/pdf';

    if(req.body.fileId){
      const f=await getFileAccess(req.user!.id,req.user!.role,companyId,String(req.body.fileId),'view');
      if(!f)return res.status(403).json({error:'You do not have permission to fax this file.'});
      const object=await getObject(f.storageKey);
      if(!object)return res.status(404).json({error:'Stored file is missing.'});
      buffer=object;filename=f.name;fileId=f.id;uploadedMime=f.mimeType||'application/octet-stream';
    } else if(req.file){
      buffer=req.file.buffer;filename=req.file.originalname||filename;uploadedMime=req.file.mimetype||uploadedMime;
      // Persist a private copy before sending so the fax history always has
      // the exact document that the user submitted, even if delivery later fails.
      await assertFaxStorage(companyId, buffer.length);
      const storageKey=`fax-out-${crypto.randomUUID()}`;
      await putObject(storageKey,buffer,uploadedMime);
      try{
        const saved=await db.file.create({data:{companyId,ownerId:req.user!.id,name:safeFaxFilename(filename),storageKey,mimeType:uploadedMime,sizeBytes:buffer.length,source:'FAX'}});
        fileId=saved.id;
        await db.company.update({where:{id:companyId},data:{storageUsedBytes:{increment:buffer.length}}});
      }catch(e){
        try{await deleteObject(storageKey);}catch{}
        throw e;
      }
    } else {
      return res.status(400).json({error:'Choose a SecureFile document or upload a document to fax.'});
    }

    if(buffer.length>20*1024*1024)return res.status(413).json({error:'Fax content must be 20 MB or smaller.'});

    const job=await db.faxJob.create({data:{companyId,userId:req.user!.id,direction:'OUTBOUND',status:'SENDING',recipientNumber:to,senderNumber:line.phoneNumber,fileId}});

    try{
      const result:any=await sendPhaxioFax({
        to,buffer,filename,
        headerText:String(req.body.headerText||'').slice(0,50)||undefined,
        callerId:line.phoneNumber,
        callbackUrl:callbackUrl(),
        tag:{securefile_job_id:job.id,user_id:req.user!.id}
      });
      const providerRef=String(result.id||result.fax_id||'').trim();
      const updated=await db.faxJob.update({where:{id:job.id},data:{status:'QUEUED',providerRef:providerRef||null,fileId:fileId||null}});
      await notify(req.user!.id,'Fax queued',`Your fax to ${to} has been queued for delivery.`,companyId, NotificationType.FAX_SENT, true);
      return res.status(201).json(updated);
    }catch(e:any){
      await db.faxJob.update({where:{id:job.id},data:{status:'FAILED',errorMessage:e.message||'Fax provider error'}});
      await notify(req.user!.id,'Fax failed',e.message||`Unable to send fax to ${to}.`,companyId, NotificationType.FAX_FAILED, true);
      throw e;
    }
  }catch(e){next(e)}
});

function safeFaxFilename(value:string){
  const cleaned=String(value||'SecureFile Fax.pdf').replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').trim();
  return cleaned.slice(0,180)||'SecureFile Fax.pdf';
}

async function assertFaxStorage(companyId:string, additional:number){
  const c=await db.company.findUnique({where:{id:companyId},select:{storageLimitGb:true,storageUsedBytes:true}});
  if(!c)throw new Error('Company not found');
  const limit=BigInt(Math.floor(c.storageLimitGb*1024*1024*1024));
  if(c.storageUsedBytes+BigInt(additional)>limit){
    const e=new Error('Storage limit exceeded');
    (e as any).status=413;
    throw e;
  }
}

export default r;
