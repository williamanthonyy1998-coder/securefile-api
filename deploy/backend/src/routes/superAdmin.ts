import { Router } from 'express';
import { db } from '../db';
import { auth, role, AuthedRequest } from '../middleware/auth';
import { hashPassword, safeSlug } from '../utils/security';
import { addonSchema, calculatePrice } from '../services/pricing';

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
    const { name, email, storageGb = 10, users = 1, months = 1, addons = {}, adminEmail, adminName, adminPassword } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Company name and contact email are required' });

    const userLimit = Math.max(1, Math.floor(Number(users) || 1));
    const storageLimit = Math.max(1, Number(storageGb) || 10);
    const billingMonths = Math.max(1, Math.floor(Number(months) || 1));
    const selectedAddons = addonSchema.parse(addons || {});
    const quote = calculatePrice(userLimit, storageLimit, billingMonths, selectedAddons);
    const slug = await slugFor(String(name));

    const result = await db.$transaction(async tx => {
      const company = await tx.company.create({
        data: {
          name: String(name),
          slug,
          contactEmail: String(email),
          storageLimitGb: storageLimit
        }
      });

      await tx.subscription.create({
        data: {
          companyId: company.id,
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
            email: String(adminEmail).toLowerCase(),
            uniqueName: String(adminName),
            passwordHash: await hashPassword(String(adminPassword)),
            role: 'COMPANY_ADMIN',
            status: 'ACTIVE',
            emailVerifiedAt: new Date()
          }
        });
        await tx.folder.create({ data: { companyId: company.id, ownerId: user.id, name: 'Personal Folder' } });
      }

      return company;
    });

    res.status(201).json({ company: result, url: `https://${result.slug}.${process.env.PUBLIC_APP_DOMAIN || 'securefile.com'}` });
  } catch (e) { next(e); }
});

r.patch('/companies/:id', async (req, res, next) => {
  try {
    const c = await db.company.findUnique({ where: { id: req.params.id } });
    if (!c) return res.status(404).json({ error: 'Company not found' });

    const users = Math.max(1, Math.floor(Number(req.body.users) || 1));
    const storageGb = Math.max(1, Number(req.body.storageGb ?? c.storageLimitGb) || 10);
    const months = Math.max(1, Math.floor(Number(req.body.months ?? 1) || 1));
    const currentUserCount = await db.user.count({ where: { companyId: c.id } });
    if (users < currentUserCount) return res.status(409).json({ error: `Users included cannot be below the ${currentUserCount} existing company users.` });
    const existingSubscription = await db.subscription.findUnique({ where: { companyId: c.id } });
    const selectedAddons = addonSchema.parse(req.body.addons ?? existingSubscription?.addons ?? {});
    const quote = calculatePrice(users, storageGb, months, selectedAddons);

    const result = await db.$transaction(async tx => {
      const company = await tx.company.update({
        where: { id: c.id },
        data: {
          name: req.body.name ?? c.name,
          contactEmail: req.body.contactEmail ?? c.contactEmail,
          logoUrl: req.body.logoUrl ?? c.logoUrl,
          storageLimitGb: storageGb
        }
      });

      const existing = await tx.subscription.findUnique({ where: { companyId: c.id } });
      const subscription = existing
        ? await tx.subscription.update({
            where: { companyId: c.id },
            data: {
              users, storageGb, months, priceCents: quote.amountCents, addons: selectedAddons,
              expiresAt: new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000)
            }
          })
        : await tx.subscription.create({
            data: {
              companyId: c.id, users, storageGb, months,
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
