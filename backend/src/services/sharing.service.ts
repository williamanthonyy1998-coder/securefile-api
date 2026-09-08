import { PrismaClient, Role } from "@prisma/client";

import { db } from "../db";
import { AppError } from "../utils/errors";
import { hashPassword, hashToken, randomToken } from "../utils/security";
import { getFileAccess, getFolderAccess } from "./access";
import { requireAddon } from "./entitlements";
import { notify, notifyCompanyAdmins } from "./notify";

const permissionKeys = [
  "canView",
  "canDownload",
  "canUpload",
  "canEdit",
  "canDelete",
  "canShare",
] as const;

export interface CreateShareInput {
  fileId?: string;
  folderId?: string;
  recipientId?: string;
  type?: string;
  permissions?: Record<string, unknown>;
  password?: string;
  expiresAt?: string | null;
}

export interface UpdateShareInput {
  canView?: boolean;
  canDownload?: boolean;
  canUpload?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canShare?: boolean;
  expiresAt?: string | null;
}

class SharingService {
  constructor(private readonly db: PrismaClient) {}

  private validType(t: string) {
    return t === "PUBLIC" || t === "INTERNAL" ? t : "INTERNAL";
  }

  private canManageShare(
    userId: string,
    role: Role | string,
    share: { ownerId: string; recipientId: string | null; canShare: boolean },
  ) {
    if (role === "COMPANY_ADMIN" || role === "SUPER_ADMIN") return true;
    if (share.ownerId === userId) return true;
    return Boolean(share.recipientId === userId && share.canShare);
  }

  async createShare(
    userId: string,
    role: Role | string,
    companyId: string,
    actorEmail: string | undefined,
    input: CreateShareInput,
  ) {
    const { fileId, folderId, recipientId, permissions = {}, password, expiresAt } =
      input;
    const type = this.validType(String(input.type || "INTERNAL"));

    if ((!fileId && !folderId) || (fileId && folderId)) {
      throw new AppError("Exactly one resource is required", 400);
    }

    const source = fileId
      ? await getFileAccess(userId, role, companyId, String(fileId), "share")
      : await getFolderAccess(
          userId,
          role,
          companyId,
          String(folderId),
          "share",
        );

    if (!source) {
      throw new AppError("Share permission denied", 403);
    }

    if (Boolean(permissions.share)) {
      await requireAddon(companyId, "reshare");
    }

    // Initial owner/admin sharing is part of the core workflow. The paid re-share
    // add-on is required only when a non-owner is sharing onward.
    const sourceOwnerId = (source as { ownerId?: string }).ownerId;
    if (
      role !== "COMPANY_ADMIN" &&
      role !== "SUPER_ADMIN" &&
      sourceOwnerId !== userId
    ) {
      await requireAddon(companyId, "reshare");
    }

    let recipient: { id: string } | null = null;
    if (type === "INTERNAL") {
      if (!recipientId) {
        throw new AppError("Recipient required", 400);
      }
      if (String(recipientId) === userId) {
        throw new AppError("You cannot share a resource with yourself", 400);
      }
      recipient = await this.db.user.findFirst({
        where: { id: String(recipientId), companyId, status: "ACTIVE" },
      });
      if (!recipient) {
        throw new AppError("Recipient not found or not active", 404);
      }
    }

    const rawPublic = type === "PUBLIC" ? randomToken() : null;
    const s = await this.db.share.create({
      data: {
        companyId,
        fileId: fileId ? String(fileId) : undefined,
        folderId: folderId ? String(folderId) : undefined,
        ownerId: userId,
        recipientId: type === "INTERNAL" ? String(recipientId) : undefined,
        type,
        publicTokenHash: rawPublic ? hashToken(rawPublic) : undefined,
        canView: permissions.view !== false,
        canDownload: Boolean(permissions.download),
        canUpload: Boolean(permissions.upload),
        canEdit: Boolean(permissions.edit),
        canDelete: Boolean(permissions.delete),
        canShare: Boolean(permissions.share),
        passwordHash: password ? await hashPassword(String(password)) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
    });

    if (recipient) {
      const resourceName = fileId
        ? (
            await this.db.file.findUnique({
              where: { id: String(fileId) },
              select: { name: true },
            })
          )?.name
        : (
            await this.db.folder.findUnique({
              where: { id: String(folderId) },
              select: { name: true },
            })
          )?.name;
      const sharer = await this.db.user.findUnique({
        where: { id: userId },
        select: { uniqueName: true, email: true },
      });
      await notify(
        recipient.id,
        "Resource shared with you",
        `${resourceName || "A resource"} was shared with you by ${sharer?.uniqueName || sharer?.email || "a SecureFile user"}.`,
        companyId,
        undefined,
        true,
      );
    }

    await notifyCompanyAdmins(
      companyId,
      "Resource shared",
      `${fileId ? "A file" : "A folder"} was shared by ${actorEmail || "a user"}.`,
      "FILE_SHARED",
      { excludeUserId: userId, entityId: s.id },
    );

    return { ...s, publicToken: rawPublic };
  }

  async listShares(userId: string, role: Role | string, companyId: string) {
    const shares = await this.db.share.findMany({
      where: {
        companyId,
        OR: [{ ownerId: userId }, { recipientId: userId }],
      },
      include: {
        file: { select: { id: true, name: true } },
        folder: { select: { id: true, name: true } },
        recipient: { select: { id: true, email: true, uniqueName: true } },
        owner: { select: { id: true, email: true, uniqueName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return shares.map((s) => ({
      ...s,
      manageable:
        s.ownerId === userId ||
        role === "COMPANY_ADMIN" ||
        role === "SUPER_ADMIN" ||
        (s.recipientId === userId && s.canShare),
    }));
  }

  async updateShare(
    shareId: string,
    userId: string,
    role: Role | string,
    companyId: string,
    input: UpdateShareInput,
  ) {
    const s = await this.db.share.findFirst({
      where: { id: shareId, companyId },
    });

    if (!s || !this.canManageShare(userId, role, s)) {
      throw new AppError(
        "You do not have permission to manage this share",
        403,
      );
    }

    const data: Record<string, unknown> = {};
    for (const key of permissionKeys) {
      if (input[key] !== undefined) data[key] = Boolean(input[key]);
    }
    if (data.canShare === true) {
      await requireAddon(s.companyId, "reshare");
    }
    if (input.expiresAt === null) data.expiresAt = null;
    else if (input.expiresAt) data.expiresAt = new Date(input.expiresAt);

    const updated = await this.db.share.update({ where: { id: s.id }, data });

    if (s.recipientId) {
      await notify(
        s.recipientId,
        "Share permissions updated",
        "The permissions for a shared resource were updated.",
        s.companyId,
        "FILE_SHARED",
        true,
        { entityId: s.id },
      );
    }

    return updated;
  }

  async revokeShare(
    shareId: string,
    userId: string,
    role: Role | string,
    companyId: string,
  ) {
    const s = await this.db.share.findFirst({
      where: { id: shareId, companyId },
    });

    if (!s || !this.canManageShare(userId, role, s)) {
      throw new AppError(
        "You do not have permission to revoke this share",
        403,
      );
    }

    await this.db.share.delete({ where: { id: s.id } });

    if (s.recipientId) {
      await notify(
        s.recipientId,
        "Share revoked",
        "A shared resource is no longer available to you.",
        s.companyId,
        "FILE_SHARED",
        true,
        { entityId: s.id },
      );
    }
  }
}

export const sharingService = new SharingService(db);
