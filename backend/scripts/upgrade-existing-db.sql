-- SecureFile production schema upgrade (safe for existing databases)
-- Adds the fields introduced by the business/industry, personal-folder and plan updates.

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "businessIndustry" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "businessDescription" TEXT;
ALTER TABLE "Folder" ADD COLUMN IF NOT EXISTS "isPersonal" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "planCode" TEXT NOT NULL DEFAULT 'CUSTOM';

CREATE INDEX IF NOT EXISTS "Folder_companyId_ownerId_isPersonal_idx"
  ON "Folder" ("companyId", "ownerId", "isPersonal");

-- Convert legacy folders created by the older application into personal folders.
UPDATE "Folder" f
SET "isPersonal" = TRUE
WHERE "isPersonal" = FALSE
  AND "name" = 'Personal Folder'
  AND "ownerId" IS NOT NULL;
