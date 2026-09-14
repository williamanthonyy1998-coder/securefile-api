import { db } from "../db";

export type Action = "view" | "download" | "upload" | "edit" | "delete" | "share";
const key: Record<Action, string> = {
  view: "canView",
  download: "canDownload",
  upload: "canUpload",
  edit: "canEdit",
  delete: "canDelete",
  share: "canShare",
};
const activeExpiry = { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };

async function personalFolderAllowed(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { personalFolderAllowed: true } });
  return user?.personalFolderAllowed !== false;
}

export async function getFileAccess(userId: string, role: string, companyId: string, fileId: string, action: Action) {
  const f = await db.file.findFirst({ where: { id: fileId, companyId, deletedAt: null } });
  if (!f) return null;
  if (role === "COMPANY_ADMIN" || role === "SUPER_ADMIN") return f;

  const folder = f.folderId
    ? await db.folder.findFirst({ where: { id: f.folderId, companyId, deletedAt: null }, select: { id: true, ownerId: true, isPersonal: true, parentId: true } })
    : null;
  if (f.ownerId === userId) {
    if (folder?.isPersonal && !(await personalFolderAllowed(userId))) return null;
    return f;
  }

  const direct = await db.share.findFirst({ where: { companyId, fileId, recipientId: userId, ...activeExpiry, [key[action]]: true } });
  if (direct) return f;
  if (folder?.isPersonal && folder.ownerId !== userId) return null;
  if (f.folderId && await getFolderAccess(userId, role, companyId, f.folderId, action)) return f;
  return null;
}

export async function getFolderAccess(userId: string, role: string, companyId: string, folderId: string, action: Action) {
  let current = await db.folder.findFirst({ where: { id: folderId, companyId, deletedAt: null } });
  const allowPersonal = role === "COMPANY_ADMIN" || role === "SUPER_ADMIN" ? true : await personalFolderAllowed(userId);
  while (current) {
    if (role === "COMPANY_ADMIN" || role === "SUPER_ADMIN") return current;
    if (current.isPersonal && current.ownerId === userId) return allowPersonal ? current : null;
    if (current.isPersonal && current.ownerId !== userId) {
      const share = await db.share.findFirst({ where: { companyId, folderId: current.id, recipientId: userId, ...activeExpiry, [key[action]]: true } });
      return share ? current : null;
    }
    if (current.ownerId === userId) return current;

    const internalShare = await db.share.findFirst({
      where: { companyId, folderId: current.id, recipientId: userId, type: "INTERNAL", ...activeExpiry, [key[action]]: true },
    });
    if (internalShare) return current;

    // A PUBLIC folder share is intentionally not anonymous. Once the user is
    // authenticated, the link acts as the access grant for this workspace.
    const publicShare = await db.share.findFirst({
      where: { companyId, folderId: current.id, type: "PUBLIC", ...activeExpiry, [key[action]]: true },
    });
    if (publicShare) return current;

    current = current.parentId
      ? await db.folder.findFirst({ where: { id: current.parentId, companyId, deletedAt: null } })
      : null;
  }
  return null;
}

export async function listVisibleFolderIds(userId: string, role: string, companyId: string) {
  if (role === "COMPANY_ADMIN" || role === "SUPER_ADMIN") {
    const rows = await db.folder.findMany({ where: { companyId, deletedAt: null, OR: [{ isPersonal: false }, { isPersonal: true, ownerId: userId }] }, select: { id: true } });
    return rows.map((x) => x.id);
  }

  const allowPersonal = await personalFolderAllowed(userId);
  const folders = await db.folder.findMany({
    where: { companyId, deletedAt: null, OR: [{ isPersonal: false }, { isPersonal: true, ownerId: userId }] },
    select: { id: true, parentId: true, ownerId: true, isPersonal: true },
  });
  const allowed = new Set<string>();
  for (const f of folders) {
    if (f.isPersonal && f.ownerId === userId && allowPersonal) allowed.add(f.id);
    else if (!f.isPersonal && f.ownerId === userId) allowed.add(f.id);
  }

  const shared = await db.share.findMany({
    where: {
      companyId,
      folderId: { not: null },
      ...activeExpiry,
      canView: true,
      OR: [
        { recipientId: userId, type: "INTERNAL" },
        { type: "PUBLIC" },
      ],
    },
    select: { folderId: true },
  });
  for (const x of shared) if (x.folderId) allowed.add(x.folderId);

  let changed = true;
  while (changed) {
    changed = false;
    for (const f of folders) {
      if (f.parentId && allowed.has(f.parentId) && !allowed.has(f.id) && !f.isPersonal) {
        allowed.add(f.id);
        changed = true;
      }
    }
  }
  return [...allowed];
}
