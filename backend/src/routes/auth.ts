import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { db } from "../db";
import {
  hashPassword,
  verifyPassword,
  signAccess,
  randomToken,
  hashToken,
  safeSlug,
} from "../utils/security";
import { sendUserEmail } from "../services/email";
import { createCheckoutSession } from "../services/payment";
import { z } from "zod";
import { env } from "../config/env";
import {
  calculatePrice,
  addonSchema,
  getPlan,
  pricePlan,
} from "../services/pricing";
const r = Router();
const signup = z.object({
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
  addons: any,
  planCode: string,
) {
  if (planCode && planCode !== "CUSTOM")
    return pricePlan(planCode as any, months).amountCents;
  return calculatePrice(users, gb, months, addons).amountCents;
}
async function uniqueSlug(name: string) {
  const base = safeSlug(name);
  let slug = base;
  for (let i = 0; i < 10; i++) {
    if (!(await db.company.findUnique({ where: { slug } }))) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
  }
  throw new Error("Could not allocate company URL");
}

r.post("/signup", async (req, res, next) => {
  try {
    const x = signup.parse(req.body);
    const plan = x.planCode === "CUSTOM" ? null : getPlan(x.planCode);
    if (plan && x.users < plan.users)
      return res
        .status(400)
        .json({
          error: `${plan.name} includes ${plan.users} users. Additional users can be added, but the included minimum cannot be reduced.`,
        });
    const users = plan ? x.users : x.users;
    const months = x.months;
    const storageGb = plan?.storageGb ?? x.storageGb;
    const addons = addonSchema.parse(plan?.addons ?? x.addons ?? {});
    if (await db.user.findUnique({ where: { email: x.adminEmail } }))
      return res.status(409).json({ error: "Email already registered" });
    const slug = await uniqueSlug(x.companyName);
    const passwordHash = await hashPassword(x.password);
    const price = plan
      ? pricePlan(plan.code, months, users, storageGb).amountCents
      : priceCents(users, storageGb, months, addons, x.planCode);
    const result = await db.$transaction(
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
    res
      .status(201)
      .json({
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
      });
  } catch (e) {
    next(e);
  }
});

r.post("/verify-email", async (req, res, next) => {
  try {
    const token = String(req.body.token || "");
    const row = await db.verificationToken.findFirst({
      where: {
        tokenHash: hashToken(token),
        type: "EMAIL_VERIFICATION",
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!row)
      return res
        .status(400)
        .json({ error: "Invalid or expired verification token" });
    await db.$transaction([
      db.user.update({
        where: { id: row.userId },
        data: { emailVerifiedAt: new Date(), status: "ACTIVE" },
      }),
      db.verificationToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);
    const companyId = row.user.companyId;
    const subscription = companyId
      ? await db.subscription.findUnique({
          where: { companyId },
          select: { id: true },
        })
      : null;
    res.json({ ok: true, companyId, subscriptionId: subscription?.id || null });
  } catch (e) {
    next(e);
  }
});

r.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
      });
    }

    const u = await db.user.findUnique({
      where: { email },
    });

    if (
      !u ||
      !u.passwordHash ||
      !(await verifyPassword(password, u.passwordHash))
    ) {
      return res.status(401).json({
        error: 'Invalid email or password',
      });
    }

    if (!u.emailVerifiedAt) {
      return res.status(403).json({
        error: 'Please verify your email before logging in',
      });
    }

    if (u.status === 'SUSPENDED') {
      return res.status(403).json({
        error: 'Account suspended',
      });
    }

    if (u.companyId) {
      const subscription = await db.subscription.findUnique({
        where: { companyId: u.companyId },
        select: { status: true },
      });

      if (
        subscription?.status === 'PENDING' &&
        env.BILLING_MODE === 'stripe'
      ) {
        return res.status(402).json({
          error: 'Payment is required before your workspace can be activated',
        });
      }
    }

    const token = signAccess({
      id: u.id,
      role: u.role,
      companyId: u.companyId,
    });

    return res.json({
      token,
      user: {
        id: u.id,
        email: u.email,
        name: u.uniqueName,
        role: u.role,
        companyId: u.companyId,
      },
    });
  } catch (error) {
    console.error('LOGIN_ERROR:', error);
    return next(error);
  }
});

r.post("/forgot-password", async (req, res, next) => {
  try {
    const email = String(req.body.email || "")
      .toLowerCase()
      .trim();
    const u = await db.user.findUnique({ where: { email } });
    console.log(u, "Email of the user")
    if (u) {
      const token = randomToken();
      await db.verificationToken.create({
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
    res.json({
      message: "If the email exists, a reset message has been sent.",
    });
  } catch (e) {
    next(e);
  }
});

r.post("/reset-password", async (req, res, next) => {
  try {
    const token = String(req.body.token || "");
    const password = String(req.body.password || "");
    if (password.length < 10)
      return res
        .status(400)
        .json({ error: "Password must be at least 10 characters" });
    const row = await db.verificationToken.findFirst({
      where: {
        tokenHash: hashToken(token),
        type: "PASSWORD_RESET",
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!row)
      return res.status(400).json({ error: "Invalid or expired reset token" });
    await db.$transaction([
      db.user.update({
        where: { id: row.userId },
        data: { passwordHash: await hashPassword(password) },
      }),
      db.verificationToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
export default r;
