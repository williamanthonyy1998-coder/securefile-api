import { Request, Response, NextFunction } from "express";

import { AuthedRequest } from "../middleware/auth";
import {
  integrationService,
  PhaxioWebhookRequest,
} from "../services/integration.service";
import { AppError } from "../utils/errors";

export async function inboundEmail(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await integrationService.handleInboundEmail({
      secretHeader: String(req.headers["x-inbound-email-secret"] || ""),
      to: req.body.to,
      from: req.body.from,
      subject: req.body.subject,
      text: req.body.text,
      body: req.body.body,
      html: req.body.html,
      recipientEmail: req.body.recipientEmail,
      senderEmail: req.body.senderEmail,
    });
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function faxInbound(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await integrationService.handleFaxInbound({
      webhookSecret: String(req.headers["x-fax-webhook-secret"] || ""),
      companyId: req.body.companyId,
      userId: req.body.userId,
      fromNumber: req.body.from_number,
      toNumber: req.body.to_number,
      providerId: req.body.id,
      numPages: req.body.num_pages,
      file: req.file,
    });
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function faxWebhook(
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  try {
    const webhookReq: PhaxioWebhookRequest = {
      headers: req.headers as Record<string, unknown>,
      query: req.query as Record<string, unknown>,
      body: req.body || {},
      file: req.file,
      protocol: req.protocol,
      host: String(req.get("host") || ""),
    };
    const result = await integrationService.handleFaxWebhook(webhookReq);
    if ("created" in result && result.created) {
      return res.status(201).json({
        ok: result.ok,
        jobId: result.jobId,
        fileId: result.fileId,
      });
    }
    return res.json(result);
  } catch (error: any) {
    if (error instanceof AppError) {
      return res.status(error.status).json({ error: error.message });
    }
    return res
      .status(500)
      .json({ error: error?.message || "Fax webhook processing failed" });
  }
}

export async function sendPostal(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }
    await integrationService.sendPostal(req.user.companyId);
  } catch (error) {
    next(error);
  }
}
