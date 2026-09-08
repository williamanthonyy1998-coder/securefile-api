import crypto from "node:crypto";
import { NotificationType, PrismaClient } from "@prisma/client";

import { env } from "../config/env";
import { db } from "../db";
import { AppError } from "../utils/errors";
import { safeFilename } from "../utils/security";
import { requireAddon } from "./entitlements";
import { getPhaxioFaxFile } from "./fax";
import { notify } from "./notify";
import { deleteObject, putObject } from "./storage";

export type InboundEmailInput = {
  secretHeader?: string;
  to?: unknown;
  from?: unknown;
  subject?: unknown;
  text?: unknown;
  body?: unknown;
  html?: unknown;
  recipientEmail?: unknown;
  senderEmail?: unknown;
};

export type FaxInboundInput = {
  webhookSecret?: string;
  companyId?: unknown;
  userId?: unknown;
  fromNumber?: unknown;
  toNumber?: unknown;
  providerId?: unknown;
  numPages?: unknown;
  file?: Express.Multer.File;
};

export type PhaxioWebhookRequest = {
  headers: Record<string, unknown>;
  query: Record<string, unknown>;
  body: Record<string, any>;
  file?: Express.Multer.File;
  protocol: string;
  host: string;
};

function parseProviderObject(value: any) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value)) || {};
  } catch {
    return {};
  }
}

class IntegrationService {
  constructor(private readonly db: PrismaClient) {}

  private phaxioCallbackValid(req: PhaxioWebhookRequest): boolean {
    const signature = String(req.headers["x-phaxio-signature"] || "").trim();
    const token = env.PHAXIO_CALLBACK_TOKEN || env.FAX_WEBHOOK_SECRET;
    if (!token) return false;
    if (!signature) return false;
    const callbackUrl = String(
      env.PHAXIO_CALLBACK_URL ||
        `${req.protocol}://${req.host}/api/integrations/fax/webhook`,
    );
    const params: any = { ...req.body };
    const fileParts: any = {};
    if (req.file) fileParts[req.file.fieldname] = req.file;
    const names = Object.keys(params).sort();
    let base = callbackUrl;
    for (const name of names) base += name + String(params[name]);
    for (const name of Object.keys(fileParts).sort()) {
      const f = fileParts[name];
      base += name + crypto.createHash("sha1").update(f.buffer).digest("hex");
    }
    const expected = crypto.createHmac("sha1", token).update(base).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  async handleInboundEmail(input: InboundEmailInput) {
    const secret = env.INBOUND_EMAIL_SECRET;
    if (!secret || input.secretHeader !== secret) {
      throw new AppError("Invalid inbound email webhook secret", 401);
    }

    const to = String(input.to || input.recipientEmail || "")
      .trim()
      .toLowerCase();
    const from = String(input.from || input.senderEmail || "")
      .trim()
      .toLowerCase();
    const subject = String(input.subject || "(No subject)")
      .trim()
      .slice(0, 180);
    const body = String(input.text || input.body || input.html || "")
      .trim()
      .slice(0, 50000);

    if (
      !to ||
      !from ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)
    ) {
      throw new AppError("Valid from and to email addresses are required", 400);
    }

    const recipient = await this.db.user.findUnique({
      where: { email: to },
      select: { id: true, companyId: true, email: true },
    });
    if (!recipient?.companyId) {
      throw new AppError("SecureFile recipient mailbox not found", 404);
    }

    const sender = await this.db.user.findFirst({
      where: { companyId: recipient.companyId, email: from },
      select: { id: true },
    });
    const id = crypto.randomUUID();
    await this.db.$executeRaw`
      INSERT INTO "EmailMessage" ("id","companyId","senderId","recipientId","recipientEmail","subject","body","direction","createdAt")
      VALUES (${id},${recipient.companyId},${sender?.id || null},${recipient.id},${recipient.email},${subject},${body},'RECEIVED',NOW())`;
    await notify(recipient.id, "New email", subject, recipient.companyId);
    return { ok: true, id };
  }

  async handleFaxInbound(input: FaxInboundInput) {
    if (
      !env.FAX_WEBHOOK_SECRET ||
      input.webhookSecret !== env.FAX_WEBHOOK_SECRET
    ) {
      throw new AppError("Invalid fax webhook", 401);
    }

    const companyId = String(input.companyId || "");
    const userId = String(input.userId || "");
    const user = await this.db.user.findFirst({
      where: { id: userId, companyId },
    });
    if (!user || !input.file) {
      throw new AppError("Valid user and fax file required", 400);
    }

    const sub = await this.db.subscription.findUnique({
      where: { companyId },
      select: { addons: true, status: true },
    });
    if (sub?.status !== "ACTIVE" || !(sub.addons as any)?.fax) {
      throw new AppError("Fax add-on is not active", 402);
    }

    const key = `fax-${crypto.randomUUID()}`;
    await putObject(
      key,
      input.file.buffer,
      input.file.mimetype || "application/pdf",
    );
    const f = await this.db.file.create({
      data: {
        companyId,
        ownerId: userId,
        name: safeFilename(input.file.originalname || "Incoming Fax.pdf"),
        storageKey: key,
        mimeType: input.file.mimetype || "application/pdf",
        sizeBytes: input.file.size,
        source: "FAX",
      },
    });
    await this.db.company.update({
      where: { id: companyId },
      data: { storageUsedBytes: { increment: input.file.size } },
    });
    await this.db.faxJob.create({
      data: {
        companyId,
        userId,
        direction: "INBOUND",
        status: "RECEIVED",
        senderNumber: String(input.fromNumber || ""),
        recipientNumber: String(input.toNumber || ""),
        fileId: f.id,
        provider: "PHAXIO",
        providerRef: input.providerId ? String(input.providerId) : null,
        pages: input.numPages ? Number(input.numPages) : null,
      },
    });
    await notify(
      userId,
      "New fax received",
      `A new fax was received on your personal fax number.`,
      companyId,
      NotificationType.FAX_RECEIVED,
      true,
    );
    return { id: f.id };
  }

  async handleFaxWebhook(req: PhaxioWebhookRequest) {
    const legacyToken = env.FAX_WEBHOOK_SECRET;
    const signed = this.phaxioCallbackValid(req);
    const legacy = Boolean(legacyToken && req.query.token === legacyToken);
    if (!signed && !legacy) {
      throw new AppError("Invalid fax webhook signature", 401);
    }

    const providerFax = parseProviderObject(req.body.fax);
    const eventType = String(req.body.event_type || "").toLowerCase();
    const direction = String(
      req.body.direction || providerFax.direction || "",
    ).toLowerCase();
    const faxId = String(
      req.body.id || req.body.fax_id || providerFax.id || "",
    ).trim();
    const status = String(req.body.status || providerFax.status || "").toLowerCase();
    const successRaw = req.body.success;
    const recipientStatus = Array.isArray(providerFax.recipients)
      ? String(providerFax.recipients[0]?.status || "").toLowerCase()
      : "";
    const success =
      successRaw === true ||
      String(successRaw || "").toLowerCase() === "true" ||
      status === "success" ||
      recipientStatus === "success";

    if (direction === "received" || req.file) {
      const toNumber = String(
        req.body.to_number ||
          providerFax.to_number ||
          providerFax.recipient_phone_number ||
          "",
      ).trim();
      const line = await this.db.faxLine.findUnique({
        where: { phoneNumber: toNumber },
      });
      if (!line?.active) {
        throw new AppError(
          "Receiving fax number is not assigned to a SecureFile user",
          404,
        );
      }

      const sub = await this.db.subscription.findUnique({
        where: { companyId: line.companyId },
        select: { addons: true, status: true },
      });
      if (sub?.status !== "ACTIVE" || !(sub.addons as any)?.fax) {
        throw new AppError("Fax add-on is not active", 402);
      }

      if (faxId) {
        const existing = await this.db.faxJob.findFirst({
          where: {
            provider: "PHAXIO",
            providerRef: faxId,
            direction: "INBOUND",
          },
        });
        if (existing) {
          return { ok: true, duplicate: true, jobId: existing.id };
        }
      }

      let buffer = req.file?.buffer;
      if (!buffer && faxId) buffer = await getPhaxioFaxFile(faxId);
      if (!buffer) {
        throw new AppError(
          "Received fax PDF was not provided by the fax provider",
          400,
        );
      }

      const name = safeFilename(
        String(
          req.file?.originalname ||
            `Incoming Fax ${new Date().toISOString().slice(0, 10)}.pdf`,
        ),
      );
      const key = `fax-${crypto.randomUUID()}`;
      await putObject(key, buffer, "application/pdf");
      try {
        const f = await this.db.file.create({
          data: {
            companyId: line.companyId,
            ownerId: line.userId,
            name,
            storageKey: key,
            mimeType: "application/pdf",
            sizeBytes: buffer.length,
            source: "FAX",
          },
        });
        await this.db.company.update({
          where: { id: line.companyId },
          data: { storageUsedBytes: { increment: buffer.length } },
        });
        const job = await this.db.faxJob.create({
          data: {
            companyId: line.companyId,
            userId: line.userId,
            direction: "INBOUND",
            status: "RECEIVED",
            senderNumber:
              String(
                req.body.from_number || providerFax.from_number || "",
              ).trim() || null,
            recipientNumber: toNumber || null,
            fileId: f.id,
            provider: "PHAXIO",
            providerRef: faxId || null,
            pages: req.body.num_pages
              ? Number(req.body.num_pages)
              : providerFax.num_pages
                ? Number(providerFax.num_pages)
                : null,
          },
        });
        await notify(
          line.userId,
          "New fax received",
          `${name} was received on your personal fax number.`,
          line.companyId,
          NotificationType.FAX_RECEIVED,
          true,
        );
        return { ok: true, jobId: job.id, fileId: f.id, created: true as const };
      } catch (e) {
        await deleteObject(key);
        throw e;
      }
    }

    let job = faxId
      ? await this.db.faxJob.findFirst({
          where: {
            provider: "PHAXIO",
            providerRef: faxId,
            direction: "OUTBOUND",
          },
        })
      : null;
    const tagJobId = String(
      req.body["tag[securefile_job_id]"] || req.body.securefile_job_id || "",
    ).trim();
    if (!job && tagJobId) {
      job = await this.db.faxJob.findFirst({
        where: { id: tagJobId, direction: "OUTBOUND" },
      });
    }
    if (!job) return { ok: true, ignored: true };

    const failed =
      ["failure", "failed", "error", "error_state"].includes(status) ||
      ["failure", "failed", "error"].includes(recipientStatus) ||
      (eventType === "fax_completed" && !success);
    const updated = await this.db.faxJob.update({
      where: { id: job.id },
      data: {
        status: failed ? "FAILED" : "SENT",
        errorMessage: failed
          ? String(
              req.body.error_message ||
                providerFax.error_message ||
                req.body.error_type ||
                providerFax.error_type ||
                "Fax transmission failed",
            ).slice(0, 500)
          : null,
        pages: req.body.num_pages ? Number(req.body.num_pages) : job.pages,
      },
    });
    await notify(
      job.userId,
      failed ? "Fax delivery failed" : "Fax delivered",
      failed
        ? `Your fax to ${job.recipientNumber || "the recipient"} could not be delivered.`
        : `Your fax to ${job.recipientNumber || "the recipient"} was delivered successfully.`,
      job.companyId,
      failed ? NotificationType.FAX_FAILED : NotificationType.FAX_SENT,
      true,
    );
    return { ok: true, jobId: updated.id, status: updated.status };
  }

  async sendPostal(companyId: string) {
    await requireAddon(companyId, "postal");
    if (!env.POSTAL_API_KEY || !env.POSTAL_API_URL) {
      throw new AppError("Postal provider is not configured", 503);
    }
    throw new AppError(
      "Postal provider adapter is configured but requires provider-specific payload mapping.",
      501,
    );
  }
}

export const integrationService = new IntegrationService(db);
