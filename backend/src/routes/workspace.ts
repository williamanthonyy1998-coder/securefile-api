import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { db } from '../db';
import { auth, AuthedRequest, role } from '../middleware/auth';
import { activeSubscription } from '../middleware/subscription';
import { notify } from '../services/notify';
import { sendEmail, sendUserEmail, emailTemplate, emailConfigured } from '../services/email';
import { getFileAccess, getFolderAccess } from '../services/access';
import { env } from '../config/env';
import { putObject } from '../services/storage';
import { safeFilename } from '../utils/security';

const r=Router();
const taskUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:env.MAX_UPLOAD_MB*1024*1024}});

r.get('/requests',auth,async(req:AuthedRequest,res,next)=>{try{
 const rows=await db.accessRequest.findMany({where:{companyId:req.user!.companyId!,requesterId:req.user!.id},include:{targetUser:{select:{id:true,uniqueName:true,email:true,role:true}}},orderBy:{createdAt:'desc'},take:100});res.json(rows);
}catch(e){next(e)}});

r.delete('/requests/:id',auth,activeSubscription,async(req:AuthedRequest,res,next)=>{try{
 const row=await db.accessRequest.findFirst({where:{id:String(req.params.id),companyId:req.user!.companyId!,requesterId:req.user!.id}});if(!row)return res.status(404).json({error:'Request not found'});if(row.status!=='PENDING')return res.status(409).json({error:'Only pending requests can be deleted'});await db.accessRequest.delete({where:{id:row.id}});res.status(204).end();
}catch(e){next(e)}});

r.post('/requests',auth,activeSubscription,async(req:AuthedRequest,res,next)=>{try{
 const companyId=req.user!.companyId!;const targetUserId=String(req.body.targetUserId||'');const requestedName=String(req.body.requestedName||'').trim().slice(0,180);const requestedType=String(req.body.requestedType||'FILE').toUpperCase();const note=String(req.body.note||'').trim().slice(0,2000);const canDownload=Boolean(req.body.canDownload);
 if(!targetUserId||targetUserId===req.user!.id)return res.status(400).json({error:'Choose another active user as the approver.'});
 if(requestedName.length<2)return res.status(400).json({error:'Enter the file or folder name you are requesting.'});
 if(!['FILE','FOLDER'].includes(requestedType))return res.status(400).json({error:'Invalid requested resource type.'});
 const target=await db.user.findFirst({where:{id:targetUserId,companyId,status:'ACTIVE'}});if(!target)return res.status(404).json({error:'Approver not found.'});
 const [ownedFiles,ownedFolders,shareCount]=await Promise.all([db.file.count({where:{companyId,ownerId:target.id,deletedAt:null}}),db.folder.count({where:{companyId,ownerId:target.id,deletedAt:null}}),db.share.count({where:{companyId,recipientId:target.id,canShare:true}})]);
 if(!['COMPANY_ADMIN','SUPER_ADMIN'].includes(target.role) && ownedFiles+ownedFolders+shareCount===0)return res.status(400).json({error:'That user is not an authorized resource owner/approver.'});
 const duplicate=await db.accessRequest.findFirst({where:{companyId,requesterId:req.user!.id,targetUserId,status:'PENDING',requestedName,requestedType:requestedType as any}});if(duplicate)return res.status(409).json({error:'You already have a pending request for this resource name and approver.'});
 const result=await db.$transaction(async tx=>{const request=await tx.accessRequest.create({data:{companyId,requesterId:req.user!.id,targetUserId,requestedName,requestedType:requestedType as any,note,canDownload}});await tx.approval.create({data:{companyId,requesterId:req.user!.id,approverId:targetUserId,accessRequestId:request.id,canDownload,note}});return request;});
 const requester=await db.user.findUnique({where:{id:req.user!.id},select:{uniqueName:true,email:true}});const message=`${requester?.uniqueName||requester?.email||'A user'} is requesting ${requestedType.toLowerCase()} “${requestedName}”.${note?' Reason: '+note:''}`;await notify(targetUserId,'New access request',message,companyId);await sendUserEmail(target.email,'SecureFile access request',`<p>${message}</p><p>Open SecureFile → Approvals to review and fulfill this request.</p>`).catch(()=>{});res.status(201).json(result);
}catch(e){next(e)}});

r.get('/approvals',auth,async(req:AuthedRequest,res,next)=>{try{
 const rows=await db.approval.findMany({where:{companyId:req.user!.companyId!,approverId:req.user!.id,requesterId:{not:req.user!.id}},include:{requester:{select:{id:true,uniqueName:true,email:true,role:true}},accessRequest:true},orderBy:{createdAt:'desc'},take:100});res.json(rows);
}catch(e){next(e)}});

r.get('/approvals/:id/resources',auth,async(req:AuthedRequest,res,next)=>{try{
 const approval=await db.approval.findFirst({where:{id:String(req.params.id),companyId:req.user!.companyId!,approverId:req.user!.id,status:'PENDING'},include:{accessRequest:true}});if(!approval)return res.status(404).json({error:'Approval request not found'});
 const q=String(req.query.q||approval.accessRequest?.requestedName||'').trim();const type=approval.accessRequest?.requestedType||'FILE';const companyId=req.user!.companyId!;const out:any[]=[];
 if(type==='FILE'){const rows=await db.file.findMany({where:{companyId,deletedAt:null,name:{contains:q,mode:'insensitive'}},orderBy:{createdAt:'desc'},take:50});for(const f of rows){if(await getFileAccess(req.user!.id,req.user!.role,companyId,f.id,'share'))out.push({id:f.id,name:f.name,type:'FILE'});}}
 else {const rows=await db.folder.findMany({where:{companyId,deletedAt:null,name:{contains:q,mode:'insensitive'}},orderBy:{createdAt:'desc'},take:50});for(const f of rows){if(await getFolderAccess(req.user!.id,req.user!.role,companyId,f.id,'share'))out.push({id:f.id,name:f.name,type:'FOLDER'});}}
 res.json(out);
}catch(e){next(e)}});

r.patch('/approvals/:id',auth,activeSubscription,async(req:AuthedRequest,res,next)=>{try{
 const id=String(req.params.id);const status=String(req.body.status||'').toUpperCase();if(!['APPROVED','REJECTED'].includes(status))return res.status(400).json({error:'Approval status must be APPROVED or REJECTED'});
 const a=await db.approval.findFirst({where:{id,companyId:req.user!.companyId!,approverId:req.user!.id,requesterId:{not:req.user!.id},status:'PENDING'},include:{accessRequest:true}});if(!a)return res.status(404).json({error:'Approval not found or already resolved'});
 let fileId=a.fileId||undefined,folderId=a.folderId||undefined;let resourceOwnerId=req.user!.id;
 if(status==='APPROVED'){
   fileId=req.body.fileId?String(req.body.fileId):fileId;folderId=req.body.folderId?String(req.body.folderId):folderId;
   if((fileId?1:0)+(folderId?1:0)!==1)return res.status(400).json({error:'Before approving, select the actual file or folder that fulfills the request.'});
   const allowed:any=fileId?await getFileAccess(req.user!.id,req.user!.role,a.companyId,fileId,'share'):await getFolderAccess(req.user!.id,req.user!.role,a.companyId,folderId!,'share');if(!allowed)return res.status(403).json({error:'You do not have Share permission for the selected resource.'});resourceOwnerId=allowed.ownerId||req.user!.id;
 }
 const result=await db.$transaction(async tx=>{
   const approval=await tx.approval.update({where:{id},data:{status:status as any,fileId,folderId}});
   const request=await tx.accessRequest.update({where:{id:a.accessRequestId!},data:{status:status as any,fileId,folderId}});
   if(status==='APPROVED'){
     const existing=await tx.share.findFirst({where:{companyId:a.companyId,recipientId:a.requesterId,...(fileId?{fileId}:{folderId})}});
     if(existing)await tx.share.update({where:{id:existing.id},data:{canView:true,canDownload:a.canDownload}});
     else await tx.share.create({data:{companyId:a.companyId,ownerId:resourceOwnerId,recipientId:a.requesterId,fileId,folderId,type:'INTERNAL',canView:true,canDownload:a.canDownload}});
   }
   return {approval,request};
 });
 const requester=await db.user.findUnique({where:{id:a.requesterId},select:{email:true}});await notify(a.requesterId,status==='APPROVED'?'Access request approved':'Access request rejected',status==='APPROVED'?'The requested resource has been shared with you.':'Your access request was rejected.',a.companyId);if(requester)await sendUserEmail(requester.email,`SecureFile request ${status.toLowerCase()}`,status==='APPROVED'?'<p>Your requested resource has been shared with your SecureFile account.</p>':'<p>Your access request was rejected.</p>').catch(()=>{});res.json(result);
}catch(e){next(e)}});

r.get('/tasks',auth,async(req:AuthedRequest,res,next)=>{try{
 const fileFilter=req.query.fileId?{fileId:String(req.query.fileId)}:{};const folderFilter=req.query.folderId?{folderId:String(req.query.folderId)}:{};const where=req.user!.role==='COMPANY_ADMIN'?{companyId:req.user!.companyId!,deletedAt:null,...fileFilter,...folderFilter}:{companyId:req.user!.companyId!,assigneeId:req.user!.id,deletedAt:null,...fileFilter,...folderFilter};
 const rows=await db.task.findMany({where,include:{assignee:{select:{id:true,uniqueName:true,email:true}},file:{select:{id:true,name:true,mimeType:true}},folder:{select:{id:true,name:true}}},orderBy:[{dueAt:'asc'},{createdAt:'desc'}],take:200});res.json(rows);
}catch(e){next(e)}});

r.post('/tasks',auth,activeSubscription,role('COMPANY_ADMIN'),async(req:AuthedRequest,res,next)=>{try{
 const companyId=req.user!.companyId!;const assigneeId=String(req.body.assigneeId||'');const title=String(req.body.title||'').trim().slice(0,180);const description=String(req.body.description||'').trim().slice(0,4000);const fileId=req.body.fileId?String(req.body.fileId):undefined;const folderId=req.body.folderId?String(req.body.folderId):undefined;const startPage=req.body.startPage!==''&&req.body.startPage!=null?Number(req.body.startPage):undefined;const endPage=req.body.endPage!==''&&req.body.endPage!=null?Number(req.body.endPage):undefined;const priority=String(req.body.priority||'MEDIUM').toUpperCase();const dueAt=req.body.dueAt?new Date(req.body.dueAt):null;
 if(!assigneeId||!title)return res.status(400).json({error:'Assignee and task title are required'});if((fileId?1:0)+(folderId?1:0)>1)return res.status(400).json({error:'Choose either a file or a folder'});if(fileId&&!await getFileAccess(req.user!.id,req.user!.role,companyId,fileId,'view'))return res.status(403).json({error:'You cannot assign this file'});if(folderId&&!await getFolderAccess(req.user!.id,req.user!.role,companyId,folderId,'view'))return res.status(403).json({error:'You cannot assign this folder'});if((startPage!==undefined||endPage!==undefined)&&!fileId)return res.status(400).json({error:'Page range is available only for files'});if(startPage!==undefined&&(!Number.isInteger(startPage)||startPage<1))return res.status(400).json({error:'Start page must be a positive whole number'});if(endPage!==undefined&&(!Number.isInteger(endPage)||endPage<1))return res.status(400).json({error:'End page must be a positive whole number'});if(startPage!==undefined&&endPage!==undefined&&startPage>endPage)return res.status(400).json({error:'End page must be greater than or equal to start page'});if(!['LOW','MEDIUM','HIGH','URGENT'].includes(priority))return res.status(400).json({error:'Invalid priority'});if(dueAt&&Number.isNaN(dueAt.getTime()))return res.status(400).json({error:'Invalid due date'});if(dueAt&&dueAt<=new Date())return res.status(400).json({error:'Due date must be in the future'});
 const assignee=await db.user.findFirst({where:{id:assigneeId,companyId,status:'ACTIVE',role:{in:['EMPLOYEE','CLIENT']}}});if(!assignee)return res.status(404).json({error:'Assignee not found'});
 const task=await db.task.create({data:{companyId,createdById:req.user!.id,assigneeId,title,description,fileId,folderId,startPage,endPage,priority:priority as any,dueAt}});
 await notify(assignee.id,'New task assigned',`${title}${dueAt?' — due '+dueAt.toLocaleString():''}`,companyId);await sendUserEmail(assignee.email,'SecureFile task assigned',`<p>You have a new task: <strong>${title}</strong>.</p>${description?`<p>${description}</p>`:''}${startPage||endPage?`<p>Pages: ${startPage||1}–${endPage||'end'}</p>`:''}`).catch(()=>{});res.status(201).json(task);
}catch(e){next(e)}});

r.patch('/tasks/:id/status',auth,activeSubscription,async(req:AuthedRequest,res,next)=>{try{
 const task=await db.task.findFirst({where:{id:String(req.params.id),companyId:req.user!.companyId!,deletedAt:null}});if(!task)return res.status(404).json({error:'Task not found'});if(task.assigneeId!==req.user!.id)return res.status(403).json({error:'Only the assigned user can update task status'});const status=String(req.body.status||'').toUpperCase();if(!['PENDING','STARTED','PARTIALLY_COMPLETED','COMPLETED'].includes(status))return res.status(400).json({error:'Invalid task status'});const updated=await db.task.update({where:{id:task.id},data:{status:status as any}});await notify(task.createdById,'Task status updated',`${task.title} is now ${status.replace('_',' ').toLowerCase()}.`,task.companyId);res.json(updated);
}catch(e){next(e)}});

r.post('/tasks/:id/solution',auth,activeSubscription,taskUpload.single('file'),async(req:AuthedRequest,res,next)=>{try{const task=await db.task.findFirst({where:{id:String(req.params.id),companyId:req.user!.companyId!,deletedAt:null}});if(!task)return res.status(404).json({error:'Task not found'});if(task.assigneeId!==req.user!.id)return res.status(403).json({error:'Only the assignee can submit a solution'});if(!req.file)return res.status(400).json({error:'Solution file required'});const key=`solution-${crypto.randomUUID()}${path.extname(req.file.originalname)}`;await putObject(key,req.file.buffer,req.file.mimetype||'application/octet-stream');const f=await db.file.create({data:{companyId:req.user!.companyId!,ownerId:req.user!.id,name:safeFilename(req.file.originalname),storageKey:key,mimeType:req.file.mimetype||'application/octet-stream',sizeBytes:req.file.size,source:'UPLOAD'}});await db.company.update({where:{id:req.user!.companyId!},data:{storageUsedBytes:{increment:req.file.size}}});const updated=await db.task.update({where:{id:task.id},data:{solutionKey:key,status:'COMPLETED'}});await notify(task.createdById,'Task completed',task.title,task.companyId);res.status(201).json({task:updated,fileId:f.id});}catch(e){next(e)}});

r.get('/messages',auth,async(req:AuthedRequest,res,next)=>{try{const companyId=req.user!.companyId!;const groupId=req.query.groupId?String(req.query.groupId):'';const withUser=req.query.withUser?String(req.query.withUser):'';let where:any={companyId};if(groupId){const member=await db.groupMember.findFirst({where:{groupId,userId:req.user!.id,group:{companyId}}});if(!member)return res.status(403).json({error:'Group access denied'});where.groupId=groupId;}else if(withUser){where.OR=[{senderId:req.user!.id,recipientId:withUser},{senderId:withUser,recipientId:req.user!.id}];}else where.OR=[{senderId:req.user!.id},{recipientId:req.user!.id}];res.json(await db.message.findMany({where,include:{sender:{select:{id:true,uniqueName:true,email:true}},recipient:{select:{id:true,uniqueName:true,email:true}}},orderBy:{createdAt:'asc'},take:500}));}catch(e){next(e)}});
r.post('/messages',auth,activeSubscription,async(req:AuthedRequest,res,next)=>{try{const body=String(req.body.body||'').trim();const recipientId=req.body.recipientId?String(req.body.recipientId):undefined;const groupId=req.body.groupId?String(req.body.groupId):undefined;if(!body||((recipientId?1:0)+(groupId?1:0)!==1))return res.status(400).json({error:'Choose a recipient or group and enter a message'});if(recipientId&&!await db.user.findFirst({where:{id:recipientId,companyId:req.user!.companyId!,status:'ACTIVE'}}))return res.status(404).json({error:'Recipient not found'});if(groupId&&!await db.groupMember.findFirst({where:{groupId,userId:req.user!.id,group:{companyId:req.user!.companyId!}}}))return res.status(403).json({error:'Group access denied'});const m=await db.message.create({data:{companyId:req.user!.companyId!,senderId:req.user!.id,recipientId,groupId,body:body.slice(0,10000)}});if(recipientId)await notify(recipientId,'New message',body.slice(0,160),req.user!.companyId!);if(groupId){const members=await db.groupMember.findMany({where:{groupId,userId:{not:req.user!.id}},select:{userId:true}});for(const member of members)await notify(member.userId,'New group message',body.slice(0,160),req.user!.companyId!);}res.status(201).json(m);}catch(e){next(e)}});
r.get('/groups',auth,async(req:AuthedRequest,res)=>{res.json(await db.group.findMany({where:{companyId:req.user!.companyId!,members:{some:{userId:req.user!.id}}},include:{members:{include:{user:{select:{id:true,email:true,uniqueName:true}}}}}}));});
r.post('/groups',auth,activeSubscription,async(req:AuthedRequest,res,next)=>{try{const ids=Array.isArray(req.body.userIds)?req.body.userIds.map(String):[];const name=String(req.body.name||'').trim().slice(0,120);if(!name)return res.status(400).json({error:'Group name is required'});const unique=[...new Set([req.user!.id,...ids])];const valid=await db.user.findMany({where:{id:{in:unique},companyId:req.user!.companyId!,status:'ACTIVE'},select:{id:true}});if(valid.length!==unique.length)return res.status(400).json({error:'One or more users are outside the company or inactive'});const g=await db.group.create({data:{companyId:req.user!.companyId!,name,createdById:req.user!.id,members:{create:valid.map(u=>({userId:u.id}))}}});res.status(201).json(g);}catch(e){next(e)}});
r.patch('/groups/:id',auth,activeSubscription,async(req:AuthedRequest,res,next)=>{try{const g=await db.group.findFirst({where:{id:String(req.params.id),companyId:req.user!.companyId!,members:{some:{userId:req.user!.id}}}});if(!g)return res.status(404).json({error:'Group not found'});if(req.user!.role!=='COMPANY_ADMIN'&&req.user!.role!=='SUPER_ADMIN'&&g.createdById!==req.user!.id)return res.status(403).json({error:'Only the group creator or Company Admin can rename this group'});const name=String(req.body.name||'').trim().slice(0,120);if(!name)return res.status(400).json({error:'Group name is required'});res.json(await db.group.update({where:{id:g.id},data:{name}}));}catch(e){next(e)}});
r.delete('/groups/:id',auth,activeSubscription,async(req:AuthedRequest,res,next)=>{try{const g=await db.group.findFirst({where:{id:String(req.params.id),companyId:req.user!.companyId!,members:{some:{userId:req.user!.id}}}});if(!g)return res.status(404).json({error:'Group not found'});if(req.user!.role!=='COMPANY_ADMIN'&&req.user!.role!=='SUPER_ADMIN'&&g.createdById!==req.user!.id)return res.status(403).json({error:'Only the group creator or Company Admin can delete this group'});await db.group.delete({where:{id:g.id}});res.status(204).end();}catch(e){next(e)}});
r.get('/emails',auth,async(req:AuthedRequest,res,next)=>{try{
 const companyId=req.user!.companyId!; const box=String(req.query.box||'inbox');
 const rows:any[]=await db.$queryRaw`
   SELECT e.id,e."companyId",e."senderId",e."recipientId",e."recipientEmail",e.subject,e.body,e.direction,e."createdAt",
          su."uniqueName" AS "senderUniqueName",su.email AS "senderEmail",
          ru."uniqueName" AS "recipientUniqueName",ru.email AS "recipientUserEmail"
   FROM "EmailMessage" e
   LEFT JOIN "User" su ON su.id=e."senderId"
   LEFT JOIN "User" ru ON ru.id=e."recipientId"
   WHERE e."companyId"=${companyId}
     AND (${box}='sent' AND e."senderId"=${req.user!.id} OR ${box}<>'sent' AND (e."recipientId"=${req.user!.id} OR lower(e."recipientEmail")=lower(${req.user!.email})))
   ORDER BY e."createdAt" DESC LIMIT 200`;
 res.json(rows.map(x=>({...x,sender:x.senderId?{id:x.senderId,uniqueName:x.senderUniqueName,email:x.senderEmail}:null,recipient:x.recipientId?{id:x.recipientId,uniqueName:x.recipientUniqueName,email:x.recipientUserEmail}:null})));
}catch(e){next(e)}});

r.get('/email/status',auth,async(_req,res)=>res.json({configured:emailConfigured(),provider:process.env.EMAIL_PROVIDER||'console'}));
r.post('/email',auth,activeSubscription,async(req:AuthedRequest,res,next)=>{try{
 const recipientId=req.body.recipientId?String(req.body.recipientId):''; const directEmail=String(req.body.recipientEmail||'').trim().toLowerCase();
 const subject=String(req.body.subject||'').trim().slice(0,180); const body=String(req.body.body||'').trim().slice(0,20000);
 if(!subject||!body||(!recipientId&&!directEmail))return res.status(400).json({error:'Recipient, subject and message are required'});
 if(directEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(directEmail))return res.status(400).json({error:'Enter a valid recipient email address'});
 let recipient:any=null;
 if(recipientId){recipient=await db.user.findFirst({where:{id:recipientId,companyId:req.user!.companyId!},select:{id:true,email:true,uniqueName:true}});if(!recipient)return res.status(404).json({error:'Recipient not found'});}
 const to=(recipient?.email||directEmail).toLowerCase(); const safeBody=body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>');
 const html=emailTemplate(subject,`<p style="white-space:pre-wrap;line-height:1.7">${safeBody}</p>`);
 const delivery=await sendEmail(to,subject,html);
 const id=crypto.randomUUID();
 const created:any[]=await db.$queryRaw`
   INSERT INTO "EmailMessage" ("id","companyId","senderId","recipientId","recipientEmail","subject","body","direction","createdAt")
   VALUES (${id},${req.user!.companyId!},${req.user!.id},${recipient?.id||null},${to},${subject},${body},'SENT',NOW())
   RETURNING "id","companyId","senderId","recipientId","recipientEmail","subject","body","direction","createdAt"`;
 if(recipient)await notify(recipient.id,'New email',subject,req.user!.companyId!);
 res.status(201).json({ok:true,mail:created[0],recipient:{email:to},delivery});
}catch(e){next(e)}});

r.get('/notifications',auth,async(req:AuthedRequest,res)=>res.json(await db.notification.findMany({where:{userId:req.user!.id},orderBy:{createdAt:'desc'},take:100})));r.patch('/notifications/:id/read',auth,async(req:AuthedRequest,res)=>res.json(await db.notification.updateMany({where:{id:String(req.params.id),userId:req.user!.id},data:{readAt:new Date()}})));r.patch('/notifications/read-all',auth,async(req:AuthedRequest,res)=>res.json(await db.notification.updateMany({where:{userId:req.user!.id,readAt:null},data:{readAt:new Date()}})));
r.post('/ai',auth,activeSubscription,async(req:AuthedRequest,res,next)=>{try{const message=String(req.body.message||'').trim();if(!message)return res.status(400).json({error:'Message required'});if(!env.AI_API_KEY||!env.AI_BASE_URL||!env.AI_MODEL)return res.json({answer:'AI is not configured yet.'});const response=await fetch(`${env.AI_BASE_URL.replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${env.AI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:env.AI_MODEL,messages:[{role:'system',content:'You are the SecureFile assistant. Help users use SecureFile. Never reveal data outside the current user’s authorization.'},{role:'user',content:message}],temperature:.2})});const data:any=await response.json();if(!response.ok)throw new Error(data?.error?.message||'AI provider error');res.json({answer:data.choices?.[0]?.message?.content||'No answer returned.'});}catch(e){next(e)}});

export default r;
