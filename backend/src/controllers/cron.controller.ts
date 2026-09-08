import { Request, Response, NextFunction } from "express";

import { cronService } from "../services/cron.service";

export async function runMaintenance(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const supplied =
      (req.headers["x-cron-secret"] as string | undefined) ||
      req.headers.authorization?.replace(/^Bearer\s+/i, "");

    cronService.assertAuthorized(supplied);
    const result = await cronService.runMaintenance();
    return res.json(result);
  } catch (error) {
    next(error);
  }
}
