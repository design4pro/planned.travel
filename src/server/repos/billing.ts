/**
 * Billing state and usage counters.
 *
 * Two audiences, two shapes:
 *
 * - **In-app reads** go through {@link getSubscription} and the usage helpers, all tenant-scoped like
 *   every other repository. `assertQuota()` in `./base` resolves its ceilings from the same row.
 * - **Stripe webhooks** have no session and therefore no tenant context: they arrive with a Stripe
 *   customer or subscription id and have to *discover* which organization they belong to. Those three
 *   functions take a plain {@link Database}, are named `…Unscoped`, and are the only functions in
 *   `src/server/repos/**` that may run without a {@link TenantScope}. They return billing rows only —
 *   never trip, place or traveller data — so a mis-signed webhook cannot read a tenant's content.
 */

import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  ORGANIZATION_PLANS,
  SUBSCRIPTION_STATUSES,
  USAGE_METRICS,
  subscriptions,
  usageRecords,
} from '#/server/db/schema'
import { allOf, createTenantRepository, resolveQuotas, tenantFilter } from './base'
import { NotFoundError } from './context'
import { currencySchema, definedOnly, idSchema, instantSchema, nonNegativeIntSchema } from './validation'
import type { PlanId } from '#/lib/plans'
import type { QuotaOverrides } from '#/server/db/schema'
import type { Database, Subscription, UsageMetric, UsageRecord } from '#/server/db/types'
import type { TenantScope } from './base'

export const subscriptionsRepository = createTenantRepository(subscriptions, 'subscription')
export const usageRecordsRepository = createTenantRepository(usageRecords, 'usage record')

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const planSchema = z.enum(ORGANIZATION_PLANS)
const statusSchema = z.enum(SUBSCRIPTION_STATUSES)
const metricSchema = z.enum(USAGE_METRICS)

/**
 * Overrides are sparse by definition — a metric with no entry falls back to the plan.
 * `z.record()` over an enum key is *exhaustive* in Zod 4, so it rejected `{}` and
 * `{ trips: 2 }` alike and no ceiling write could ever have landed; `z.partialRecord()`
 * is the sparse form.
 */
const quotaOverridesSchema: z.ZodType<QuotaOverrides> = z.partialRecord(
  metricSchema,
  z.number().int().min(0),
)

export const upsertSubscriptionInput = z.object({
  plan: planSchema.optional(),
  status: statusSchema.optional(),
  stripeCustomerId: z.string().trim().min(1).max(64).nullish(),
  stripeSubscriptionId: z.string().trim().min(1).max(64).nullish(),
  stripePriceId: z.string().trim().min(1).max(64).nullish(),
  seats: nonNegativeIntSchema.max(10_000).optional(),
  currency: currencySchema.nullish(),
  unitAmountMinor: nonNegativeIntSchema.nullish(),
  currentPeriodStart: instantSchema.nullish(),
  currentPeriodEnd: instantSchema.nullish(),
  cancelAtPeriodEnd: z.boolean().optional(),
  canceledAt: instantSchema.nullish(),
  trialEndsAt: instantSchema.nullish(),
  quotaOverrides: quotaOverridesSchema.nullish(),
  seatLimit: nonNegativeIntSchema.max(100_000).optional(),
  storageLimitBytes: nonNegativeIntSchema.optional(),
})
export type UpsertSubscriptionInput = z.infer<typeof upsertSubscriptionInput>

export const setUsageInput = z.object({
  metric: metricSchema,
  /** `YYYY-MM` for metered metrics, `all` for cumulative ones. */
  period: z
    .string()
    .trim()
    .regex(/^(?:all|\d{4}-(?:0[1-9]|1[0-2]))$/, 'must be `all` or `YYYY-MM`')
    .optional(),
  value: nonNegativeIntSchema,
})
export type SetUsageInput = z.infer<typeof setUsageInput>

/* -------------------------------------------------------------------------------------------------
 * Subscription (tenant-scoped)
 * ---------------------------------------------------------------------------------------------- */

/** The workspace's billing row, or `null` while it is still on the free plan. */
export async function getSubscription(scope: TenantScope): Promise<Subscription | null> {
  const rows = await subscriptionsRepository.findMany(scope, { limit: 1 })
  return rows[0] ?? null
}

/** Creates or patches the workspace's single billing row. */
export async function upsertSubscription(
  scope: TenantScope,
  input: UpsertSubscriptionInput,
): Promise<Subscription> {
  const values = definedOnly(upsertSubscriptionInput.parse(input))
  const existing = await getSubscription(scope)
  if (existing) {
    return subscriptionsRepository.requireUpdate(scope, existing.id, values)
  }
  return subscriptionsRepository.insert(scope, values)
}

export interface PlanSummary {
  /** The coarse tier column. `planId` is what a customer is told they are on. */
  readonly plan: (typeof ORGANIZATION_PLANS)[number]
  readonly planId: PlanId
  readonly status: (typeof SUBSCRIPTION_STATUSES)[number]
  readonly seats: number
  readonly cancelAtPeriodEnd: boolean
  readonly currentPeriodEnd: Date | null
  readonly trialEndsAt: Date | null
  readonly limits: Record<UsageMetric, number>
}

/** Plan, status and the resolved quota ceilings — the billing screen header. */
export async function getPlanSummary(scope: TenantScope): Promise<PlanSummary> {
  const [row, quotas] = await Promise.all([getSubscription(scope), resolveQuotas(scope)])
  return {
    plan: quotas.plan,
    planId: quotas.planId,
    status: row === null ? 'active' : statusSchema.catch('active').parse(row.status),
    seats: row?.seats ?? 1,
    cancelAtPeriodEnd: row?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: row?.currentPeriodEnd ?? null,
    trialEndsAt: row?.trialEndsAt ?? null,
    limits: quotas.limits,
  }
}

/* -------------------------------------------------------------------------------------------------
 * Usage counters (tenant-scoped)
 * ---------------------------------------------------------------------------------------------- */

const CUMULATIVE_PERIOD = 'all'

export async function listUsageRecords(
  scope: TenantScope,
  options: { readonly period?: string } = {},
): Promise<Array<UsageRecord>> {
  return usageRecordsRepository.findMany(scope, {
    where: options.period ? eq(usageRecords.period, options.period) : undefined,
    orderBy: [asc(usageRecords.metric), desc(usageRecords.period)],
  })
}

export async function getUsageRecord(
  scope: TenantScope,
  metric: UsageMetric,
  period = CUMULATIVE_PERIOD,
): Promise<UsageRecord | null> {
  return usageRecordsRepository.findOne(
    scope,
    allOf(eq(usageRecords.metric, metricSchema.parse(metric)), eq(usageRecords.period, period)),
  )
}

/** Sets a counter to an exact value — used after a recount. */
export async function setUsage(scope: TenantScope, input: SetUsageInput): Promise<UsageRecord> {
  const values = setUsageInput.parse(input)
  const period = values.period ?? CUMULATIVE_PERIOD
  const existing = await getUsageRecord(scope, values.metric, period)
  if (existing) {
    return usageRecordsRepository.requireUpdate(scope, existing.id, { value: values.value })
  }
  return usageRecordsRepository.insert(scope, {
    metric: values.metric,
    period,
    value: values.value,
  })
}

/**
 * Moves a counter by `delta`, clamped at zero. The increment happens in SQL so two concurrent
 * requests cannot both read the same value and write it back.
 */
export async function bumpUsage(
  scope: TenantScope,
  metric: UsageMetric,
  delta: number,
  period = CUMULATIVE_PERIOD,
): Promise<UsageRecord> {
  const parsedMetric = metricSchema.parse(metric)
  const step = z.number().int().parse(delta)
  const existing = await getUsageRecord(scope, parsedMetric, period)

  if (!existing) {
    return usageRecordsRepository.insert(scope, {
      metric: parsedMetric,
      period,
      value: Math.max(step, 0),
    })
  }

  // Expressed in SQL rather than read-modify-write so concurrent bumps cannot lose an increment.
  const rows = await scope.db
    .update(usageRecords)
    .set({ value: sql`MAX(${usageRecords.value} + ${step}, 0)` })
    .where(tenantFilter(scope, usageRecords, eq(usageRecords.id, existing.id)))
    .returning()
  const row = rows.at(0)
  if (row === undefined) {
    throw new NotFoundError('usage record', existing.id)
  }
  return row
}

/** Counters for the current calendar month, keyed by metric. */
export async function getMonthlyUsage(
  scope: TenantScope,
  month = new Date().toISOString().slice(0, 7),
): Promise<Map<UsageMetric, number>> {
  const rows = await listUsageRecords(scope, { period: month })
  const usage = new Map<UsageMetric, number>()
  for (const row of rows) {
    const metric = metricSchema.safeParse(row.metric)
    if (metric.success) {
      usage.set(metric.data, row.value)
    }
  }
  return usage
}

/* -------------------------------------------------------------------------------------------------
 * Webhook lookups (deliberately un-scoped — see the module docblock)
 * ---------------------------------------------------------------------------------------------- */

/**
 * Resolves the billing row for one organization without a tenant context. Only the Stripe webhook and
 * the checkout callback may call this; everything inside a request uses {@link getSubscription}.
 */
export async function findSubscriptionByOrganizationUnscoped(
  db: Database,
  organizationId: string,
): Promise<Subscription | null> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, idSchema.parse(organizationId)))
    .limit(1)
  return rows[0] ?? null
}

/** Finds the organization a Stripe customer belongs to. Webhook-only. */
export async function findSubscriptionByStripeCustomerUnscoped(
  db: Database,
  stripeCustomerId: string,
): Promise<Subscription | null> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, z.string().trim().min(1).max(64).parse(stripeCustomerId)))
    .limit(1)
  return rows[0] ?? null
}

/** Finds the organization a Stripe subscription belongs to. Webhook-only. */
export async function findSubscriptionByStripeSubscriptionUnscoped(
  db: Database,
  stripeSubscriptionId: string,
): Promise<Subscription | null> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(
      eq(
        subscriptions.stripeSubscriptionId,
        z.string().trim().min(1).max(64).parse(stripeSubscriptionId),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

/**
 * Writes billing state for an organization the webhook has already identified. The `organizationId`
 * is part of the predicate on update and of the payload on insert, so a webhook can only ever touch
 * the one row it resolved.
 */
export async function upsertSubscriptionUnscoped(
  db: Database,
  organizationId: string,
  input: UpsertSubscriptionInput,
): Promise<Subscription> {
  const id = idSchema.parse(organizationId)
  const values = definedOnly(upsertSubscriptionInput.parse(input))
  const existing = await findSubscriptionByOrganizationUnscoped(db, id)

  const rows = existing
    ? await db
        .update(subscriptions)
        .set(values)
        .where(and(eq(subscriptions.id, existing.id), eq(subscriptions.organizationId, id)))
        .returning()
    : await db
        .insert(subscriptions)
        .values({ ...values, organizationId: id })
        .returning()

  const row = rows.at(0)
  if (row === undefined) {
    throw new NotFoundError('subscription', id)
  }
  return row
}
