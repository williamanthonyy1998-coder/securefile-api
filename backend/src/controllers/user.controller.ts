import { Request, Response, NextFunction } from "express";

import { AuthedRequest } from "../middleware/auth";
import { userService } from "../services/user.service";
import { AppError } from "../utils/errors";

export async function listUsers(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }
    return res.json(await userService.listUsers(req.user.companyId));
  } catch (error) {
    next(error);
  }
}

export async function listChatUsers(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user?.companyId) {
      throw new AppError("No company", 400);
    }
    return res.json(await userService.listChatUsers(req.user.id));
  } catch (error) {
    next(error);
  }
}

export async function getUserMeta(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = req.user!.companyId!;
    return res.json(await userService.getMeta(companyId));
  } catch (error) {
    next(error);
  }
}

export async function createUser(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const companyId = req.user!.companyId!;
    const result = await userService.createUser(
      companyId,
      req.user!.id,
      req.body,
    );
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getUserPermissions(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const shares = await userService.getPermissions(
      req.user!.companyId!,
      String(req.params.id),
    );
    return res.json(shares);
  } catch (error) {
    next(error);
  }
}

export async function updateUserPermissions(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await userService.updatePermissions(
      req.user!.companyId!,
      req.user!.id,
      String(req.params.id),
      req.body.folders,
    );
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateUser(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const updated = await userService.updateUser(
      req.user!.companyId!,
      String(req.params.id),
      req.body || {},
    );
    return res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function updateUserStatus(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const updated = await userService.updateStatus(
      req.user!.companyId!,
      String(req.params.id),
      req.body?.status,
    );
    return res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function resendInvitation(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await userService.resendInvitation(
      req.user!.companyId!,
      String(req.params.id),
    );
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    await userService.deleteUser(
      req.user!.companyId!,
      String(req.params.id),
      req.user!.id,
    );
    return res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function acceptInvitation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await userService.acceptInvitation(
      req.body?.token,
      req.body?.password,
    );
    return res.json(result);
  } catch (error) {
    next(error);
  }
}
