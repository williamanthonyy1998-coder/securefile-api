import { Router } from "express";

import { auth } from "../middleware/auth";
import {
  getCompanyStats,
  getMyCompany,
  updateMyCompany,
} from "../controllers/company.controller";

const router = Router();

router.get("/me", auth, getMyCompany);
router.get("/stats", auth, getCompanyStats);
router.patch("/me", auth, updateMyCompany);

export default router;
