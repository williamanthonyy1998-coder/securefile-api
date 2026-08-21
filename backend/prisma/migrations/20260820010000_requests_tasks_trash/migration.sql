DO $$ BEGIN
  CREATE TYPE "TaskPriority" AS ENUM ('LOW','MEDIUM','HIGH','URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "ResourceType" AS ENUM ('FILE','FOLDER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "Folder" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "startPage" INTEGER;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "endPage" INTEGER;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "AccessRequest" ADD COLUMN IF NOT EXISTS "requestedName" TEXT;
ALTER TABLE "AccessRequest" ADD COLUMN IF NOT EXISTS "requestedType" "ResourceType";
UPDATE "AccessRequest" SET "requestedName" = COALESCE("requestedName", 'Requested resource');
UPDATE "AccessRequest" SET "requestedType" = COALESCE("requestedType", CASE WHEN "folderId" IS NOT NULL THEN 'FOLDER'::"ResourceType" ELSE 'FILE'::"ResourceType" END);
ALTER TABLE "AccessRequest" ALTER COLUMN "requestedName" SET NOT NULL;
ALTER TABLE "AccessRequest" ALTER COLUMN "requestedType" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "Task_companyId_deletedAt_idx" ON "Task"("companyId","deletedAt");
CREATE INDEX IF NOT EXISTS "File_companyId_deletedAt_idx" ON "File"("companyId","deletedAt");
CREATE INDEX IF NOT EXISTS "Folder_companyId_deletedAt_idx" ON "Folder"("companyId","deletedAt");
