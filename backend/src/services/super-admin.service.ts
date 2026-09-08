import type { Prisma } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { env } from "../config/env";
import { db } from "../db";
import { AppError } from "../utils/errors";
import {
  hashPassword,
  randomToken,
  hashToken,
  safeSlug,
} from "../utils/security";
import { sendUserEmail } from "./email";
import {
  addonSchema,
  calculatePrice,
  getPlan,
  pricePlan,
} from "./pricing";

export interface CreateCompanyInput {
  name?: string;
  email?: string;
  businessIndustry?: string;
  businessDescription?: string;
  planCode?: string;
  storageGb?: number;
  users?: number;
  months?: number;
  addons?: unknown;
  adminEmail?: string;
  adminName?: string;
  adminPassword?: string;
}

export interface UpdateCompanyInput {
  name?: string;
  contactEmail?: string;
  businessIndustry?: string;
  businessDescription?: string | null;
  logoUrl?: string | null;
  planCode?: string;
  users?: number;
  storageGb?: number;
  months?: number;
  addons?: unknown;
}

class SuperAdminService {
  constructor(private readonly db: PrismaClient) {}

  private async slugFor(name: string) {
    const base = safeSlug(name);
    let slug = base;

    for (let i = 0; i < 10; i++) {
      if (!(await this.db.company.findUnique({ where: { slug } }))) {
        return slug;
      }
      slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    }

    throw new AppError("Could not allocate company URL", 500);
  }

  async listCompanies() {
    return this.db.company.findMany({
      include: {
        subscription: true,
        _count: {
          select: {
            users: true,
            files: true,
            folders: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async createCompany(input: CreateCompanyInput) {
    const {
      name,
      email,
      businessIndustry = "Other",
      businessDescription = "",
      planCode = "CUSTOM",
      storageGb = 10,
      users = 1,
      months = 1,
      addons = {},
      adminEmail,
      adminName,
      adminPassword,
    } = input;

    if (!name || !email) {
      throw new AppError("Company name and contact email are required", 400);
    }

    const companyEmail = z
      .string()
      .email()
      .safeParse(String(email).trim().toLowerCase());

    if (!companyEmail.success) {
      throw new AppError("Enter a valid company email address", 400);
    }

    if (!adminEmail || !adminName || !adminPassword) {
      throw new AppError(
        "Company Admin email, name and password are required",
        400,
      );
    }

    const normalizedAdminEmail = String(adminEmail).trim().toLowerCase();
    const adminEmailCheck = z.string().email().safeParse(normalizedAdminEmail);

    if (!adminEmailCheck.success) {
      throw new AppError("Enter a valid Company Admin email address", 400);
    }

    if (String(adminName).trim().length < 2) {
      throw new AppError(
        "Company Admin name must be at least 2 characters",
        400,
      );
    }

    if (String(adminPassword).length < 10) {
      throw new AppError(
        "Company Admin password must be at least 10 characters",
        400,
      );
    }

    const existingAdmin = await this.db.user.findUnique({
      where: { email: normalizedAdminEmail },
    });

    if (existingAdmin) {
      throw new AppError("Company Admin email is already registered", 409);
    }

    const normalizedPlan = String(planCode || "CUSTOM").toUpperCase();

    if (
      !["STARTER", "BUSINESS", "PROFESSIONAL", "CUSTOM"].includes(
        normalizedPlan,
      )
    ) {
      throw new AppError("Invalid plan code", 400);
    }

    const fixedPlan =
      normalizedPlan === "CUSTOM" ? null : getPlan(normalizedPlan);

    const userLimit = fixedPlan
      ? Math.max(fixedPlan.users, Math.floor(Number(users) || fixedPlan.users))
      : Math.max(1, Math.floor(Number(users) || 1));

    const storageLimit = fixedPlan
      ? Math.max(fixedPlan.storageGb, Number(storageGb) || fixedPlan.storageGb)
      : Math.max(1, Number(storageGb) || 10);

    const billingMonths = Math.max(1, Math.floor(Number(months) || 1));

    const selectedAddons = addonSchema.parse(fixedPlan?.addons ?? addons ?? {});

    const quote = fixedPlan
      ? pricePlan(fixedPlan.code, billingMonths, userLimit, storageLimit)
      : calculatePrice(userLimit, storageLimit, billingMonths, selectedAddons);

    const slug = await this.slugFor(String(name));

    const result = await this.db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const company = await tx.company.create({
          data: {
            name: String(name).trim(),
            slug,
            contactEmail: companyEmail.data,
            businessIndustry: String(businessIndustry).trim(),
            businessDescription:
              String(businessDescription || "").trim() || null,
            storageLimitGb: storageLimit,
          },
        });

        await tx.subscription.create({
          data: {
            companyId: company.id,
            planCode: normalizedPlan,
            users: userLimit,
            storageGb: storageLimit,
            months: billingMonths,
            priceCents: quote.amountCents,
            status: "ACTIVE",
            startsAt: new Date(),
            expiresAt: new Date(
              Date.now() + billingMonths * 30 * 24 * 60 * 60 * 1000,
            ),
            provider: "SUPER_ADMIN",
            addons: selectedAddons,
          },
        });

        const passwordHash = await hashPassword(String(adminPassword));

        const user = await tx.user.create({
          data: {
            companyId: company.id,
            email: normalizedAdminEmail,
            uniqueName: String(adminName).trim(),
            passwordHash,
            role: "COMPANY_ADMIN",
            status: "ACTIVE",
            emailVerifiedAt: new Date(),
          },
        });

        await tx.folder.create({
          data: {
            companyId: company.id,
            ownerId: user.id,
            name: "Personal Folder",
            isPersonal: true,
          },
        });

        const resetToken = randomToken();

        await tx.verificationToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(resetToken),
            type: "PASSWORD_RESET",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });

        return {
          company,
          user,
          resetToken,
        };
      },
    );

    const resetUrl = `${env.APP_URL}/reset-password?token=${encodeURIComponent(
      result.resetToken,
    )}`;

    await sendUserEmail(
      result.user.email,
      "Your SecureFile Company Admin Account",
      `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">

          <h2>Welcome to SecureFile</h2>

          <p>
            Hello
            <strong>${result.user.uniqueName}</strong>,
          </p>

          <p>
            Your SecureFile company admin account
            has been created successfully.
          </p>

          <h3>Account Details</h3>

          <p>
            <strong>Company:</strong>
            ${result.company.name}
          </p>

          <p>
            <strong>Email:</strong>
            ${result.user.email}
          </p>

          <p>
            <strong>Password:</strong>
            ${String(adminPassword)}
          </p>

          <p>
            You can use the email address and password
            above to log in to your SecureFile account.
          </p>

          <h3>Change Your Password</h3>

          <p>
            We recommend changing the password after
            your first login.
          </p>

          <p>
            <a
              href="${resetUrl}"
              style="
                display: inline-block;
                padding: 12px 20px;
                background: #2563eb;
                color: #ffffff;
                text-decoration: none;
                border-radius: 6px;
              "
            >
              Change Your Password
            </a>
          </p>

          <p>
            Or copy and paste this URL into your browser:
          </p>

          <p>
            ${resetUrl}
          </p>

          <p>
            This password-change link will expire
            in <strong>24 hours</strong> and can only
            be used once.
          </p>

          <hr />

          <p>
            Regards,<br />
            <strong>SecureFile Team</strong>
          </p>

        </div>
      `,
    );

    return {
      company: result.company,
      url: process.env.APP_URL || "http://localhost:5173",
    };
  }

  async updateCompany(companyId: string, input: UpdateCompanyInput) {
    const c = await this.db.company.findUnique({
      where: { id: companyId },
    });

    if (!c) {
      throw new AppError("Company not found", 404);
    }

    const requestedPlan = String(input.planCode ?? "CUSTOM").toUpperCase();

    if (
      !["STARTER", "BUSINESS", "PROFESSIONAL", "CUSTOM"].includes(requestedPlan)
    ) {
      throw new AppError("Invalid plan code", 400);
    }

    const fixedPlan =
      requestedPlan === "CUSTOM" ? null : getPlan(requestedPlan);

    const users = fixedPlan
      ? Math.max(
          fixedPlan.users,
          Math.floor(Number(input.users) || fixedPlan.users),
        )
      : Math.max(1, Math.floor(Number(input.users) || 1));

    const storageGb = fixedPlan
      ? Math.max(
          fixedPlan.storageGb,
          Number(input.storageGb ?? c.storageLimitGb) || fixedPlan.storageGb,
        )
      : Math.max(1, Number(input.storageGb ?? c.storageLimitGb) || 10);

    const months = Math.max(1, Math.floor(Number(input.months ?? 1) || 1));

    const currentUserCount = await this.db.user.count({
      where: { companyId: c.id },
    });

    if (users < currentUserCount) {
      throw new AppError(
        `Users included cannot be below the ${currentUserCount} existing company users.`,
        409,
      );
    }

    const existingSubscription = await this.db.subscription.findUnique({
      where: { companyId: c.id },
    });

    const selectedAddons = addonSchema.parse(
      fixedPlan?.addons ??
        input.addons ??
        existingSubscription?.addons ??
        {},
    );

    const quote = fixedPlan
      ? pricePlan(fixedPlan.code, months, users, storageGb)
      : calculatePrice(users, storageGb, months, selectedAddons);

    return this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      const company = await tx.company.update({
        where: { id: c.id },
        data: {
          name: input.name ?? c.name,
          contactEmail: input.contactEmail ?? c.contactEmail,
          businessIndustry: input.businessIndustry ?? c.businessIndustry,
          businessDescription:
            input.businessDescription ?? c.businessDescription,
          logoUrl: input.logoUrl ?? c.logoUrl,
          storageLimitGb: storageGb,
        },
      });

      const existing = await tx.subscription.findUnique({
        where: { companyId: c.id },
      });

      const subscription = existing
        ? await tx.subscription.update({
            where: { companyId: c.id },
            data: {
              planCode: requestedPlan,
              users,
              storageGb,
              months,
              priceCents: quote.amountCents,
              addons: selectedAddons,
              expiresAt: new Date(
                Date.now() + months * 30 * 24 * 60 * 60 * 1000,
              ),
            },
          })
        : await tx.subscription.create({
            data: {
              companyId: c.id,
              planCode: requestedPlan,
              users,
              storageGb,
              months,
              priceCents: quote.amountCents,
              status: "ACTIVE",
              startsAt: new Date(),
              expiresAt: new Date(
                Date.now() + months * 30 * 24 * 60 * 60 * 1000,
              ),
              provider: "SUPER_ADMIN",
              addons: selectedAddons,
            },
          });

      return { company, subscription };
    });
  }

  async deleteCompany(companyId: string) {
    await this.db.company.delete({
      where: { id: companyId },
    });
  }
}

export const superAdminService = new SuperAdminService(db);
