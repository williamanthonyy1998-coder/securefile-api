import { Router } from "express";

import { runMaintenance } from "../controllers/cron.controller";

const router = Router();

router.post("/maintenance", runMaintenance);

export default router;
