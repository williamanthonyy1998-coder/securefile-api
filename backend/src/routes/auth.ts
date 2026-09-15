import { Router } from "express";
import { forgotPassword, login, resetPassword, signup, verifyEmail, verifyTwoFactor, setupTwoFactor, enableTwoFactor, disableTwoFactor } from "../controllers/auth.controller";
import { auth } from "../middleware/auth";

const router = Router();
router.post("/signup", signup);
router.post("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/2fa/verify", verifyTwoFactor);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/2fa/setup", auth, setupTwoFactor);
router.post("/2fa/enable", auth, enableTwoFactor);
router.post("/2fa/disable", auth, disableTwoFactor);
export default router;
