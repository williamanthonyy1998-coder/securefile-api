import dotenv from "dotenv";
import path from "node:path";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: path.resolve(process.cwd(), "../.env"), override: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

// Explicitly use the same URL loaded above so the repair and Prisma CLI cannot
// silently operate on different databases.
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

async function main() {
  // This script is intentionally data-preserving.  The Message model was
  // migrated from the legacy recipientId/groupId design to Conversation.
  // Prisma cannot add required columns to a populated Message table by
  // itself, so we migrate the rows first and only then run db push.
  await migrateLegacyMessaging();
  await repairKnownSchemaDrift();
  await db.$disconnect();
  await runPrismaPush();
}

async function tableExists(table: string) {
  const rows: Array<{ exists: boolean }> = await db.$queryRawUnsafe(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=$1
    ) AS exists
  `, table);
  return Boolean(rows[0]?.exists);
}

async function columnExists(table: string, column: string) {
  const rows: Array<{ exists: boolean }> = await db.$queryRawUnsafe(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1 AND column_name=$2
    ) AS exists
  `, table, column);
  return Boolean(rows[0]?.exists);
}

async function ensureConversationTables() {
  await db.$executeRawUnsafe(`DO $$ BEGIN CREATE TYPE "ConversationType" AS ENUM ('DIRECT','GROUP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Conversation" (
      "id" TEXT NOT NULL,
      "companyId" TEXT NOT NULL,
      "type" "ConversationType" NOT NULL DEFAULT 'DIRECT',
      "name" TEXT,
      "createdById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
    )
  `);
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ConversationParticipant" (
      "id" TEXT NOT NULL,
      "conversationId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastReadAt" TIMESTAMP(3),
      CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
    )
  `);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId","userId")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ConversationParticipant_conversationId_userId_idx" ON "ConversationParticipant"("conversationId","userId")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Conversation_companyId_updatedAt_idx" ON "Conversation"("companyId","updatedAt")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Conversation_companyId_type_idx" ON "Conversation"("companyId","type")`);
}

async function insertConversation(companyId: string, type: 'DIRECT'|'GROUP', name: string|null, createdById: string|null, participants: string[]) {
  const id = `conv_${crypto.randomUUID()}`;
  await db.$executeRawUnsafe(`INSERT INTO "Conversation"("id","companyId","type","name","createdById") VALUES ($1,$2,$3::"ConversationType",$4,$5)`, id, companyId, type, name, createdById);
  for (const userId of [...new Set(participants.filter(Boolean))]) {
    await db.$executeRawUnsafe(`INSERT INTO "ConversationParticipant"("id","conversationId","userId") SELECT $1,$2,$3 WHERE EXISTS (SELECT 1 FROM "User" WHERE "id"=$3) ON CONFLICT ("conversationId","userId") DO NOTHING`, `cp_${crypto.randomUUID()}`, id, userId);
  }
  return id;
}

async function migrateLegacyMessaging() {
  const messageExists = await tableExists('Message');
  if (!messageExists) return;
  const legacyRecipient = await columnExists('Message','recipientId');
  const legacyGroup = await columnExists('Message','groupId');
  const conversationColumn = await columnExists('Message','conversationId');
  if (!legacyRecipient && !legacyGroup && conversationColumn) {
    // Already on the new model. Make sure updatedAt exists for older partial DBs.
    if (!await columnExists('Message','updatedAt')) {
      await db.$executeRawUnsafe(`ALTER TABLE "Message" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    }
    return;
  }

  await ensureConversationTables();

  const legacyGroups = new Map<string, { companyId: string; name: string; createdById: string|null }>();
  const legacyGroupMembers = new Map<string,string[]>();
  if (await tableExists('Group')) {
    const groups: any[] = await db.$queryRawUnsafe(`SELECT "id","companyId","name","createdById" FROM "Group"`);
    for (const g of groups) legacyGroups.set(String(g.id), { companyId:String(g.companyId), name:String(g.name || 'Group'), createdById:g.createdById ? String(g.createdById) : null });
  }
  if (await tableExists('GroupMember')) {
    const members: any[] = await db.$queryRawUnsafe(`SELECT "groupId","userId" FROM "GroupMember"`);
    for (const m of members) {
      const arr=legacyGroupMembers.get(String(m.groupId)) || [];
      arr.push(String(m.userId)); legacyGroupMembers.set(String(m.groupId),arr);
    }
  }

  // Group conversations are created first so all legacy group messages can map directly.
  const groupConversation = new Map<string,string>();
  for (const [groupId,g] of legacyGroups) {
    const id = await insertConversation(g.companyId,'GROUP',g.name,g.createdById,legacyGroupMembers.get(groupId) || (g.createdById ? [g.createdById] : []));
    groupConversation.set(groupId,id);
  }

  const selectRecipient = legacyRecipient ? `"recipientId"` : `NULL::TEXT AS "recipientId"`;
  const selectGroup = legacyGroup ? `"groupId"` : `NULL::TEXT AS "groupId"`;
  const messages: any[] = await db.$queryRawUnsafe(`SELECT "id","companyId","senderId","body","createdAt",${selectRecipient},${selectGroup} FROM "Message" ORDER BY "createdAt" ASC,"id" ASC`);
  const directConversation = new Map<string,string>();

  for (const m of messages) {
    let conversationId: string|undefined;
    const gid = m.groupId ? String(m.groupId) : '';
    if (gid && groupConversation.has(gid)) {
      conversationId = groupConversation.get(gid);
    } else {
      const sender = String(m.senderId);
      const recipient = m.recipientId ? String(m.recipientId) : '';
      const pair = [sender, recipient || sender].sort().join('|');
      const key = `${String(m.companyId)}:${pair}`;
      conversationId = directConversation.get(key);
      if (!conversationId) {
        conversationId = await insertConversation(String(m.companyId),'DIRECT',null,sender,[sender,recipient].filter(Boolean));
        directConversation.set(key,conversationId);
      }
    }
    await db.$executeRawUnsafe(`ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "conversationId" TEXT`);
    await db.$executeRawUnsafe(`UPDATE "Message" SET "conversationId"=$1 WHERE "id"=$2 AND "conversationId" IS NULL`, conversationId, String(m.id));
  }

  await db.$executeRawUnsafe(`ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3)`);
  await db.$executeRawUnsafe(`UPDATE "Message" SET "updatedAt"=COALESCE("updatedAt","createdAt",CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL`);
  await db.$executeRawUnsafe(`ALTER TABLE "Message" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP`);
  await db.$executeRawUnsafe(`ALTER TABLE "Message" ALTER COLUMN "updatedAt" SET NOT NULL`);
  const missing: Array<{n: number}> = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "Message" WHERE "conversationId" IS NULL`);
  if ((missing[0]?.n || 0) > 0) throw new Error(`Messaging migration stopped safely: ${missing[0].n} messages have no conversation.`);
  await db.$executeRawUnsafe(`ALTER TABLE "Message" ALTER COLUMN "conversationId" SET NOT NULL`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx" ON "Message"("conversationId","createdAt")`);
}

async function repairKnownSchemaDrift() {
  const tables: Array<{ table_name: string }> = await db.$queryRawUnsafe(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('AccessRequest','Task','Notification')`);
  const names = new Set(tables.map(x => x.table_name));
  if (names.has('AccessRequest')) {
    await db.$executeRawUnsafe(`DO $$ BEGIN CREATE TYPE "ResourceType" AS ENUM ('FILE','FOLDER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    const cols: Array<{ udt_name: string; data_type: string }> = await db.$queryRawUnsafe(`SELECT udt_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='AccessRequest' AND column_name='requestedType'`);
    if (cols.length && cols[0].udt_name !== 'ResourceType') await db.$executeRawUnsafe(`ALTER TABLE "AccessRequest" ALTER COLUMN "requestedType" TYPE "ResourceType" USING (CASE WHEN upper("requestedType"::text)='FOLDER' THEN 'FOLDER'::"ResourceType" ELSE 'FILE'::"ResourceType" END)`);
    await db.$executeRawUnsafe(`ALTER TABLE "AccessRequest" ADD COLUMN IF NOT EXISTS "requestedName" TEXT`);
    await db.$executeRawUnsafe(`UPDATE "AccessRequest" SET "requestedName"=COALESCE(NULLIF("requestedName",''),'Requested resource') WHERE "requestedName" IS NULL OR "requestedName"=''`);
    await db.$executeRawUnsafe(`ALTER TABLE "AccessRequest" ALTER COLUMN "requestedName" SET NOT NULL`);
    await db.$executeRawUnsafe(`UPDATE "AccessRequest" SET "requestedType"=CASE WHEN "folderId" IS NOT NULL THEN 'FOLDER'::"ResourceType" ELSE 'FILE'::"ResourceType" END WHERE "requestedType" IS NULL`);
    await db.$executeRawUnsafe(`ALTER TABLE "AccessRequest" ALTER COLUMN "requestedType" SET NOT NULL`);
  }
  if (names.has('Task')) await db.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "lastReminderAt" TIMESTAMP(3)`);
  if (names.has('Notification')) {
    await db.$executeRawUnsafe(`DO $$ BEGIN CREATE TYPE "NotificationType" AS ENUM ('FILE_UPLOADED','FILE_SHARED','FILE_UPDATED','FILE_DELETED','ACCESS_REQUESTED','ACCESS_REQUEST_APPROVED','ACCESS_REQUEST_REJECTED','APPROVAL_REQUESTED','APPROVAL_APPROVED','APPROVAL_REJECTED','TASK_ASSIGNED','TASK_STARTED','TASK_COMPLETED','TASK_DUE_SOON','TASK_OVERDUE','MESSAGE_RECEIVED','FAX_SENT','FAX_RECEIVED','FAX_FAILED','USER_INVITED','USER_ACTIVATED','USER_SUSPENDED','SUBSCRIPTION_UPDATED','PAYMENT_FAILED','SECURITY_ALERT','SYSTEM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await db.$executeRawUnsafe(`ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "type" "NotificationType" DEFAULT 'SYSTEM' NOT NULL`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Notification_userId_type_createdAt_idx" ON "Notification"("userId","type","createdAt")`);
    console.log('Verified: Notification.type exists in the configured database.');
  }
}

async function runPrismaPush() {
  const prismaBin = process.platform === 'win32' ? path.join(process.cwd(),'node_modules','.bin','prisma.cmd') : path.join(process.cwd(),'node_modules','.bin','prisma');
  const schemaPath = path.join(process.cwd(),'prisma','schema.prisma');
  const quote = (value: string) => `"${value.replace(/"/g,'\\"')}"`;
  const migrationUrl = process.env.DIRECT_URL || databaseUrl;
  const command = `${quote(prismaBin)} db push --schema ${quote(schemaPath)} --accept-data-loss`;
  execSync(command,{stdio:'inherit',cwd:process.cwd(),env:{...process.env,DATABASE_URL:migrationUrl},shell:process.platform==='win32'?(process.env.ComSpec||'cmd.exe'):'/bin/sh'});
}

main().catch(async err => {
  console.error(err);
  await db.$disconnect().catch(() => undefined);
  process.exit(1);
});
