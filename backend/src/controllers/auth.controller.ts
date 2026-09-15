import { Request, Response, NextFunction } from "express";

import { authService } from "../services/auth.service";
import type { AuthedRequest } from "../middleware/auth";

export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.signup(req.body);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function verifyEmail(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    return res.json(await authService.verifyEmail(req.body?.token));
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(
      await authService.login(req.body?.email, req.body?.password),
    );
  } catch (error) {
    console.error("LOGIN_ERROR:", error);
    return next(error);
  }
}

export async function verifyTwoFactor(req: Request, res: Response, next: NextFunction) {
  try { return res.json(await authService.verifyTwoFactor(req.body?.challengeToken, req.body?.code)); }
  catch (error) { next(error); }
}

export async function setupTwoFactor(req: AuthedRequest, res: Response, next: NextFunction) {
  try { return res.json(await authService.setupTwoFactor(req.user!.id)); }
  catch (error) { next(error); }
}

export async function enableTwoFactor(req: AuthedRequest, res: Response, next: NextFunction) {
  try { return res.json(await authService.enableTwoFactor(req.user!.id, req.body?.code)); }
  catch (error) { next(error); }
}

export async function disableTwoFactor(req: AuthedRequest, res: Response, next: NextFunction) {
  try { return res.json(await authService.disableTwoFactor(req.user!.id, req.body?.password, req.body?.code)); }
  catch (error) { next(error); }
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    return res.json(await authService.forgotPassword(req.body?.email));
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    return res.json(
      await authService.resetPassword(req.body?.token, req.body?.password),
    );
  } catch (error) {
    next(error);
  }
}
