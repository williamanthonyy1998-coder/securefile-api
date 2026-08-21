import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import path from 'node:path';

const db = new PrismaClient();

async function main() {
  // Repair known legacy columns before Prisma validates the current schema.
  const tables: any[] = await db.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('AccessRequest','Task')
  `);
  const names = new Set(tables.map(x => x.table_name));

  if (names.has('AccessRequest')) {
    await db.$executeRawUnsafe(`DO $$ BEGIN CREATE TYPE "ResourceType" AS ENUM ('FILE','FOLDER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    const cols: any[] = await db.$queryRawUnsafe(`
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
  if (names.has('Task')) await db.$executeRawUnsafe(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "lastReminderAt" TIMESTAMP(3);`);

  // Windows npm exposes Prisma as a .cmd shim. Calling a .cmd file directly
  // with execFileSync can fail with EINVAL on Node 26. Execute through the
  // platform shell instead, while keeping the schema path quoted safely.
  const prismaBin = process.platform === 'win32'
    ? path.join(process.cwd(), 'node_modules', '.bin', 'prisma.cmd')
    : path.join(process.cwd(), 'node_modules', '.bin', 'prisma');
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  const quote = (value: string) => `"${value.replace(/"/g, '\\"')}"`;
  const command = `${quote(prismaBin)} db push --schema ${quote(schemaPath)}`;
  execSync(command, { stdio: 'inherit', cwd: process.cwd(), shell: process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : '/bin/sh' });
}

main().catch(err => { console.error(err); process.exit(1); }).finally(() => db.$disconnect());
