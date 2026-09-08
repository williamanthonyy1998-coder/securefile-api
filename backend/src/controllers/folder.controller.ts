import { Response, NextFunction } from "express";

import { AuthedRequest } from "../middleware/auth";
import { folderService } from "../services/folder.service";
import { AppError } from "../utils/errors";

export async function listFolders(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }

    const folders = await folderService.listFolders(
      req.user.id,
      req.user.role,
      req.user.companyId,
    );

    res.setHeader("Cache-Control", "private, no-store");
    return res.json(folders);
  } catch (error) {
    next(error);
  }
}

export async function createFolder(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }

    const folder = await folderService.createFolder(
      req.user.id,
      req.user.role,
      req.user.companyId,
      req.user.email,
      {
        name: req.body?.name,
        parentId: req.body?.parentId,
      },
    );

    return res.status(201).json(folder);
  } catch (error) {
    next(error);
  }
}

export async function updateFolder(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }

    const folder = await folderService.updateFolder(
      String(req.params.id),
      req.user.id,
      req.user.role,
      req.user.companyId,
      req.user.email,
      {
        name: req.body?.name,
        parentId: req.body?.parentId,
      },
    );

    return res.json(folder);
  } catch (error) {
    next(error);
  }
}

export async function deleteFolder(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }

    await folderService.softDeleteFolder(
      String(req.params.id),
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
