import { Router } from "express";
import { db } from "../db";
import { auth, AuthedRequest, role } from "../middleware/auth";

const r = Router();

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

r.get("/me", auth, async (req: AuthedRequest, res) => {
  if (!req.user?.companyId)
    return res.status(400).json({ error: "No company" });
  const c = await db.company.findUnique({
    where: { id: req.user.companyId },
    select: {
      id:true,name:true,slug:true,contactEmail:true,businessIndustry:true,businessDescription:true,logoUrl:true,
      createdAt:true,updatedAt:true,storageLimitGb:true,storageUsedBytes:true,
      subscription: { select: { id:true,planCode:true,users:true,storageGb:true,status:true,expiresAt:true,addons:true } },
    },
  });
  if (!c) return res.status(404).json({ error: "Company not found" });
  res.json({
    ...c,
    storageUsedBytes: String(c.storageUsedBytes),
    features: {
      ...jsonObject(c.subscription?.addons),
      planName:
        (
          {
            STARTER: "Basic",
            BUSINESS: "Advanced",
            PROFESSIONAL: "Premium",
            CUSTOM: "Enterprise",
          } as any
        )[c.subscription?.planCode || "CUSTOM"] || "Enterprise",
    },
  });
});

r.get("/stats", auth, async (req: AuthedRequest, res, next) => {
  try {
    const id = req.user?.companyId;
    if (!id) return res.status(400).json({ error: "No company" });

    const c = await db.company.findUnique({
      where: { id },
      select: {
        storageLimitGb: true,
        storageUsedBytes: true,
        _count: { select: { users: true, files: true, folders: true } },
      },
    });
    if (!c) return res.status(404).json({ error: "Company not found" });

    const unreadNotifications = await db.notification.count({
      where: { companyId: id, userId: req.user!.id, readAt: null },
    });

    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      users: c._count.users,
      files: c._count.files,
      folders: c._count.folders,
      unreadNotifications,
      storageLimitGb: c.storageLimitGb || 0,
      storageUsedBytes: String(c.storageUsedBytes || 0),
    });
  } catch (e) {
    next(e);
  }
});

export default r;
