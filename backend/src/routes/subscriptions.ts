import { Router } from "express";

import { auth, role } from "../middleware/auth";
import {
  cancelSubscription,
  changeQuote,
  checkoutSubscription,
  getMySubscription,
  quoteSubscription,
  reactivateSubscription,
  stripeWebhook,
} from "../controllers/subscription.controller";

const router = Router();

router.get("/me", auth, getMySubscription);

router.post("/quote", quoteSubscription);

router.post("/change-quote", auth, role("COMPANY_ADMIN"), changeQuote);

router.post("/cancel", auth, role("COMPANY_ADMIN"), cancelSubscription);

router.post("/reactivate", auth, role("COMPANY_ADMIN"), reactivateSubscription);

router.post("/checkout", auth, role("COMPANY_ADMIN"), checkoutSubscription);

router.post("/stripe-webhook", stripeWebhook);

export default router;
