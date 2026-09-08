import { Request, Response, NextFunction } from "express";
import { verifyAccess } from "../utils/security";

export type AuthedUser = {
  id: string;
  role: string;
  companyId: string | null;
  email: string;
};
export type AuthedRequest = Request & { user?: AuthedUser };

export async function auth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer "))
    return res.status(401).json({ error: "Authentication required" });

  try {
    const payload = verifyAccess(h.slice(7));
    req.user = {
      id: payload.id,
      role: payload.role,
      companyId: payload.companyId,
      email: payload.email || "",
    };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

export const role =
  (...roles: string[]) =>
    (req: AuthedRequest, res: Response, next: NextFunction) => {
      if (!req.user || !roles.includes(req.user.role))
        return res.status(403).json({ error: "Forbidden" });
      next();
    };

export const tenant = (
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user?.companyId && req.user?.role !== "SUPER_ADMIN")
    return res.status(403).json({ error: "Tenant context required" });
  next();
};
