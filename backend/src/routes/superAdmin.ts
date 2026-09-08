import { Router } from "express";

import { auth, role } from "../middleware/auth";
import {
  createCompany,
  deleteCompany,
  listCompanies,
  updateCompany,
} from "../controllers/super-admin.controller";

const router = Router();

router.use(auth, role("SUPER_ADMIN"));

router.get("/companies", listCompanies);
router.post("/companies", createCompany);
router.patch("/companies/:id", updateCompany);
router.delete("/companies/:id", deleteCompany);

export default router;
