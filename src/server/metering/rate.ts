/**
 * The per-tenant ceiling on metered calls — a counter, not a count, and the one implementation of
 * it.
 *
 * Every other ceiling in this product bounds a row a workspace owns, which is why
 * `assertQuota()` can enforce it: the guard counts the table and refuses the next insert. A transit
 * search and a confirmation extraction leave no row, so there is nothing to `COUNT(*)`. What
 * bounds them is a tally, kept per organization and per calendar month in KV, checked **after a
 * cache miss and before the call** — a cached answer costs nothing and must therefore spend
 * nothing.
 *
 * The numbers are not here. They come from `resolveLimits()` in `src/server/billing/limits.ts`
 * ({@link PLAN_RATE_CEILINGS}), because the published number and the enforced number have to be
 * the same number; this module only measures against whatever it is handed.
 *
 * **Minted once, for three callers.** `03-S3` makes the first search, `03-S7` makes the first
 * extraction and `src/server/geo/geocode.ts` makes the first lookup; all three are the same rule
 * with a different metric name, so the metric is an argument. A second implementation a wave later
 * would be two implementations of one rule — which is also why this file sits here rather than
 * inside any one of them.
 *
 * ## Two postures, inherited rather than invented
 *
 * `src/server/metering/outbound.ts` states them for the provider gate and the argument is
 * identical here:
 *
 * - **The gate fails open.** Only a *successful* read saying the ceiling is spent closes it. A KV
 *   hiccup must not be able to turn a metering fault into a feature outage — a metering layer that
 *   can take the product down is worse than no metering layer.
 * - **Recording fails open and silent.** A tally that threw would turn a counter write into a
 *   failed search after the call had already been made and paid for.
 *
 * ## What this is not
 *
 * It is not exact under concurrency. KV has no atomic increment, so two searches issued in the
 * same instant by the same workspace can both read `n` and both write `n + 1`. That is a known
 * and bounded imprecision: the loop a ceiling exists to catch is thousands of calls, not two, and
 * the ceilings are set far below the point where one workspace's bill is worth noticing. The
 * shape that would fix it is the one `outbound.ts` already names — a Durable Object accumulating
 * in memory — and it is worth building when there is traffic that needs it and not before.
 */

import type { RateMetric } from '#/server/billing/limits'

/**
 * The slice of Workers KV this module uses. A real `KVNamespace` satisfies it, and so does a map
 * in a test — which is the whole reason it is written out rather than imported.
 */
export interface RateCounterStore {
  get: (key: string) => Promise<string | null>
  put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ) => Promise<void>
}

/**
 * How long a month's tally is kept.
 *
 * Forty days rather than "until the month ends": the key already names the month, so an entry
 * outliving its window is never read again, and a fixed span needs no arithmetic over month
 * lengths to get wrong. It is long enough that a workspace cannot reset its own tally by going
 * quiet for a week.
 */
export const RATE_COUNTER_TTL_SECONDS = 40 * 24 * 60 * 60

/** Bumped when the stored shape changes, so old entries are ignored rather than misread. */
const RATE_COUNTER_VERSION = 'v1'

/** The calendar month a tally belongs to, in UTC: `2026-09`. */
export function rateWindowOf(now: Date): string {
  return now.toISOString().slice(0, 7)
}

/** One workspace's tally of one metric in one month. */
export function rateMeterKey(
  metric: RateMetric,
  organizationId: string,
  window: string,
): string {
  return `rate:${RATE_COUNTER_VERSION}:${metric}:${organizationId}:${window}`
}

/**
 * Thrown when the workspace has spent its allowance of a metered call.
 *
 * The message is the one the traveller reads, so it says what ran out, what the ceiling was and
 * when it comes back — a refusal a reader cannot act on is indistinguishable from a fault.
 */
export class RateCeilingError extends Error {
  constructor(
    readonly metric: RateMetric,
    readonly ceiling: number,
    readonly spent: number,
  ) {
    super(
      ceiling === 0
        ? 'Connection search is not part of this workspace’s plan. Upgrade to search timetables from inside a trip.'
        : `This workspace has used all ${ceiling} of its searches this month. The allowance renews on the first of next month.`,
    )
    this.name = 'RateCeilingError'
  }
}

export interface SpendRateInput {
  readonly metric: RateMetric
  readonly organizationId: string
  /** The plan's ceiling, from `resolveLimits().rates` and never from a constant in a feature. */
  readonly ceiling: number
  readonly now: () => Date
  /** Optional, because a caller with no logger is a test and not a lesser caller. */
  readonly logger?: { warn: (message: string, fields?: unknown) => void } | null
}

function tallyOf(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '', 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0
}

async function readTally(
  store: RateCounterStore,
  key: string,
  input: SpendRateInput,
): Promise<number> {
  try {
    return tallyOf(await store.get(key))
  } catch (cause) {
    // Fails open: a counter that cannot be read is not evidence that the ceiling is spent.
    input.logger?.warn('transit.meter.read_failed', {
      metric: input.metric,
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return 0
  }
}

async function writeTally(
  store: RateCounterStore,
  key: string,
  next: number,
  input: SpendRateInput,
): Promise<void> {
  try {
    await store.put(key, String(next), {
      expirationTtl: RATE_COUNTER_TTL_SECONDS,
    })
  } catch (cause) {
    // Silent and open, for the same reason the recording posture in `outbound.ts` is: the call
    // this counts is about to be made, and failing it over its own bookkeeping helps nobody.
    input.logger?.warn('transit.meter.write_failed', {
      metric: input.metric,
      message: cause instanceof Error ? cause.message : String(cause),
    })
  }
}

/**
 * Spend one unit of `metric` for one workspace, or refuse.
 *
 * Answers the tally *after* the spend, so a caller can tell the reader how much is left without a
 * second read. A ceiling of zero is refused before the store is touched at all: a plan that may
 * make no calls has no tally to keep, and reading one would be a round trip spent proving a
 * number we already have.
 */
export async function spendRateUnit(
  store: RateCounterStore,
  input: SpendRateInput,
): Promise<number> {
  if (input.ceiling <= 0) {
    throw new RateCeilingError(input.metric, input.ceiling, 0)
  }

  const key = rateMeterKey(
    input.metric,
    input.organizationId,
    rateWindowOf(input.now()),
  )
  const spent = await readTally(store, key, input)

  if (spent >= input.ceiling) {
    throw new RateCeilingError(input.metric, input.ceiling, spent)
  }

  const next = spent + 1
  await writeTally(store, key, next, input)
  return next
}

/**
 * Spend up to `wanted` units of `metric` for one workspace in one read and one write, and answer
 * how many were granted.
 *
 * A caller that needs several units for one piece of work (a request resolving many places)
 * would otherwise write the same key several times within a second, and a key store that allows
 * about one write per key per second drops all but the first - the tally then counts one call
 * for many. Reading once and writing once keeps the tally honest, and the answer is never above
 * what is left, so a ceiling is never exceeded by the batch. Nothing is thrown for a spent month
 * or a ceiling of zero: that is a grant of zero, which the caller already has to handle.
 */
export async function spendRateUnits(
  store: RateCounterStore,
  input: SpendRateInput,
  wanted: number,
): Promise<number> {
  if (input.ceiling <= 0 || wanted <= 0) {
    return 0
  }

  const key = rateMeterKey(
    input.metric,
    input.organizationId,
    rateWindowOf(input.now()),
  )
  const spent = await readTally(store, key, input)
  const granted = Math.min(wanted, Math.max(0, input.ceiling - spent))
  if (granted > 0) {
    await writeTally(store, key, spent + granted, input)
  }
  return granted
}
