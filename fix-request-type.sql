DO $$
DECLARE
  current_type text;
BEGIN
  SELECT data_type
  INTO current_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'AccessRequest'
    AND column_name = 'requestedType';

  IF current_type IS NOT NULL AND current_type <> 'USER-DEFINED' THEN
    ALTER TABLE "AccessRequest"
      ALTER COLUMN "requestedType" TYPE text
      USING "requestedType"::text;
  END IF;
END $$;

UPDATE "AccessRequest"
SET "requestedType" =
  CASE
    WHEN UPPER("requestedType"::text) IN ('FILE', 'FOLDER')
      THEN UPPER("requestedType"::text)
    WHEN "fileId" IS NOT NULL
      THEN 'FILE'
    WHEN "folderId" IS NOT NULL
      THEN 'FOLDER'
    ELSE 'FILE'
  END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ResourceType'
  ) THEN
    CREATE TYPE "ResourceType" AS ENUM ('FILE', 'FOLDER');
  END IF;
END $$;

ALTER TABLE "AccessRequest"
  ALTER COLUMN "requestedType"
  TYPE "ResourceType"
  USING "requestedType"::"ResourceType";