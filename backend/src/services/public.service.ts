import { PrismaClient } from "@prisma/client";

import { env } from "../config/env";
import { db } from "../db";
import { AppError } from "../utils/errors";
import { hashToken, verifyPassword } from "../utils/security";
import {
  addonSchema,
  allPlans,
  calculatePrice,
  PRICES,
} from "./pricing";
import { getObject } from "./storage";

class PublicService {
  constructor(private readonly db: PrismaClient) {}

  private async ensureWorkspaceAvailable(companyId: string) {
    const subscription = await this.db.subscription.findUnique({
      where: { companyId },
      select: { status: true, expiresAt: true },
    });

    if (
      !subscription ||
      subscription.status === "SUSPENDED" ||
      subscription.status === "CANCELED" ||
      (subscription.expiresAt && subscription.expiresAt <= new Date())
    ) {
      throw new AppError(
        "This SecureFile workspace is currently unavailable.",
        402,
      );
    }
  }

  getHealth() {
    return {
      ok: true,
      service: "securefile-api",
      time: new Date().toISOString(),
    };
  }

  getPricing(monthsRaw: unknown) {
    const months = Math.max(1, Math.floor(Number(monthsRaw) || 1));

    return {
      currency: "USD",
      prices: PRICES,
      minimumUsers: 1,
      minimumStorageGb: 1,
      plans: allPlans(months),
    };
  }

  getQuote(body: {
    users?: unknown;
    storageGb?: unknown;
    months?: unknown;
    addons?: unknown;
  }) {
    return calculatePrice(
      Number(body.users),
      Number(body.storageGb),
      Number(body.months),
      addonSchema.parse(body.addons || {}),
    );
  }

  async unlockShare(token: string, password?: string) {
    const share = await this.db.share.findFirst({
      where: {
        publicTokenHash: hashToken(token),
        type: "PUBLIC",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { file: true, folder: true },
    });

    if (!share) {
      throw new AppError("Public share not found or expired", 404);
    }

    await this.ensureWorkspaceAvailable(share.companyId);

    if (
      share.passwordHash &&
      !(await verifyPassword(String(password || ""), share.passwordHash))
    ) {
      throw new AppError("Invalid share password", 403);
    }

    return {
      shareId: share.id,
      file: share.file
        ? {
            id: share.file.id,
            name: share.file.name,
            mimeType: share.file.mimeType,
          }
        : null,
      folder: share.folder
        ? { id: share.folder.id, name: share.folder.name }
        : null,
      permissions: {
        view: Boolean(share.canView),
        download: Boolean(share.canDownload),
        upload: Boolean(share.canUpload),
        edit: Boolean(share.canEdit),
        delete: Boolean(share.canDelete),
        share: Boolean(share.canShare),
      },
      downloadUrl: share.file && share.canDownload
        ? `${env.APP_URL}/api/public/shares/${token}/download`
        : null,
      contentUrl: share.file && share.canView
        ? `${env.APP_URL}/api/public/shares/${token}/content`
        : null,
      requiresLogin: Boolean(share.folderId),
      loginUrl: share.folderId ? `${env.APP_URL}/login?returnTo=/public-share/${encodeURIComponent(token)}` : null,
    };
  }

  async viewShare(token: string, passwordHeader?: string) {
    const share = await this.db.share.findFirst({
      where: {
        publicTokenHash: hashToken(token),
        type: "PUBLIC",
        canView: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { file: true },
    });

    if (!share?.file) throw new AppError("Public preview unavailable", 404);

    await this.ensureWorkspaceAvailable(share.file.companyId);

    if (share.passwordHash) {
      const password = String(passwordHeader || "");
      if (!(await verifyPassword(password, share.passwordHash))) {
        throw new AppError("Share password required", 403);
      }
    }

    const data = await getObject(share.file.storageKey);
    if (!data) throw new AppError("Stored file missing", 404);

    return {
      data,
      mimeType: share.file.mimeType || "application/octet-stream",
      fileName: share.file.name,
    };
  }

  async downloadShare(token: string, passwordHeader?: string) {
    const share = await this.db.share.findFirst({
      where: {
        publicTokenHash: hashToken(token),
        type: "PUBLIC",
        canDownload: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { file: true },
    });

    if (!share?.file) {
      throw new AppError("Public download unavailable", 404);
    }

    await this.ensureWorkspaceAvailable(share.file.companyId);

    if (share.passwordHash) {
      const password = String(passwordHeader || "");
      if (!(await verifyPassword(password, share.passwordHash))) {
        throw new AppError("Share password required", 403);
      }
    }

    const data = await getObject(share.file.storageKey);

    if (!data) {
      throw new AppError("Stored file missing", 404);
    }

    return {
      data,
      mimeType: share.file.mimeType || "application/octet-stream",
      fileName: share.file.name,
    };
  }
  async getAuthenticatedFolderShare(token: string, userId: string, role: string, companyId: string) {
    const share = await this.db.share.findFirst({
      where: {
        publicTokenHash: hashToken(token),
        type: "PUBLIC",
        folderId: { not: null },
        companyId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { folder: true },
    });

    if (!share?.folder) throw new AppError("Shared folder not found or expired", 404);
    if (!share.canView) throw new AppError("Folder viewing is not permitted for this share", 403);
    await this.ensureWorkspaceAvailable(companyId);


    return {
      shareId: share.id,
      folder: { id: share.folder.id, name: share.folder.name, parentId: share.folder.parentId },
      permissions: {
        view: Boolean(share.canView),
        download: Boolean(share.canDownload),
        upload: Boolean(share.canUpload),
        edit: Boolean(share.canEdit),
        delete: Boolean(share.canDelete),
        share: Boolean(share.canShare),
      },
      owner: { id: share.ownerId },
    };
  }

}

export const publicService = new PublicService(db);
