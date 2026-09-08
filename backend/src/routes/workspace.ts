import { Router } from "express";
import multer from "multer";

import { env } from "../config/env";
import { auth, role } from "../middleware/auth";
import { activeSubscription } from "../middleware/subscription";
import {
  askAi,
  createRequest,
  createTask,
  deleteRequest,
  getEmailStatus,
  listApprovalResources,
  listApprovals,
  listEmails,
  listNotifications,
  listRequests,
  listTasks,
  markAllNotificationsRead,
  markNotificationRead,
  resolveApproval,
  sendWorkspaceEmail,
  submitTaskSolution,
  updateTaskStatus,
} from "../controllers/workspace.controller";

const router = Router();
const taskUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
});

router.get("/requests", auth, listRequests);
router.delete("/requests/:id", auth, activeSubscription, deleteRequest);
router.post("/requests", auth, activeSubscription, createRequest);

router.get("/approvals", auth, listApprovals);
router.get("/approvals/:id/resources", auth, listApprovalResources);
router.patch("/approvals/:id", auth, activeSubscription, resolveApproval);

router.get("/tasks", auth, listTasks);
router.post("/tasks", auth, activeSubscription, role("COMPANY_ADMIN"), createTask);
router.patch(
  "/tasks/:id/status",
  auth,
  activeSubscription,
  updateTaskStatus,
);
router.post(
  "/tasks/:id/solution",
  auth,
  activeSubscription,
  taskUpload.single("file"),
  submitTaskSolution,
);

router.get("/emails", auth, listEmails);
router.get("/email/status", auth, getEmailStatus);
router.post("/email", auth, activeSubscription, sendWorkspaceEmail);

router.get("/notifications", auth, listNotifications);
router.patch("/notifications/:id/read", auth, markNotificationRead);
router.patch("/notifications/read-all", auth, markAllNotificationsRead);

router.post("/ai", auth, activeSubscription, askAi);

export default router;
