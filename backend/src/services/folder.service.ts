import { PrismaClient } from "@prisma/client";

import { db } from "../db";
import { AppError } from "../utils/errors";
import { safeFilename } from "../utils/security";
import { getFolderAccess, listVisibleFolderIds } from "./access";
import { notifyCompanyAdmins } from "./notify";

class FolderService {
  constructor(private readonly db: PrismaClient) {}

  async listFolders(userId: string, role: string, companyId: string) {
    const ids = await listVisibleFolderIds(userId, role, companyId);

    return this.db.folder.findMany({
      where: { companyId, deletedAt: null, id: { in: ids } },
      select: {
        id: true,
        companyId: true,
        ownerId: true,
        parentId: true,
        name: true,
        isPersonal: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ isPersonal: "desc" }, { name: "asc" }],
    });
  }

  async createFolder(
    userId: string,
    role: string,
    companyId: string,
    actorEmail: string | undefined,
    input: { name?: string; parentId?: string },
  ) {
    const name = safeFilename(String(input.name || "New Folder"));
    const parentId = input.parentId || undefined;

    if (
      parentId &&
      !(await getFolderAccess(userId, role, companyId, parentId, "upload"))
    ) {
      throw new AppError("Folder permission denied", 403);
    }

    const created = await this.db.folder.create({
      data: {
        companyId,
        ownerId: userId,
        parentId,
        name,
        isPersonal: false,
      },
    });

    await notifyCompanyAdmins(
      companyId,
      "Folder created",
      `${name} was created by ${actorEmail || "a user"}.`,
      "SYSTEM",
      { excludeUserId: userId, entityId: created.id },
    );

    return created;
  }

  async updateFolder(
    folderId: string,
    userId: string,
    role: string,
    companyId: string,
    actorEmail: string | undefined,
    input: { name?: string; parentId?: string | null },
  ) {
    const folder = await getFolderAccess(
      userId,
      role,
      companyId,
      folderId,
      "edit",
    );

    if (!folder) {
      throw new AppError("Edit permission denied", 403);
    }

    if (folder.isPersonal) {
      throw new AppError("Personal folders cannot be renamed or moved", 403);
    }

    const parentId =
      input.parentId === null ? null : input.parentId || folder.parentId;

    if (parentId === folder.id) {
      throw new AppError("Folder cannot contain itself", 400);
    }

    if (parentId) {
      const parent = await this.db.folder.findFirst({
        where: { id: parentId, companyId: folder.companyId, deletedAt: null },
      });

      if (!parent) {
        throw new AppError("Destination folder not found", 404);
      }

      let cursor: { id: string; parentId: string | null } | null = parent;

      while (cursor) {
        if (cursor.id === folder.id) {
          throw new AppError(
            "A folder cannot be moved inside itself or one of its descendants",
            400,
          );
        }

        cursor = cursor.parentId
          ? await this.db.folder.findFirst({
              where: {
                id: cursor.parentId,
                companyId: folder.companyId,
                deletedAt: null,
              },
              select: { id: true, parentId: true },
            })
          : null;
      }

      if (
        !(await getFolderAccess(userId, role, companyId, parentId, "upload"))
      ) {
        throw new AppError("Destination folder permission denied", 403);
      }
    }

    const updated = await this.db.folder.update({
      where: { id: folder.id },
      data: {
        name: input.name ? safeFilename(String(input.name)) : folder.name,
        parentId,
      },
    });

    await notifyCompanyAdmins(
      folder.companyId,
      "Folder updated",
      `${folder.name} was renamed or moved by ${actorEmail || "a user"}.`,
      "SYSTEM",
      { excludeUserId: userId, entityId: folder.id },
    );

    return updated;
  }

  async softDeleteFolder(
    folderId: string,
    userId: string,
    role: string,
    companyId: string,
    actorEmail: string | undefined,
  ) {
    const folder = await getFolderAccess(
      userId,
      role,
      companyId,
      folderId,
      "delete",
    );

    if (!folder) {
      throw new AppError("Delete permission denied", 403);
    }

    if (folder.isPersonal) {
      throw new AppError("Personal folders cannot be deleted", 403);
    }

    const now = new Date();
    const descendants = await this.db.folder.findMany({
      where: { companyId: folder.companyId, deletedAt: null },
      select: { id: true, parentId: true },
    });

    const ids = new Set<string>([folder.id]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const descendant of descendants) {
        if (
          descendant.parentId &&
          ids.has(descendant.parentId) &&
          !ids.has(descendant.id)
        ) {
          ids.add(descendant.id);
          changed = true;
        }
      }
    }

    await this.db.$transaction([
      this.db.folder.updateMany({
        where: { id: { in: [...ids] } },
        data: { deletedAt: now },
      }),
      this.db.file.updateMany({
        where: {
          companyId: folder.companyId,
          folderId: { in: [...ids] },
          deletedAt: null,
        },
        data: { deletedAt: now },
      }),
    ]);

    await notifyCompanyAdmins(
      folder.companyId,
      "Folder moved to trash",
      `${folder.name} and its contents were moved to Trash by ${actorEmail || "a user"}.`,
      "FILE_DELETED",
      { excludeUserId: userId, entityId: folder.id },
    );
  }
}

export const folderService = new FolderService(db);
