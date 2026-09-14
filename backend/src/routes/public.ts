import { Router } from "express";

import { auth } from "../middleware/auth";

import {
  downloadPublicShare,
  viewPublicShare,
  getPublicHealth,
  getPublicPricing,
  postPricingQuote,
  unlockPublicShare,
  getAuthenticatedFolderShare,
} from "../controllers/public.controller";

const router = Router();

router.get("/health", getPublicHealth);
router.get("/pricing", getPublicPricing);
router.post("/pricing/quote", postPricingQuote);
router.post("/shares/:token/unlock", unlockPublicShare);
router.get("/shares/:token/folder", auth, getAuthenticatedFolderShare);
router.get("/shares/:token/content", viewPublicShare);
router.get("/shares/:token/download", downloadPublicShare);

export default router;
