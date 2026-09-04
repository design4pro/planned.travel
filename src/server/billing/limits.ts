/**
 * The single resolver for "what may this tenant actually do".
 *
 * There used to be two answers to that question — one the repositories enforced
 * (`resolveQuotas`, from the tier column) and one the billing screen rendered
 * (`effectiveLimits`, from the marketing catalogue) — and they disagreed. A paying
 * workspace was told it was three seats over a limit it was nowhere near, at a price
 * it was not paying. Everything that needs a ceiling now comes through
 * {@link resolveLimits}, so the two can no longer drift: the repository guard and the
 * billing domain read the *same* numbers out of the *same* function.
 *
 * ## Authority order
 *
 * Later steps override earlier ones. This is the whole contract:
 *
 * 0. **Subscription status.** A row whose status no longer entitles the customer
 *    (`canceled`, `unpaid`, `paused`, `incomplete…`) resolves to the Free plan with no
 *    per-tenant escapes at all. A lapsed subscription grandfathers nothing.
 * 1. **The provider product id** identifies the plan. It is what the customer is
 *    actually being charged for, so it outranks every other hint about which plan they
 *    are on. A row with no product id, or one referencing a product this deployment no
 *    longer sells, falls back to the legacy tier column via {@link planIdFromTier}.
 * 2. **The plan catalogue** (`src/lib/plans.ts`) supplies that plan's own limits —
 *    seats (narrowed to the seats actually purchased on a per-seat plan), trips,
 *    storage and every module switch. The coarse tier row in
 *    {@link PLAN_QUOTAS} supplies only the operational metrics the catalogue does not
 *    model: places, files, exports, collections and journeys.
 * 3. **Per-tenant ceilings stored on the subscription row** — `seat_limit`,
 *    `storage_limit_bytes`, then `quota_overrides` — have the last word. This is the
 *    deliberate escape hatch: it is how a customer is grandfathered above the plan
 *    they pay for, or given head-room by hand, and it must keep working.
 *
 * ## Two vocabularies, bridged here and nowhere else
 *
 * The `subscriptions.plan` column carries a coarse tier (`free | starter | pro |
 * business`) under a CHECK constraint and predates the catalogue, which sells
 * `free | solo | crew`. {@link planIdFromRow} is the only translation from a row to a
 * catalogue plan and {@link TIER_FOR_PLAN} the only translation back.
 *
 * Two shapes of the same answer come out of the resolver because the two callers
 * count in different units: `limits` is catalogue-shaped (`null` is unlimited, safe to
 * serialise to the browser) and `metrics` is column-shaped (`UNLIMITED`, keyed by
 * `USAGE_METRICS`). {@link METRIC_FOR_QUOTA} pairs them up, and the equivalence of the
 * three metrics they share is asserted in `__tests__/limits.test.ts`.
 *
 * A third field, `rates`, carries the ceilings that bound metered provider *calls*
 * rather than rows — see {@link PLAN_RATE_CEILINGS} for why they cannot be either of the
 * other two shapes.
 */

import {
  catalogueLimits,
  isEntitlingStatus,
  planById,
  planForProductId,
} from '#/lib/plans'
import { ORGANIZATION_PLANS, USAGE_METRICS } from '#/server/db/schema'
import { PLAN_QUOTAS, UNLIMITED } from '#/server/db/types'

import type { PlanId, PlanLimits, QuotaKey } from '#/lib/plans'
import type { QuotaOverrides } from '#/server/db/schema'
import type { OrganizationPlan, UsageMetric } from '#/server/db/types'

/* ------------------------------------------------------------------ vocabularies */

/**
 * The tier whose {@link PLAN_QUOTAS} row is the closest fit for each catalogue plan.
 * Solo and Crew both map to `business` because that is the only tier without a cap on
 * the operational metrics, which every paid plan promises; the limits that actually
 * differ between them are the catalogue's own and are written explicitly.
 */
export const TIER_FOR_PLAN: { readonly [K in PlanId]: OrganizationPlan } = {
  free: 'free',
  solo: 'business',
  crew: 'business',
}

/** The metric column each catalogue quota is stored and enforced under. */
export const METRIC_FOR_QUOTA: { readonly [K in QuotaKey]: UsageMetric } = {
  seats: 'members',
  trips: 'trips',
  storageBytes: 'storage_bytes',
}

/** Ceilings the catalogue leaves uncapped still need a finite integer column. */
export const SEAT_LIMIT_CEILING = 100_000

/* -------------------------------------------------------------- rate ceilings */

/**
 * Ceilings on metered **calls**, resolved here and nowhere else.
 *
 * Every metric in {@link PLAN_QUOTAS} bounds a row a workspace owns, which is why
 * `assertQuota()` can enforce it: the guard counts the table and refuses the next
 * insert. The metrics below bound something that leaves no row — an outbound call to a
 * provider, made on a tenant's behalf and billed to us. A tenant that makes one in a
 * loop spends money every other tenant is paying for, so the rate is a ceiling like any
 * other and belongs beside them rather than as a constant inside a feature module: the
 * published number and the enforced number are the same number, for a provider call as
 * much as for a row.
 *
 * Three consequences follow, and each is asserted in `__tests__/limits.test.ts`:
 *
 * - **They are not {@link UsageMetric}s.** `usage_records.metric` is a CHECK-constrained
 *   enum counting rows, and `assertQuota()` reads it; a call metric in that list would
 *   be a ceiling the guard half-applies, against a counter nobody increments.
 * - **`quota_overrides` cannot raise them.** That column is keyed by the same enum, so
 *   an operator who writes one of these keys has it ignored, not applied.
 * - **No plan is unlimited.** {@link UNLIMITED} is available and deliberately unused: a
 *   row costs us storage we can see, a call costs money on somebody else's invoice, and
 *   an uncapped one has no ceiling to discover the loop by.
 *
 * The counting is not here either. It is a per-organization tally over KV, minted once by
 * the stage that makes the first search (`docs/plans/03-reservations-and-transport.md`,
 * `03-S3`) and reused under the second metric name by the stage that makes the first
 * extraction (`03-S7`); this module supplies the numbers that tally is measured against.
 */
export const RATE_METRICS = [
  'transit_searches_per_month',
  'extraction_calls_per_month',
] as const
export type RateMetric = (typeof RATE_METRICS)[number]

/**
 * How many metered calls of each kind a plan may make per calendar month.
 *
 * **Free is zero for both**, because Free cannot open the booking desk at all
 * (`reservations` is off in its catalogue entry) and neither call is reachable from
 * anywhere else. An allowance nobody can spend is a number that only ever misleads.
 *
 * `transit_searches_per_month` — the paid figures are sized against the work rather than
 * the seats: a fortnight abroad with a dozen journeys, searched and searched again, is
 * comfortably under a hundred, so Solo's 250 is a month of real planning with head-room,
 * and Crew's 1,000 is the same trip planned by up to ten people who are mostly searching
 * the *same* journeys — which is why it is four times Solo's and not ten.
 *
 * `extraction_calls_per_month` — a confirmation file turned into a draft booking, on our
 * own `AI` binding (`docs/adr/0012-workers-ai-for-confirmation-extraction.md`). It is the
 * dearer call of the two and its allowance is the tighter one: a transit search is a
 * single request to a timetable, while an extraction converts a document to text and then
 * runs a model over what it read. It is also the rarer act — a traveller imports the
 * handful of confirmations they were sent, once each, rather than re-running a search
 * every time a timetable might have moved. A month of real planning is a couple of dozen
 * files, so Solo's 100 is several trips' worth; Crew's 400 keeps the same four-times step
 * Solo-to-Crew already has, and for the sharper version of the same reason: a
 * confirmation is imported once by whoever was sent it, so a workspace's volume grows
 * with the trips it has in flight and not with the people planning them.
 *
 * Both are far below the point where the bill for one workspace is worth noticing, and a
 * workspace that reaches either is asking for a conversation, which is what a ceiling is
 * for.
 */
export const PLAN_RATE_CEILINGS: {
  readonly [K in PlanId]: Readonly<Record<RateMetric, number>>
} = {
  free: { transit_searches_per_month: 0, extraction_calls_per_month: 0 },
  solo: { transit_searches_per_month: 250, extraction_calls_per_month: 100 },
  crew: { transit_searches_per_month: 1_000, extraction_calls_per_month: 400 },
}

export function tierOf(value: string | null | undefined): OrganizationPlan {
  return typeof value === 'string' &&
    (ORGANIZATION_PLANS as ReadonlyArray<string>).includes(value)
    ? (value as OrganizationPlan)
    : 'free'
}

function isUsageMetric(value: string): value is UsageMetric {
  return (USAGE_METRICS as ReadonlyArray<string>).includes(value)
}

/**
 * The catalogue plan a legacy tier column stands for. Seats are what separate the
 * single-traveller plan from the shared one, because the tier column cannot say.
 */
export function planIdFromTier(tier: OrganizationPlan, seats: number): PlanId {
  switch (tier) {
    case 'free':
    case 'starter':
      return 'free'
    case 'pro':
      return 'solo'
    case 'business':
      return seats > 1 ? 'crew' : 'solo'
  }
}

/* ---------------------------------------------------------------- stored ceilings */

/**
 * The per-tenant ceilings a subscription row carries — step 3 of the authority order.
 *
 * `tier` rides along because the operational metrics the catalogue does not model are
 * still read from that row of {@link PLAN_QUOTAS}.
 */
export interface StoredCeilings {
  readonly tier: OrganizationPlan
  readonly seatLimit: number
  readonly storageLimitBytes: number
  readonly overrides: QuotaOverrides
}

/** Everything {@link resolveLimitsFromRow} needs off a persisted subscription row. */
export interface SubscriptionLimitsRow {
  readonly plan: string
  readonly status: string
  readonly seats: number
  readonly providerProductId: string | null
  readonly seatLimit: number
  readonly storageLimitBytes: number
  readonly quotaOverrides: QuotaOverrides | null
}

/**
 * The plan a persisted row represents: product id first, tier column only as a
 * fallback. The only translation from a row to the catalogue in the codebase.
 */
export function planIdFromRow(
  row: Pick<SubscriptionLimitsRow, 'plan' | 'seats' | 'providerProductId'>,
): PlanId {
  const fromProduct = planForProductId(row.providerProductId)
  if (fromProduct !== null) return fromProduct.plan.id
  return planIdFromTier(tierOf(row.plan), row.seats)
}

/** Read the stored ceilings off a row, with the tier column narrowed. */
export function storedCeilingsFromRow(
  row: SubscriptionLimitsRow,
): StoredCeilings {
  return {
    tier: tierOf(row.plan),
    seatLimit: row.seatLimit,
    storageLimitBytes: row.storageLimitBytes,
    overrides: row.quotaOverrides ?? {},
  }
}

/**
 * The ceilings a plan writes when it is sold — the values every sanctioned write path
 * stamps onto the row, so a freshly written row's columns agree with its plan instead
 * of describing some other one.
 *
 * Only finite caps fit in an integer column, so an uncapped metric is left to the
 * tier default; that is why Solo and Crew map to the tier that already has none.
 */
export function ceilingsForPlan(planId: PlanId, seats: number): StoredCeilings {
  const plan = planById(planId)
  const limits = catalogueLimits(plan, seats)
  const trips = limits.trips
  return {
    tier: TIER_FOR_PLAN[planId],
    seatLimit: limits.seats ?? SEAT_LIMIT_CEILING,
    storageLimitBytes: limits.storageBytes ?? Number.MAX_SAFE_INTEGER,
    overrides: trips === null ? {} : { trips },
  }
}

/* ---------------------------------------------------------------- the resolver */

export interface ResolveLimitsInput {
  /** The catalogue plan in force, already resolved from the product id or the tier. */
  readonly planId: PlanId
  /** Seats billed on the subscription. */
  readonly seats: number
  /** Per-tenant ceilings, or `null` for a tenant that has none to escape with. */
  readonly ceilings: StoredCeilings | null
}

export interface EffectiveLimits {
  readonly planId: PlanId
  /** The tier row the operational metrics were read from. */
  readonly tier: OrganizationPlan
  readonly seats: number
  /** Catalogue-shaped, `null` for unlimited. What the UI renders. */
  readonly limits: PlanLimits
  /** Column-shaped, {@link UNLIMITED} for unlimited. What the repositories enforce. */
  readonly metrics: Record<UsageMetric, number>
  /**
   * Ceilings on metered provider calls — see {@link PLAN_RATE_CEILINGS}. Plan-owned and
   * finite: no stored ceiling raises one, because no column can name one.
   */
  readonly rates: Record<RateMetric, number>
}

/** `null` (unlimited, JSON-safe) into the infinite sentinel the columns count in. */
function toMetric(limit: number | null): number {
  return limit === null ? UNLIMITED : limit
}

/** The infinite sentinel back into the `null` the client understands. */
function toQuota(limit: number): number | null {
  return Number.isFinite(limit) ? limit : null
}

/**
 * Resolve the limits actually in force. **The** implementation — the repository quota
 * guard and the billing domain both end up here, which is what stops the enforced
 * numbers and the displayed numbers from ever disagreeing again.
 */
export function resolveLimits(input: ResolveLimitsInput): EffectiveLimits {
  const plan = planById(input.planId)
  const seats = Math.max(Math.floor(input.seats), 1)
  const ceilings = input.ceilings
  const tier = ceilings?.tier ?? TIER_FOR_PLAN[plan.id]

  // Step 2 — the catalogue owns its own limits; the tier row owns the rest.
  const catalogue = catalogueLimits(plan, seats)
  const metrics: Record<UsageMetric, number> = {
    ...PLAN_QUOTAS[tier],
    members: toMetric(catalogue.seats),
    trips: toMetric(catalogue.trips),
    storage_bytes: toMetric(catalogue.storageBytes),
  }

  // Step 3 — the row's own ceilings win, and may sit above the plan on purpose.
  if (ceilings !== null) {
    metrics.members = ceilings.seatLimit
    metrics.storage_bytes = ceilings.storageLimitBytes
    for (const [metric, value] of Object.entries(ceilings.overrides)) {
      if (typeof value === 'number' && isUsageMetric(metric)) {
        metrics[metric] = value
      }
    }
  }

  return {
    planId: plan.id,
    tier,
    seats,
    // Step 3 does not reach here on purpose: `quota_overrides` is keyed by `UsageMetric`
    // and a call metric is not one, so the plan's own figure is the last word.
    rates: { ...PLAN_RATE_CEILINGS[plan.id] },
    limits: {
      ...catalogue,
      seats: toQuota(metrics.members),
      trips: toQuota(metrics.trips),
      storageBytes: toQuota(metrics.storage_bytes),
    },
    metrics,
  }
}

/** The Free plan with no escapes — every tenant without an entitling row. */
const FREE_INPUT: ResolveLimitsInput = {
  planId: 'free',
  seats: 1,
  ceilings: null,
}

/**
 * Reduce a persisted row to resolver input: step 0 (does this row entitle anything at
 * all?) and step 1 (which plan is it?) in one place.
 */
export function limitInputsFromRow(
  row: SubscriptionLimitsRow | null,
): ResolveLimitsInput {
  if (row === null || !isEntitlingStatus(row.status)) return FREE_INPUT
  return {
    planId: planIdFromRow(row),
    seats: row.seats,
    ceilings: storedCeilingsFromRow(row),
  }
}

/** {@link resolveLimits} straight off a persisted row. The repository entry point. */
export function resolveLimitsFromRow(
  row: SubscriptionLimitsRow | null,
): EffectiveLimits {
  return resolveLimits(limitInputsFromRow(row))
}
