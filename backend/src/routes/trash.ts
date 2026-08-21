import { Router } from 'express';
import { db } from '../db';
import { auth, AuthedRequest } from '../middleware/auth';
import { getFileAccess, getFolderAccess } from '../services/access';
import { deleteObject } from '../services/storage';
import { audit } from '../services/audit';
import { activeSubscription } from '../middleware/subscription';

const r=Router();

r.get('/',auth,async(req:AuthedRequest,res,next)=>{try{
 const companyId=req.user!.companyId!;
 const whereUser=req.user!.role==='COMPANY_ADMIN'?{}:{ownerId:req.user!.id};
 const [files,folders]=await Promise.all([
   db.file.findMany({where:{companyId,deletedAt:{not:null},...whereUser},orderBy:{deletedAt:'desc'},take:200,select:{id:true,name:true,sizeBytes:true,mimeType:true,deletedAt:true,ownerId:true,folderId:true}}),
   db.folder.findMany({where:{companyId,deletedAt:{not:null},...whereUser},orderBy:{deletedAt:'desc'},take:200,select:{id:true,name:true,isPersonal:true,deletedAt:true,ownerId:true,parentId:true}})
 ]);
 res.json({files:files.map(f=>({...f,type:'FILE',sizeBytes:String(f.sizeBytes)})),folders:folders.map(f=>({...f,type:'FOLDER'}))});
}catch(e){next(e)}});

const restoreHandler=async(req:AuthedRequest,res:any,next:any)=>{try{
 const type=String(req.params.type).toUpperCase(); const id=String(req.params.id); const companyId=req.user!.companyId!;
 if(type==='FILE'){
   const f=await db.file.findFirst({where:{id,companyId,deletedAt:{not:null}}}); if(!f)return res.status(404).json({error:'Deleted file not found'});
   if(req.user!.role!=='COMPANY_ADMIN'&&f.ownerId!==req.user!.id)return res.status(403).json({error:'Only the owner or Company Admin can restore this file'});
   const parent=f.folderId?await db.folder.findFirst({where:{id:f.folderId,companyId},select:{deletedAt:true}}):null;await db.file.update({where:{id},data:{deletedAt:null,folderId:parent?.deletedAt?null:f.folderId}}); await audit(companyId,req.user!.id,'RESTORE','FILE',id); return res.json({ok:true});
 }
 if(type==='FOLDER'){
   const f=await db.folder.findFirst({where:{id,companyId,deletedAt:{not:null}}}); if(!f)return res.status(404).json({error:'Deleted folder not found'});
   if(req.user!.role!=='COMPANY_ADMIN'&&f.ownerId!==req.user!.id)return res.status(403).json({error:'Only the owner or Company Admin can restore this folder'});
   const folders=await db.folder.findMany({where:{companyId,deletedAt:{not:null}},select:{id:true,parentId:true}}); const ids=new Set([id]); let changed=true;
   while(changed){changed=false;for(const x of folders){if(x.parentId&&ids.has(x.parentId)&&!ids.has(x.id)){ids.add(x.id);changed=true}}}
   await db.$transaction([db.folder.updateMany({where:{id:{in:[...ids]}},data:{deletedAt:null}}),db.file.updateMany({where:{companyId,folderId:{in:[...ids]},deletedAt:{not:null}},data:{deletedAt:null}})]);
   await audit(companyId,req.user!.id,'RESTORE','FOLDER',id); return res.json({ok:true});
 }
 res.status(400).json({error:'Invalid trash item type'});
}catch(e){next(e)}};

// Restore is idempotent and accepts POST (primary) plus GET for compatibility with older clients.
r.post('/:type/:id/restore',auth,activeSubscription,restoreHandler);
r.get('/:type/:id/restore',auth,activeSubscription,restoreHandler);

r.delete('/:type/:id',auth,activeSubscription,async(req:AuthedRequest,res,next)=>{try{
 const type=String(req.params.type).toUpperCase(); const id=String(req.params.id); const companyId=req.user!.companyId!;
 if(type==='FILE'){
   const f=await db.file.findFirst({where:{id,companyId,deletedAt:{not:null}}}); if(!f)return res.status(404).json({error:'Deleted file not found'});
   if(req.user!.role!=='COMPANY_ADMIN'&&f.ownerId!==req.user!.id)return res.status(403).json({error:'Only the owner or Company Admin can permanently delete this file'});
   await deleteObject(f.storageKey).catch(()=>{}); await db.file.delete({where:{id}}); await db.company.update({where:{id:companyId},data:{storageUsedBytes:{decrement:f.sizeBytes}}}); return res.status(204).end();
 }
 if(type==='FOLDER'){
   const f=await db.folder.findFirst({where:{id,companyId,deletedAt:{not:null}}}); if(!f)return res.status(404).json({error:'Deleted folder not found'});
   if(req.user!.role!=='COMPANY_ADMIN'&&f.ownerId!==req.user!.id)return res.status(403).json({error:'Only the owner or Company Admin can permanently delete this folder'});
   const folders=await db.folder.findMany({where:{companyId,deletedAt:{not:null}},select:{id:true,parentId:true}}); const ids=new Set([id]); let changed=true; while(changed){changed=false;for(const x of folders){if(x.parentId&&ids.has(x.parentId)&&!ids.has(x.id)){ids.add(x.id);changed=true}}}
   const files=await db.file.findMany({where:{companyId,folderId:{in:[...ids]},deletedAt:{not:null}},select:{id:true,storageKey:true,sizeBytes:true}}); for(const file of files)await deleteObject(file.storageKey).catch(()=>{});
   await db.$transaction(async tx=>{if(files.length)await tx.file.deleteMany({where:{id:{in:files.map(x=>x.id)}}});await tx.folder.deleteMany({where:{id:{in:[...ids]}}});});
   const total=files.reduce((n,x)=>n+x.sizeBytes,0n); await db.company.update({where:{id:companyId},data:{storageUsedBytes:{decrement:total}}}); return res.status(204).end();
 }
 res.status(400).json({error:'Invalid trash item type'});
}catch(e){next(e)}});
export default r;
