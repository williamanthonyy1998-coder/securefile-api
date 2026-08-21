import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { db } from '../db';
import { auth, role, AuthedRequest } from '../middleware/auth';
import { hashPassword, safeSlug } from '../utils/security';
import { addonSchema, calculatePrice, getPlan, pricePlan } from '../services/pricing';
import { z } from 'zod';

const r = Router();
r.use(auth, role('SUPER_ADMIN'));

async function slugFor(name: string) {
  const base = safeSlug(name);
  let slug = base;
  for (let i = 0; i < 10; i++) {
    if (!await db.company.findUnique({ where: { slug } })) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
  }
  throw new Error('Could not allocate company URL');
}


r.get('/companies', async (_req, res, next) => {
  try {
    const companies = await db.company.findMany({
      include: { subscription: true, _count: { select: { users: true, files: true, folders: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(companies);
  } catch (e) { next(e); }
});

r.post('/companies', async (req: AuthedRequest, res, next) => {
  try {
    const { name, email, businessIndustry = 'Other', businessDescription = '', planCode = 'CUSTOM', storageGb = 10, users = 1, months = 1, addons = {}, adminEmail, adminName, adminPassword } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Company name and contact email are required' });
    const companyEmail = z.string().email().safeParse(String(email).trim().toLowerCase());
    if (!companyEmail.success) return res.status(400).json({ error: 'Enter a valid company email address' });
    if (adminEmail) { const adminEmailCheck = z.string().email().safeParse(String(adminEmail).trim().toLowerCase()); if (!adminEmailCheck.success) return res.status(400).json({ error: 'Enter a valid Company Admin email address' }); }

    const normalizedPlan = String(planCode || 'CUSTOM').toUpperCase();
    if (!['STARTER','BUSINESS','PROFESSIONAL','CUSTOM'].includes(normalizedPlan)) return res.status(400).json({ error: 'Invalid plan code' });
    const fixedPlan = normalizedPlan === 'CUSTOM' ? null : getPlan(normalizedPlan);
    const userLimit = fixedPlan ? Math.max(fixedPlan.users, Math.floor(Number(users) || fixedPlan.users)) : Math.max(1, Math.floor(Number(users) || 1));
    const storageLimit = fixedPlan ? Math.max(fixedPlan.storageGb, Number(storageGb) || fixedPlan.storageGb) : Math.max(1, Number(storageGb) || 10);
    const billingMonths = Math.max(1, Math.floor(Number(months) || 1));
    const selectedAddons = addonSchema.parse(fixedPlan?.addons ?? addons ?? {});
    const quote = fixedPlan ? pricePlan(fixedPlan.code, billingMonths, userLimit, storageLimit) : calculatePrice(userLimit, storageLimit, billingMonths, selectedAddons);
    const slug = await slugFor(String(name));

    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const company = await tx.company.create({
        data: {
          name: String(name),
          slug,
          contactEmail: companyEmail.data,
          businessIndustry: String(businessIndustry),
          businessDescription: String(businessDescription || '') || null,
          storageLimitGb: storageLimit
        }
      });

      await tx.subscription.create({
        data: {
          companyId: company.id,
          planCode: normalizedPlan,
          users: userLimit,
          storageGb: storageLimit,
          months: billingMonths,
          priceCents: quote.amountCents,
          status: 'ACTIVE',
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + billingMonths * 30 * 24 * 60 * 60 * 1000),
          provider: 'SUPER_ADMIN',
          addons: selectedAddons
        }
      });

      if (adminEmail && adminName && adminPassword) {
        const user = await tx.user.create({
          data: {
            companyId: company.id,
            email: String(adminEmail).trim().toLowerCase(),
            uniqueName: String(adminName),
            passwordHash: await hashPassword(String(adminPassword)),
            role: 'COMPANY_ADMIN',
            status: 'ACTIVE',
            emailVerifiedAt: new Date()
          }
        });
        await tx.folder.create({ data: { companyId: company.id, ownerId: user.id, name: 'Personal Folder', isPersonal: true } });
      }

      return company;
    });

    res.status(201).json({ company: result, url: process.env.APP_URL || 'http://localhost:5173' });
  } catch (e) { next(e); }
});

r.patch('/companies/:id', async (req, res, next) => {
  try {
    const c = await db.company.findUnique({ where: { id: req.params.id } });
    if (!c) return res.status(404).json({ error: 'Company not found' });

    const requestedPlan = String(req.body.planCode ?? 'CUSTOM').toUpperCase();
    if (!['STARTER','BUSINESS','PROFESSIONAL','CUSTOM'].includes(requestedPlan)) return res.status(400).json({ error: 'Invalid plan code' });
    const fixedPlan = requestedPlan === 'CUSTOM' ? null : getPlan(requestedPlan);
    const users = fixedPlan ? Math.max(fixedPlan.users, Math.floor(Number(req.body.users) || fixedPlan.users)) : Math.max(1, Math.floor(Number(req.body.users) || 1));
    const storageGb = fixedPlan ? Math.max(fixedPlan.storageGb, Number(req.body.storageGb ?? c.storageLimitGb) || fixedPlan.storageGb) : Math.max(1, Number(req.body.storageGb ?? c.storageLimitGb) || 10);
    const months = Math.max(1, Math.floor(Number(req.body.months ?? 1) || 1));
    const currentUserCount = await db.user.count({ where: { companyId: c.id } });
    if (users < currentUserCount) return res.status(409).json({ error: `Users included cannot be below the ${currentUserCount} existing company users.` });
    const existingSubscription = await db.subscription.findUnique({ where: { companyId: c.id } });
    const selectedAddons = addonSchema.parse(fixedPlan?.addons ?? req.body.addons ?? existingSubscription?.addons ?? {});
    const quote = fixedPlan ? pricePlan(fixedPlan.code, months, users, storageGb) : calculatePrice(users, storageGb, months, selectedAddons);

    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const company = await tx.company.update({
        where: { id: c.id },
        data: {
          name: req.body.name ?? c.name,
          contactEmail: req.body.contactEmail ?? c.contactEmail,
          businessIndustry: req.body.businessIndustry ?? c.businessIndustry,
          businessDescription: req.body.businessDescription ?? c.businessDescription,
          logoUrl: req.body.logoUrl ?? c.logoUrl,
          storageLimitGb: storageGb
        }
      });

      const existing = await tx.subscription.findUnique({ where: { companyId: c.id } });
      const subscription = existing
        ? await tx.subscription.update({
            where: { companyId: c.id },
            data: {
              planCode: requestedPlan, users, storageGb, months, priceCents: quote.amountCents, addons: selectedAddons,
              expiresAt: new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000)
            }
          })
        : await tx.subscription.create({
            data: {
              companyId: c.id, planCode: requestedPlan, users, storageGb, months,
              priceCents: quote.amountCents, status: 'ACTIVE',
              startsAt: new Date(), expiresAt: new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000),
              provider: 'SUPER_ADMIN', addons: selectedAddons
            }
          });

      return { company, subscription };
    });

    res.json(result);
  } catch (e) { next(e); }
});

r.delete('/companies/:id', async (req, res, next) => {
  try {
    await db.company.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default r;
