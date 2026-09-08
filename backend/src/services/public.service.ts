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
      downloadUrl: share.file
        ? `${env.APP_URL}/api/public/shares/${token}/download`
        : null,
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

    const subscription = await this.db.subscription.findUnique({
      where: { companyId: share.file.companyId },
      select: { status: true, expiresAt: true },
    });

    if (
      !subscription ||
      subscription.status === "SUSPENDED" ||
      subscription.status === "CANCELED" ||
      (subscription.expiresAt && subscription.expiresAt <= new Date())
    ) {
      throw new AppError(
        "This SecureFile workspace is currently suspended.",
        402,
      );
    }

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
}

export const publicService = new PublicService(db);
