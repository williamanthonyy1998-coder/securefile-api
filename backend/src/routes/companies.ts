import { Router } from "express";

import { auth } from "../middleware/auth";
import {
  getCompanyStats,
  getMyCompany,
} from "../controllers/company.controller";

const router = Router();

router.get("/me", auth, getMyCompany);
router.get("/stats", auth, getCompanyStats);

export default router;
