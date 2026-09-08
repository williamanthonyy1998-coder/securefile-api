import { Response, NextFunction } from "express";

import { AuthedRequest } from "../middleware/auth";
import { trashService } from "../services/trash.service";
import { AppError } from "../utils/errors";

export async function listTrash(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }

    const result = await trashService.listTrash(
      req.user.id,
      req.user.role,
      req.user.companyId,
    );

    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function restoreTrashItem(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }

    const type = String(req.params.type || "");
    const id = String(req.params.id || "");

    if (!type || !id) {
      throw new AppError("Trash item type and id are required", 400);
    }

    const result = await trashService.restoreItem(
      type,
      id,
      req.user.id,
      req.user.role,
      req.user.companyId,
      req.user.email,
    );

    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function permanentlyDeleteTrashItem(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }

    const type = String(req.params.type || "");
    const id = String(req.params.id || "");

    if (!type || !id) {
      throw new AppError("Trash item type and id are required", 400);
    }

    await trashService.permanentlyDeleteItem(
      type,
      id,
      req.user.id,
      req.user.role,
      req.user.companyId,
      req.user.email,
    );

    return res.status(204).end();
  } catch (error) {
    next(error);
  }
}
