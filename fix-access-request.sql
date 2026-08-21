ALTER TABLE "AccessRequest"
ADD COLUMN IF NOT EXISTS "requestedName" TEXT,
ADD COLUMN IF NOT EXISTS "requestedType" TEXT;

UPDATE "AccessRequest" ar
SET
  "requestedType" =
    CASE
      WHEN ar."fileId" IS NOT NULL THEN 'FILE'
      WHEN ar."folderId" IS NOT NULL THEN 'FOLDER'
      ELSE 'FILE'
    END,
  "requestedName" =
    COALESCE(
      (SELECT f."name"
       FROM "File" f
       WHERE f."id" = ar."fileId"),
      (SELECT fo."name"
       FROM "Folder" fo
       WHERE fo."id" = ar."folderId"),
      'Requested resource'
    )
WHERE
  "requestedName" IS NULL
  OR "requestedType" IS NULL;

ALTER TABLE "AccessRequest"
ALTER COLUMN "requestedName" SET NOT NULL,
ALTER COLUMN "requestedType" SET NOT NULL;