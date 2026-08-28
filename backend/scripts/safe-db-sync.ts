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
  const tables: Array<{ table_name: string }> = await db.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public'
      AND table_name IN ('AccessRequest','Task','Notification')
  `);
  const names = new Set(tables.map(x => x.table_name));

  if (names.has('AccessRequest')) {
    await db.$executeRawUnsafe(`DO $$ BEGIN CREATE TYPE "ResourceType" AS ENUM ('FILE','FOLDER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    const cols: Array<{ udt_name: string; data_type: string }> = await db.$queryRawUnsafe(`
      SELECT udt_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='AccessRequest' AND column_name='requestedType'
    `);
    if (cols.length && cols[0].udt_name !== 'ResourceType') {
      await db.$executeRawUnsafe(`ALTER TABLE "AccessRequest" ALTER COLUMN "requestedType" TYPE "ResourceType" USING (CASE WHEN upper("requestedType"::text)='FOLDER' THEN 'FOLDER'::"ResourceType" ELSE 'FILE'::"ResourceType" END);`);
    }
    await db.$executeRawUnsafe(`ALTER TABLE "AccessRequest" ADD COLUMN IF NOT EXISTS "requestedName" TEXT;`);
    await db.$executeRawUnsafe(`UPDATE "AccessRequest" SET "requestedName"=COALESCE(NULLIF("requestedName",''),'Requested resource') WHERE "requestedName" IS NULL OR "requestedName"='';`);
    await db.$executeRawUnsafe(`ALTER TABLE "AccessRequest" ALTER COLUMN "requestedName" SET NOT NULL;`);
    await db.$executeRawUnsafe(`UPDATE "AccessRequest" SET "requestedType"=CASE WHEN "folderId" IS NOT NULL THEN 'FOLDER'::"ResourceType" ELSE 'FILE'::"ResourceType" END WHERE "requestedType" IS NULL;`);
    await db.$executeRawUnsafe(`ALTER TABLE "AccessRequest" ALTER COLUMN "requestedType" SET NOT NULL;`);
  }

  if (names.has('Task')) {
    await db.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "lastReminderAt" TIMESTAMP(3);`);
  }

  if (names.has('Notification')) {
    await db.$executeRawUnsafe(`DO $$ BEGIN
      CREATE TYPE "NotificationType" AS ENUM (
        'FILE_UPLOADED','FILE_SHARED','FILE_UPDATED','FILE_DELETED',
        'ACCESS_REQUESTED','ACCESS_REQUEST_APPROVED','ACCESS_REQUEST_REJECTED',
        'APPROVAL_REQUESTED','APPROVAL_APPROVED','APPROVAL_REJECTED',
        'TASK_ASSIGNED','TASK_STARTED','TASK_COMPLETED','TASK_DUE_SOON','TASK_OVERDUE',
        'MESSAGE_RECEIVED','FAX_SENT','FAX_RECEIVED','FAX_FAILED',
        'USER_INVITED','USER_ACTIVATED','USER_SUSPENDED',
        'SUBSCRIPTION_UPDATED','PAYMENT_FAILED','SECURITY_ALERT','SYSTEM'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await db.$executeRawUnsafe(`ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "type" "NotificationType" DEFAULT 'SYSTEM' NOT NULL;`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Notification_userId_type_createdAt_idx" ON "Notification"("userId", "type", "createdAt");`);

    const check: Array<{ column_name: string }> = await db.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='Notification' AND column_name='type'
    `);
    if (check.length !== 1) {
      throw new Error("Notification.type repair did not persist. Database sync aborted safely.");
    }
    console.log("Verified: Notification.type exists in the configured database.");
  }

  await db.$disconnect();

  const prismaBin = process.platform === 'win32'
    ? path.join(process.cwd(), 'node_modules', '.bin', 'prisma.cmd')
    : path.join(process.cwd(), 'node_modules', '.bin', 'prisma');
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  const quote = (value: string) => `"${value.replace(/"/g, '\\"')}"`;
  // Prisma DDL should use the Supabase session/direct connection (5432).
  // The application itself continues using DATABASE_URL (transaction pooler).
  const migrationUrl = process.env.DIRECT_URL || databaseUrl;
  const command = `${quote(prismaBin)} db push --schema ${quote(schemaPath)}`;
  execSync(command, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: migrationUrl },
    shell: process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : '/bin/sh',
  });
}

main().catch(async err => {
  console.error(err);
  await db.$disconnect().catch(() => undefined);
  process.exit(1);
});
