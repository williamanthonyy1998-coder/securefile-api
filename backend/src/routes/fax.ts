import { Router } from "express";
import multer from "multer";

import { env } from "../config/env";
import { auth } from "../middleware/auth";
import { activeSubscription } from "../middleware/subscription";
import {
  getFaxDashboard,
  provisionFaxNumber,
  sendFax,
} from "../controllers/fax.controller";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.min(env.MAX_UPLOAD_MB, 20) * 1024 * 1024 },
});

router.get("/", auth, activeSubscription, getFaxDashboard);
router.post(
  "/number/provision",
  auth,
  activeSubscription,
  provisionFaxNumber,
);
router.post(
  "/send",
  auth,
  activeSubscription,
  upload.single("file"),
  sendFax,
);

export default router;
