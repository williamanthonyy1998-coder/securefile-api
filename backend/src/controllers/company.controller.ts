import { Response, NextFunction } from "express";

import { AuthedRequest } from "../middleware/auth";
import { companyService } from "../services/company.service";
import { AppError } from "../utils/errors";

export async function getMyCompany(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }

    const company = await companyService.getMyCompany(req.user.companyId);
    return res.json(company);
  } catch (error) {
    next(error);
  }
}

export async function getCompanyStats(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }

    const stats = await companyService.getCompanyStats(
      req.user.companyId,
      req.user.id,
      req.user.role,
    );

    res.setHeader("Cache-Control", "private, no-store");
    return res.json(stats);
  } catch (error) {
    next(error);
  }
}


export async function updateMyCompany(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) throw new AppError("No company", 400);
    if (req.user.role !== "COMPANY_ADMIN" && req.user.role !== "SUPER_ADMIN") {
      throw new AppError("Only a Company Admin can edit workspace details", 403);
    }

    const body = req.body || {};
    const company = await companyService.updateMyCompany(req.user.companyId, {
      name: body.name,
      businessIndustry: body.businessIndustry,
      businessDescription: body.businessDescription,
    });
    return res.json(company);
  } catch (error) {
    next(error);
  }
}
