import {db} from '../db'; export async function notify(userId:string,title:string,body:string,companyId?:string){return db.notification.create({data:{userId,title,body,companyId}})}
