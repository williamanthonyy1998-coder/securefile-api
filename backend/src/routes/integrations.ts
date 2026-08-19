import {Router} from 'express';
import multer from 'multer';
import {db} from '../db';
import {auth,AuthedRequest} from '../middleware/auth';
import {env} from '../config/env';
import {requireAddon} from '../services/entitlements';
import {safeFilename} from '../utils/security'; import crypto from 'node:crypto'; import {putObject} from '../services/storage';
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:env.MAX_UPLOAD_MB*1024*1024}});
const r=Router();

r.post('/fax/inbound',upload.single('file'),async(req,res)=>{
 if(!env.FAX_WEBHOOK_SECRET || req.headers['x-fax-webhook-secret']!==env.FAX_WEBHOOK_SECRET)return res.status(401).json({error:'Invalid fax webhook'});
 const companyId=String(req.body.companyId||''); const userId=String(req.body.userId||'');
 const user=await db.user.findFirst({where:{id:userId,companyId}});
 if(!user||!req.file)return res.status(400).json({error:'Valid user and fax file required'});
 const sub=await db.subscription.findUnique({where:{companyId},select:{addons:true,status:true}});
 if(sub?.status!=='ACTIVE'||!(sub.addons as any)?.fax)return res.status(402).json({error:'Fax add-on is not active'});
 const key=`fax-${crypto.randomUUID()}`; await putObject(key,req.file.buffer,req.file.mimetype||'application/pdf');
 const f=await db.file.create({data:{companyId,ownerId:userId,name:safeFilename(req.file.originalname||'Incoming Fax.pdf'),storageKey:key,mimeType:req.file.mimetype||'application/pdf',sizeBytes:req.file.size,source:'FAX'}});
 await db.company.update({where:{id:companyId},data:{storageUsedBytes:{increment:req.file.size}}});
 res.status(201).json({id:f.id});
});

r.post('/postal/send',auth,async(req:AuthedRequest,res)=>{
 await requireAddon(req.user!.companyId!,'postal');
 if(!env.POSTAL_API_KEY||!env.POSTAL_API_URL)return res.status(503).json({error:'Postal provider is not configured'});
 res.status(501).json({error:'Postal provider adapter is configured but requires provider-specific payload mapping.'});
});
export default r;
