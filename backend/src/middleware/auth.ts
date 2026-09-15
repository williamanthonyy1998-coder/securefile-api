import { Request, Response, NextFunction } from "express";
import { verifyAccess } from "../utils/security";
import { db } from "../db";

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

    // The JWT only proves that a session was issued in the past.
    // Re-check the live account on every authenticated request so deleted,
    // suspended, or otherwise inactive users cannot keep using an old token.
    const user = await db.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        role: true,
        companyId: true,
        email: true,
        status: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "Account no longer exists. Please sign in again." });
    }

    if (user.status !== "ACTIVE") {
      return res.status(401).json({
        error: user.status === "SUSPENDED"
          ? "Your account has been suspended. You have been logged out."
          : "Your account is not active. You have been logged out.",
      });
    }

    if (!user.emailVerifiedAt) {
      return res.status(401).json({ error: "Your account is not verified. Please sign in again." });
    }

    // Use the current database role/company/email rather than stale JWT claims.
    req.user = {
      id: user.id,
      role: user.role,
      companyId: user.companyId,
      email: user.email,
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
