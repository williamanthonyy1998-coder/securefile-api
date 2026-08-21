-- SecureFile collaboration, mail, task reminders and safe legacy upgrades.

-- Make the legacy AccessRequest columns compatible with the current enum schema.
DO $$
DECLARE
  typ text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO typ
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  WHERE c.relname = 'AccessRequest' AND a.attname = 'requestedType' AND a.attnum > 0 AND NOT a.attisdropped;

  IF typ IS NULL THEN
    ALTER TABLE "AccessRequest" ADD COLUMN "requestedType" "ResourceType";
  ELSIF typ NOT LIKE '%ResourceType%' THEN
    ALTER TABLE "AccessRequest"
      ALTER COLUMN "requestedType" TYPE "ResourceType"
      USING (CASE
        WHEN upper("requestedType"::text) IN ('FOLDER','FOLDERS') THEN 'FOLDER'::"ResourceType"
        ELSE 'FILE'::"ResourceType"
      END);
  END IF;
END $$;

ALTER TABLE "AccessRequest" ADD COLUMN IF NOT EXISTS "requestedName" TEXT;
UPDATE "AccessRequest"
SET "requestedName" = COALESCE(NULLIF("requestedName", ''), 'Requested resource')
WHERE "requestedName" IS NULL OR "requestedName" = '';
ALTER TABLE "AccessRequest" ALTER COLUMN "requestedName" SET NOT NULL;
UPDATE "AccessRequest"
SET "requestedType" = CASE WHEN "folderId" IS NOT NULL THEN 'FOLDER'::"ResourceType" ELSE 'FILE'::"ResourceType" END
WHERE "requestedType" IS NULL;
ALTER TABLE "AccessRequest" ALTER COLUMN "requestedType" SET NOT NULL;

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "lastReminderAt" TIMESTAMP(3);

DO $$ BEGIN
  CREATE TYPE "EmailDirection" AS ENUM ('SENT','RECEIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "EmailMessage" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "senderId" TEXT,
  "recipientId" TEXT,
  "recipientEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "direction" "EmailDirection" NOT NULL DEFAULT 'SENT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EmailMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "EmailMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "EmailMessage_companyId_createdAt_idx" ON "EmailMessage"("companyId","createdAt");
CREATE INDEX IF NOT EXISTS "EmailMessage_recipientId_createdAt_idx" ON "EmailMessage"("recipientId","createdAt");
CREATE INDEX IF NOT EXISTS "EmailMessage_senderId_createdAt_idx" ON "EmailMessage"("senderId","createdAt");
