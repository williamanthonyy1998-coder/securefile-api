import { PrismaClient } from "@prisma/client";

import { db } from "../db";
import { AppError } from "../utils/errors";
import { audit } from "./audit";
import { notifyCompanyAdmins } from "./notify";
import { deleteObject } from "./storage";

class TrashService {
  constructor(private readonly db: PrismaClient) {}

  async listTrash(userId: string, role: string, companyId: string) {
    const whereUser = role === "COMPANY_ADMIN" ? {} : { ownerId: userId };

    const [files, folders] = await Promise.all([
      this.db.file.findMany({
        where: { companyId, deletedAt: { not: null }, ...whereUser },
        orderBy: { deletedAt: "desc" },
        take: 200,
        select: {
          id: true,
          name: true,
          sizeBytes: true,
          mimeType: true,
          deletedAt: true,
          ownerId: true,
          folderId: true,
        },
      }),
      this.db.folder.findMany({
        where: { companyId, deletedAt: { not: null }, ...whereUser },
        orderBy: { deletedAt: "desc" },
        take: 200,
        select: {
          id: true,
          name: true,
          isPersonal: true,
          deletedAt: true,
          ownerId: true,
          parentId: true,
        },
      }),
    ]);

    return {
      files: files.map((f) => ({
        ...f,
        type: "FILE" as const,
        sizeBytes: String(f.sizeBytes),
      })),
      folders: folders.map((f) => ({
        ...f,
        type: "FOLDER" as const,
      })),
    };
  }

  private async descendantFolderIds(companyId: string, rootId: string) {
    const folders = await this.db.folder.findMany({
      where: { companyId, deletedAt: { not: null } },
      select: { id: true, parentId: true },
    });

    const ids = new Set([rootId]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const folder of folders) {
        if (
          folder.parentId &&
          ids.has(folder.parentId) &&
          !ids.has(folder.id)
        ) {
          ids.add(folder.id);
          changed = true;
        }
      }
    }

    return [...ids];
  }

  private assertOwnerOrAdmin(
    role: string,
    ownerId: string | null,
    userId: string,
    action: string,
  ) {
    if (role !== "COMPANY_ADMIN" && ownerId !== userId) {
      throw new AppError(
        `Only the owner or Company Admin can ${action}`,
        403,
      );
    }
  }

  async restoreItem(
    type: string,
    id: string,
    userId: string,
    role: string,
    companyId: string,
    actorEmail?: string,
  ) {
    const normalized = type.toUpperCase();

    if (normalized === "FILE") {
      const file = await this.db.file.findFirst({
        where: { id, companyId, deletedAt: { not: null } },
      });

      if (!file) {
        throw new AppError("Deleted file not found", 404);
      }

      this.assertOwnerOrAdmin(role, file.ownerId, userId, "restore this file");

      const parent = file.folderId
        ? await this.db.folder.findFirst({
            where: { id: file.folderId, companyId },
            select: { deletedAt: true },
          })
        : null;

      await this.db.file.update({
        where: { id },
        data: {
          deletedAt: null,
          folderId: parent?.deletedAt ? null : file.folderId,
        },
      });

      await audit(companyId, userId, "RESTORE", "FILE", id);
      await notifyCompanyAdmins(
        companyId,
        "File restored",
        `${file.name} was restored from Trash by ${actorEmail || "a user"}.`,
        "FILE_UPDATED",
        { excludeUserId: userId, entityId: id },
      );

      return { ok: true };
    }

    if (normalized === "FOLDER") {
      const folder = await this.db.folder.findFirst({
        where: { id, companyId, deletedAt: { not: null } },
      });

      if (!folder) {
        throw new AppError("Deleted folder not found", 404);
      }

      this.assertOwnerOrAdmin(
        role,
        folder.ownerId,
        userId,
        "restore this folder",
      );

      const ids = await this.descendantFolderIds(companyId, id);

      await this.db.$transaction([
        this.db.folder.updateMany({
          where: { id: { in: ids } },
          data: { deletedAt: null },
        }),
        this.db.file.updateMany({
          where: {
            companyId,
            folderId: { in: ids },
            deletedAt: { not: null },
          },
          data: { deletedAt: null },
        }),
      ]);

      await audit(companyId, userId, "RESTORE", "FOLDER", id);
      await notifyCompanyAdmins(
        companyId,
        "Folder restored",
        `${folder.name} was restored from Trash by ${actorEmail || "a user"}.`,
        "FILE_UPDATED",
        { excludeUserId: userId, entityId: id },
      );

      return { ok: true };
    }

    throw new AppError("Invalid trash item type", 400);
  }

  async permanentlyDeleteItem(
    type: string,
    id: string,
    userId: string,
    role: string,
    companyId: string,
    actorEmail?: string,
  ) {
    const normalized = type.toUpperCase();

    if (normalized === "FILE") {
      const file = await this.db.file.findFirst({
        where: { id, companyId, deletedAt: { not: null } },
      });

      if (!file) {
        throw new AppError("Deleted file not found", 404);
      }

      this.assertOwnerOrAdmin(
        role,
        file.ownerId,
        userId,
        "permanently delete this file",
      );

      await deleteObject(file.storageKey).catch(() => {});
      await this.db.file.delete({ where: { id } });
      await this.db.company.update({
        where: { id: companyId },
        data: { storageUsedBytes: { decrement: file.sizeBytes } },
      });
      await notifyCompanyAdmins(
        companyId,
        "File permanently deleted",
        `${file.name} was permanently deleted by ${actorEmail || "a user"}.`,
        "FILE_DELETED",
        { excludeUserId: userId, entityId: id },
      );

      return;
    }

    if (normalized === "FOLDER") {
      const folder = await this.db.folder.findFirst({
        where: { id, companyId, deletedAt: { not: null } },
      });

      if (!folder) {
        throw new AppError("Deleted folder not found", 404);
      }

      this.assertOwnerOrAdmin(
        role,
        folder.ownerId,
        userId,
        "permanently delete this folder",
      );

      const ids = await this.descendantFolderIds(companyId, id);
      const files = await this.db.file.findMany({
        where: {
          companyId,
          folderId: { in: ids },
          deletedAt: { not: null },
        },
        select: { id: true, storageKey: true, sizeBytes: true },
      });

      for (const file of files) {
        await deleteObject(file.storageKey).catch(() => {});
      }

      await this.db.$transaction(async (tx) => {
        if (files.length) {
          await tx.file.deleteMany({
            where: { id: { in: files.map((x) => x.id) } },
          });
        }
        await tx.folder.deleteMany({ where: { id: { in: ids } } });
      });

      const total = files.reduce((n, x) => n + x.sizeBytes, 0n);
      await this.db.company.update({
        where: { id: companyId },
        data: { storageUsedBytes: { decrement: total } },
      });
      await notifyCompanyAdmins(
        companyId,
        "Folder permanently deleted",
        `${folder.name} was permanently deleted by ${actorEmail || "a user"}.`,
        "FILE_DELETED",
        { excludeUserId: userId, entityId: id },
      );

      return;
    }

    throw new AppError("Invalid trash item type", 400);
  }
}

export const trashService = new TrashService(db);
