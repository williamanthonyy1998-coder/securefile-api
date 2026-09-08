import { Router } from "express";

import {
  acceptInvitation,
  createUser,
  deleteUser,
  getUserMeta,
  getUserPermissions,
  listChatUsers,
  listUsers,
  resendInvitation,
  updateUser,
  updateUserPermissions,
  updateUserStatus,
} from "../controllers/user.controller";
import { auth, role } from "../middleware/auth";
import { activeSubscription } from "../middleware/subscription";

const router = Router();

router.get("/", auth, listUsers);
router.get("/chat", auth, listChatUsers);
router.get("/meta", auth, role("COMPANY_ADMIN"), getUserMeta);

router.post("/", auth, activeSubscription, role("COMPANY_ADMIN"), createUser);

router.get(
  "/:id/permissions",
  auth,
  role("COMPANY_ADMIN"),
  getUserPermissions,
);
router.put(
  "/:id/permissions",
  auth,
  activeSubscription,
  role("COMPANY_ADMIN"),
  updateUserPermissions,
);

router.patch(
  "/:id",
  auth,
  activeSubscription,
  role("COMPANY_ADMIN"),
  updateUser,
);
router.patch(
  "/:id/status",
  auth,
  activeSubscription,
  role("COMPANY_ADMIN"),
  updateUserStatus,
);

router.post(
  "/:id/resend-invitation",
  auth,
  activeSubscription,
  role("COMPANY_ADMIN"),
  resendInvitation,
);

router.delete(
  "/:id",
  auth,
  activeSubscription,
  role("COMPANY_ADMIN"),
  deleteUser,
);

router.post("/accept-invitation", acceptInvitation);

export default router;
