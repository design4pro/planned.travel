/**
 * Plan entitlements and quota enforcement.
 *
 * This is the gate SPEC §5 refers to: every scoped repository that creates a row a
 * plan can run out of calls `assertWithinLimit()` before it writes, so one tenant can
 * never consume enough of a shared resource to degrade another.
 *
 * Caching strategy — deliberate, and the reason the two halves are separate:
 *
 * - **Plan state** (which plan, which status, how many seats) changes only when the
 *   billing provider tells us it has, so it is cached in KV for a short TTL and
 *   invalidated explicitly from the webhook. That keeps D1 out of the hot path on every
 *   quota check.
 * - **Usage** is always counted live. Caching it would let a tenant burst past a quota
 *   inside the cache window, which is exactly what this module exists to prevent.
 */

import { z } from 'zod'
import {
  BILLING_INTERVALS,
  BILLING_STATES,
  PLAN_IDS,
  QUOTA_KEYS,
  exceedsQuota,
  formatQuota,
  formatQuotaUsage,
  isEntitlingStatus,
  isModuleKey,
  isQuotaKey,
  planById,
  planFor,
  quotaRatio,
  quotaRemaining,
} from '#/lib/plans'
import type { LimitKey, ModuleKey, Plan, PlanLimits, QuotaKey } from '#/lib/plans'
import { ORGANIZATION_PLANS, USAGE_METRICS } from '#/server/db/schema'
import { resolveLimits } from './limits'
import { FeatureLockedError, QuotaExceededError } from './types'
import type { EffectiveLimits } from './limits'
import type {
  BillingContext,
  BillingRuntime,
  CachedPendingPlanChange,
  CachedPlanState,
  Entitlements,
  PendingPlanChange,
  QuotaState,
  SubscriptionRecord,
  UsageSnapshot,
} from './types'

/**
 * Short enough that a missed invalidation self-heals within a minute, long enough to
 * absorb the request burst a single page load creates.
 */
export const PLAN_STATE_CACHE_TTL_SECONDS = 60

/**
 * Bumped whenever `CachedPlanState` changes shape *or* meaning, so old entries are
 * ignored. `v4` added the scheduled change Polar has accepted but not yet applied;
 * `v5` is the release in which that field can finally be non-null, because the
 * `pending_*` columns exist to hold it. The shape is identical, which is exactly why
 * the bump is needed: every warm `v4` entry was written by code that could only ever
 * report `null`, so it would still validate and would still hide a real scheduled
 * change until its TTL ran out.
 */
const PLAN_STATE_CACHE_VERSION = 'v5'

export function planStateCacheKey(organizationId: string): string {
  return `billing:plan:${PLAN_STATE_CACHE_VERSION}:${organizationId}`
}

const storedCeilingsSchema = z.object({
  tier: z.enum(ORGANIZATION_PLANS),
  seatLimit: z.number().int().min(0),
  storageLimitBytes: z.number().int().min(0),
  overrides: z.partialRecord(z.enum(USAGE_METRICS), z.number().int().min(0)),
})

const pendingChangeSchema = z.object({
  planId: z.enum(PLAN_IDS),
  interval: z.enum(BILLING_INTERVALS),
  effectiveAt: z.string(),
})

const planStateSchema = z.object({
  planId: z.enum(PLAN_IDS),
  status: z.enum(BILLING_STATES),
  interval: z.enum(BILLING_INTERVALS).nullable(),
  seats: z.number().int().min(1),
  cancelAtPeriodEnd: z.boolean(),
  currentPeriodEnd: z.string().nullable(),
  trialEndsAt: z.string().nullable(),
  hasProviderCustomer: z.boolean(),
  pendingChange: pendingChangeSchema.nullable(),
  ceilings: storedCeilingsSchema.nullable(),
})

function toIso(value: Date | null): string | null {
  return value === null ? null : value.toISOString()
}

/**
 * Derive the cacheable plan state from a persisted row (or the absence of one).
 *
 * Step 0 of the authority order in `./limits` lands here: a row whose status has
 * stopped entitling the customer keeps neither its plan nor its ceilings, so a
 * cancelled Crew workspace is metered against Free like any other free workspace.
 */
export function planStateFromRecord(record: SubscriptionRecord | null): CachedPlanState {
  const plan = planFor(record)
  const entitled = record !== null && isEntitlingStatus(record.status)
  return {
    planId: plan.id,
    status: record?.status ?? 'none',
    interval: record?.interval ?? null,
    seats: Math.max(record?.seats ?? plan.seatRange.min, 1),
    cancelAtPeriodEnd: record?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: toIso(record?.currentPeriodEnd ?? null),
    trialEndsAt: toIso(record?.trialEndsAt ?? null),
    hasProviderCustomer: (record?.providerCustomerId ?? null) !== null,
    // A lapsed subscription schedules nothing, for the same reason it grandfathers
    // nothing: whatever Polar had queued against it went with the entitlement.
    pendingChange: entitled ? cachedPendingChange(record.pendingChange ?? null) : null,
    ceilings: entitled ? record.ceilings : null,
  }
}

/** Narrow a scheduled change to the JSON-safe shape the cache entry holds. */
function cachedPendingChange(
  pending: PendingPlanChange | null,
): CachedPendingPlanChange | null {
  if (pending === null) return null
  return {
    planId: pending.planId,
    interval: pending.interval,
    effectiveAt: pending.effectiveAt.toISOString(),
  }
}

/**
 * The organization's plan state, from KV when warm and from D1 otherwise.
 * A malformed or stale-shaped cache entry is treated as a miss, never as an error.
 */
export async function loadPlanState(ctx: BillingContext): Promise<CachedPlanState> {
  const { runtime, organizationId } = ctx
  const key = planStateCacheKey(organizationId)

  const cached = await runtime.cache.get(key)
  if (cached !== null) {
    const parsed = planStateSchema.safeParse(safeJsonParse(cached))
    if (parsed.success) return parsed.data
    runtime.logger.warn('billing.plan_state.cache_discarded', { organizationId })
  }

  const record = await runtime.subscriptions.findByOrganization(organizationId)
  const state = planStateFromRecord(record)
  await runtime.cache.put(key, JSON.stringify(state), {
    expirationTtl: PLAN_STATE_CACHE_TTL_SECONDS,
  })
  return state
}

/** Drop the cached plan state. Called from the webhook on every subscription change. */
export async function invalidateEntitlements(
  runtime: BillingRuntime,
  organizationId: string,
): Promise<void> {
  await runtime.cache.delete(planStateCacheKey(organizationId))
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ quota states */

export function quotaState(key: QuotaKey, limit: number | null, used: number): QuotaState {
  return {
    key,
    limit,
    used,
    remaining: quotaRemaining(limit, used),
    ratio: quotaRatio(limit, used),
    exceeded: exceedsQuota(limit, used, 0),
  }
}

function quotaStates(
  limits: PlanLimits,
  usage: UsageSnapshot,
): { readonly [K in QuotaKey]: QuotaState } {
  return {
    seats: quotaState('seats', limits.seats, usage.seats),
    trips: quotaState('trips', limits.trips, usage.trips),
    storageBytes: quotaState('storageBytes', limits.storageBytes, usage.storageBytes),
  }
}

function usageFor(key: QuotaKey, usage: UsageSnapshot): number {
  return usage[key]
}

/* ------------------------------------------------------------------ entitlements */

/**
 * The limits in force for a cached plan state — the billing domain's one call into
 * {@link resolveLimits}, which is also where `assertQuota()` in the repositories ends
 * up. Anything that needs a ceiling on this side of the app goes through here.
 */
export function effectiveLimitsFor(state: CachedPlanState): EffectiveLimits {
  return resolveLimits({
    planId: state.planId,
    seats: state.seats,
    ceilings: state.ceilings,
  })
}

/**
 * Everything the product and the billing screen need to know about what this
 * organization may do right now. Safe to return straight to the client.
 *
 * `planId` and `planName` come from the catalogue — that is the plan the customer
 * bought — while `limits` and `quotas` are the *effective* numbers, so the screen can
 * name Solo and still meter the ten seats a grandfathered row actually allows.
 */
export async function entitlements(ctx: BillingContext): Promise<Entitlements> {
  const [state, usage] = await Promise.all([
    loadPlanState(ctx),
    ctx.runtime.usage.read(ctx.organizationId),
  ])

  const plan = planById(state.planId)
  const { limits } = effectiveLimitsFor(state)

  return {
    organizationId: ctx.organizationId,
    planId: plan.id,
    planName: plan.name,
    status: state.status,
    interval: state.interval,
    seats: state.seats,
    limits,
    usage,
    quotas: quotaStates(limits, usage),
    cancelAtPeriodEnd: state.cancelAtPeriodEnd,
    currentPeriodEnd: state.currentPeriodEnd,
    trialEndsAt: state.trialEndsAt,
    trialing: isTrialing(state, ctx.runtime.now()),
    hasProviderCustomer: state.hasProviderCustomer,
    pendingChange: pendingChangeOf(state, ctx.runtime.now()),
  }
}

/**
 * The scheduled change, revived from the cache entry — or `null` when there is none
 * left to report.
 *
 * A date that has already passed is dropped rather than rendered: Polar applies the
 * change at the start of the next period, so past that instant the plan fields above
 * are the change, and a banner still promising it is a lie the customer can check.
 * An unparseable instant is dropped for the same reason a malformed cache entry is a
 * miss — a scheduled change we cannot date is one we cannot describe.
 */
function pendingChangeOf(
  state: CachedPlanState,
  now: Date,
): PendingPlanChange | null {
  const pending = state.pendingChange
  if (pending === null) return null

  const effectiveAt = new Date(pending.effectiveAt)
  if (Number.isNaN(effectiveAt.getTime())) return null
  if (effectiveAt.getTime() <= now.getTime()) return null

  return { planId: pending.planId, interval: pending.interval, effectiveAt }
}

function isTrialing(state: CachedPlanState, now: Date): boolean {
  if (state.status !== 'trialing') return false
  if (state.trialEndsAt === null) return true
  const ends = Date.parse(state.trialEndsAt)
  return Number.isNaN(ends) ? true : ends > now.getTime()
}

/** The plan an organization is on, without the usage round-trip. */
export async function currentPlan(ctx: BillingContext): Promise<Plan> {
  const state = await loadPlanState(ctx)
  return planById(state.planId)
}

/** The limits actually in force: catalogue defaults under the row's own ceilings. */
export async function currentLimits(ctx: BillingContext): Promise<PlanLimits> {
  return effectiveLimitsFor(await loadPlanState(ctx)).limits
}

/** Non-throwing feature check for conditional UI and optional code paths. */
export async function hasFeature(ctx: BillingContext, key: ModuleKey): Promise<boolean> {
  const limits = await currentLimits(ctx)
  return limits[key]
}

/**
 * The single enforcement point.
 *
 * For a countable quota (`seats`, `trips`, `storageBytes`) this reads live usage and
 * throws `QuotaExceededError` when `used + requested` would break the plan's limit.
 * For a module key it throws `FeatureLockedError` when the plan does not include the
 * module, and `requested` is ignored.
 *
 * Call it *before* the insert, inside the repository that owns the row.
 */
export async function assertWithinLimit(
  ctx: BillingContext,
  key: LimitKey,
  requested = 1,
): Promise<void> {
  const state = await loadPlanState(ctx)
  const plan = planById(state.planId)
  const { limits } = effectiveLimitsFor(state)

  if (isModuleKey(key)) {
    if (limits[key]) return
    throw new FeatureLockedError(
      { key, planId: plan.id },
      `The ${plan.name} plan does not include ${moduleLabel(key)}.`,
    )
  }

  if (!isQuotaKey(key)) return

  const limit = limits[key]
  if (limit === null) return

  const amount = Math.max(Math.floor(requested), 0)
  const usage = await ctx.runtime.usage.read(ctx.organizationId)
  const used = usageFor(key, usage)

  if (!exceedsQuota(limit, used, amount)) return

  throw new QuotaExceededError(
    { key, planId: plan.id, limit, used, requested: amount },
    `The ${plan.name} plan allows ${formatQuota(key, limit)} ${QUOTA_NOUNS[key]} and you are ` +
      `using ${formatQuotaUsage(key, used)}. Upgrade to add more.`,
  )
}

/** Reads naturally inside the quota message: "allows 2 trips". */
const QUOTA_NOUNS: { readonly [K in QuotaKey]: string } = {
  seats: 'members',
  trips: 'trips',
  storageBytes: 'of storage',
}

const MODULE_LABELS: { readonly [K in ModuleKey]: string } = {
  itinerary: 'the itinerary planner',
  map: 'trip maps',
  budget: 'budgets',
  packing: 'packing lists',
  reservations: 'reservations',
  journal: 'the travel journal',
  atlas: 'the world map tracker',
  collaboration: 'sharing trips with other people',
  realtime: 'real-time collaboration',
  offlineMaps: 'offline maps',
  pdfExport: 'PDF export',
  prioritySupport: 'priority support',
}

function moduleLabel(key: ModuleKey): string {
  return MODULE_LABELS[key]
}

/** Every quota key, for iterating meters in a stable order. */
export const METERED_QUOTAS: ReadonlyArray<QuotaKey> = QUOTA_KEYS
