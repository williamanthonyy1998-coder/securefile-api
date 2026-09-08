import { Router } from "express";
import rateLimit from "express-rate-limit";

import { env } from "../config/env";
import { realtimeEvents } from "../services/realtime";
import { subscriptionSweep } from "../services/subscriptionWorker";
import { emailConfigured } from "../services/email";
import { faxConfigured } from "../services/fax";
import { remoteStorageConfigured } from "../services/storage";

import auth from "./auth";
import companies from "./companies";
import users from "./users";
import files from "./files";
import folders from "./folders";
import sharing from "./sharing";
import workspace from "./workspace";
import subscriptions from "./subscriptions";
import superAdmin from "./superAdmin";
import publicRoutes from "./public";
import search from "./search";
import integrations from "./integrations";
import trash from "./trash";
import cron from "./cron";
import fax from "./fax";
import conversations from "./conversations";
import messages from "./messages";

const router = Router();

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use("/auth", authRateLimit, auth);
router.use("/public", publicRoutes);
router.use("/search", search);
router.use("/companies", companies);
router.use("/conversations", conversations);
router.use("/messages", messages);
router.use("/users", users);
router.use("/files", files);
router.use("/folders", folders);
router.use("/sharing", sharing);
router.use("/workspace", workspace);
router.use("/subscriptions", subscriptions);
router.use("/super-admin", superAdmin);
router.use("/integrations", integrations);
router.use("/trash", trash);
router.use("/workspace/trash", trash);
router.use("/cron", cron);
router.use("/fax", fax);

router.get("/realtime", realtimeEvents);

router.get("/maintenance/sweep", async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET;

    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    await subscriptionSweep();

    return res.json({
      ok: true,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
  });
});

export default router;
