import { db } from '../db';
import { deleteObject } from './storage';

export async function hardDeleteFile(fileId: string) {
  const file = await db.file.findUnique({ where: { id: fileId } });
  if (!file) return false;
  await deleteObject(file.storageKey).catch(() => undefined);
  await db.file.delete({ where: { id: fileId } });
  const company = await db.company.findUnique({ where: { id: file.companyId }, select: { storageUsedBytes: true } });
  const next = (company?.storageUsedBytes ?? 0n) - file.sizeBytes;
  await db.company.update({ where: { id: file.companyId }, data: { storageUsedBytes: next < 0n ? 0n : next } });
  return true;
}

async function descendants(companyId: string, rootId: string) {
  const all = await db.folder.findMany({ where: { companyId }, select: { id: true, parentId: true } });
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of all) {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        changed = true;
      }
    }
  }
  return [...ids];
}

export async function hardDeleteFolder(folderId: string) {
  const folder = await db.folder.findUnique({ where: { id: folderId }, select: { id: true, companyId: true } });
  if (!folder) return false;
  const ids = await descendants(folder.companyId, folder.id);
  const files = await db.file.findMany({ where: { companyId: folder.companyId, folderId: { in: ids } }, select: { id: true, storageKey: true, sizeBytes: true } });
  for (const file of files) await deleteObject(file.storageKey).catch(() => undefined);
  await db.folder.deleteMany({ where: { id: { in: ids } } });
  const bytes = files.reduce((sum, f) => sum + f.sizeBytes, 0n);
  if (bytes > 0n) {
    const company = await db.company.findUnique({ where: { id: folder.companyId }, select: { storageUsedBytes: true } });
    const next = (company?.storageUsedBytes ?? 0n) - bytes;
    await db.company.update({ where: { id: folder.companyId }, data: { storageUsedBytes: next < 0n ? 0n : next } });
  }
  return true;
}

export async function purgeExpiredTrash() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const files = await db.file.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true } });
  for (const f of files) await hardDeleteFile(f.id).catch(console.error);
  const folders = await db.folder.findMany({ where: { deletedAt: { lt: cutoff } }, select: { id: true } });
  for (const f of folders) await hardDeleteFolder(f.id).catch(console.error);
  return { files: files.length, folders: folders.length };
}
