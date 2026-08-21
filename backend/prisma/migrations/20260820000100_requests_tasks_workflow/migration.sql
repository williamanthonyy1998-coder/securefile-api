-- SecureFile Requests / Approvals / Task Management production upgrade
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskPriority') THEN
    CREATE TYPE "TaskPriority" AS ENUM ('LOW','MEDIUM','HIGH','URGENT');
  END IF;
END $$;

ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'CANCELED';

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "startPage" INTEGER;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "endPage" INTEGER;

CREATE INDEX IF NOT EXISTS "Task_companyId_fileId_idx" ON "Task" ("companyId","fileId");
CREATE INDEX IF NOT EXISTS "Task_companyId_folderId_idx" ON "Task" ("companyId","folderId");
