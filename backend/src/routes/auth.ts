import {Router} from 'express';
import {db} from '../db';
import {hashPassword,verifyPassword,signAccess,randomToken,hashToken,safeSlug} from '../utils/security';
import {sendEmail} from '../services/email';
import {createCheckoutSession} from '../services/payment';
import {z} from 'zod';
import {env} from '../config/env'; import {calculatePrice,addonSchema} from '../services/pricing';
const r=Router();
const signup=z.object({companyName:z.string().trim().min(2).max(120),companyEmail:z.string().email(),adminEmail:z.string().email(),adminName:z.string().trim().min(2).max(120),password:z.string().min(10).max(128),users:z.number().int().min(1).max(10000),storageGb:z.number().int().min(1).max(100000),months:z.number().int().min(1).max(60),addons:addonSchema.optional()});
function verifyUrl(token:string){return `${env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`;}
function resetUrl(token:string){return `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;}
function priceCents(users:number,gb:number,months:number,addons:any){return calculatePrice(users,gb,months,addons).amountCents;}
async function uniqueSlug(name:string){const base=safeSlug(name); let slug=base; for(let i=0;i<10;i++){if(!await db.company.findUnique({where:{slug}}))return slug; slug=`${base}-${Math.random().toString(36).slice(2,7)}`;} throw new Error('Could not allocate company URL');}

r.post('/signup',async(req,res,next)=>{try{
 const x=signup.parse(req.body); if(await db.user.findUnique({where:{email:x.adminEmail}})) return res.status(409).json({error:'Email already registered'});
 const slug=await uniqueSlug(x.companyName); const passwordHash=await hashPassword(x.password); const addons=addonSchema.parse(x.addons||{}); const price=priceCents(x.users,x.storageGb,x.months,addons);
 const result=await db.$transaction(async tx=>{
   const company=await tx.company.create({data:{name:x.companyName,slug,contactEmail:x.companyEmail,storageLimitGb:x.storageGb}});
   const user=await tx.user.create({data:{companyId:company.id,email:x.adminEmail.toLowerCase(),uniqueName:x.adminName,passwordHash,role:'COMPANY_ADMIN',status:'INVITED',personalFolderAllowed:true}}); await tx.folder.create({data:{companyId:company.id,ownerId:user.id,name:'Personal Folder'}});
   const subscription=await tx.subscription.create({data:{companyId:company.id,users:x.users,storageGb:x.storageGb,months:x.months,priceCents:price,status:'PENDING',startsAt:new Date(),expiresAt:new Date(Date.now()+x.months*30*86400000),provider:'PENDING',addons}});
   const token=randomToken(); await tx.verificationToken.create({data:{userId:user.id,tokenHash:hashToken(token),type:'EMAIL_VERIFICATION',expiresAt:new Date(Date.now()+24*3600*1000)}});
   return {company,user,subscription,token};
 });
 const checkout=await createCheckoutSession({companyId:result.company.id,email:x.companyEmail,amountCents:price,description:`${x.companyName} — ${x.users} users, ${x.storageGb} GB, ${x.months} months`,metadata:{companyId:result.company.id,subscriptionId:result.subscription.id,users:String(x.users),storageGb:String(x.storageGb),months:String(x.months),addons:JSON.stringify(addons)}});
 await sendEmail(x.adminEmail,'Verify your SecureFile admin email',`<p>Verify your admin account:</p><p><a href="${verifyUrl(result.token)}">Verify email</a></p><p>Your workspace URL will be ${result.company.slug}.${env.PUBLIC_APP_DOMAIN}</p>`);
 res.status(201).json({company:{id:result.company.id,name:result.company.name,slug:result.company.slug,url:`https://${result.company.slug}.${env.PUBLIC_APP_DOMAIN}`},subscription:{id:result.subscription.id,priceCents:price,status:'PENDING'},checkout,verificationUrl:env.NODE_ENV==='development'?verifyUrl(result.token):undefined});
 }catch(e){next(e)}});

r.post('/verify-email',async(req,res,next)=>{try{const token=String(req.body.token||''); const row=await db.verificationToken.findFirst({where:{tokenHash:hashToken(token),type:'EMAIL_VERIFICATION',usedAt:null,expiresAt:{gt:new Date()}},include:{user:true}}); if(!row)return res.status(400).json({error:'Invalid or expired verification token'}); await db.$transaction([db.user.update({where:{id:row.userId},data:{emailVerifiedAt:new Date(),status:'ACTIVE'}}),db.verificationToken.update({where:{id:row.id},data:{usedAt:new Date()}})]); res.json({ok:true});}catch(e){next(e)}});

r.post('/login',async(req,res)=>{const email=String(req.body.email||'').toLowerCase().trim(); const password=String(req.body.password||''); const u=await db.user.findUnique({where:{email}}); if(!u||!u.passwordHash||!(await verifyPassword(password,u.passwordHash)))return res.status(401).json({error:'Invalid email or password'}); if(!u.emailVerifiedAt)return res.status(403).json({error:'Please verify your email before logging in'}); if(u.status==='SUSPENDED')return res.status(403).json({error:'Account suspended'}); if(u.companyId){const subscription=await db.subscription.findUnique({where:{companyId:u.companyId},select:{status:true}});if(subscription?.status==='PENDING')return res.status(402).json({error:'Payment is required before your workspace can be activated'});} const token=signAccess({id:u.id,role:u.role,companyId:u.companyId}); res.json({token,user:{id:u.id,email:u.email,name:u.uniqueName,role:u.role,companyId:u.companyId}})});

r.post('/forgot-password',async(req,res,next)=>{try{const email=String(req.body.email||'').toLowerCase().trim(); const u=await db.user.findUnique({where:{email}}); if(u){const token=randomToken(); await db.verificationToken.create({data:{userId:u.id,tokenHash:hashToken(token),type:'PASSWORD_RESET',expiresAt:new Date(Date.now()+30*60*1000)}}); await sendEmail(email,'SecureFile password reset',`<p><a href="${resetUrl(token)}">Reset your password</a></p><p>This link expires in 30 minutes.</p>`);} res.json({message:'If the email exists, a reset message has been sent.'});}catch(e){next(e)}});

r.post('/reset-password',async(req,res,next)=>{try{const token=String(req.body.token||''); const password=String(req.body.password||''); if(password.length<10)return res.status(400).json({error:'Password must be at least 10 characters'}); const row=await db.verificationToken.findFirst({where:{tokenHash:hashToken(token),type:'PASSWORD_RESET',usedAt:null,expiresAt:{gt:new Date()}}}); if(!row)return res.status(400).json({error:'Invalid or expired reset token'}); await db.$transaction([db.user.update({where:{id:row.userId},data:{passwordHash:await hashPassword(password)}}),db.verificationToken.update({where:{id:row.id},data:{usedAt:new Date()}})]); res.json({ok:true});}catch(e){next(e)}});
export default r;
