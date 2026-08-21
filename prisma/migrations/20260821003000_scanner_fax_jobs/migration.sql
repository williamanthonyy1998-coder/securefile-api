DO $$ BEGIN
  CREATE TYPE "ScanJobStatus" AS ENUM ('QUEUED','SCANNING','COMPLETED','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FaxJobStatus" AS ENUM ('QUEUED','SENDING','SENT','RECEIVED','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FaxDirection" AS ENUM ('OUTBOUND','INBOUND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ScanJob" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "ScanJobStatus" NOT NULL DEFAULT 'QUEUED',
  "provider" TEXT NOT NULL DEFAULT 'UPLOAD',
  "pages" INTEGER,
  "resolutionDpi" INTEGER,
  "colorMode" TEXT,
  "duplex" BOOLEAN NOT NULL DEFAULT false,
  "outputFileId" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScanJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScanJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ScanJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ScanJob_companyId_status_createdAt_idx" ON "ScanJob"("companyId","status","createdAt");
CREATE INDEX IF NOT EXISTS "ScanJob_userId_createdAt_idx" ON "ScanJob"("userId","createdAt");

CREATE TABLE IF NOT EXISTS "FaxJob" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "direction" "FaxDirection" NOT NULL DEFAULT 'OUTBOUND',
  "status" "FaxJobStatus" NOT NULL DEFAULT 'QUEUED',
  "recipientNumber" TEXT,
  "senderNumber" TEXT,
  "fileId" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'WEBHOOK',
  "providerRef" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FaxJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FaxJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FaxJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "FaxJob_companyId_status_createdAt_idx" ON "FaxJob"("companyId","status","createdAt");
CREATE INDEX IF NOT EXISTS "FaxJob_userId_createdAt_idx" ON "FaxJob"("userId","createdAt");
