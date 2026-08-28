import type { Prisma } from "@prisma/client";

import { Router } from "express";

import { db } from "../db";

import { auth, role, AuthedRequest } from "../middleware/auth";

import {
  hashPassword,
  randomToken,
  hashToken,
  safeSlug,
} from "../utils/security";

import { sendUserEmail } from "../services/email";

import { env } from "../config/env";

import {
  addonSchema,
  calculatePrice,
  getPlan,
  pricePlan,
} from "../services/pricing";

import { z } from "zod";

const r = Router();

r.use(auth, role("SUPER_ADMIN"));

async function slugFor(name: string) {
  const base = safeSlug(name);

  let slug = base;

  for (let i = 0; i < 10; i++) {
    if (!(await db.company.findUnique({ where: { slug } }))) {
      return slug;
    }

    slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
  }

  throw new Error("Could not allocate company URL");
}

r.get("/companies", async (_req, res, next) => {
  try {
    const companies = await db.company.findMany({
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

    res.json(companies);
  } catch (e) {
    next(e);
  }
});

r.post("/companies", async (req: AuthedRequest, res, next) => {
  try {
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
    } = req.body;


    if (!name || !email) {
      return res.status(400).json({
        error: "Company name and contact email are required",
      });
    }

    const companyEmail = z
      .string()
      .email()
      .safeParse(String(email).trim().toLowerCase());

    if (!companyEmail.success) {
      return res.status(400).json({
        error: "Enter a valid company email address",
      });
    }

    if (!adminEmail || !adminName || !adminPassword) {
      return res.status(400).json({
        error: "Company Admin email, name and password are required",
      });
    }

    const normalizedAdminEmail = String(adminEmail).trim().toLowerCase();

    const adminEmailCheck = z.string().email().safeParse(normalizedAdminEmail);

    if (!adminEmailCheck.success) {
      return res.status(400).json({
        error: "Enter a valid Company Admin email address",
      });
    }

    if (String(adminName).trim().length < 2) {
      return res.status(400).json({
        error: "Company Admin name must be at least 2 characters",
      });
    }

    if (String(adminPassword).length < 10) {
      return res.status(400).json({
        error: "Company Admin password must be at least 10 characters",
      });
    }

    const existingAdmin = await db.user.findUnique({
      where: {
        email: normalizedAdminEmail,
      },
    });

    if (existingAdmin) {
      return res.status(409).json({
        error: "Company Admin email is already registered",
      });
    }

    const normalizedPlan = String(planCode || "CUSTOM").toUpperCase();

    if (
      !["STARTER", "BUSINESS", "PROFESSIONAL", "CUSTOM"].includes(
        normalizedPlan,
      )
    ) {
      return res.status(400).json({
        error: "Invalid plan code",
      });
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

    const slug = await slugFor(String(name));

    const result = await db.$transaction(
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

        const subscription = await tx.subscription.create({
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

            // Token valid for 24 hours
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });

        return {
          company,
          subscription,
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

    res.status(201).json({
      company: result.company,
      url: process.env.APP_URL || "http://localhost:5173",
    });

  } catch (e) {
    next(e);
  }
});

r.patch("/companies/:id", async (req, res, next) => {
  try {
    const c = await db.company.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!c) {
      return res.status(404).json({
        error: "Company not found",
      });
    }

    const requestedPlan = String(req.body.planCode ?? "CUSTOM").toUpperCase();

    if (
      !["STARTER", "BUSINESS", "PROFESSIONAL", "CUSTOM"].includes(requestedPlan)
    ) {
      return res.status(400).json({
        error: "Invalid plan code",
      });
    }

    const fixedPlan =
      requestedPlan === "CUSTOM" ? null : getPlan(requestedPlan);

    const users = fixedPlan
      ? Math.max(
        fixedPlan.users,
        Math.floor(Number(req.body.users) || fixedPlan.users),
      )
      : Math.max(1, Math.floor(Number(req.body.users) || 1));

    const storageGb = fixedPlan
      ? Math.max(
        fixedPlan.storageGb,
        Number(req.body.storageGb ?? c.storageLimitGb) || fixedPlan.storageGb,
      )
      : Math.max(1, Number(req.body.storageGb ?? c.storageLimitGb) || 10);

    const months = Math.max(1, Math.floor(Number(req.body.months ?? 1) || 1));

    const currentUserCount = await db.user.count({
      where: {
        companyId: c.id,
      },
    });

    if (users < currentUserCount) {
      return res.status(409).json({
        error: `Users included cannot be below the ${currentUserCount} existing company users.`,
      });
    }

    const existingSubscription = await db.subscription.findUnique({
      where: {
        companyId: c.id,
      },
    });

    const selectedAddons = addonSchema.parse(
      fixedPlan?.addons ??
      req.body.addons ??
      existingSubscription?.addons ??
      {},
    );

    const quote = fixedPlan
      ? pricePlan(fixedPlan.code, months, users, storageGb)
      : calculatePrice(users, storageGb, months, selectedAddons);

    const result = await db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const company = await tx.company.update({
          where: {
            id: c.id,
          },

          data: {
            name: req.body.name ?? c.name,

            contactEmail: req.body.contactEmail ?? c.contactEmail,

            businessIndustry: req.body.businessIndustry ?? c.businessIndustry,

            businessDescription:
              req.body.businessDescription ?? c.businessDescription,

            logoUrl: req.body.logoUrl ?? c.logoUrl,

            storageLimitGb: storageGb,
          },
        });

        const existing = await tx.subscription.findUnique({
          where: {
            companyId: c.id,
          },
        });

        const subscription = existing
          ? await tx.subscription.update({
            where: {
              companyId: c.id,
            },

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

        return {
          company,
          subscription,
        };
      },
    );

    return res.json(result);
  } catch (e) {
    next(e);
  }
});

r.delete("/companies/:id", async (req, res, next) => {
  try {
    await db.company.delete({
      where: {
        id: req.params.id,
      },
    });

    return res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default r;
