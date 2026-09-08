import { Router } from "express";
import multer from "multer";

import { env } from "../config/env";
import { auth } from "../middleware/auth";
import { activeSubscription } from "../middleware/subscription";
import {
  commitUpload,
  createUploadTicket,
  deleteFile,
  downloadFile,
  getFile,
  getSignedUrl,
  listFiles,
  previewFile,
  saveFaxDocument,
  scanPages,
  scanPdf,
  updateFile,
  uploadFile,
} from "../controllers/file.controller";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
});

router.post("/upload-ticket", auth, activeSubscription, createUploadTicket);
router.post("/commit-upload", auth, activeSubscription, commitUpload);
router.get("/:id/signed-url", auth, activeSubscription, getSignedUrl);
router.get("/", auth, listFiles);
router.post(
  "/upload",
  auth,
  activeSubscription,
  upload.single("file"),
  uploadFile,
);
router.get("/:id", auth, getFile);
router.get("/:id/download", auth, activeSubscription, downloadFile);
router.get("/:id/preview", auth, activeSubscription, previewFile);
router.patch("/:id", auth, activeSubscription, updateFile);
router.delete("/:id", auth, activeSubscription, deleteFile);
router.post(
  "/scan-pages",
  auth,
  activeSubscription,
  upload.array("pages", 100),
  scanPages,
);
router.post(
  "/scan",
  auth,
  activeSubscription,
  upload.single("file"),
  scanPdf,
);
router.post(
  "/fax",
  auth,
  activeSubscription,
  upload.single("file"),
  saveFaxDocument,
);

export default router;
