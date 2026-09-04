/**
 * The provider screen's arithmetic, kept out of the component so it can be argued with.
 *
 * Everything here is pure and takes its clock as an argument. That is not only for testability:
 * this screen may render no string derived from the browser's clock at all (see the note on
 * `../providers.tsx`). Computing the numbers here, from an instant the loader supplies, is what
 * keeps the rendered output a function of the data - and the unit tests over this module are what
 * is left holding it, now that the e2e audit that policed the whole console tree is gone.
 *
 * ## Three numbers, because there are three questions
 *
 * A single "forecast" would blur answers that differ. `monthEnd` answers *what will this month
 * cost*, and it is anchored to calls already made, so it is the one to hold a ceiling against.
 * `runRate` answers *what does a month at today's pace look like*, ignoring where we are in the
 * month, which is the number to compare between months. `projected` answers *what happens at N
 * workspaces*, and is the only one that extrapolates along a dimension we have not observed.
 *
 * ## Refusing to answer is a feature
 *
 * A projection from a few hours of data is arithmetic, not a forecast, and printing it would be the
 * same mistake as showing `0` beside a provider that has no client yet: a number that looks like a
 * measurement and is not one. Below {@link MIN_FORECAST_HOURS} this module returns `null` for every
 * projected figure and the screen says what it is waiting for.
 */

/** Below this much observation, no projection is offered at all. One full day. */
export const MIN_FORECAST_HOURS = 24

/**
 * The longest window a rate is measured over. Thirty days.
 *
 * A cap rather than "all of it", so that a quiet January cannot depress a busy March: without it
 * the rate is an average over the provider's whole lifetime and gets less responsive every week it
 * runs, which is the opposite of what a run-rate is for.
 */
export const MAX_FORECAST_HOURS = 720

/** Hours in an average month: 365.25 × 24 ÷ 12, floored. Used for month-shaped extrapolations. */
export const HOURS_PER_MONTH = 730

export interface UsagePoint {
  /** `YYYY-MM-DDTHH`, UTC. */
  readonly bucket: string
  readonly calls: number
}

export interface ForecastInput {
  readonly now: Date
  /** Hourly points, any order; only their count and span are used. */
  readonly series: ReadonlyArray<UsagePoint>
  /** Calls in the current calendar month, measured. */
  readonly monthToDate: number
  /** Distinct workspaces with at least one call in the window. The platform is not one. */
  readonly activeWorkspaces: number
  /** Oldest hour bucket held for this provider, or `null` when nothing is recorded. */
  readonly measuringSince: string | null
}

export interface Forecast {
  /** Hours of observation the numbers rest on, capped. */
  readonly windowHours: number
  /** Calls seen inside that window. */
  readonly windowCalls: number
  /** `null` until there is enough observation to project from. */
  readonly monthEnd: number | null
  readonly runRate: number | null
  /**
   * Measured calls per active workspace per month — the measured counterpart of the assumed
   * per-user workload in `docs/ARCHITECTURE.md` §8. `null` when no workspace traffic exists to
   * average, which is the ordinary case for a provider only the platform calls.
   */
  readonly perWorkspace: number | null
  /** True while `windowHours` is under {@link MIN_FORECAST_HOURS}: show the caveat, not the number. */
  readonly provisional: boolean
}

const HOUR_MS = 60 * 60 * 1000

/** `YYYY-MM-DDTHH` back to an instant. The buckets are UTC, so the suffix is explicit. */
function bucketToDate(bucket: string): Date {
  return new Date(`${bucket}:00:00.000Z`)
}

/** Whole hours left in `now`'s UTC calendar month, counting the current hour as spent. */
export function hoursRemainingInMonth(now: Date): number {
  const nextMonth = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    1,
    0,
    0,
    0,
    0,
  )
  return Math.max(0, Math.floor((nextMonth - now.getTime()) / HOUR_MS))
}

/**
 * The three numbers, or nulls where the data does not support one.
 *
 * The window runs from the oldest bucket held to `now`, floored at one hour so the rate is never a
 * division by zero, and capped at {@link MAX_FORECAST_HOURS}. When the cap bites, the calls counted
 * are only those inside it — otherwise the numerator would span a period the denominator does not.
 */
export function forecast(input: ForecastInput): Forecast {
  const nowMs = input.now.getTime()

  const oldestMs =
    input.measuringSince === null
      ? nowMs
      : bucketToDate(input.measuringSince).getTime()

  const observedHours = Math.max(1, Math.floor((nowMs - oldestMs) / HOUR_MS))
  const windowHours = Math.min(observedHours, MAX_FORECAST_HOURS)

  // The floor of the window as a bucket key, and it is `windowHours - 1` rather than `windowHours`
  // because the comparison below is inclusive: buckets are whole hours, so N hours of observation
  // is N buckets ending at the current one. Subtracting the full N admits one extra bucket, which
  // divides a longer numerator by a shorter denominator and reads the rate high — the very error
  // the cap above exists to prevent.
  const floor = new Date(nowMs - (windowHours - 1) * HOUR_MS)
    .toISOString()
    .slice(0, 13)
  const windowCalls = input.series
    .filter((point) => point.bucket >= floor)
    .reduce((total, point) => total + point.calls, 0)

  if (observedHours < MIN_FORECAST_HOURS) {
    return {
      windowHours: observedHours,
      windowCalls,
      monthEnd: null,
      runRate: null,
      perWorkspace: null,
      provisional: true,
    }
  }

  const perHour = windowCalls / windowHours
  const perWorkspace =
    input.activeWorkspaces > 0
      ? (windowCalls * HOURS_PER_MONTH) / (input.activeWorkspaces * windowHours)
      : null

  return {
    windowHours,
    windowCalls,
    monthEnd: input.monthToDate + perHour * hoursRemainingInMonth(input.now),
    runRate: perHour * HOURS_PER_MONTH,
    perWorkspace,
    provisional: false,
  }
}

/**
 * What N workspaces would cost, at `callsPerWorkspace` each.
 *
 * Both inputs are the operator's: the count defaults to today's measured one and the rate to the
 * measured `perWorkspace`, so the honest number is what the screen shows until someone deliberately
 * replaces it. `null` in, `null` out — there is no default rate to fall back on, because inventing
 * one is how an assumption gets mistaken for a measurement.
 */
export function projectAtScale(
  workspaces: number,
  callsPerWorkspace: number | null,
): number | null {
  if (callsPerWorkspace === null || !Number.isFinite(workspaces)) return null
  return Math.max(0, workspaces) * callsPerWorkspace
}

export type MeterTone = 'brand' | 'warning' | 'danger'

/**
 * The bar's tone, stepped at the provider's own thresholds rather than at literals.
 *
 * `/admin`'s quota panel hard-codes 0.7 and 0.9; here the pair is per-provider, because a vendor
 * with a hard monthly cap and one with burst pricing do not deserve the same warning point. The
 * comparison is `>=` rather than `>`: a limit set to exactly its warn threshold should warn.
 */
export function meterTone(
  used: number,
  limit: number,
  warnPercent: number,
  criticalPercent: number,
): MeterTone {
  if (limit <= 0) return 'danger'
  const percent = (used / limit) * 100
  if (percent >= criticalPercent) return 'danger'
  if (percent >= warnPercent) return 'warning'
  return 'brand'
}
