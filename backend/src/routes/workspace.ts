import {Router} from 'express'; import {db} from '../db'; import {auth,AuthedRequest,role} from '../middleware/auth'; import {activeSubscription} from '../middleware/subscription'; import {notify} from '../services/notify';
import {sendEmail, emailTemplate, emailConfigured} from '../services/email';
import {requireAddon} from '../services/entitlements'; import {getFileAccess,getFolderAccess} from '../services/access'; import {env} from '../config/env'; import multer from 'multer'; import path from 'node:path'; import crypto from 'node:crypto'; import {putObject,deleteObject} from '../services/storage'; import {safeFilename} from '../utils/security';
const r=Router(); const taskUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:env.MAX_UPLOAD_MB*1024*1024}});
const scoped={companyId:undefined};
r.get('/requests',auth,async(req:AuthedRequest,res,next)=>{try{
  const companyId=req.user!.companyId!;
  const rows=await db.accessRequest.findMany({
    where:{companyId,requesterId:req.user!.id},
    include:{targetUser:{select:{id:true,uniqueName:true,email:true,role:true}}},
    orderBy:{createdAt:'desc'},take:100
  });
  const fileIds=rows.flatMap((x:any)=>x.fileId?[x.fileId]:[]);
  const folderIds=rows.flatMap((x:any)=>x.folderId?[x.folderId]:[]);
  const [files,folders]=await Promise.all([
    fileIds.length?db.file.findMany({where:{id:{in:fileIds},companyId},select:{id:true,name:true}}):[],
    folderIds.length?db.folder.findMany({where:{id:{in:folderIds},companyId},select:{id:true,name:true}}):[]
  ]);
  const fm=new Map((files as any[]).map((x:any)=>[x.id,x]));
  const fom=new Map((folders as any[]).map((x:any)=>[x.id,x]));
  res.json(rows.map((x:any)=>({...x,file:x.fileId?fm.get(x.fileId)||null:null,folder:x.folderId?fom.get(x.folderId)||null:null})));
}catch(e){next(e)}});

r.post('/requests',auth,activeSubscription,async(req:AuthedRequest,res,next)=>{try{
  const companyId=req.user!.companyId!;
  const targetUserId=String(req.body.targetUserId||'');
  const fileId=req.body.fileId?String(req.body.fileId):undefined;
  const folderId=req.body.folderId?String(req.body.folderId):undefined;
  const note=req.body.note?String(req.body.note).slice(0,2000):undefined;
  const canDownload=Boolean(req.body.canDownload);
  if(!targetUserId)return res.status(400).json({error:'Select the user who should approve this request.'});
  if(targetUserId===req.user!.id)return res.status(400).json({error:'You cannot send an access request to yourself.'});
  if((fileId?1:0)+(folderId?1:0)!==1)return res.status(400).json({error:'Select exactly one file or folder.'});
  const target=await db.user.findFirst({where:{id:targetUserId,companyId}});
  if(!target)return res.status(404).json({error:'Target user not found in this company.'});
  const targetCanApprove=fileId?await getFileAccess(target.id,target.role,companyId,fileId,'share'):await getFolderAccess(target.id,target.role,companyId,folderId!,'share');
  if(!targetCanApprove)return res.status(403).json({error:'That user is not authorized to approve access to this resource.'});
  const resource=fileId?await db.file.findFirst({where:{id:fileId,companyId},select:{id:true,name:true}}):await db.folder.findFirst({where:{id:folderId,companyId},select:{id:true,name:true}});
  if(!resource)return res.status(404).json({error:'Requested resource not found.'});
  const duplicate=await db.accessRequest.findFirst({where:{companyId,requesterId:req.user!.id,targetUserId,status:'PENDING',...(fileId?{fileId}:{folderId})}});
  if(duplicate)return res.status(409).json({error:'A pending request for this resource and approver already exists.'});
  const result=await db.$transaction(async tx=>{
    const request=await tx.accessRequest.create({data:{companyId,requesterId:req.user!.id,targetUserId,fileId,folderId,note,canDownload}});
    await tx.approval.create({data:{companyId,requesterId:req.user!.id,approverId:targetUserId,accessRequestId:request.id,fileId,folderId,canDownload,note}});
    return request;
  });
  await notify(targetUserId,'Access request received',`${req.user!.uniqueName||req.user!.email} requested access to ${'name' in resource?resource.name:'the resource'}.`,companyId);
  res.status(201).json(result);
}catch(e){next(e)}});

r.patch('/requests/:id',auth,activeSubscription,async(req:AuthedRequest,res,next)=>{try{
  const row=await db.accessRequest.findFirst({where:{id:String(req.params.id),companyId:req.user!.companyId!,requesterId:req.user!.id}});
  if(!row)return res.status(404).json({error:'Request not found'});
  if(row.status!=='PENDING')return res.status(409).json({error:'Request is already resolved.'});
  return res.status(403).json({error:'You cannot approve your own request. The assigned approver must decide this request.'});
}catch(e){next(e)}});

r.get('/approvals',auth,async(req:AuthedRequest,res,next)=>{try{
  const companyId=req.user!.companyId!;
  // Approval queue contains ONLY requests assigned to the current user.
  const rows=await db.approval.findMany({
    where:{companyId,approverId:req.user!.id},
    include:{requester:{select:{id:true,uniqueName:true,email:true,role:true}},approver:{select:{id:true,uniqueName:true,email:true,role:true}}},
    orderBy:{createdAt:'desc'},take:100
  });
  const fileIds=rows.flatMap((x:any)=>x.fileId?[x.fileId]:[]);
  const folderIds=rows.flatMap((x:any)=>x.folderId?[x.folderId]:[]);
  const [files,folders]=await Promise.all([
    fileIds.length?db.file.findMany({where:{id:{in:fileIds},companyId},select:{id:true,name:true}}):[],
    folderIds.length?db.folder.findMany({where:{id:{in:folderIds},companyId},select:{id:true,name:true}}):[]
  ]);
  const fm=new Map((files as any[]).map((x:any)=>[x.id,x]));
  const fom=new Map((folders as any[]).map((x:any)=>[x.id,x]));
  res.json(rows.map((x:any)=>({
    ...x,
    file:x.fileId?fm.get(x.fileId)||null:null,
    folder:x.folderId?fom.get(x.folderId)||null:null,
    accessRequest:{id:x.accessRequestId||null,canDownload:!!x.canDownload,note:x.note||null,status:x.status,fileId:x.fileId||null,folderId:x.folderId||null}
  })));
}catch(e){next(e)}});

r.post('/approvals',auth,activeSubscription,async(req:AuthedRequest,res,next)=>{try{
  // Kept for compatibility with older clients. Normal access requests create approvals automatically.
  const approverId=String(req.body.approverId||'');
  if(!approverId)return res.status(400).json({error:'Approver required'});
  if(approverId===req.user!.id)return res.status(400).json({error:'You cannot approve your own request.'});
  const approver=await db.user.findFirst({where:{id:approverId,companyId:req.user!.companyId!}});
  if(!approver)return res.status(404).json({error:'Approver not found'});
  const fileId=req.body.fileId?String(req.body.fileId):undefined,folderId=req.body.folderId?String(req.body.folderId):undefined;
  if((fileId?1:0)+(folderId?1:0)!==1)return res.status(400).json({error:'Exactly one file or folder is required'});
  const x=await db.approval.create({data:{companyId:req.user!.companyId!,requesterId:req.user!.id,approverId:approver.id,fileId,folderId,canDownload:Boolean(req.body.canDownload),note:req.body.note}});
  await notify(approver.id,'Approval requested',req.body.note||'A new approval requires your attention.',req.user!.companyId!);
  res.status(201).json(x);
}catch(e){next(e)}});

r.patch('/approvals/:id',auth,activeSubscription,async(req:AuthedRequest,res,next)=>{try{
  const a=await db.approval.findFirst({where:{id:String(req.params.id),companyId:req.user!.companyId!,approverId:req.user!.id}});
  if(!a)return res.status(404).json({error:'Approval not found or you are not the approver.'});
  const status=req.body.status==='APPROVED'?'APPROVED':req.body.status==='REJECTED'?'REJECTED':null;
  if(!status)return res.status(400).json({error:'Invalid status'});
  if(a.status!=='PENDING')return res.status(409).json({error:'This approval is already resolved.'});
  if(a.requesterId===req.user!.id)return res.status(403).json({error:'Self-approval is not allowed.'});
  const allowed=a.fileId?await getFileAccess(req.user!.id,req.user!.role,req.user!.companyId!,a.fileId,'share'):a.folderId?await getFolderAccess(req.user!.id,req.user!.role,req.user!.companyId!,a.folderId,'share'):null;
  if(!allowed)return res.status(403).json({error:'You are not authorized to approve access to this resource.'});
  const updated=await db.$transaction(async tx=>{
    const approval=await tx.approval.update({where:{id:a.id},data:{status}});
    let request:any=null;
    if(a.accessRequestId){request=await tx.accessRequest.update({where:{id:a.accessRequestId},data:{status}});}
    if(status==='APPROVED'){
      const existing=await tx.share.findFirst({where:{companyId:a.companyId,recipientId:a.requesterId,...(a.fileId?{fileId:a.fileId}:{folderId:a.folderId})}});
      if(existing){await tx.share.update({where:{id:existing.id},data:{canView:true,canDownload:a.canDownload}});}
      else {await tx.share.create({data:{companyId:a.companyId,ownerId:req.user!.id,recipientId:a.requesterId,fileId:a.fileId,folderId:a.folderId,type:'INTERNAL',canView:true,canDownload:a.canDownload}});}
    }
    return {approval,request};
  });
  await notify(a.requesterId,status==='APPROVED'?'Access request approved':'Access request rejected',status==='APPROVED'?'Your requested resource is now available in Shared.':'Your access request was rejected by the approver.',req.user!.companyId!);
  res.json(updated);
}catch(e){next(e)}});

r.get('/tasks',auth,async(req:AuthedRequest,res)=>{const where=req.user!.role==='COMPANY_ADMIN'?{companyId:req.user!.companyId!}:{companyId:req.user!.companyId!,OR:[{assigneeId:req.user!.id},{createdById:req.user!.id}]};res.json(await db.task.findMany({where,orderBy:{createdAt:'desc'},take:100}))});
r.post('/tasks',auth,activeSubscription,role('COMPANY_ADMIN'),async(req:AuthedRequest,res)=>{const assignee=await db.user.findFirst({where:{id:req.body.assigneeId,companyId:req.user!.companyId!,role:{in:['EMPLOYEE','CLIENT']}}});if(!assignee)return res.status(404).json({error:'Assignee not found'});const x=await db.task.create({data:{companyId:req.user!.companyId!,createdById:req.user!.id,assigneeId:assignee.id,title:String(req.body.title||'Untitled task'),description:req.body.description,fileId:req.body.fileId,folderId:req.body.folderId,dueAt:req.body.dueAt?new Date(req.body.dueAt):undefined}});await notify(assignee.id,'New work assigned',x.title,req.user!.companyId!);res.status(201).json(x)});
r.patch('/tasks/:id',auth,activeSubscription,async(req:AuthedRequest,res)=>{const x=await db.task.findFirst({where:{id:String(req.params.id),companyId:req.user!.companyId!}});if(!x)return res.status(404).json({error:'Task not found'});if(x.assigneeId!==req.user?.id&&req.user?.role!=='COMPANY_ADMIN')return res.status(403).json({error:'Forbidden'});const allowed=['PENDING','STARTED','PARTIALLY_COMPLETED','COMPLETED'];if(!allowed.includes(req.body.status))return res.status(400).json({error:'Invalid task status'});res.json(await db.task.update({where:{id:x.id},data:{status:req.body.status}}))});
r.post('/tasks/:id/solution',auth,activeSubscription,taskUpload.single('file'),async(req:AuthedRequest,res,next)=>{try{const task=await db.task.findFirst({where:{id:String(req.params.id),companyId:req.user!.companyId!}});if(!task)return res.status(404).json({error:'Task not found'});if(task.assigneeId!==req.user!.id)return res.status(403).json({error:'Only the assignee can submit a solution'});if(!req.file)return res.status(400).json({error:'Solution file required'});const key=`solution-${crypto.randomUUID()}${path.extname(req.file.originalname)}`;await putObject(key,req.file.buffer,req.file.mimetype||'application/octet-stream');const f=await db.file.create({data:{companyId:req.user!.companyId!,ownerId:req.user!.id,name:safeFilename(req.file.originalname),storageKey:key,mimeType:req.file.mimetype,sizeBytes:req.file.size,source:'UPLOAD'}});await db.company.update({where:{id:req.user!.companyId!},data:{storageUsedBytes:{increment:req.file.size}}});const updated=await db.task.update({where:{id:task.id},data:{solutionKey:key,status:'COMPLETED'}});await notify(task.createdById,'Work completed',task.title,req.user!.companyId!);res.status(201).json({task:updated,fileId:f.id});}catch(e){next(e)}});
r.get('/messages',auth,async(req:AuthedRequest,res,next)=>{try{const companyId=req.user!.companyId!;const groupId=req.query.groupId?String(req.query.groupId):'';const withUser=req.query.withUser?String(req.query.withUser):'';let where:any={companyId};if(groupId){const member=await db.groupMember.findFirst({where:{groupId,userId:req.user!.id,group:{companyId}}});if(!member)return res.status(403).json({error:'Group access denied'});where.groupId=groupId;}else if(withUser){where.OR=[{senderId:req.user!.id,recipientId:withUser},{senderId:withUser,recipientId:req.user!.id}];}else{where.OR=[{senderId:req.user!.id},{recipientId:req.user!.id}];}res.json(await db.message.findMany({where,include:{sender:{select:{id:true,uniqueName:true,email:true}},recipient:{select:{id:true,uniqueName:true,email:true}}},orderBy:{createdAt:'asc'},take:500}));}catch(e){next(e)}});
r.post('/messages',auth,activeSubscription,async(req:AuthedRequest,res,next)=>{try{const body=String(req.body.body||'').trim();const recipientId=req.body.recipientId?String(req.body.recipientId):undefined;const groupId=req.body.groupId?String(req.body.groupId):undefined;if(!body)return res.status(400).json({error:'Message required'});if((recipientId?1:0)+(groupId?1:0)!==1)return res.status(400).json({error:'Choose a recipient or group'});if(recipientId){const recipient=await db.user.findFirst({where:{id:recipientId,companyId:req.user!.companyId!}});if(!recipient)return res.status(404).json({error:'Recipient not found'});}if(groupId){const member=await db.groupMember.findFirst({where:{groupId,userId:req.user!.id,group:{companyId:req.user!.companyId!}}});if(!member)return res.status(403).json({error:'Group access denied'});}const m=await db.message.create({data:{companyId:req.user!.companyId!,senderId:req.user!.id,recipientId,groupId,body:body.slice(0,10000)}});if(recipientId)await notify(recipientId,'New message',body.slice(0,160),req.user!.companyId!);if(groupId){const members=await db.groupMember.findMany({where:{groupId,userId:{not:req.user!.id}},select:{userId:true}});for(const member of members)await notify(member.userId,'New group message',body.slice(0,160),req.user!.companyId!);}res.status(201).json(m);}catch(e){next(e)}});
r.get('/groups',auth,async(req:AuthedRequest,res)=>{const groups=await db.group.findMany({where:{companyId:req.user!.companyId!,members:{some:{userId:req.user!.id}}},include:{members:{include:{user:{select:{id:true,email:true,uniqueName:true}}}}}});res.json(groups)});
r.post('/groups',auth,activeSubscription,async(req:AuthedRequest,res)=>{const ids=Array.isArray(req.body.userIds)?req.body.userIds.map(String):[];const valid=await db.user.findMany({where:{id:{in:[req.user!.id,...ids]},companyId:req.user!.companyId!},select:{id:true}});if(valid.length!==new Set([req.user!.id,...ids]).size)return res.status(400).json({error:'One or more users are outside the company'});const g=await db.group.create({data:{companyId:req.user!.companyId!,name:String(req.body.name||'New Group'),members:{create:valid.map(u=>({userId:u.id}))}}});res.status(201).json(g)});
r.get('/email/status',auth,async(req:AuthedRequest,res)=>{res.json({configured:emailConfigured(),provider:process.env.EMAIL_PROVIDER||'console',message:emailConfigured()?'Email delivery is configured.':'Email delivery is not configured. Add EMAIL_PROVIDER=resend, EMAIL_FROM and RESEND_API_KEY to the server .env.'});});
r.post('/email',auth,activeSubscription,async(req:AuthedRequest,res,next)=>{try{const recipientId=req.body.recipientId?String(req.body.recipientId):'';const directEmail=String(req.body.recipientEmail||'').trim().toLowerCase();const subject=String(req.body.subject||'').trim().slice(0,180);const body=String(req.body.body||'').trim().slice(0,20000);if(!subject||!body||(!recipientId&&!directEmail))return res.status(400).json({error:'Recipient, subject and message are required'});let recipient:any=null;if(recipientId){recipient=await db.user.findFirst({where:{id:recipientId,companyId:req.user!.companyId!},select:{id:true,email:true,uniqueName:true}});if(!recipient)return res.status(404).json({error:'Recipient not found'});}const to=recipient?.email||directEmail;if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))return res.status(400).json({error:'Enter a valid recipient email address'});const sender=await db.user.findUnique({where:{id:req.user!.id},select:{uniqueName:true,email:true}});const safeBody=body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>');const html=emailTemplate(subject,`<p style=\"white-space:pre-wrap;line-height:1.7\">${safeBody}</p><p style=\"color:#667085;font-size:13px\">From ${sender?.uniqueName||sender?.email||'SecureFile user'} (${sender?.email||''})</p>`);const result=await sendEmail(to,subject,html);if(recipient)await notify(recipient.id,'Email received',`${subject} — from ${sender?.uniqueName||sender?.email||'SecureFile user'}`,req.user!.companyId!);res.status(201).json({ok:true,recipient:{name:recipient?.uniqueName||'',email:to},delivery:result});}catch(e){next(e)}});
r.get('/notifications',auth,async(req:AuthedRequest,res)=>res.json(await db.notification.findMany({where:{userId:req.user?.id},orderBy:{createdAt:'desc'},take:100})));r.patch('/notifications/:id/read',auth,async(req:AuthedRequest,res)=>res.json(await db.notification.updateMany({where:{id:String(req.params.id),userId:req.user?.id},data:{readAt:new Date()}})));
r.post('/ai',auth,async(req:AuthedRequest,res)=>{const message=String(req.body.message||'').trim();if(!message)return res.status(400).json({error:'Message required'});if(!env.AI_API_KEY||!env.AI_BASE_URL||!env.AI_MODEL)return res.json({answer:'AI is not configured yet. Add AI_API_KEY, AI_BASE_URL and AI_MODEL on the server to enable live assistance.'});try{const response=await fetch(`${env.AI_BASE_URL.replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${env.AI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:env.AI_MODEL,messages:[{role:'system',content:'You are the SecureFile assistant. Help the user use the software. Never reveal data the current user is not authorized to access.'},{role:'user',content:message}],temperature:.2})});const data:any=await response.json();if(!response.ok)throw new Error(data?.error?.message||'AI provider error');res.json({answer:data.choices?.[0]?.message?.content||'No answer returned.'});}catch(e:any){res.status(502).json({error:e.message||'AI provider unavailable'})}});
export default r;
