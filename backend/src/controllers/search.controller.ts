import { Response, NextFunction } from "express";

import { AuthedRequest } from "../middleware/auth";
import { searchService } from "../services/search.service";
import { AppError } from "../utils/errors";

export async function searchWorkspace(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }

    const result = await searchService.search(
      String(req.query.q || ""),
      req.user.id,
      req.user.role,
      req.user.companyId,
    );

    return res.json(result);
  } catch (error) {
    next(error);
  }
}
