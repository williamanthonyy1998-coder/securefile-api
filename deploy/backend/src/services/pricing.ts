import { z } from 'zod';

export const PRICES = {
  baseUser: 10,
  additionalUser: 5,
  storageGb: 0.30,
  preview: 5,
  scanner: 5,
  fax: 5,
  reshare: 1,
  rename: 2,
  postal: 10
} as const;

export const addonSchema = z.object({
  preview: z.boolean().default(false),
  scanner: z.boolean().default(false),
  fax: z.boolean().default(false),
  reshare: z.boolean().default(false),
  rename: z.boolean().default(false),
  postal: z.boolean().default(false)
});

export type Addons = z.infer<typeof addonSchema>;

export function calculatePrice(users:number, storageGb:number, months:number, addons:Partial<Addons> = {}) {
  if (!Number.isInteger(users) || users < 1) throw new Error('Users must be at least 1');
  if (!Number.isInteger(storageGb) || storageGb < 1) throw new Error('Storage must be at least 1 GB');
  if (!Number.isInteger(months) || months < 1) throw new Error('Months must be at least 1');

  const a = addonSchema.parse(addons);
  const userMonthly = PRICES.baseUser + Math.max(0, users - 1) * PRICES.additionalUser;
  const storageMonthly = storageGb * PRICES.storageGb;
  const addonMonthly =
    (a.preview ? PRICES.preview * users : 0) +
    (a.scanner ? PRICES.scanner * users : 0) +
    (a.fax ? PRICES.fax * users : 0) +
    (a.reshare ? PRICES.reshare * users : 0) +
    (a.rename ? PRICES.rename * users : 0) +
    (a.postal ? PRICES.postal * users : 0);
  const monthly = userMonthly + storageMonthly + addonMonthly;
  return {
    users, storageGb, months, addons: a,
    monthly: Number(monthly.toFixed(2)),
    total: Number((monthly * months).toFixed(2)),
    amountCents: Math.round(monthly * months * 100),
    breakdown: { userMonthly, storageMonthly, addonMonthly }
  };
}
