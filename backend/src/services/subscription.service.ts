import crypto from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";

import { env } from "../config/env";
import { db } from "../db";
import { AppError } from "../utils/errors";
import {
  cancelStripeSubscription,
  createCheckoutSession,
  setStripeSubscriptionCancelAtPeriodEnd,
  verifyStripeSignature,
} from "./payment";
import { addonSchema, calculatePrice, getPlan, pricePlan } from "./pricing";
import { notify } from "./notify";

export type QuoteInput = {
  users?: unknown;
  storageGb?: unknown;
  months?: unknown;
  addons?: unknown;
};

export type CheckoutInput = {
  planCode?: unknown;
  users?: unknown;
  storageGb?: unknown;
  months?: unknown;
};

export type StripeWebhookResult =
  | { kind: "text"; status: number; body: string }
  | { kind: "json"; body: Record<string, unknown> };

class SubscriptionService {
  constructor(private readonly db: PrismaClient) {}

  async getMine(companyId: string) {
    return this.db.subscription.findUnique({ where: { companyId } });
  }

  getQuote(input: QuoteInput) {
    return calculatePrice(
      Number(input.users),
      Number(input.storageGb),
      Number(input.months),
      addonSchema.parse(input.addons || {}),
    );
  }

  async getChangeQuote(companyId: string, input: QuoteInput) {
    const s = await this.db.subscription.findUnique({ where: { companyId } });
    if (!s) throw new AppError("Subscription not found", 404);

    const users = Math.max(s.users, Number(input.users) || s.users);
    const storageGb = Math.max(
      s.storageGb,
      Number(input.storageGb) || s.storageGb,
    );
    const months = Math.max(1, Math.min(120, Number(input.months) || 1));
    const plan = getPlan(s.planCode);
    const addons = addonSchema.parse(plan?.addons ?? s.addons ?? {});
    const quote = plan
      ? pricePlan(plan.code, months, users, storageGb)
      : calculatePrice(
          users,
          storageGb,
          months,
          addons,
          Number(s.storageGb) || 0,
        );

    return {
      quote,
      current: {
        users: s.users,
        storageGb: s.storageGb,
        planCode: s.planCode,
        addons,
      },
    };
  }

  async cancel(companyId: string) {
    const s = await this.db.subscription.findUnique({ where: { companyId } });
    if (!s) throw new AppError("Subscription not found.", 404);
    if (s.status === "SUSPENDED" || (s.expiresAt && s.expiresAt <= new Date())) {
      throw new AppError(
        "This subscription has already expired. Renew it to restore access.",
        400,
      );
    }

    // SecureFile Option A is upfront, non-recurring billing. Cancellation is an
    // immediate customer-requested suspension: the workspace and all data remain
    // preserved, but protected workspace actions stop immediately. Renewal from
    // Settings is still allowed and payment is the only authority that restores
    // access. Legacy recurring Stripe subscriptions are canceled immediately too.
    let stripeCanceled = false;
    if (s.stripeSubscriptionId?.startsWith("sub_")) {
      const updated: any = await cancelStripeSubscription(
        s.stripeSubscriptionId,
      ).catch(() => null);
      stripeCanceled = Boolean(updated);
    }
    await this.db.subscription.update({
      where: { id: s.id },
      data: { status: "SUSPENDED", cancelAtPeriodEnd: false },
    });
    const users = await this.db.user.findMany({
      where: { companyId, status: { not: "SUSPENDED" } },
      select: { id: true },
    });
    for (const u of users) {
      await notify(
        u.id,
        "Subscription canceled",
        "Your SecureFile workspace is now suspended. Your data is preserved. Renew from Settings to restore full access.",
        companyId,
        undefined,
        true,
      );
    }
    return { ok: true, status: "SUSPENDED", stripeCanceled };
  }

  async reactivate(companyId: string) {
    const s = await this.db.subscription.findUnique({ where: { companyId } });
    if (!s) throw new AppError("Subscription not found.", 404);
    if (s.status === "SUSPENDED" || (s.expiresAt && s.expiresAt <= new Date())) {
      throw new AppError(
        "This subscription has already expired. Use Renew Subscription instead.",
        400,
      );
    }
    if (s.stripeSubscriptionId?.startsWith("sub_")) {
      await setStripeSubscriptionCancelAtPeriodEnd(
        s.stripeSubscriptionId,
        false,
      );
    }
    await this.db.subscription.update({
      where: { id: s.id },
      data: { cancelAtPeriodEnd: false },
    });
    const users = await this.db.user.findMany({
      where: { companyId, status: { not: "SUSPENDED" } },
      select: { id: true },
    });
    for (const u of users) {
      await notify(
        u.id,
        "Subscription reactivated",
        "Your current paid SecureFile period will continue normally.",
        companyId,
        undefined,
        true,
      );
    }
    return { ok: true, cancelAtPeriodEnd: false };
  }

  async checkout(companyId: string, input: CheckoutInput) {
    const s = await this.db.subscription.findUnique({
      where: { companyId },
      include: { company: { select: { contactEmail: true, name: true } } },
    });
    if (!s) throw new AppError("Subscription not found", 404);

    // Renewals are allowed after expiry/suspension. Payment webhook is the only authority that restores access.
    const requestedPlan = String(input.planCode || s.planCode || "CUSTOM").toUpperCase();
    const plan = requestedPlan === "CUSTOM" ? null : getPlan(requestedPlan);
    const users = Math.max(1, Number(input.users) || s.users);
    if (users < s.users) {
      throw new AppError(
        `You cannot reduce purchased users here. Current users: ${s.users}.`,
        400,
      );
    }
    const storageGb = plan
      ? Math.max(plan.storageGb, Number(input.storageGb) || s.storageGb)
      : Math.max(s.storageGb, Number(input.storageGb) || s.storageGb);
    if (storageGb < s.storageGb) {
      throw new AppError(
        `You cannot reduce storage here. Current storage: ${s.storageGb} GB.`,
        400,
      );
    }
    const months = Math.max(1, Math.min(120, Number(input.months) || 1));
    const addons = addonSchema.parse(plan?.addons ?? s.addons ?? {});
    const quote = plan
      ? pricePlan(plan.code, months, users, storageGb)
      : calculatePrice(
          users,
          storageGb,
          months,
          addons,
          Number(s.storageGb) || 0,
        );
    const checkout = await createCheckoutSession({
      companyId,
      email: s.company.contactEmail,
      totalAmountCents: quote.amountCents,
      description: `${s.company.name} — ${plan?.name || "Enterprise"} ${s.status === "ACTIVE" ? "capacity upgrade" : "renewal"}: ${users} users, ${storageGb} GB, ${months} month${months === 1 ? "" : "s"} upfront`,
      metadata: {
        companyId,
        subscriptionId: s.id,
        planCode: plan?.code || s.planCode || "CUSTOM",
        users: String(users),
        storageGb: String(storageGb),
        months: String(months),
        priceCents: String(quote.amountCents),
        totalPriceCents: String(quote.amountCents),
        addons: JSON.stringify(addons),
        changeType: s.status === "ACTIVE" ? "UPGRADE" : "RENEWAL",
      },
    });
    await this.db.subscription.update({
      where: { id: s.id },
      data: {
        pendingPlanCode: plan?.code || s.planCode || "CUSTOM",
        pendingUsers: users,
        pendingStorageGb: storageGb,
        pendingMonths: months,
        pendingPriceCents: quote.amountCents,
        pendingAddons: addons,
        pendingCheckoutId: checkout.id || null,
      },
    });
    return {
      ...checkout,
      quote,
      pending: {
        users,
        storageGb,
        months,
        planCode: plan?.code || s.planCode || "CUSTOM",
      },
    };
  }

  async handleStripeWebhook(
    raw: Buffer,
    signature: string,
  ): Promise<StripeWebhookResult> {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      return { kind: "text", status: 503, body: "Webhook not configured" };
    }
    if (
      !Buffer.isBuffer(raw) ||
      !verifyStripeSignature(raw, signature, env.STRIPE_WEBHOOK_SECRET)
    ) {
      return { kind: "text", status: 400, body: "Invalid signature" };
    }

    let event: any;
    try {
      event = JSON.parse(raw.toString("utf8"));
    } catch {
      return { kind: "text", status: 400, body: "Invalid JSON" };
    }

    try {
      const inserted = await this.db.$queryRaw<Array<{ id: string }>>`
        INSERT INTO "PaymentEvent" ("id","provider","eventId","eventType","createdAt")
        VALUES (${crypto.randomUUID()}, 'stripe', ${String(event.id)}, ${String(event.type)}, NOW())
        ON CONFLICT ("eventId") DO NOTHING
        RETURNING "id"
      `;
      if (!inserted.length) {
        return { kind: "json", body: { received: true, duplicate: true } };
      }

      const obj = event.data?.object || {};
      const metadata = obj.metadata || {};
      const companyId = String(metadata.companyId || "");
      const subscriptionId = String(metadata.subscriptionId || "");

      if (event.type === "checkout.session.completed") {
        if (obj.payment_status !== "paid" && obj.mode !== "subscription") {
          return { kind: "json", body: { received: true, pending: true } };
        }
        if (companyId && subscriptionId) {
          const current = await this.db.subscription.findUnique({
            where: { id: subscriptionId },
          });
          if (current) {
            const starts = new Date();
            const users = Number(metadata.users) || current.users;
            const storageGb = Number(metadata.storageGb) || current.storageGb;
            const months = Number(metadata.months) || 1;
            const totalPriceCents =
              Number(metadata.totalPriceCents) ||
              Number(obj.amount_total) ||
              current.priceCents;
            const addons = metadata.addons
              ? addonSchema.parse(JSON.parse(metadata.addons))
              : ((current.addons || {}) as any);
            const newCustomerId = String(obj.customer || "");
            const expires = new Date(
              starts.getTime() + months * 30 * 24 * 60 * 60 * 1000,
            );
            await this.db.$transaction([
              this.db.subscription.update({
                where: { id: subscriptionId },
                data: {
                  planCode: String(metadata.planCode || current.planCode),
                  users,
                  storageGb,
                  months,
                  priceCents: totalPriceCents,
                  status: "ACTIVE",
                  startsAt: starts,
                  expiresAt: expires,
                  provider: "stripe",
                  providerRef: String(obj.id),
                  stripeCustomerId: newCustomerId || current.stripeCustomerId,
                  stripeSubscriptionId: null,
                  billingInterval: "one-time",
                  cancelAtPeriodEnd: false,
                  addons,
                  pendingPlanCode: null,
                  pendingUsers: null,
                  pendingStorageGb: null,
                  pendingMonths: null,
                  pendingPriceCents: null,
                  pendingAddons: Prisma.JsonNull,
                  pendingCheckoutId: null,
                },
              }),
              this.db.company.update({
                where: { id: companyId },
                data: { storageLimitGb: storageGb },
              }),
            ]);
            const usersToNotify = await this.db.user.findMany({
              where: { companyId, status: { not: "SUSPENDED" } },
              select: { id: true },
            });
            for (const u of usersToNotify) {
              await notify(
                u.id,
                "Payment successful",
                `Your SecureFile access is active for ${months} month${months === 1 ? "" : "s"} after your upfront payment of $${(totalPriceCents / 100).toFixed(2)}.`,
                companyId,
                undefined,
                true,
              );
            }
          }
        }
      } else if (event.type === "invoice.paid") {
        const stripeSubId = String(obj.subscription || "");
        if (stripeSubId) {
          const current = await this.db.subscription.findFirst({
            where: { stripeSubscriptionId: stripeSubId },
          });
          if (current) {
            const periodEnd = Number(obj.lines?.data?.[0]?.period?.end || 0);
            await this.db.subscription.update({
              where: { id: current.id },
              data: {
                status: "ACTIVE",
                expiresAt: periodEnd
                  ? new Date(periodEnd * 1000)
                  : new Date(Date.now() + 31 * 86400000),
                provider: "stripe",
                cancelAtPeriodEnd: Boolean(obj.cancel_at_period_end || false),
              },
            });
            const users = await this.db.user.findMany({
              where: {
                companyId: current.companyId,
                status: { not: "SUSPENDED" },
              },
              select: { id: true },
            });
            for (const u of users) {
              await notify(
                u.id,
                "Subscription renewed",
                "Your monthly SecureFile payment was received successfully.",
                current.companyId,
                undefined,
                true,
              );
            }
          }
        }
      } else if (event.type === "invoice.payment_failed") {
        const stripeSubId = String(obj.subscription || "");
        if (stripeSubId) {
          const current = await this.db.subscription.findFirst({
            where: { stripeSubscriptionId: stripeSubId },
          });
          if (current) {
            await this.db.subscription.update({
              where: { id: current.id },
              data: { status: "PAST_DUE" },
            });
            const users = await this.db.user.findMany({
              where: {
                companyId: current.companyId,
                status: { not: "SUSPENDED" },
              },
              select: { id: true },
            });
            for (const u of users) {
              await notify(
                u.id,
                "Payment failed",
                "Your SecureFile subscription payment failed. Please update your payment method to avoid service interruption.",
                current.companyId,
                undefined,
                true,
              );
            }
          }
        }
      } else if (event.type === "customer.subscription.updated") {
        const stripeSubId = String(obj.id || "");
        const current = stripeSubId
          ? await this.db.subscription.findFirst({
              where: { stripeSubscriptionId: stripeSubId },
            })
          : null;
        if (current) {
          const statusMap: any = {
            active: "ACTIVE",
            past_due: "PAST_DUE",
            unpaid: "PAST_DUE",
            canceled: "CANCELED",
            incomplete: "PENDING",
            incomplete_expired: "SUSPENDED",
            paused: "PAST_DUE",
          };
          const mapped = String(statusMap[obj.status] || current.status) as any;
          const periodEnd = Number(obj.current_period_end || 0);
          await this.db.subscription.update({
            where: { id: current.id },
            data: {
              status: mapped,
              expiresAt: periodEnd
                ? new Date(periodEnd * 1000)
                : current.expiresAt,
              cancelAtPeriodEnd: Boolean(obj.cancel_at_period_end || false),
            },
          });
        }
      } else if (event.type === "customer.subscription.deleted") {
        const stripeSubId = String(obj.id || "");
        const current = stripeSubId
          ? await this.db.subscription.findFirst({
              where: { stripeSubscriptionId: stripeSubId },
            })
          : null;
        if (current) {
          await this.db.subscription.update({
            where: { id: current.id },
            data: { status: "CANCELED", cancelAtPeriodEnd: false },
          });
          const users = await this.db.user.findMany({
            where: {
              companyId: current.companyId,
              status: { not: "SUSPENDED" },
            },
            select: { id: true },
          });
          for (const u of users) {
            await notify(
              u.id,
              "Subscription canceled",
              "Your SecureFile subscription has been canceled.",
              current.companyId,
              undefined,
              true,
            );
          }
        }
      }

      return { kind: "json", body: { received: true } };
    } catch (e) {
      console.error(e);
      return { kind: "text", status: 500, body: "Webhook processing failed" };
    }
  }
}

export const subscriptionService = new SubscriptionService(db);
