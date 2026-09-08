import { Router } from "express";
import multer from "multer";

import { env } from "../config/env";
import { auth } from "../middleware/auth";
import { activeSubscription } from "../middleware/subscription";
import {
  faxInbound,
  faxWebhook,
  inboundEmail,
  sendPostal,
} from "../controllers/integration.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
});

const router = Router();

/**
 * Provider-agnostic inbound email endpoint.
 * Configure your mail provider to POST received messages here with x-inbound-email-secret.
 * It stores the message in the recipient user's SecureFile mailbox.
 */
router.post("/email/inbound", inboundEmail);

/** Legacy/manual inbound endpoint. Production Phaxio callbacks should use /fax/webhook. */
router.post("/fax/inbound", upload.single("file"), faxInbound);

/**
 * Real Phaxio callback endpoint for both inbound and outbound fax events.
 * Phaxio sends multipart/form-data and includes the received PDF as `file` for inbound faxes.
 * The callback URL can contain ?token=<FAX_WEBHOOK_SECRET> for an additional shared-secret check.
 */
router.post("/fax/webhook", upload.single("file"), faxWebhook);

router.post("/postal/send", auth, activeSubscription, sendPostal);

export default router;
