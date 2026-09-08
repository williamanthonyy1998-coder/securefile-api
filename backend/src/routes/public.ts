import { Router } from "express";

import {
  downloadPublicShare,
  getPublicHealth,
  getPublicPricing,
  postPricingQuote,
  unlockPublicShare,
} from "../controllers/public.controller";

const router = Router();

router.get("/health", getPublicHealth);
router.get("/pricing", getPublicPricing);
router.post("/pricing/quote", postPricingQuote);
router.post("/shares/:token/unlock", unlockPublicShare);
router.get("/shares/:token/download", downloadPublicShare);

export default router;
