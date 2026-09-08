import { Request, Response, NextFunction } from "express";

import { authService } from "../services/auth.service";

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
