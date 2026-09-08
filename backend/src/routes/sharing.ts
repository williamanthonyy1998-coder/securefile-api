import { Router } from "express";

import { auth } from "../middleware/auth";
import { activeSubscription } from "../middleware/subscription";
import {
  createShare,
  listShares,
  revokeShare,
  updateShare,
} from "../controllers/sharing.controller";

const router = Router();

router.post("/", auth, activeSubscription, createShare);
router.get("/", auth, listShares);
router.patch("/:id", auth, activeSubscription, updateShare);
router.delete("/:id", auth, activeSubscription, revokeShare);

export default router;
