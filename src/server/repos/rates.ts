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
 * **The reader's display currency lives here too.** {@link getDisplayCurrency} and
 * {@link setDisplayCurrency} are the only reader and only writer of `user_settings.display_currency`,
 * and the settings repository is not widened to reach it: the regional form cannot touch the
 * preference, and `updateUserSettingsInput` does not name it. {@link listAnsweringCurrencies} and
 * {@link resolveDisplayRates} are the two reads the display conversion needs; both go through the same
 * frozen-rate predicate as {@link resolveRate}, so the menu never offers a code the conversion cannot
 * answer.
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
import { NotFoundError } from './context'
import { getMembership } from './members'
import {
  ensureUserSettings,
  getUserSettings,
  userSettingsRepository,
} from './settings'
import { readableTripFilter, requireTrip } from './trips'
import { currencySchema, dateSchema, idSchema } from './validation'
import type { SQL } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
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
 * The columns a row must carry to be a frozen-rate observation, which `expenses` and `settlements`
 * both do.
 */
interface FrozenRateColumns {
  readonly originalCurrency: SQLiteColumn
  readonly currency: SQLiteColumn
  readonly exchangeRate: SQLiteColumn
  readonly tripId: SQLiteColumn
}

/**
 * What makes a row an observation of a frozen rate, in one place: it records a source currency
 * different from its own and a positive rate, on a trip the caller can read. `pair` narrows it to
 * one ordered pair; without it every pair qualifies, which is what lists the codes a rate answers for.
 */
function frozenRatePredicates(
  scope: TenantScope,
  table: FrozenRateColumns,
  pair?: { readonly from: string; readonly to?: string },
): Array<SQL | undefined> {
  return [
    pair === undefined ? undefined : eq(table.originalCurrency, pair.from),
    pair?.to === undefined ? undefined : eq(table.currency, pair.to),
    ne(table.originalCurrency, table.currency),
    isNotNull(table.exchangeRate),
    gt(table.exchangeRate, 0),
    inArray(table.tripId, readableTripIds(scope)),
  ]
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
        ...frozenRatePredicates(scope, expenses, pair),
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
        ...frozenRatePredicates(scope, settlements, pair),
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

/* -------------------------------------------------------------------------------------------------
 * The display conversion
 * ---------------------------------------------------------------------------------------------- */

/**
 * The codes a rate from `from` answers for: every currency that a readable expense or payment froze
 * a rate toward from `from`, sorted. A code listed here is one {@link resolveRate} answers for with
 * `from` as the source, because both read the same predicate.
 *
 * Only the ordered pair counts. A trip kept in `EUR` that froze `GBP` to `EUR` lists `EUR` for
 * `GBP` and nothing for `EUR`: the opposite pair is never inferred.
 */
export async function listAnsweringCurrencies(
  scope: TenantScope,
  from: string,
): Promise<Array<string>> {
  const source = currencySchema.parse(from)
  const [fromExpenses, fromPayments] = await Promise.all([
    scope.db
      .selectDistinct({ code: expenses.currency })
      .from(expenses)
      .where(
        tenantFilter(
          scope,
          expenses,
          ...frozenRatePredicates(scope, expenses, { from: source }),
        ),
      ),
    scope.db
      .selectDistinct({ code: settlements.currency })
      .from(settlements)
      .where(
        tenantFilter(
          scope,
          settlements,
          ...frozenRatePredicates(scope, settlements, { from: source }),
        ),
      ),
  ])
  return [
    ...new Set([...fromExpenses, ...fromPayments].map((row) => row.code)),
  ].sort()
}

const displayRatesInput = z.strictObject({
  /** The currencies the figures are in. Repeats are folded: one lookup per distinct pair. */
  from: z.array(currencySchema).max(64),
  to: currencySchema,
  on: dateSchema,
})

export type DisplayRatesQuery = z.input<typeof displayRatesInput>

/**
 * The rate to the display currency for each distinct source currency, `null` where nothing answers.
 *
 * One {@link resolveRate} call per distinct pair, whatever the number of rows that share it; a
 * source that already is the target needs no rate and answers the identity, so a figure that is
 * already in the display currency is never run through a lookup. A pair nothing answers is `null`,
 * never a 1:1.
 */
export async function resolveDisplayRates(
  scope: TenantScope,
  query: DisplayRatesQuery,
  port?: RateSource,
): Promise<Map<string, ResolvedRate | null>> {
  const { from, to, on } = displayRatesInput.parse(query)
  const sources = [...new Set(from)]
  const answers = await Promise.all(
    sources.map((source) =>
      source === to
        ? { rate: 1, source: 'identity' }
        : resolveRate(scope, { from: source, to, on }, port),
    ),
  )
  return new Map(
    sources.map((source, index) => [source, answers[index] ?? null]),
  )
}

/* -------------------------------------------------------------------------------------------------
 * The reader's display preference
 * ---------------------------------------------------------------------------------------------- */

/**
 * The currency the given reader chose, or `null` for "each trip in its own currency" - which is
 * also what a member who has never had a settings row reads. The caller passes its own id only.
 */
export async function getDisplayCurrency(
  scope: TenantScope,
  userId: string,
): Promise<string | null> {
  return (await getUserSettings(scope, userId))?.displayCurrency ?? null
}

/**
 * Stores the caller's own display currency, or `null` to return to per-trip.
 *
 * Takes no user id: the row is the caller's, resolved by organization and user inside the scope.
 * The caller must be a member of the workspace in scope - a session whose membership has lapsed, or
 * a scope built for someone who never joined, is a {@link NotFoundError} and no row is inserted.
 * Writes the one column; the accounting default the settings screen owns is never touched.
 */
export async function setDisplayCurrency(
  scope: TenantScope,
  code: string | null,
): Promise<string | null> {
  const next = code === null ? null : currencySchema.parse(code)
  const userId = scope.ctx.userId
  if ((await getMembership(scope, userId)) === null) {
    throw new NotFoundError('workspace member', userId)
  }
  const row = await ensureUserSettings(scope, userId)
  const updated = await userSettingsRepository.requireUpdate(scope, row.id, {
    displayCurrency: next,
  })
  return updated.displayCurrency
}
