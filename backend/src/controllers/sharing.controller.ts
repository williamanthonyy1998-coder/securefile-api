import { Response, NextFunction } from "express";

import { AuthedRequest } from "../middleware/auth";
import { sharingService } from "../services/sharing.service";
import { AppError } from "../utils/errors";

export async function createShare(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }

    const share = await sharingService.createShare(
      req.user.id,
      req.user.role,
      req.user.companyId,
      req.user.email,
      {
        fileId: req.body?.fileId,
        folderId: req.body?.folderId,
        recipientId: req.body?.recipientId,
        type: req.body?.type,
        permissions: req.body?.permissions,
        password: req.body?.password,
        expiresAt: req.body?.expiresAt,
      },
    );

    return res.status(201).json(share);
  } catch (error) {
    next(error);
  }
}

export async function listShares(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }

    const shares = await sharingService.listShares(
      req.user.id,
      req.user.role,
      req.user.companyId,
    );

    return res.json(shares);
  } catch (error) {
    next(error);
  }
}

export async function updateShare(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }

    const updated = await sharingService.updateShare(
      String(req.params.id),
      req.user.id,
      req.user.role,
      req.user.companyId,
      {
        canView: req.body?.canView,
        canDownload: req.body?.canDownload,
        canUpload: req.body?.canUpload,
        canEdit: req.body?.canEdit,
        canDelete: req.body?.canDelete,
        canShare: req.body?.canShare,
        expiresAt: req.body?.expiresAt,
      },
    );

    return res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function revokeShare(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }

    await sharingService.revokeShare(
      String(req.params.id),
      req.user.id,
      req.user.role,
      req.user.companyId,
    );

    return res.status(204).end();
  } catch (error) {
    next(error);
  }
}
