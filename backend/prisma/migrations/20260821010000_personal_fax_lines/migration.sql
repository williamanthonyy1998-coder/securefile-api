DO $$ BEGIN
  CREATE TYPE "FaxJobStatus" AS ENUM ('QUEUED','SENDING','SENT','RECEIVED','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FaxDirection" AS ENUM ('OUTBOUND','INBOUND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "FaxLine" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "phoneNumber" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'PHAXIO',
  "providerRef" TEXT,
  "countryCode" INTEGER,
  "areaCode" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FaxLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FaxLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FaxLine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "FaxLine_userId_key" ON "FaxLine"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "FaxLine_phoneNumber_key" ON "FaxLine"("phoneNumber");
CREATE INDEX IF NOT EXISTS "FaxLine_companyId_active_idx" ON "FaxLine"("companyId","active");

CREATE TABLE IF NOT EXISTS "FaxJob" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "direction" "FaxDirection" NOT NULL DEFAULT 'OUTBOUND',
  "status" "FaxJobStatus" NOT NULL DEFAULT 'QUEUED',
  "recipientNumber" TEXT,
  "senderNumber" TEXT,
  "fileId" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'PHAXIO',
  "providerRef" TEXT,
  "pages" INTEGER,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FaxJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FaxJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FaxJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FaxJob_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
ALTER TABLE "FaxJob" ADD COLUMN IF NOT EXISTS "pages" INTEGER;

DO $$ BEGIN
  ALTER TABLE "FaxJob" ADD CONSTRAINT "FaxJob_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "FaxJob_companyId_status_createdAt_idx" ON "FaxJob"("companyId","status","createdAt");
CREATE INDEX IF NOT EXISTS "FaxJob_userId_createdAt_idx" ON "FaxJob"("userId","createdAt");
CREATE INDEX IF NOT EXISTS "FaxJob_providerRef_idx" ON "FaxJob"("providerRef");
