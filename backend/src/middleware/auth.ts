import {Request,Response,NextFunction} from 'express';
import {verifyAccess} from '../utils/security';
import {db} from '../db';
export type AuthedRequest=Request & {user?:{id:string,role:string,companyId:string|null}};
export async function auth(req:AuthedRequest,res:Response,next:NextFunction){const h=req.headers.authorization;if(!h?.startsWith('Bearer '))return res.status(401).json({error:'Authentication required'});try{const payload=verifyAccess(h.slice(7));const u=await db.user.findUnique({where:{id:payload.id},select:{id:true,role:true,companyId:true,status:true,emailVerifiedAt:true}});if(!u||u.status==='SUSPENDED'||!u.emailVerifiedAt)return res.status(401).json({error:'Session is no longer valid'});req.user={id:u.id,role:u.role,companyId:u.companyId};next();}catch{return res.status(401).json({error:'Invalid or expired session'})}}
export const role=(...roles:string[]) => (req:AuthedRequest,res:Response,next:NextFunction)=>{if(!req.user||!roles.includes(req.user.role))return res.status(403).json({error:'Forbidden'});next()};
export const tenant=(req:AuthedRequest,res:Response,next:NextFunction)=>{if(!req.user?.companyId&&req.user?.role!=='SUPER_ADMIN')return res.status(403).json({error:'Tenant context required'});next()};
