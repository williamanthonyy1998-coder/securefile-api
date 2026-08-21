import { db } from '../db';
export type Action='view'|'download'|'upload'|'edit'|'delete'|'share';
const key:Record<Action,string>={view:'canView',download:'canDownload',upload:'canUpload',edit:'canEdit',delete:'canDelete',share:'canShare'};
const activeExpiry={OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]};

export async function getFileAccess(userId:string,role:string,companyId:string,fileId:string,action:Action){
 const f=await db.file.findFirst({where:{id:fileId,companyId,deletedAt:null}}); if(!f)return null;
 const folder=f.folderId ? await db.folder.findFirst({where:{id:f.folderId,companyId,deletedAt:null},select:{id:true,ownerId:true,isPersonal:true,parentId:true,deletedAt:true}}) : null;
 if(f.ownerId===userId)return f;
 if(folder?.isPersonal && folder.ownerId!==userId){
   const direct=await db.share.findMany({where:{companyId,fileId,recipientId:userId,...activeExpiry}});
   return direct.some((s:any)=>Boolean(s[key[action]]))?f:null;
 }
 if(role==='COMPANY_ADMIN'||role==='SUPER_ADMIN')return f;
 const direct=await db.share.findMany({where:{companyId,fileId,recipientId:userId,...activeExpiry}});
 if(direct.some((s:any)=>Boolean(s[key[action]])))return f;
 if(f.folderId && await getFolderAccess(userId,role,companyId,f.folderId,action))return f;
 return null;
}

export async function getFolderAccess(userId:string,role:string,companyId:string,folderId:string,action:Action){
 let current=await db.folder.findFirst({where:{id:folderId,companyId,deletedAt:null}});
 while(current){
   if(current.isPersonal && current.ownerId!==userId){
     const shares=await db.share.findMany({where:{companyId,folderId:current.id,recipientId:userId,...activeExpiry}});
     return shares.some((s:any)=>Boolean(s[key[action]]))?current:null;
   }
   if(role==='COMPANY_ADMIN'||role==='SUPER_ADMIN'||current.ownerId===userId)return current;
   const shares=await db.share.findMany({where:{companyId,folderId:current.id,recipientId:userId,...activeExpiry}});
   if(shares.some((s:any)=>Boolean(s[key[action]])))return current;
   current=current.parentId?await db.folder.findFirst({where:{id:current.parentId,companyId,deletedAt:null}}):null;
 }
 return null;
}

export async function listVisibleFolderIds(userId:string,role:string,companyId:string){
 const folders=await db.folder.findMany({where:{companyId,deletedAt:null,OR:[{isPersonal:false},{isPersonal:true,ownerId:userId}]},select:{id:true,parentId:true,ownerId:true,isPersonal:true}});
 const allowed=new Set<string>();
 for(const f of folders){
   if(f.isPersonal&&f.ownerId===userId)allowed.add(f.id);
   else if(!f.isPersonal&&(role==='COMPANY_ADMIN'||role==='SUPER_ADMIN'||f.ownerId===userId))allowed.add(f.id);
 }
 const shared=await db.share.findMany({where:{companyId,recipientId:userId,folderId:{not:null},...activeExpiry},select:{folderId:true,canView:true}});
 for(const x of shared)if(x.canView&&x.folderId)allowed.add(x.folderId);
 let changed=true;while(changed){changed=false;for(const f of folders){if(f.parentId&&allowed.has(f.parentId)&&!allowed.has(f.id)&&!f.isPersonal){allowed.add(f.id);changed=true}}}
 return [...allowed];
}
