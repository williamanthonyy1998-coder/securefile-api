import {db} from '../db';
export type Action='view'|'download'|'upload'|'edit'|'delete'|'share';
const key:Record<Action,string>={view:'canView',download:'canDownload',upload:'canUpload',edit:'canEdit',delete:'canDelete',share:'canShare'};

export async function getFileAccess(userId:string,role:string,companyId:string,fileId:string,action:Action){
 const f=await db.file.findFirst({where:{id:fileId,companyId}}); if(!f)return null;
 if(role==='COMPANY_ADMIN'||role==='SUPER_ADMIN'||f.ownerId===userId)return f;
 const direct=await db.share.findMany({where:{companyId,fileId,recipientId:userId,OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]}});
 if(direct.some(s=>(s as any)[key[action]]))return f;
 if(f.folderId && await getFolderAccess(userId,role,companyId,f.folderId,action))return f;
 return null;
}

export async function getFolderAccess(userId:string,role:string,companyId:string,folderId:string,action:Action){
 let current=await db.folder.findFirst({where:{id:folderId,companyId}});
 while(current){
   if(role==='COMPANY_ADMIN'||role==='SUPER_ADMIN'||current.ownerId===userId)return current;
   const shares=await db.share.findMany({where:{companyId,folderId:current.id,recipientId:userId,OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]}});
   if(shares.some(s=>(s as any)[key[action]]))return current;
   current=current.parentId?await db.folder.findFirst({where:{id:current.parentId,companyId}}):null;
 }
 return null;
}

export async function listVisibleFolderIds(userId:string,role:string,companyId:string){
 const folders=await db.folder.findMany({where:{companyId},select:{id:true,parentId:true,ownerId:true}});
 if(role==='COMPANY_ADMIN'||role==='SUPER_ADMIN')return folders.map(x=>x.id);
 const shared=await db.share.findMany({where:{companyId,recipientId:userId,folderId:{not:null},OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]},select:{folderId:true,canView:true}});
 const allowed=new Set<string>(folders.filter(x=>x.ownerId===userId).map(x=>x.id));
 const queue=shared.filter(x=>x.canView).map(x=>x.folderId!).filter(Boolean);
 for(const id of queue)allowed.add(id);
 let changed=true;
 while(changed){changed=false;for(const f of folders){if(f.parentId&&allowed.has(f.parentId)&&!allowed.has(f.id)){allowed.add(f.id);changed=true}}}
 return [...allowed];
}
