import { PrismaClient } from '@prisma/client';
const db=new PrismaClient();
async function main(){
 const users=await db.user.findMany({where:{companyId:{not:null},personalFolderAllowed:true},select:{id:true,companyId:true}});let created=0,merged=0;
 for(const user of users){const companyId=user.companyId!;const folders=await db.folder.findMany({where:{companyId,ownerId:user.id,isPersonal:true},orderBy:{createdAt:'asc'},select:{id:true}});
   let primary=folders[0];
   if(!primary){const legacy=await db.folder.findFirst({where:{companyId,ownerId:user.id,name:'Personal Folder',deletedAt:null},orderBy:{createdAt:'asc'}});primary=legacy||await db.folder.create({data:{companyId,ownerId:user.id,name:'Personal Folder',isPersonal:true}});if(legacy)await db.folder.update({where:{id:legacy.id},data:{isPersonal:true}});else created++;}
   const duplicates=await db.folder.findMany({where:{companyId,ownerId:user.id,isPersonal:true,id:{not:primary.id}},select:{id:true}});
   for(const d of duplicates){await db.file.updateMany({where:{folderId:d.id},data:{folderId:primary.id}});await db.folder.updateMany({where:{parentId:d.id},data:{parentId:primary.id}});await db.folder.delete({where:{id:d.id}});merged++;}
 }
 console.log(`Personal folders normalized. Created: ${created}; merged duplicates: ${merged}`);
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
