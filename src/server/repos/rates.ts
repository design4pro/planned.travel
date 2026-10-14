/**
 * Which rate a reader would use for a currency pair (plan stage `04-S1`).
 *
 * The one owner of "what rate answers for this ordered pair": the conversion itself is
 * `convertMinor` in `src/lib/money.ts`, and a caller that needs a rate (the preview of re-basing a
 * trip's budget currency, the display conversion) asks here and builds no lookup of its own.
 *
 * Two sources answer today and a third is a seat with nobody in it:
 *
 * 1. a **manual** rate the caller was handed by a reader;
 * 2. the **recent** rate this workspace has already frozen on an expense or a payment for that
 *    ordered pair, which is a figure a person typed or confirmed, not a guess;
 * 3. the injected {@link RateSource} port. It has no implementation here: no provider is chosen, so
 *    nothing in this module makes an outbound call, and with no port injected the answer comes from
 *    the first two or is `null`.
 *
 * It never invents, extrapolates, inverts or rounds a rate into existence. There is no cache: nothing
 * writes one until a provider exists, so a read would always miss (`04-S7` owns it).
 *
 * **No per-row writer reaches this module.** A stored `exchange_rate` is derived from the amount
 * pair, never looked up, so a rate on a row can never disagree with the figures beside it. The
 * call-graph test in `__tests__/rates.test.ts` pins that.
 *
 * **Which trips a rate may come from.** Every frozen-rate read is restricted to the trips the caller
 * can read (`readableTripFilter`, ADR 0007): a rate frozen on a private trip the caller is not on
 * answers neither function. The workspace filter alone is not enough, because a private trip lives
 * in the caller's own workspace.
 */

import { desc, eq, gt, inArray, isNotNull, ne } from 'drizzle-orm'
import { z } from 'zod'
import { expenses, settlements, trips } from '#/server/db/schema'
import { tenantFilter } from './base'
import { readableTripFilter, requireTrip } from './trips'
import { currencySchema, dateSchema, idSchema } from './validation'
import type { SQL } from 'drizzle-orm'
import type { TenantScope } from './base'

/* -------------------------------------------------------------------------------------------------
 * Shapes
 * ---------------------------------------------------------------------------------------------- */

/** A rate in major-per-major: `1 <from> = rate <to>`. */
const rateSchema = z.number().finite().positive()

const lookupInput = z.strictObject({
  from: currencySchema,
  to: currencySchema,
})

const frozenRateInput = lookupInput.extend({ tripId: idSchema })

const resolveRateInput = lookupInput.extend({
  /** The day the rate is wanted for. Only the port reads it; a frozen rate is the latest, not the day's. */
  on: dateSchema,
  /** A rate a reader supplied. Refused, not ignored, when it is not finite and positive. */
  manual: rateSchema.optional(),
})

export type FrozenRateQuery = z.input<typeof frozenRateInput>
export type RateQuery = z.input<typeof resolveRateInput>

/** A rate this workspace froze on a row, and the day the row records. */
export interface FrozenRate {
  readonly rate: number
  readonly source: 'recent'
  readonly observedOn: string
}

/** What {@link resolveRate} answers: the rate and where it came from. */
export interface ResolvedRate {
  readonly rate: number
  /** `'manual'`, `'recent'` or the port's own name for itself. */
  readonly source: string
}

/**
 * A provider of rates for a pair on a day, injected by the caller. An answer that is not a finite
 * positive rate is a miss; the port is never trusted to have checked.
 */
export interface RateSource {
  lookup: (query: {
    readonly from: string
    readonly to: string
    readonly on: string
  }) => Promise<ResolvedRate | null>
}

/* -------------------------------------------------------------------------------------------------
 * Frozen rates
 * ---------------------------------------------------------------------------------------------- */

interface Observation {
  readonly rate: number
  readonly observedOn: string
  readonly createdAt: Date
}

/**
 * The trips the caller may read, as a sub-select over the trip ids. `tenantFilter` is on the trip
 * side and the membership side of {@link readableTripFilter} alike.
 */
function readableTripIds(scope: TenantScope) {
  return scope.db
    .select({ id: trips.id })
    .from(trips)
    .where(tenantFilter(scope, trips, readableTripFilter(scope)))
}

/**
 * The newest expense that froze a rate for the ordered pair, or `null`. A row is an observation
 * only when it records a source currency different from its own and a rate: the all-null row of a
 * payment made in the accounting currency is not one.
 */
async function newestExpenseObservation(
  scope: TenantScope,
  pair: { readonly from: string; readonly to: string },
  trip: SQL | undefined,
): Promise<Observation | null> {
  const rows = await scope.db
    .select({
      rate: expenses.exchangeRate,
      observedOn: expenses.spentOn,
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .where(
      tenantFilter(
        scope,
        expenses,
        eq(expenses.originalCurrency, pair.from),
        eq(expenses.currency, pair.to),
        ne(expenses.originalCurrency, expenses.currency),
        isNotNull(expenses.exchangeRate),
        gt(expenses.exchangeRate, 0),
        inArray(expenses.tripId, readableTripIds(scope)),
        trip,
      ),
    )
    .orderBy(
      desc(expenses.spentOn),
      desc(expenses.createdAt),
      desc(expenses.id),
    )
    .limit(1)
  return toObservation(rows.at(0))
}

/** {@link newestExpenseObservation} over payments. */
async function newestSettlementObservation(
  scope: TenantScope,
  pair: { readonly from: string; readonly to: string },
  trip: SQL | undefined,
): Promise<Observation | null> {
  const rows = await scope.db
    .select({
      rate: settlements.exchangeRate,
      observedOn: settlements.settledOn,
      createdAt: settlements.createdAt,
    })
    .from(settlements)
    .where(
      tenantFilter(
        scope,
        settlements,
        eq(settlements.originalCurrency, pair.from),
        eq(settlements.currency, pair.to),
        ne(settlements.originalCurrency, settlements.currency),
        isNotNull(settlements.exchangeRate),
        gt(settlements.exchangeRate, 0),
        inArray(settlements.tripId, readableTripIds(scope)),
        trip,
      ),
    )
    .orderBy(
      desc(settlements.settledOn),
      desc(settlements.createdAt),
      desc(settlements.id),
    )
    .limit(1)
  return toObservation(rows.at(0))
}

function toObservation(
  row:
    | {
        readonly rate: number | null
        readonly observedOn: string
        readonly createdAt: Date
      }
    | undefined,
): Observation | null {
  if (
    row === undefined ||
    row.rate === null ||
    !rateSchema.safeParse(row.rate).success
  ) {
    return null
  }
  return {
    rate: row.rate,
    observedOn: row.observedOn,
    createdAt: row.createdAt,
  }
}

/** The later observation: by the day it records, then by when the row was written. */
function later(left: Observation | null, right: Observation | null) {
  if (left === null || right === null) {
    return left ?? right
  }
  if (left.observedOn !== right.observedOn) {
    return left.observedOn > right.observedOn ? left : right
  }
  return left.createdAt.getTime() > right.createdAt.getTime() ? left : right
}

/**
 * The one frozen-rate query behind both lookups: the most recent rate frozen for the ordered pair
 * on an expense or a payment, over the trips the caller can read, optionally narrowed to one trip.
 */
async function latestFrozenRate(
  scope: TenantScope,
  pair: { readonly from: string; readonly to: string },
  tripId?: string,
): Promise<FrozenRate | null> {
  const [fromExpenses, fromPayments] = await Promise.all([
    newestExpenseObservation(
      scope,
      pair,
      tripId === undefined ? undefined : eq(expenses.tripId, tripId),
    ),
    newestSettlementObservation(
      scope,
      pair,
      tripId === undefined ? undefined : eq(settlements.tripId, tripId),
    ),
  ])
  const newest = later(fromExpenses, fromPayments)
  return newest === null
    ? null
    : { rate: newest.rate, source: 'recent', observedOn: newest.observedOn }
}

/**
 * The most recent rate frozen on an expense or a payment of this trip for the ordered pair (the
 * receipt currency to the row's own currency, no inversion), or `null`.
 *
 * The trip is resolved in the caller's scope first, so a trip of another workspace, or a private
 * trip the caller is not on, is a {@link NotFoundError} and nothing is read.
 */
export async function findLatestFrozenRate(
  scope: TenantScope,
  query: FrozenRateQuery,
): Promise<FrozenRate | null> {
  const { tripId, from, to } = frozenRateInput.parse(query)
  await requireTrip(scope, tripId)
  return latestFrozenRate(scope, { from, to }, tripId)
}

/** The rate to offer for one receipt currency, and the day the row it came from records. */
export interface SuggestedRate {
  readonly rate: number
  readonly observedOn: string
}

/**
 * For each receipt currency in `from`, the rate this trip last froze for it against the trip's own
 * currency `to`, as {@link findLatestFrozenRate} answers it: one entry per currency that has one,
 * `null` when none has. Nothing outside the trip is read.
 *
 * This is the read the expense dialog's pre-fill draws on. It sits here rather than in the costs
 * server function because that module also derives the stored rate of a row, and the call-graph
 * test in `__tests__/rates.test.ts` keeps every name of this lookup out of it.
 */
export async function suggestedRatesForTrip(
  scope: TenantScope,
  query: {
    readonly tripId: string
    readonly from: ReadonlyArray<string>
    readonly to: string
  },
): Promise<Readonly<Record<string, SuggestedRate>> | null> {
  const found = await Promise.all(
    [...new Set(query.from)].map(async (from) => {
      const frozen = await findLatestFrozenRate(scope, {
        tripId: query.tripId,
        from,
        to: query.to,
      })
      return frozen === null
        ? null
        : ([
            from,
            { rate: frozen.rate, observedOn: frozen.observedOn },
          ] as const)
    }),
  )
  const entries = found.filter((entry) => entry !== null)
  return entries.length === 0 ? null : Object.fromEntries(entries)
}

/* -------------------------------------------------------------------------------------------------
 * The seam
 * ---------------------------------------------------------------------------------------------- */

/**
 * What rate would this reader use to go from `from` to `to`: a manual rate if one was given, else
 * the most recent rate this workspace froze for the pair on a trip the caller can read, else the
 * injected `port`. `null` when nothing answers.
 *
 * Never called from a per-row writer; see the module comment.
 */
export async function resolveRate(
  scope: TenantScope,
  query: RateQuery,
  port?: RateSource,
): Promise<ResolvedRate | null> {
  const { from, to, on, manual } = resolveRateInput.parse(query)
  if (manual !== undefined) {
    return { rate: manual, source: 'manual' }
  }
  const recent = await latestFrozenRate(scope, { from, to })
  if (recent !== null) {
    return { rate: recent.rate, source: recent.source }
  }
  if (port === undefined) {
    return null
  }
  const answer = await port.lookup({ from, to, on })
  return answer !== null && rateSchema.safeParse(answer.rate).success
    ? { rate: answer.rate, source: answer.source }
    : null
}
