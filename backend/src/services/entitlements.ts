import {db} from '../db';
export async function hasAddon(companyId:string,addon:string){
 const s=await db.subscription.findUnique({where:{companyId},select:{status:true,addons:true}});
 if(!s || !['ACTIVE'].includes(s.status)) return false;
 return Boolean((s.addons as any)?.[addon]);
}
export async function requireAddon(companyId:string,addon:string){
 if(!(await hasAddon(companyId,addon))) throw Object.assign(new Error(`This feature requires the ${addon} add-on.`),{status:402});
}
