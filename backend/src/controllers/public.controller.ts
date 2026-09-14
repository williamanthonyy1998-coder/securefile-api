import { Request, Response, NextFunction } from "express";

import { AuthedRequest } from "../middleware/auth";

import { publicService } from "../services/public.service";

export async function getPublicHealth(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    return res.json(publicService.getHealth());
  } catch (error) {
    next(error);
  }
}

export async function getPublicPricing(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    return res.json(publicService.getPricing(req.query.months));
  } catch (error) {
    next(error);
  }
}

export async function postPricingQuote(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    return res.json(publicService.getQuote(req.body || {}));
  } catch (error) {
    next(error);
  }
}

export async function unlockPublicShare(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await publicService.unlockShare(
      String(req.params.token || ""),
      req.body?.password,
    );
    return res.json(result);
  } catch (error) {
    next(error);
  }
}


export async function viewPublicShare(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await publicService.viewShare(
      String(req.params.token || ""),
      String(req.headers["x-share-password"] || ""),
    );
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${result.fileName.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(result.fileName)}`);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(result.data);
  } catch (error) {
    next(error);
  }
}

export async function downloadPublicShare(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await publicService.downloadShare(
      String(req.params.token || ""),
      String(req.headers["x-share-password"] || ""),
    );

    res.setHeader("Content-Type", result.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
    );
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(result.data);
  } catch (error) {
    next(error);
  }
}


export async function getAuthenticatedFolderShare(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) return res.status(403).json({ error: "A SecureFile workspace account is required." });
    const result = await publicService.getAuthenticatedFolderShare(
      String(req.params.token || ""),
      req.user.id,
      req.user.role,
      req.user.companyId,
    );
    return res.json(result);
  } catch (error) {
    next(error);
  }
}
