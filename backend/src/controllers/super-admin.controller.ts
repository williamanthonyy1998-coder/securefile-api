import { Response, NextFunction } from "express";

import { AuthedRequest } from "../middleware/auth";
import { superAdminService } from "../services/super-admin.service";

export async function listCompanies(
  _req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companies = await superAdminService.listCompanies();
    return res.json(companies);
  } catch (error) {
    next(error);
  }
}

export async function createCompany(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await superAdminService.createCompany(req.body || {});
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateCompany(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await superAdminService.updateCompany(
      String(req.params.id),
      req.body || {},
    );
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteCompany(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    await superAdminService.deleteCompany(String(req.params.id));
    return res.status(204).end();
  } catch (error) {
    next(error);
  }
}
