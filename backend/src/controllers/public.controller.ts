import { Request, Response, NextFunction } from "express";

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
    return res.send(result.data);
  } catch (error) {
    next(error);
  }
}
