import path from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// This script is executed from the repository root via npm --prefix backend.
// Load the same root environment used by the API before constructing PrismaClient.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env'), override: false });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for personal-folder backfill.');
}

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const users = await db.user.findMany({
    where: { companyId: { not: null }, personalFolderAllowed: true },
    select: { id: true, companyId: true },
  });

  let created = 0;
  let merged = 0;

  for (const user of users) {
    const companyId = user.companyId!;
    const folders = await db.folder.findMany({
      where: { companyId, ownerId: user.id, isPersonal: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    let primary = folders[0];

    if (!primary) {
      const legacy = await db.folder.findFirst({
        where: {
          companyId,
          ownerId: user.id,
          name: 'Personal Folder',
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
      });

      primary = legacy || await db.folder.create({
        data: {
          companyId,
          ownerId: user.id,
          name: 'Personal Folder',
          isPersonal: true,
        },
      });

      if (legacy) {
        await db.folder.update({
          where: { id: legacy.id },
          data: { isPersonal: true },
        });
      } else {
        created++;
      }
    }

    const duplicates = await db.folder.findMany({
      where: {
        companyId,
        ownerId: user.id,
        isPersonal: true,
        id: { not: primary.id },
      },
      select: { id: true },
    });

    for (const duplicate of duplicates) {
      await db.file.updateMany({
        where: { folderId: duplicate.id },
        data: { folderId: primary.id },
      });
      await db.folder.updateMany({
        where: { parentId: duplicate.id },
        data: { parentId: primary.id },
      });
      await db.folder.delete({ where: { id: duplicate.id } });
      merged++;
    }
  }

  console.log(`Personal folders normalized. Created: ${created}; merged duplicates: ${merged}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
