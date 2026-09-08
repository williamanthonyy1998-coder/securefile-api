import crypto from "node:crypto";
import { NotificationType, PrismaClient, Role } from "@prisma/client";

import { env } from "../config/env";
import { db } from "../db";
import { AppError } from "../utils/errors";
import { getFileAccess } from "./access";
import { requireAddon } from "./entitlements";
import {
  faxConfigured,
  provisionPhaxioNumber,
  sendPhaxioFax,
} from "./fax";
import { notify } from "./notify";
import { deleteObject, getObject, putObject } from "./storage";

export interface ProvisionFaxNumberInput {
  countryCode?: number;
  areaCode?: number;
}

export interface SendFaxInput {
  to?: string;
  fileId?: string;
  headerText?: string;
  uploadedFile?: {
    buffer: Buffer;
    originalname?: string;
    mimetype?: string;
  };
}

class FaxService {
  constructor(private readonly db: PrismaClient) {}

  private e164(value: string) {
    return /^\+[1-9]\d{7,14}$/.test(value.trim());
  }

  private callbackUrl() {
    if (!env.PHAXIO_CALLBACK_URL) return undefined;
    const base = env.PHAXIO_CALLBACK_URL.replace(/\/$/, "");
    // Prefer Phaxio's signed callback verification. The legacy query token is
    // kept only as a compatibility fallback for older deployments.
    if (env.PHAXIO_CALLBACK_TOKEN) return base;
    return env.FAX_WEBHOOK_SECRET
      ? `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(env.FAX_WEBHOOK_SECRET)}`
      : base;
  }

  private safeFaxFilename(value: string) {
    const cleaned = String(value || "SecureFile Fax.pdf")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .trim();
    return cleaned.slice(0, 180) || "SecureFile Fax.pdf";
  }

  private async assertFaxStorage(companyId: string, additional: number) {
    const c = await this.db.company.findUnique({
      where: { id: companyId },
      select: { storageLimitGb: true, storageUsedBytes: true },
    });
    if (!c) throw new AppError("Company not found", 404);
    const limit = BigInt(Math.floor(c.storageLimitGb * 1024 * 1024 * 1024));
    if (c.storageUsedBytes + BigInt(additional) > limit) {
      throw new AppError("Storage limit exceeded", 413);
    }
  }

  async getFaxDashboard(userId: string, companyId: string) {
    await requireAddon(companyId, "fax");

    const [line, jobs] = await Promise.all([
      this.db.faxLine.findUnique({ where: { userId } }),
      this.db.faxJob.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          file: {
            select: {
              id: true,
              name: true,
              mimeType: true,
              sizeBytes: true,
            },
          },
        },
      }),
    ]);

    return {
      configured: faxConfigured(),
      line,
      jobs: jobs.map((j) => ({
        ...j,
        file: j.file
          ? { ...j.file, sizeBytes: String(j.file.sizeBytes) }
          : null,
      })),
    };
  }

  async provisionNumber(
    userId: string,
    companyId: string,
    input: ProvisionFaxNumberInput,
  ) {
    await requireAddon(companyId, "fax");

    if (!faxConfigured()) {
      throw new AppError("Fax provider is not configured.", 503);
    }
    if (!env.PHAXIO_CALLBACK_URL) {
      throw new AppError(
        "PHAXIO_CALLBACK_URL must be configured before receiving faxes.",
        503,
      );
    }

    const existing = await this.db.faxLine.findUnique({ where: { userId } });
    if (existing?.active) {
      return { line: existing, created: false };
    }

    const countryCode = Number(input.countryCode ?? 1);
    const areaCode = Number(input.areaCode);

    if (!Number.isInteger(countryCode) || countryCode < 1 || countryCode > 999) {
      throw new AppError("Invalid country code.", 400);
    }
    if (!Number.isInteger(areaCode) || areaCode < 100 || areaCode > 999) {
      throw new AppError("Enter a valid area code.", 400);
    }

    const number: any = await provisionPhaxioNumber({
      countryCode,
      areaCode,
      callbackUrl: this.callbackUrl(),
    });
    const phoneNumber = String(
      number.phone_number || number.phoneNumber || "",
    ).trim();

    if (!this.e164(phoneNumber)) {
      throw new AppError(
        "Fax provider did not return a valid phone number.",
        502,
      );
    }

    const line = await this.db.faxLine.upsert({
      where: { userId },
      create: {
        companyId,
        userId,
        phoneNumber,
        provider: "PHAXIO",
        providerRef: phoneNumber,
        countryCode,
        areaCode,
        active: true,
      },
      update: {
        companyId,
        phoneNumber,
        provider: "PHAXIO",
        providerRef: phoneNumber,
        countryCode,
        areaCode,
        active: true,
      },
    });

    await notify(
      userId,
      "Your SecureFile fax number is ready",
      `Your personal fax number is ${phoneNumber}.`,
      companyId,
      undefined,
      true,
    );

    return { line, created: true };
  }

  async sendFax(
    userId: string,
    role: Role | string,
    companyId: string,
    input: SendFaxInput,
  ) {
    await requireAddon(companyId, "fax");

    if (!faxConfigured()) {
      throw new AppError("Fax provider is not configured.", 503);
    }

    const line = await this.db.faxLine.findUnique({ where: { userId } });
    if (!line?.active) {
      throw new AppError(
        "You do not have a personal fax number yet. Provision one first.",
        400,
      );
    }

    const to = String(input.to || "").trim();
    if (!this.e164(to)) {
      throw new AppError(
        "Recipient fax number must be in E.164 format, for example +14155551234.",
        400,
      );
    }

    let buffer: Buffer | undefined;
    let filename = "SecureFile Fax.pdf";
    let fileId: string | undefined;
    let uploadedMime = "application/pdf";

    if (input.fileId) {
      const f = await getFileAccess(
        userId,
        role,
        companyId,
        String(input.fileId),
        "view",
      );
      if (!f) {
        throw new AppError(
          "You do not have permission to fax this file.",
          403,
        );
      }
      const object = await getObject(f.storageKey);
      if (!object) {
        throw new AppError("Stored file is missing.", 404);
      }
      buffer = object;
      filename = f.name;
      fileId = f.id;
      uploadedMime = f.mimeType || "application/octet-stream";
    } else if (input.uploadedFile) {
      buffer = input.uploadedFile.buffer;
      filename = input.uploadedFile.originalname || filename;
      uploadedMime = input.uploadedFile.mimetype || uploadedMime;
      // Persist a private copy before sending so the fax history always has
      // the exact document that the user submitted, even if delivery later fails.
      await this.assertFaxStorage(companyId, buffer.length);
      const storageKey = `fax-out-${crypto.randomUUID()}`;
      await putObject(storageKey, buffer, uploadedMime);
      try {
        const saved = await this.db.file.create({
          data: {
            companyId,
            ownerId: userId,
            name: this.safeFaxFilename(filename),
            storageKey,
            mimeType: uploadedMime,
            sizeBytes: buffer.length,
            source: "FAX",
          },
        });
        fileId = saved.id;
        await this.db.company.update({
          where: { id: companyId },
          data: { storageUsedBytes: { increment: buffer.length } },
        });
      } catch (e) {
        try {
          await deleteObject(storageKey);
        } catch {
          /* ignore cleanup failure */
        }
        throw e;
      }
    } else {
      throw new AppError(
        "Choose a SecureFile document or upload a document to fax.",
        400,
      );
    }

    if (buffer.length > 20 * 1024 * 1024) {
      throw new AppError("Fax content must be 20 MB or smaller.", 413);
    }

    const job = await this.db.faxJob.create({
      data: {
        companyId,
        userId,
        direction: "OUTBOUND",
        status: "SENDING",
        recipientNumber: to,
        senderNumber: line.phoneNumber,
        fileId,
      },
    });

    try {
      const result: any = await sendPhaxioFax({
        to,
        buffer,
        filename,
        headerText:
          String(input.headerText || "").slice(0, 50) || undefined,
        callerId: line.phoneNumber,
        callbackUrl: this.callbackUrl(),
        tag: { securefile_job_id: job.id, user_id: userId },
      });
      const providerRef = String(result.id || result.fax_id || "").trim();
      const updated = await this.db.faxJob.update({
        where: { id: job.id },
        data: {
          status: "QUEUED",
          providerRef: providerRef || null,
          fileId: fileId || null,
        },
      });
      await notify(
        userId,
        "Fax queued",
        `Your fax to ${to} has been queued for delivery.`,
        companyId,
        NotificationType.FAX_SENT,
        true,
      );
      return updated;
    } catch (e: any) {
      await this.db.faxJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: e.message || "Fax provider error",
        },
      });
      await notify(
        userId,
        "Fax failed",
        e.message || `Unable to send fax to ${to}.`,
        companyId,
        NotificationType.FAX_FAILED,
        true,
      );
      throw e;
    }
  }
}

export const faxService = new FaxService(db);
