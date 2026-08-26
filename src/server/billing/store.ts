/**
 * `SubscriptionStore` over D1, and the row ↔ record translation either side of it.
 *
 * Kept apart from `runtime.cloudflare.ts` — which may import `cloudflare:workers` and
 * therefore only runs on workerd — because this is the seam where the billing domain
 * meets a real database, and it has to be exercisable against the in-memory SQLite the
 * repository tests use. That is what lets `__tests__/limits.test.ts` assert the whole
 * point of this module: that the limits the UI is told about are byte-for-byte the
 * limits the repository guard enforces, over the same row, through both code paths.
 *
 * Every read and write goes through the `…Unscoped` billing repository functions, which
 * are the only repository functions permitted to run without a tenant scope precisely
 * because a billing webhook has no session. They touch billing rows and nothing else.
 */

import {
  isBillingInterval,
  isPlanId,
  isSubscriptionStatus,
  planById,
  planForProductId,
} from '#/lib/plans'
import {
  findSubscriptionByOrganizationUnscoped,
  findSubscriptionByProviderCustomerUnscoped,
  findSubscriptionByProviderSubscriptionUnscoped,
  upsertSubscriptionUnscoped,
} from '#/server/repos'
import { ceilingsForPlan, planIdFromRow, storedCeilingsFromRow } from './limits'

import type { UpsertSubscriptionInput } from '#/server/repos'
import type { Database, Subscription } from '#/server/db/types'
import type { StoredCeilings } from './limits'
import type { PendingPlanChange, SubscriptionRecord, SubscriptionStore } from './types'

/** Widen a persisted row into the shape the billing domain reasons about. */
export function recordFromRow(row: Subscription): SubscriptionRecord {
  return {
    organizationId: row.organizationId,
    planId: planIdFromRow(row),
    status: isSubscriptionStatus(row.status) ? row.status : 'incomplete',
    interval: planForProductId(row.providerProductId)?.interval ?? null,
    seats: Math.max(row.seats, 1),
    providerCustomerId: row.providerCustomerId,
    providerSubscriptionId: row.providerSubscriptionId,
    providerProductId: row.providerProductId,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    trialEndsAt: row.trialEndsAt,
    canceledAt: row.canceledAt,
    pendingChange: pendingChangeFromRow(row),
    ceilings: storedCeilingsFromRow(row),
  }
}

/**
 * The scheduled change a row carries, or `null`.
 *
 * The three columns are nullable and carry no CHECK constraint, so this is where a
 * partial or unrecognised triple is refused: a row naming a plan with no date, or a
 * plan this deployment has stopped selling, reads as *no* scheduled change rather than
 * as one dated `Invalid Date`. That matters because the value goes straight into KV
 * through `cachedPendingChange()` and into the plan-changed email after that — a
 * change we cannot date is a change we cannot describe.
 */
function pendingChangeFromRow(row: Subscription): PendingPlanChange | null {
  const { pendingPlan, pendingInterval, pendingEffectiveAt } = row
  if (pendingEffectiveAt === null) return null
  if (!isPlanId(pendingPlan) || !isBillingInterval(pendingInterval)) return null
  return {
    planId: pendingPlan,
    interval: pendingInterval,
    effectiveAt: pendingEffectiveAt,
  }
}

/**
 * The columns a scheduled change occupies — the counterpart to {@link ceilingColumns}.
 *
 * Every value is an explicit `null` rather than `undefined` when there is nothing
 * scheduled, because `definedOnly()` in the repository strips `undefined` and keeps
 * `null`: emitting `undefined` would leave a superseded schedule sitting on the row
 * for the rest of the period it was supposed to end.
 */
export function pendingChangeColumns(
  pending: PendingPlanChange | null,
): Pick<
  UpsertSubscriptionInput,
  'pendingPlan' | 'pendingInterval' | 'pendingEffectiveAt'
> {
  return {
    pendingPlan: pending?.planId ?? null,
    pendingInterval: pending?.interval ?? null,
    pendingEffectiveAt: pending?.effectiveAt ?? null,
  }
}

/**
 * The columns a plan's own ceilings occupy. Every sanctioned write path stamps these,
 * so a row's `plan`, `seat_limit`, `storage_limit_bytes` and `quota_overrides` always
 * describe the plan the row is actually on — an operator raising one afterwards is then
 * an unambiguous, deliberate escape rather than a leftover from some other plan.
 */
export function ceilingColumns(
  ceilings: StoredCeilings,
): Pick<
  UpsertSubscriptionInput,
  'plan' | 'seatLimit' | 'storageLimitBytes' | 'quotaOverrides'
> {
  return {
    plan: ceilings.tier,
    seatLimit: ceilings.seatLimit,
    storageLimitBytes: ceilings.storageLimitBytes,
    quotaOverrides: ceilings.overrides,
  }
}

/** Narrow a domain record back down to the columns the table holds. */
export function rowValuesFromRecord(record: SubscriptionRecord): UpsertSubscriptionInput {
  const plan = planById(record.planId)
  const price = record.interval === null ? null : plan.prices[record.interval]

  return {
    ...ceilingColumns(record.ceilings),
    ...pendingChangeColumns(record.pendingChange ?? null),
    status: record.status,
    seats: record.seats,
    providerCustomerId: record.providerCustomerId,
    providerSubscriptionId: record.providerSubscriptionId,
    providerProductId: record.providerProductId,
    currency: price === null ? null : price.currency.toUpperCase(),
    unitAmountMinor: price?.amount ?? null,
    currentPeriodStart: record.currentPeriodStart,
    currentPeriodEnd: record.currentPeriodEnd,
    cancelAtPeriodEnd: record.cancelAtPeriodEnd,
    canceledAt: record.canceledAt,
    trialEndsAt: record.trialEndsAt,
  }
}

/** Seed columns for a row that exists before any subscription does. */
const FREE_CEILINGS: StoredCeilings = ceilingsForPlan('free', 1)

export function createSubscriptionStore(db: Database): SubscriptionStore {
  return {
    async findByOrganization(organizationId) {
      const row = await findSubscriptionByOrganizationUnscoped(db, organizationId)
      return row === null ? null : recordFromRow(row)
    },
    async findByProviderCustomerId(providerCustomerId) {
      const row = await findSubscriptionByProviderCustomerUnscoped(db, providerCustomerId)
      return row === null ? null : recordFromRow(row)
    },
    async findByProviderSubscriptionId(providerSubscriptionId) {
      const row = await findSubscriptionByProviderSubscriptionUnscoped(
        db,
        providerSubscriptionId,
      )
      return row === null ? null : recordFromRow(row)
    },
    async upsert(record) {
      await upsertSubscriptionUnscoped(
        db,
        record.organizationId,
        rowValuesFromRecord(record),
      )
    },
    async attachCustomer(organizationId, providerCustomerId) {
      // A row created here predates the subscription it will carry, so it is stamped
      // with the Free plan's ceilings. Leaving the column defaults would have handed a
      // workspace ten seats for starting a checkout it never completed — and, now that
      // the screen renders what is enforced, said so out loud.
      const existing = await findSubscriptionByOrganizationUnscoped(db, organizationId)
      await upsertSubscriptionUnscoped(db, organizationId, {
        ...(existing === null ? ceilingColumns(FREE_CEILINGS) : {}),
        providerCustomerId,
      })
    },
    async updateStatus(organizationId, status, changedAt) {
      await upsertSubscriptionUnscoped(db, organizationId, {
        status,
        canceledAt: status === 'canceled' ? changedAt : undefined,
      })
    },
  }
}
