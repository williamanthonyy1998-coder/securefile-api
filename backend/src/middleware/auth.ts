import { Request, Response, NextFunction } from "express";
import { verifyAccess } from "../utils/security";

export type AuthedUser = {
  id: string;
  role: string;
  companyId: string | null;
  email: string;
};
export type AuthedRequest = Request & { user?: AuthedUser };

// Short-lived server memory cache for read-only workspace APIs. This is deliberately
// keyed by the authenticated user and exact URL so one tenant/user can never receive
// another user's cached response. It removes repeated DB round-trips during navigation.
type CachedResponse = { expiresAt: number; body: unknown; status: number };
const readCache = new Map<string, CachedResponse>();
const CACHE_TTL_MS = 5_000;

export function clearAuthReadCache(){ readCache.clear(); }
function cacheKey(req: AuthedRequest){ return `${req.user!.id}|${req.originalUrl}`; }
function isCacheable(req: AuthedRequest){
  if(req.method !== 'GET') return false;
  const p=req.path;
  return !p.startsWith('/realtime') && !p.includes('/preview') && !p.includes('/download') && !p.includes('/notifications');
}

/**
 * Fast stateless authentication. The 7-day JWT is self-contained, so normal
 * API requests do not need a database round-trip just to authenticate.
 * Login still validates the account against the database.
 */
export async function auth(req: AuthedRequest, res: Response, next: NextFunction) {
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

    if(isCacheable(req)) {
      const key=cacheKey(req);
      const hit=readCache.get(key);
      if(hit && hit.expiresAt>Date.now()){
        res.status(hit.status).json(hit.body);
        return;
      }
      if(hit) readCache.delete(key);
      const originalJson=res.json.bind(res);
      res.json=((body: any)=>{
        readCache.set(key,{expiresAt:Date.now()+CACHE_TTL_MS,body,status:res.statusCode||200});
        return originalJson(body);
      }) as typeof res.json;
    } else if(req.method !== 'GET') {
      // A write can affect another user's view. Clear the tiny in-process cache so
      // subsequent reads never serve an old workspace snapshot.
      readCache.clear();
    }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

export const role = (...roles: string[]) =>
  (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role))
      return res.status(403).json({ error: "Forbidden" });
    next();
  };

export const tenant = (req: AuthedRequest, res: Response, next: NextFunction) => {
  if (!req.user?.companyId && req.user?.role !== "SUPER_ADMIN")
    return res.status(403).json({ error: "Tenant context required" });
  next();
};
