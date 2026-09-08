import type { Prisma } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { env } from "../config/env";
import { db } from "../db";
import { AppError } from "../utils/errors";
import {
  hashPassword,
  hashToken,
  randomToken,
  safeSlug,
  signAccess,
  verifyPassword,
} from "../utils/security";
import { sendUserEmail } from "./email";
import { createCheckoutSession } from "./payment";
import {
  addonSchema,
  type Addons,
  calculatePrice,
  getPlan,
  pricePlan,
} from "./pricing";

const signupSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  companyEmail: z.string().email(),
  businessIndustry: z.string().trim().min(2).max(120),
  businessDescription: z.string().trim().max(500).optional().or(z.literal("")),
  adminEmail: z.string().email(),
  adminName: z.string().trim().min(2).max(120),
  password: z.string().min(10).max(128),
  users: z.number().int().min(1).max(10000),
  storageGb: z.number().int().min(1).max(100000),
  months: z.number().int().min(1).max(120),
  addons: addonSchema.optional(),
  planCode: z
    .enum(["STARTER", "BUSINESS", "PROFESSIONAL", "CUSTOM"])
    .default("CUSTOM"),
});

function verifyUrl(token: string) {
  return `${env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
}

function resetUrl(token: string) {
  return `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
}

function priceCents(
  users: number,
  gb: number,
  months: number,
  addons: Partial<Addons>,
  planCode: string,
) {
  if (planCode && planCode !== "CUSTOM") {
    return pricePlan(planCode as any, months).amountCents;
  }
  return calculatePrice(users, gb, months, addons).amountCents;
}

class AuthService {
  constructor(private readonly db: PrismaClient) {}

  private async uniqueSlug(name: string) {
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

  async signup(body: unknown) {
    const x = signupSchema.parse(body);
    const plan = x.planCode === "CUSTOM" ? null : getPlan(x.planCode);

    if (plan && x.users < plan.users) {
      throw new AppError(
        `${plan.name} includes ${plan.users} users. Additional users can be added, but the included minimum cannot be reduced.`,
        400,
      );
    }

    const users = plan ? x.users : x.users;
    const months = x.months;
    const storageGb = plan?.storageGb ?? x.storageGb;
    const addons = addonSchema.parse(plan?.addons ?? x.addons ?? {});

    if (await this.db.user.findUnique({ where: { email: x.adminEmail } })) {
      throw new AppError("Email already registered", 409);
    }

    const slug = await this.uniqueSlug(x.companyName);
    const passwordHash = await hashPassword(x.password);
    const price = plan
      ? pricePlan(plan.code, months, users, storageGb).amountCents
      : priceCents(users, storageGb, months, addons, x.planCode);

    const result = await this.db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const company = await tx.company.create({
          data: {
            name: x.companyName,
            slug,
            contactEmail: x.companyEmail,
            businessIndustry: x.businessIndustry,
            businessDescription: x.businessDescription || null,
            storageLimitGb: storageGb,
          },
        });

        const user = await tx.user.create({
          data: {
            companyId: company.id,
            email: x.adminEmail.toLowerCase(),
            uniqueName: x.adminName,
            passwordHash,
            role: "COMPANY_ADMIN",
            status: "INVITED",
            personalFolderAllowed: true,
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

        const subscription = await tx.subscription.create({
          data: {
            companyId: company.id,
            planCode: x.planCode,
            users,
            storageGb,
            months,
            priceCents: price,
            status: env.BILLING_MODE === "preview" ? "ACTIVE" : "PENDING",
            startsAt: new Date(),
            expiresAt: new Date(Date.now() + months * 30 * 86400000),
            provider: env.BILLING_MODE === "preview" ? "PREVIEW" : "PENDING",
            addons,
          },
        });

        const token = randomToken();
        await tx.verificationToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(token),
            type: "EMAIL_VERIFICATION",
            expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
          },
        });

        return { company, user, subscription, token };
      },
    );

    const checkout =
      env.BILLING_MODE === "stripe"
        ? await createCheckoutSession({
            companyId: result.company.id,
            email: x.companyEmail,
            totalAmountCents: price,
            description: `${x.companyName} — ${x.planCode} plan, ${users} users, ${storageGb} GB, ${months} month${months === 1 ? "" : "s"} upfront`,
            metadata: {
              companyId: result.company.id,
              subscriptionId: result.subscription.id,
              planCode: x.planCode,
              users: String(users),
              storageGb: String(storageGb),
              months: String(months),
              totalPriceCents: String(price),
              addons: JSON.stringify(addons),
            },
          })
        : {
            provider: "preview",
            checkoutUrl: null,
            id: null,
            mode: "preview",
            subscriptionId: null,
            customerId: null,
          };

    await sendUserEmail(
      x.adminEmail,
      "Verify your SecureFile admin email",
      `<p>Verify your SecureFile admin account:</p><p>Plan: <strong>${x.planCode}</strong> · Users: ${users} · Storage: ${storageGb} GB · Billing: ${months} month${months === 1 ? "" : "s"} upfront</p><p>Business / Industry: <strong>${x.businessIndustry}</strong></p><p><a href="${verifyUrl(result.token)}">Verify email</a></p><p>Your workspace URL will be ${env.APP_URL}</p>`,
    );

    return {
      company: {
        id: result.company.id,
        name: result.company.name,
        slug: result.company.slug,
        url: `https://${env.APP_URL}`,
      },
      subscription: {
        id: result.subscription.id,
        planCode: x.planCode,
        users,
        storageGb,
        priceCents: price,
        status: result.subscription.status,
      },
      checkout,
      verificationUrl:
        env.BILLING_MODE === "preview" ? verifyUrl(result.token) : undefined,
    };
  }

  async verifyEmail(tokenRaw: unknown) {
    const token = String(tokenRaw || "");
    const row = await this.db.verificationToken.findFirst({
      where: {
        tokenHash: hashToken(token),
        type: "EMAIL_VERIFICATION",
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!row) {
      throw new AppError("Invalid or expired verification token", 400);
    }

    await this.db.$transaction([
      this.db.user.update({
        where: { id: row.userId },
        data: { emailVerifiedAt: new Date(), status: "ACTIVE" },
      }),
      this.db.verificationToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);

    const companyId = row.user.companyId;
    const subscription = companyId
      ? await this.db.subscription.findUnique({
          where: { companyId },
          select: { id: true },
        })
      : null;

    return {
      ok: true,
      companyId,
      subscriptionId: subscription?.id || null,
    };
  }

  async login(emailRaw: unknown, passwordRaw: unknown) {
    const email = String(emailRaw || "")
      .toLowerCase()
      .trim();
    const password = String(passwordRaw || "");

    if (!email || !password) {
      throw new AppError("Email and password are required", 400);
    }

    const u = await this.db.user.findUnique({ where: { email } });
    if (
      !u ||
      !u.passwordHash ||
      !(await verifyPassword(password, u.passwordHash))
    ) {
      throw new AppError("Invalid email or password", 401);
    }
    if (!u.emailVerifiedAt) {
      throw new AppError("Please verify your email before logging in", 403);
    }
    if (u.status === "SUSPENDED") {
      throw new AppError("Account suspended", 403);
    }

    const subscription = u.companyId
      ? await this.db.subscription.findUnique({
          where: { companyId: u.companyId },
          select: { status: true, planCode: true, addons: true },
        })
      : null;

    if (subscription?.status === "PENDING" && env.BILLING_MODE === "stripe") {
      throw new AppError(
        "Payment is required before your workspace can be activated",
        402,
      );
    }

    const accessToken = signAccess({
      id: u.id,
      role: u.role,
      companyId: u.companyId,
      email: u.email,
    });

    return {
      token: accessToken,
      user: {
        id: u.id,
        email: u.email,
        name: u.uniqueName,
        role: u.role,
        companyId: u.companyId,
        planCode: subscription?.planCode || null,
        addons: subscription?.addons || {},
      },
    };
  }

  async forgotPassword(emailRaw: unknown) {
    const email = String(emailRaw || "")
      .toLowerCase()
      .trim();
    const u = await this.db.user.findUnique({ where: { email } });
    console.log(u, "Email of the user");

    if (u) {
      const token = randomToken();
      await this.db.verificationToken.create({
        data: {
          userId: u.id,
          tokenHash: hashToken(token),
          type: "PASSWORD_RESET",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      const result = await sendUserEmail(
        email,
        "SecureFile password reset",
        `<p><a href="${resetUrl(token)}">Reset your password</a></p><p>This link expires in 24 hours.</p>`,
      );
      console.log(result, "result of forgot email");
    }

    return {
      message: "If the email exists, a reset message has been sent.",
    };
  }

  async resetPassword(tokenRaw: unknown, passwordRaw: unknown) {
    const token = String(tokenRaw || "");
    const password = String(passwordRaw || "");

    if (password.length < 10) {
      throw new AppError("Password must be at least 10 characters", 400);
    }

    const row = await this.db.verificationToken.findFirst({
      where: {
        tokenHash: hashToken(token),
        type: "PASSWORD_RESET",
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!row) {
      throw new AppError("Invalid or expired reset token", 400);
    }

    await this.db.$transaction([
      this.db.user.update({
        where: { id: row.userId },
        data: { passwordHash: await hashPassword(password) },
      }),
      this.db.verificationToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { ok: true };
  }
}

export const authService = new AuthService(db);
