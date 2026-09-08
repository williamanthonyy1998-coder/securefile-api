import { Router } from "express";

import { auth } from "../middleware/auth";
import { activeSubscription } from "../middleware/subscription";
import {
  listTrash,
  permanentlyDeleteTrashItem,
  restoreTrashItem,
} from "../controllers/trash.controller";

const router = Router();

router.get("/", auth, listTrash);

router.post("/:type/:id/restore", auth, activeSubscription, restoreTrashItem);
router.get("/:type/:id/restore", auth, activeSubscription, restoreTrashItem);

router.delete(
  "/:type/:id",
  auth,
  activeSubscription,
  permanentlyDeleteTrashItem,
);

export default router;
