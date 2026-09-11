import { PrismaClient } from "@prisma/client";

import { db } from "../db";
import { AppError } from "../utils/errors";

const PLAN_NAMES: Record<string, string> = {
  STARTER: "Basic",
  BUSINESS: "Advanced",
  PROFESSIONAL: "Premium",
  CUSTOM: "Enterprise",
};

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

class CompanyService {
  constructor(private readonly db: PrismaClient) {}

  async getMyCompany(companyId: string) {
    const company = await this.db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        slug: true,
        contactEmail: true,
        businessIndustry: true,
        businessDescription: true,
        logoUrl: true,
        createdAt: true,
        updatedAt: true,
        storageLimitGb: true,
        storageUsedBytes: true,
        subscription: {
          select: {
            id: true,
            planCode: true,
            users: true,
            storageGb: true,
            status: true,
            expiresAt: true,
            addons: true,
          },
        },
      },
    });

    if (!company) {
      throw new AppError("Company not found", 404);
    }

    return {
      ...company,
      storageUsedBytes: String(company.storageUsedBytes),
      features: {
        ...jsonObject(company.subscription?.addons),
        planName:
          PLAN_NAMES[company.subscription?.planCode || "CUSTOM"] ||
          "Enterprise",
      },
    };
  }

  async getCompanyStats(companyId: string, userId: string, role?: string) {
    const company = await this.db.company.findUnique({
      where: { id: companyId },
      select: {
        storageLimitGb: true,
        storageUsedBytes: true,
        _count: { select: { users: true, files: true, folders: true } },
      },
    });

    if (!company) {
      throw new AppError("Company not found", 404);
    }

    const unreadNotifications = await this.db.notification.count({
      where: { companyId, userId, readAt: null },
    });

    // Company Admin keeps the existing workspace-wide dashboard.
    if (role === "COMPANY_ADMIN" || role === "SUPER_ADMIN") {
      return {
        scope: "COMPANY",
        users: company._count.users,
        files: company._count.files,
        folders: company._count.folders,
        unreadNotifications,
        storageLimitGb: company.storageLimitGb || 0,
        storageUsedBytes: String(company.storageUsedBytes || 0),
      };
    }

    // Employees and Clients must never receive company-wide counts/storage.
    // Their dashboard is calculated strictly from resources they own.
    const [user, myFiles, myFolders, myStorage] = await Promise.all([
      this.db.user.findFirst({
        where: { id: userId, companyId },
        select: { uniqueName: true, email: true },
      }),
      this.db.file.count({
        where: { companyId, ownerId: userId, deletedAt: null },
      }),
      this.db.folder.count({
        where: { companyId, ownerId: userId, deletedAt: null },
      }),
      this.db.file.aggregate({
        where: { companyId, ownerId: userId, deletedAt: null },
        _sum: { sizeBytes: true },
      }),
    ]);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    return {
      scope: "USER",
      user: {
        name: user.uniqueName,
        email: user.email,
      },
      files: myFiles,
      folders: myFolders,
      unreadNotifications,
      ownStorageUsedBytes: String(myStorage._sum.sizeBytes || 0),
    };
  }
}

export const companyService = new CompanyService(db);
