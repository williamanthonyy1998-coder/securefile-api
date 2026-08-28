import { z } from 'zod';

export const PRICES = {
  baseUser: 10,
  additionalUser: 5,
  advancedAdditionalUser: 10,
  premiumAdditionalUser: 12,
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
export type PlanCode = 'STARTER' | 'BUSINESS' | 'PROFESSIONAL' | 'CUSTOM';

export const PLANS = {
  STARTER: {
    code: 'STARTER' as const,
    name: 'Basic',
    description: 'A secure solo workspace for one Company Admin with 5 GB included storage.',
    users: 1,
    storageGb: 5,
    addons: { preview: false, scanner: false, fax: false, reshare: false, rename: false, postal: false },
    popular: false,
    includedStorageGb: 5,
    fixedMonthly: 10,
    additionalUserMonthly: PRICES.additionalUser
  },
  BUSINESS: {
    code: 'BUSINESS' as const,
    name: 'Advanced',
    description: 'A complete collaboration package for growing teams.',
    users: 1,
    storageGb: 2,
    addons: { preview: true, scanner: true, fax: false, reshare: true, rename: true, postal: false },
    popular: true,
    includedStorageGb: 2,
    fixedMonthly: 15,
    additionalUserMonthly: PRICES.advancedAdditionalUser
  },
  PROFESSIONAL: {
    code: 'PROFESSIONAL' as const,
    name: 'Premium',
    description: 'The full SecureFile toolkit with all platform features.',
    users: 1,
    storageGb: 2,
    addons: { preview: true, scanner: true, fax: true, reshare: true, rename: true, postal: true },
    popular: false,
    includedStorageGb: 2,
    fixedMonthly: 25,
    additionalUserMonthly: PRICES.premiumAdditionalUser
  }
} as const;

export function calculatePrice(users:number, storageGb:number, months:number, addons:Partial<Addons> = {}, includedStorageGb = 0) {
  if (!Number.isInteger(users) || users < 1) throw new Error('Users must be at least 1');
  if (!Number.isInteger(storageGb) || storageGb < 1) throw new Error('Storage must be at least 1 GB');
  if (!Number.isInteger(months) || months < 1) throw new Error('Months must be at least 1');

  const a = addonSchema.parse(addons);
  const userMonthly = PRICES.baseUser + Math.max(0, users - 1) * PRICES.additionalUser;
  const billableStorageGb = Math.max(0, storageGb - Math.max(0, includedStorageGb));
  const storageMonthly = billableStorageGb * PRICES.storageGb;
  const addonMonthly =
    (a.preview ? PRICES.preview * users : 0) +
    (a.scanner ? PRICES.scanner * users : 0) +
    (a.fax ? PRICES.fax * users : 0) +
    (a.reshare ? PRICES.reshare * users : 0) +
    (a.rename ? PRICES.rename * users : 0) +
    (a.postal ? PRICES.postal * users : 0);
  const monthly = userMonthly + storageMonthly + addonMonthly;
  return {
    users, storageGb, months, addons: a, includedStorageGb: Math.max(0, includedStorageGb), billableStorageGb,
    monthly: Number(monthly.toFixed(2)),
    total: Number((monthly * months).toFixed(2)),
    amountCents: Math.round(monthly * months * 100),
    breakdown: { userMonthly, storageMonthly, addonMonthly }
  };
}

export function getPlan(code?: string) {
  const normalized = String(code || 'CUSTOM').toUpperCase() as PlanCode;
  if (normalized === 'CUSTOM') return null;
  return PLANS[normalized as keyof typeof PLANS] || null;
}

export function pricePlan(code: Exclude<PlanCode, 'CUSTOM'>, months = 1, totalUsers?: number, requestedStorageGb?: number) {
  const plan = PLANS[code];
  const users = Math.max(plan.users, Number.isInteger(totalUsers) ? Number(totalUsers) : plan.users);
  const storageGb = Math.max(plan.storageGb, Number.isInteger(requestedStorageGb) ? Number(requestedStorageGb) : plan.storageGb);
  const extraUsers = Math.max(0, users - plan.users);
  const extraUserMonthly = extraUsers * plan.additionalUserMonthly;
  const billableStorageGb = Math.max(0, storageGb - plan.includedStorageGb);
  const storageMonthly = billableStorageGb * PRICES.storageGb;
  const monthly = plan.fixedMonthly + extraUserMonthly + storageMonthly;
  return { ...plan, users, storageGb, months, addons: addonSchema.parse(plan.addons), includedStorageGb: plan.includedStorageGb, billableStorageGb, monthly: Number(monthly.toFixed(2)), total: Number((monthly * months).toFixed(2)), amountCents: Math.round(monthly * months * 100), breakdown: { userMonthly: plan.fixedMonthly + extraUserMonthly, basePlanMonthly: plan.fixedMonthly, additionalUserMonthly: extraUserMonthly, storageMonthly, addonMonthly: 0 } };
}

export function allPlans(months = 1) {
  return (Object.keys(PLANS) as Array<keyof typeof PLANS>).map(code => pricePlan(code, months));
}
