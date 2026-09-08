import { Response, NextFunction } from "express";

import { AuthedRequest } from "../middleware/auth";
import { faxService } from "../services/fax.service";
import { AppError } from "../utils/errors";

export async function getFaxDashboard(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }

    const result = await faxService.getFaxDashboard(
      req.user.id,
      req.user.companyId,
    );

    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function provisionFaxNumber(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }

    const { line, created } = await faxService.provisionNumber(
      req.user.id,
      req.user.companyId,
      {
        countryCode: req.body?.countryCode,
        areaCode: req.body?.areaCode,
      },
    );

    return created ? res.status(201).json(line) : res.json(line);
  } catch (error) {
    next(error);
  }
}

export async function sendFax(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }

    const job = await faxService.sendFax(
      req.user.id,
      req.user.role,
      req.user.companyId,
      {
        to: req.body?.to,
        fileId: req.body?.fileId,
        headerText: req.body?.headerText,
        uploadedFile: req.file
          ? {
              buffer: req.file.buffer,
              originalname: req.file.originalname,
              mimetype: req.file.mimetype,
            }
          : undefined,
      },
    );

    return res.status(201).json(job);
  } catch (error) {
    next(error);
  }
}
