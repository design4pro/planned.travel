/**
 * Subscription/billing helpers — shared by the HTTP routes (app.ts) and the
 * Stripe webhook handler. Pure data access + state mapping; no HTTP concerns.
 *
 * Subscription lifecycle: a `subscription` row (1:1 with the better_auth user)
 * is created lazily with `plan=free`. Stripe webhook events flip it to/from
 * `pro`. The 3-trip Free quota is enforced in POST /api/trips via isActivePro().
 */
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { createDb, subscriptions } from "@planned/db";
import type { CloudflareEnv } from "../lib/env";

type Database = ReturnType<typeof createDb>;

export const FREE_TRIP_LIMIT = 3;
const PRO_ACTIVE = new Set(["active", "trialing"]);
const STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  canceled: "canceled",
  incomplete: "incomplete",
  unpaid: "past_due",
  incomplete_expired: "incomplete",
  paused: "past_due",
};
type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete";

/** Pro = active or trialing subscription. Anything else (incl. none) is free. */
export function isActivePro(row: { plan: string | null; status: string | null } | null | undefined): boolean {
  return !!row && row.plan === "pro" && PRO_ACTIVE.has(row.status ?? "");
}

/** Map Pro price IDs (from env vars) → billing interval. */
export function priceIntervalFromEnv(env: CloudflareEnv): Record<string, "month" | "year"> {
  return {
    [env.STRIPE_PRICE_PRO_MONTHLY]: "month",
    [env.STRIPE_PRICE_PRO_ANNUAL]: "year",
  };
}

/** Return the user's subscription row, inserting a free default if absent. */
export async function getOrCreateSubscription(database: Database, userId: string) {
  const [existing] = await database
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  if (existing) return existing;

  const [created] = await database
    .insert(subscriptions)
    .values({ userId, plan: "free", status: "active" })
    .onConflictDoNothing({ target: subscriptions.userId })
    .returning();
  if (created) return created;

  // Lost a concurrent-insert race (unique user_id) — read the winner.
  const [winner] = await database
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return winner;
}

/** Upsert just the Stripe customer id (used on checkout.session.completed). */
export async function upsertCustomerId(database: Database, userId: string, customerId: string) {
  const row = await getOrCreateSubscription(database, userId);
  if (row.stripeCustomerId === customerId) return;
  await database
    .update(subscriptions)
    .set({ stripeCustomerId: customerId, updatedAt: Date.now() })
    .where(eq(subscriptions.userId, userId));
}

/**
 * Reconcile our subscription row from a Stripe subscription event.
 * Resolves the user via subscription metadata (set at checkout), falling back
 * to an existing row matched by Stripe customer id. A canceled subscription
 * reverts the user to free (keeps stripeCustomerId so the Portal still works
 * for history / re-subscribe).
 */
export interface SubscriptionSyncResult {
  userId: string;
  prevStatus: string | null;
  newStatus: string;
  interval: "month" | "year" | null;
  currentPeriodEnd: number | null;
}

export async function syncSubscriptionFromStripe(
  database: Database,
  sub: Stripe.Subscription,
  priceToInterval: Record<string, "month" | "year">,
): Promise<SubscriptionSyncResult | null> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  let userId = sub.metadata?.userId;
  if (!userId && customerId) {
    const [byCustomer] = await database
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .limit(1);
    userId = byCustomer?.userId;
  }
  if (!userId) return null; // unknown customer — nothing to reconcile

  const priceObj = sub.items.data[0]?.price;
  const priceId = typeof priceObj === "string" ? priceObj : priceObj?.id;

  const canceled = sub.status === "canceled";
  const plan: "free" | "pro" = canceled ? "free" : "pro";
  const interval = priceId ? priceToInterval[priceId] : undefined;
  const status = STATUS_MAP[sub.status] ?? "incomplete";
  // Stripe's dahlia API version dropped `current_period_end` from the Subscription
  // type (→ billing_schedules), but the webhook payload may still carry it; read
  // it defensively. It's display-only (renewal date), not used for quota gating.
  const periodEnd = (sub as { current_period_end?: number }).current_period_end;

  const values = {
    userId,
    stripeCustomerId: customerId ?? null,
    stripeSubscriptionId: canceled ? null : sub.id,
    priceId: priceId ?? null,
    plan,
    status,
    interval: interval ?? null,
    currentPeriodEnd: periodEnd ? periodEnd * 1000 : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    updatedAt: Date.now(),
  };

  const [existing] = await database
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  const prevStatus = existing?.status ?? null;

  if (existing) {
    await database.update(subscriptions).set(values).where(eq(subscriptions.userId, userId));
  } else {
    await database.insert(subscriptions).values({ ...values, createdAt: Date.now() });
  }

  // Transition descriptor — the webhook turns this into 0..1 notification job(s).
  return {
    userId,
    prevStatus,
    newStatus: status,
    interval: interval ?? null,
    currentPeriodEnd: periodEnd ? periodEnd * 1000 : null,
  };
}
