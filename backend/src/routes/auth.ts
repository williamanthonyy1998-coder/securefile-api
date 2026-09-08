import { Router } from "express";

import {
  forgotPassword,
  login,
  resetPassword,
  signup,
  verifyEmail,
} from "../controllers/auth.controller";

const router = Router();

router.post("/signup", signup);
router.post("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
