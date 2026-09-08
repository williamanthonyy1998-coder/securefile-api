import { Router } from "express";

import { auth } from "../middleware/auth";
import { searchWorkspace } from "../controllers/search.controller";

const router = Router();

router.get("/", auth, searchWorkspace);

export default router;
