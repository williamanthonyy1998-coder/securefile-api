import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { db } from "../db";
import { AppError } from "../utils/errors";
import {
  emailConfigured,
  emailTemplate,
  sendEmail,
} from "./email";
import { notify } from "./notify";

export interface SendWorkspaceEmailInput {
  recipientId?: string;
  recipientEmail?: string;
  subject?: string;
  body?: string;
}

class WorkspaceMailService {
  constructor(private readonly db: PrismaClient) {}

  getEmailStatus() {
    return {
      configured: emailConfigured(),
      provider: process.env.EMAIL_PROVIDER || "console",
    };
  }

  async listEmails(userId: string, email: string, companyId: string, box?: string) {
    const mailbox = String(box || "inbox");

    const rows: Array<{
      id: string;
      companyId: string;
      senderId: string | null;
      recipientId: string | null;
      recipientEmail: string | null;
      subject: string;
      body: string;
      direction: string;
      createdAt: Date;
      senderUniqueName: string | null;
      senderEmail: string | null;
      recipientUniqueName: string | null;
      recipientUserEmail: string | null;
    }> = await this.db.$queryRaw`
      SELECT e.id,e."companyId",e."senderId",e."recipientId",e."recipientEmail",e.subject,e.body,e.direction,e."createdAt",
             su."uniqueName" AS "senderUniqueName",su.email AS "senderEmail",
             ru."uniqueName" AS "recipientUniqueName",ru.email AS "recipientUserEmail"
      FROM "EmailMessage" e
      LEFT JOIN "User" su ON su.id=e."senderId"
      LEFT JOIN "User" ru ON ru.id=e."recipientId"
      WHERE e."companyId"=${companyId}
        AND (${mailbox}='sent' AND e."senderId"=${userId} OR ${mailbox}<>'sent' AND (e."recipientId"=${userId} OR lower(e."recipientEmail")=lower(${email})))
      ORDER BY e."createdAt" DESC LIMIT 200`;

    return rows.map((x) => ({
      ...x,
      sender: x.senderId
        ? {
            id: x.senderId,
            uniqueName: x.senderUniqueName,
            email: x.senderEmail,
          }
        : null,
      recipient: x.recipientId
        ? {
            id: x.recipientId,
            uniqueName: x.recipientUniqueName,
            email: x.recipientUserEmail,
          }
        : null,
    }));
  }

  async sendEmail(
    userId: string,
    companyId: string,
    input: SendWorkspaceEmailInput,
  ) {
    const recipientId = input.recipientId ? String(input.recipientId) : "";
    const directEmail = String(input.recipientEmail || "")
      .trim()
      .toLowerCase();
    const subject = String(input.subject || "")
      .trim()
      .slice(0, 180);
    const body = String(input.body || "")
      .trim()
      .slice(0, 20000);

    if (!subject || !body || (!recipientId && !directEmail)) {
      throw new AppError("Recipient, subject and message are required", 400);
    }

    if (directEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(directEmail)) {
      throw new AppError("Enter a valid recipient email address", 400);
    }

    let recipient: {
      id: string;
      email: string;
      uniqueName: string | null;
    } | null = null;

    if (recipientId) {
      recipient = await this.db.user.findFirst({
        where: { id: recipientId, companyId },
        select: { id: true, email: true, uniqueName: true },
      });

      if (!recipient) {
        throw new AppError("Recipient not found", 404);
      }
    }

    const to = (recipient?.email || directEmail).toLowerCase();
    const safeBody = body
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");
    const html = emailTemplate(
      subject,
      `<p style="white-space:pre-wrap;line-height:1.7">${safeBody}</p>`,
    );

    const delivery = await sendEmail(to, subject, html);
    const id = crypto.randomUUID();

    const created: Array<{
      id: string;
      companyId: string;
      senderId: string;
      recipientId: string | null;
      recipientEmail: string;
      subject: string;
      body: string;
      direction: string;
      createdAt: Date;
    }> = await this.db.$queryRaw`
      INSERT INTO "EmailMessage" ("id","companyId","senderId","recipientId","recipientEmail","subject","body","direction","createdAt")
      VALUES (${id},${companyId},${userId},${recipient?.id || null},${to},${subject},${body},'SENT',NOW())
      RETURNING "id","companyId","senderId","recipientId","recipientEmail","subject","body","direction","createdAt"`;

    if (recipient) {
      await notify(recipient.id, "New email", subject, companyId);
    }

    if (recipient?.id) {
      await notify(
        recipient.id,
        "New email",
        subject,
        companyId,
        "MESSAGE_RECEIVED",
        false,
        { entityId: created[0]?.id },
      );
    }

    return {
      ok: true,
      mail: created[0],
      recipient: { email: to },
      delivery,
    };
  }
}

export const workspaceMailService = new WorkspaceMailService(db);
