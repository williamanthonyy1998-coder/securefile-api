import { Router } from "express";

import { auth } from "../middleware/auth";
import { activeSubscription } from "../middleware/subscription";
import {
  createFolder,
  deleteFolder,
  listFolders,
  updateFolder,
} from "../controllers/folder.controller";

const router = Router();

router.get("/", auth, listFolders);
router.post("/", auth, activeSubscription, createFolder);
router.patch("/:id", auth, activeSubscription, updateFolder);
router.delete("/:id", auth, activeSubscription, deleteFolder);

export default router;
