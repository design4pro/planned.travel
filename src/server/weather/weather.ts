/**
 * The weather policy - cache, allowance, provider, cache write, and the days a reading covers.
 *
 * Every consumer enters through {@link resolveTripWeather} and none reaches `./met-norway`
 * directly, for the reason `src/server/geo/geocode.ts` gives about its own vendor: the rules this
 * module applies are what make an outbound, metered, third-party call safe to make on behalf of
 * a traveller opening a screen.
 *
 * **The order of operations per location is the contract**, and each position is load-bearing:
 *
 * 1. **The cache first.** An entry is fresh until the expiry the provider stated, and a fresh entry
 *    costs nothing, so it spends nothing.
 * 2. **The allowance after the cache, and before the call.** The metric counts *outbound calls*,
 *    and a cache hit makes none; gating one would charge a workspace for a read that costs us
 *    nothing, and would empty a board that the cache could still draw. This is the opposite of
 *    `geocode.ts`, which gates first so that a workspace outside the feature is never served an
 *    answer another one paid for - that argument does not transfer to a weather forecast, whose
 *    key is a coordinate and whose answer is public. A spent allowance therefore degrades the
 *    board rather than emptying it: cached days render, the rest are `unavailable`.
 * 3. **The provider ledger around the call**, so the operator's own view of the vendor sees every
 *    call this module makes. It sits inside the allowance because the two count different things:
 *    the allowance is a workspace's month, the ledger is this deployment's bill.
 * 4. **The cache write last**, so a failed call leaves nothing behind that could be served.
 *
 * Two rules sit around that order and are not specific to one vendor. **An entry past its stated
 * expiry is re-validated, not discarded**: the entry holds the provider's last-modified validator,
 * so the one call that follows is conditional, and a "not modified" answer keeps the series and
 * moves the expiry on. **A failure is remembered** for {@link FAILURE_TTL_SECONDS}, per provider and
 * coordinate, because a spent unit cannot be refunded and a reload during an outage would
 * otherwise bill a workspace for a feature it was never given. The failure entry is read after the
 * cache and before the allowance, so a remembered failure costs neither a call nor a unit.
 *
 * **Nothing here throws at a caller for a provider reason.** A provider error, a timeout, a body
 * that does not parse, a spent allowance and a blocked vendor all turn the affected days into
 * `unavailable`. A planner that waited on this module for its first paint would be taken down by
 * somebody else's outage, which is why it is called after paint and why it cannot reject.
 *
 * ## Recorded days
 *
 * A day already past is read from a second provider, the same way and through the same path: the
 * cache per date, the remembered failure, the one grant of the allowance, the provider ledger, the
 * per-call timeout. It differs in three ways. The provider publishes a day some days after it ends,
 * so a past day inside that lag is `not-yet-recorded` - its own answer, which asks nothing of
 * anyone, spends nothing and is never filled in from a forecast. One call covers every recorded day
 * of a place, and each day is kept on its own, so a trip that grows by a day asks for that day.
 * And a reader that does not ask for recorded days (a tab loaded before they existed) is answered
 * as it always was: a past day is `none`.
 *
 * ## Estimated days
 *
 * A day beyond what the forecast covers is read from the same second provider's climatology: the
 * long-term mean high, low and rainfall of the day's month. One call per place answers all twelve
 * months, so it is kept thirty days and serves every trip to that place. It is a third kind with its
 * own place in the order of spending - forecast, then estimate, then recorded, because the day a
 * traveller is about to live is the one they act on - and its day carries no wind, no sky and no
 * slots, because an average over decades has none. A day as far out as {@link FORECAST_LOOKAHEAD_DAYS}
 * is an estimate before anything is asked. A nearer day is a forecast day until the forecast says
 * otherwise, and the allowance is granted once, up front, so a place with a day past
 * {@link FORECAST_CERTAIN_DAYS} also asks for its climatology: the forecast may stop short of it, and
 * the day would otherwise have nothing to fall back on. An estimate is an opt-in of the reader, like
 * the recorded days, because a reader that does not know the kind cannot draw it.
 *
 * ## The cache is shared across tenants, and holds nothing about them
 *
 * A key is a kind, a coordinate and nothing else: that a point has a forecast is a public fact, not
 * a fact about anybody's trip. No function exported here takes a trip, a place or a member, and
 * `__tests__/seam.test.ts` keeps it so. Days are grouped into a trip's local days when an entry is
 * *read*, never when it is stored, because two trips at one coordinate can sit in two zones.
 *
 * ## Bounds
 *
 * A request resolves at most {@link WEATHER_MAX_LOCATIONS} distinct locations, in the order given,
 * those with a forecast first, then those with an estimate, then those with only recorded days.
 * Each call is aborted at {@link WEATHER_CALL_TIMEOUT_MS}, inside a {@link WEATHER_DEADLINE_MS}
 * deadline for the whole request. The per-call bound is the smaller on purpose: calls fan out under
 * the deadline, and a per-call bound above it could never fire - one hung provider would take every
 * location down together instead of only itself.
 */

import { z } from 'zod'

import { sunTimes } from '#/lib/sun'
import { dayKeyIn, resolveTimeZone, todayKeyIn } from '#/lib/time'
import { hourIn } from '#/lib/timezones'
import { callProvider } from '#/server/metering/outbound'
import { spendRateUnits } from '#/server/metering/rate'

import type { SunTimes } from '#/lib/sun'
import type { DayReading, DaySlot, ForecastReading } from '#/lib/weather'
import type { OutboundRuntime } from '#/server/metering/outbound'
import type { RateCounterStore } from '#/server/metering/rate'

/* ---------------------------------------------------------------- vocabulary */

/** A point on the earth, as a place stores it. */
export interface WeatherCoordinate {
  readonly lat: number
  readonly lng: number
}

/** What one day of a trip asks: a date, and the point it is spent at. Either may be missing. */
export interface WeatherQuery {
  readonly date: string | null
  readonly location: WeatherCoordinate | null
}

/**
 * What a day is given back. Positional: the outcome at an index answers the query at that index,
 * so this module never has to be told which trip, day or place a query came from.
 */
export type WeatherOutcome =
  | { readonly status: 'none' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'not-yet-recorded' }
  | {
      readonly status: 'ok'
      readonly reading: DayReading
      readonly sun: SunTimes
    }

/** One instant of a provider's series, reduced to what the planner reads. */
export interface ForecastStep {
  /** ISO instant, UTC. */
  readonly time: string
  readonly tempC: number
  /** The condition for the stretch after this step, day/night suffix removed; `null` when none. */
  readonly symbol: string | null
  /** Wind speed at the step, metres per second; `null` when the step carries none. */
  readonly windMs: number | null
  /** Millimetres in the stretch after this step - the hourly figure, else the six-hourly one. */
  readonly precipitationMm: number | null
  /** Chance of precipitation after this step, 0 to 100; `null` when the provider states none. */
  readonly precipitationProbability: number | null
}

export interface ForecastFetch {
  readonly series: ReadonlyArray<ForecastStep>
  /** The provider's stated expiry, or `null` when it gave none that can be read. */
  readonly expires: Date | null
  /** The provider's last-modified validator, or `null` when it gave none that can be read. */
  readonly lastModified: string | null
}

/**
 * The answer to a conditional request whose validator still holds: no series, because the caller
 * already has it, and the expiry (and validator) the provider now states.
 */
export interface ForecastNotModified {
  readonly notModified: true
  readonly expires: Date | null
  readonly lastModified: string | null
}

/** The provider seam. `./met-norway` implements it; a test hands over a stub. */
export interface ForecastProvider {
  readonly forecast: (
    lat: number,
    lng: number,
    init: {
      readonly signal: AbortSignal
      /** The stored validator; the request is conditional when it is given. */
      readonly lastModified?: string | null
    },
  ) => Promise<ForecastFetch | ForecastNotModified>
}

/** One recorded day, metric. A field the provider had nothing for is `null`, never a number. */
export interface RecordedValues {
  readonly tempMinC: number | null
  readonly tempMaxC: number | null
  /** Millimetres that fell over the day. */
  readonly precipitationMm: number | null
  /** The mean wind over the day at two metres, metres per second. */
  readonly windMs: number | null
}

/** The provider seam for recorded days. `./nasa-power` implements it; a test hands over a stub. */
export interface RecordedProvider {
  /**
   * How many whole days the provider takes to publish a day: a day is recorded once its date is at
   * least this many days before the provider's own today. Held by the client, because it is a
   * property of the service and not of this policy.
   */
  readonly lagDays: number
  /**
   * The first date the provider holds data for (`YYYY-MM-DD`). A trip dated earlier is read as `none`
   * and never asked for: the provider refuses such a range, and a refusal is remembered per cell, so
   * one workspace's mistyped year would otherwise blank the cell for every other workspace.
   */
  readonly firstDate: string
  /** Every day from `range.start` to `range.end` (inclusive, `YYYY-MM-DD`), keyed by its date. */
  readonly daily: (
    lat: number,
    lng: number,
    range: { readonly start: string; readonly end: string },
    init: { readonly signal: AbortSignal },
  ) => Promise<ReadonlyMap<string, RecordedValues>>
}

/** One month of a climatology, metric. A field the provider had nothing for is `null`. */
export interface ClimateMonth {
  readonly tempMinC: number | null
  readonly tempMaxC: number | null
  /** The mean millimetres per day over the month. */
  readonly precipitationMm: number | null
}

/** The provider seam for estimated days. `./nasa-power` implements it; a test hands over a stub. */
export interface ClimateProvider {
  /** The twelve months of the point's climatology, January first. */
  readonly climatology: (
    lat: number,
    lng: number,
    init: { readonly signal: AbortSignal },
  ) => Promise<ReadonlyArray<ClimateMonth>>
}

export type WeatherFailureReason =
  'unreachable' | 'refused' | 'malformed' | 'timeout'

/**
 * A provider failure, typed so a caller can tell it from a defect of our own.
 *
 * The message is developer-facing English and never quotes a URL or a body: a URL carries a
 * coordinate, and a body is the provider's text.
 */
export class WeatherProviderError extends Error {
  constructor(
    readonly reason: WeatherFailureReason,
    message: string,
  ) {
    super(message)
    this.name = 'WeatherProviderError'
  }
}

/** The slice of Workers KV the policy uses. A real `KVNamespace` satisfies it; so does a map. */
export interface WeatherCache {
  readonly get: (key: string) => Promise<string | null>
  readonly put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ) => Promise<void>
}

export interface WeatherRuntime {
  /** Where readings are kept - shared across every tenant, on purpose. */
  readonly cache: WeatherCache
  /** Where allowances are tallied - per workspace, on purpose. */
  readonly counters: RateCounterStore
  /** The provider ledger's runtime, so every vendor call is counted and blockable. */
  readonly outbound: OutboundRuntime
  readonly organizationId: string
  /** `resolveLimits().rates.weather_lookups_per_month` for this workspace. */
  readonly ceiling: number
  readonly now: () => Date
  readonly logger?: {
    warn: (message: string, fields?: unknown) => void
    info: (message: string, fields?: unknown) => void
  } | null
  readonly metNorway: ForecastProvider
  readonly nasaPower: RecordedProvider & ClimateProvider
}

/* ------------------------------------------------------------------- bounds */

export const WEATHER_CALL_TIMEOUT_MS = 6_000
export const WEATHER_DEADLINE_MS = 8_000
export const WEATHER_MAX_LOCATIONS = 12

/**
 * How far ahead a day may be and still be worth a call.
 *
 * Not the forecast window - the provider decides that, and the window is read off its answer - but
 * a ceiling above any window it has ever offered, so that a trip next year does not spend a
 * workspace's unit on every reload to learn that nothing covers it.
 */
export const FORECAST_LOOKAHEAD_DAYS = 14

/**
 * The days from today a forecast has always covered in full: MET's compact product ran to today plus
 * nine on 2026-10-12. A forecast day past this may turn out to be beyond the forecast, so its place
 * also asks for its climatology (see the module header); one up to it never does.
 */
export const FORECAST_CERTAIN_DAYS = 7

/** A missing or already-past expiry is read as this long from the fetch. */
const MIN_FRESH_MS = 60_000

/** Retention, not freshness: how long an entry is kept whatever its expiry says. */
const RETENTION_SECONDS = 6 * 60 * 60

/** How long a failed provider is left alone at a coordinate. */
export const FAILURE_TTL_SECONDS = 5 * 60

/** The vendor behind the forecast kind; the failure entry is keyed on it. */
const FORECAST_PROVIDER = 'met-norway'

/** The vendor behind the recorded and estimate kinds; the failure entry is keyed on it. */
const NASA_PROVIDER = 'nasa-power'

/** A recorded day this many days old or more is settled; a younger one may still be revised. */
export const RECORDED_RECENT_DAYS = 90

/** How long a recorded day under {@link RECORDED_RECENT_DAYS} old is kept. */
export const RECORDED_RECENT_TTL_SECONDS = 24 * 60 * 60

/** How long a recorded day of {@link RECORDED_RECENT_DAYS} old or more is kept. */
export const RECORDED_SETTLED_TTL_SECONDS = 30 * 24 * 60 * 60

/** How long a place's climatology is kept: a long-term mean does not change within a month. */
export const ESTIMATE_TTL_SECONDS = 30 * 24 * 60 * 60

/**
 * How long a climatology with no temperature in it is remembered as empty, for the reason
 * {@link RECORDED_EMPTY_TTL_SECONDS} gives.
 */
export const ESTIMATE_EMPTY_TTL_SECONDS = 60 * 60

/**
 * How long a day the provider answered with nothing in it is remembered as empty.
 *
 * Short on purpose: the answer was real, so it is not a provider failure and the failure entry does
 * not apply, but a hole is exactly what a late publication or a gap can fill, and keeping it for a
 * day or a month would pin it. Remembering it at all is what stops every view of the board from
 * spending a unit to be told the same thing.
 */
export const RECORDED_EMPTY_TTL_SECONDS = 60 * 60

/* --------------------------------------------------------------------- keys */

/** Bumped when a stored shape changes; the previous prefix is left to expire on its own. */
export const WEATHER_CACHE_VERSION = 'v2'

/**
 * A coordinate cut to `digits` decimals, four by default: the provider's terms for the forecast and
 * what its keys use.
 *
 * Four decimals is about eleven metres, so one doorway is one entry. `-0.0000` is folded into
 * `0.0000` so that two spellings of the equator are one key.
 */
export function roundCoordinate(value: number, digits = 4): string {
  const fixed = value.toFixed(digits)
  return Number(fixed) === 0 ? (0).toFixed(digits) : fixed
}

/** `wx:v2:forecast:{lat}:{lng}` - a kind and a coordinate, and nothing about who asked. */
export function forecastCacheKey(lat: number, lng: number): string {
  return `wx:${WEATHER_CACHE_VERSION}:forecast:${roundCoordinate(lat)}:${roundCoordinate(lng)}`
}

/**
 * `wx:v2:recorded:{lat}:{lng}:{date}` - a coordinate cut to one decimal, a date and nothing about
 * who asked.
 *
 * One decimal because the provider's grid is about half a degree: a finer key only fragments the
 * cache for the same cell, and a finer coordinate sent to the provider would disclose more than the
 * answer needs. The request is built from the same rounded value.
 */
export function recordedCacheKey(
  lat: number,
  lng: number,
  date: string,
): string {
  return `wx:${WEATHER_CACHE_VERSION}:recorded:${roundCoordinate(lat, 1)}:${roundCoordinate(lng, 1)}:${date}`
}

/**
 * `wx:v2:estimate:{lat}:{lng}` - a coordinate cut to one decimal and nothing about who asked, for
 * the reason {@link recordedCacheKey} gives. No date: the entry holds every month.
 */
export function estimateCacheKey(lat: number, lng: number): string {
  return `wx:${WEATHER_CACHE_VERSION}:estimate:${roundCoordinate(lat, 1)}:${roundCoordinate(lng, 1)}`
}

/**
 * `wx:v2:fail:{provider}:{lat}:{lng}` - the provider, a coordinate and nothing about who asked.
 *
 * Per provider, so one vendor's outage never hides the days another vendor can still answer, and
 * not per kind, because an outage is the vendor's. A new provider needs a new argument and nothing
 * else.
 */
export function failureCacheKey(
  provider: string,
  lat: number,
  lng: number,
): string {
  return `wx:${WEATHER_CACHE_VERSION}:fail:${provider}:${roundCoordinate(lat)}:${roundCoordinate(lng)}`
}

/** `partlycloudy_night` -> `partlycloudy`: the label does not depend on the hour. */
export function stripDayNight(code: string): string {
  return code.replace(/_(day|night|polartwilight)$/, '')
}

/* ------------------------------------------------------------------ the days */

type ForecastDay = Omit<ForecastReading, 'kind' | 'source'>

/** A day is read in four slots of this many hours. */
const SLOT_HOURS = 6
const SLOT_COUNT = 24 / SLOT_HOURS

interface GroupedForecast {
  readonly days: ReadonlyMap<string, ForecastDay>
  /** The last local date the series carries in full, or `null` when it carries none. */
  readonly lastCompleteDate: string | null
}

const DAY_MS = 86_400_000

function shiftDate(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10)
}

/**
 * A provider's series cut into the trip's local days.
 *
 * A step belongs to the day it falls in *in the trip's zone*, so a step at 22:00Z is tomorrow's
 * first hour in Oslo. A date is complete when the series has a step on a later date: the series
 * runs through that whole date and out the other side. The last date it touches is therefore
 * partial, and is not a forecast day. That rule is applied only to the far end - today is always
 * a forecast day, read from the hours still ahead - so the boundary moves with the provider
 * rather than with our guess.
 */
export function groupForecastDays(
  series: ReadonlyArray<ForecastStep>,
  timeZone: string,
): GroupedForecast {
  const zone = resolveTimeZone(timeZone)
  const byDate = new Map<string, Array<ForecastStep>>()
  let lastDate: string | null = null

  for (const step of series) {
    const date = dayKeyIn(step.time, zone)
    byDate.set(date, [...(byDate.get(date) ?? []), step])
    if (lastDate === null || date > lastDate) {
      lastDate = date
    }
  }

  return {
    days: new Map(
      [...byDate].map(([date, steps]) => [date, readDay(steps, zone)]),
    ),
    lastCompleteDate: lastDate === null ? null : shiftDate(lastDate, -1),
  }
}

/** The largest of the figures a day has, or `null` when it has none. */
function highest(values: ReadonlyArray<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null)
  return present.length === 0 ? null : Math.max(...present)
}

/** One decimal, which is what the provider states and what a reader can use; no float dust. */
function tenth(value: number): number {
  return Math.round(value * 10) / 10
}

/** One local day's steps read into the figures the planner draws. */
function readDay(
  steps: ReadonlyArray<ForecastStep>,
  zone: string,
): ForecastDay {
  const temperatures = steps.map((step) => step.tempC)
  const rain = steps.flatMap((step) =>
    step.precipitationMm === null ? [] : [step.precipitationMm],
  )
  const wind = highest(steps.map((step) => step.windMs))
  const symbols = new Map<string, number>()
  for (const step of steps) {
    if (step.symbol !== null) {
      symbols.set(step.symbol, (symbols.get(step.symbol) ?? 0) + 1)
    }
  }
  return {
    tempMinC: Math.min(...temperatures),
    tempMaxC: Math.max(...temperatures),
    symbol: dominant(symbols),
    precipitationMm:
      rain.length === 0 ? null : tenth(rain.reduce((a, b) => a + b, 0)),
    precipitationProbability: highest(
      steps.map((step) => step.precipitationProbability),
    ),
    windMs: wind === null ? null : tenth(wind),
    slots: slotsOf(steps, zone),
  }
}

/**
 * The day's steps cut into night, morning, afternoon and evening by local hour.
 *
 * A slot's temperature is the mean of the steps inside it. A slot that no step is inside or covers
 * is left out, never drawn with a value from its neighbour - which is how today, once the morning
 * has gone, has two.
 *
 * A step's sky describes the six hours that start at the step, and past the hourly stretch the
 * steps sit at 00, 06, 12 and 18 UTC, which is not the start of a local slot in most zones (05:00,
 * 11:00 and so on in Los Angeles). So the slot takes the sky of the step whose six hours overlap it
 * most, and none when that is less than half of the slot: a slot is never given the sky of other
 * hours than its own.
 */
function slotsOf(
  steps: ReadonlyArray<ForecastStep>,
  zone: string,
): ReadonlyArray<DaySlot> | null {
  const starts = steps.map((step) => hourIn(step.time, zone))
  const slots: Array<DaySlot> = []
  for (let index = 0; index < SLOT_COUNT; index += 1) {
    const slotStart = index * SLOT_HOURS
    const inSlot = steps.filter(
      (_, at) => Math.floor(starts[at] / SLOT_HOURS) === index,
    )
    const covering = coveringStep(steps, starts, slotStart)
    const sources =
      inSlot.length > 0 ? inSlot : covering === null ? [] : [covering]
    if (sources.length === 0) {
      continue
    }
    slots.push({
      from: `${String(slotStart).padStart(2, '0')}:00`,
      symbol: covering?.symbol ?? null,
      tempC: tenth(
        sources.reduce((sum, step) => sum + step.tempC, 0) / sources.length,
      ),
    })
  }
  return slots.length === 0 ? null : slots
}

/** The step whose six hours cover at least half of the slot starting at `slotStart`, most first. */
function coveringStep(
  steps: ReadonlyArray<ForecastStep>,
  starts: ReadonlyArray<number>,
  slotStart: number,
): ForecastStep | null {
  let best: ForecastStep | null = null
  let bestOverlap = 0
  for (const [at, step] of steps.entries()) {
    const overlap = Math.max(0, SLOT_HOURS - Math.abs(starts[at] - slotStart))
    if (overlap > bestOverlap) {
      best = step
      bestOverlap = overlap
    }
  }
  return bestOverlap * 2 >= SLOT_HOURS ? best : null
}

/** The most frequent symbol; the first one seen wins a tie, so the answer is deterministic. */
function dominant(counts: ReadonlyMap<string, number>): string | null {
  let best: string | null = null
  let bestCount = 0
  for (const [symbol, count] of counts) {
    if (count > bestCount) {
      best = symbol
      bestCount = count
    }
  }
  return best
}

/* ---------------------------------------------------------------- the cache */

const entrySchema = z.object({
  v: z.literal(2),
  fetchedAt: z.string(),
  expires: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  // A provider that sent no `Last-Modified` leaves none; such an entry is re-fetched unconditionally.
  lastModified: z.string().nullable().default(null),
  series: z.array(
    z.object({
      time: z.string(),
      tempC: z.number(),
      symbol: z.string().nullable(),
      windMs: z.number().nullable(),
      precipitationMm: z.number().nullable(),
      precipitationProbability: z.number().nullable(),
    }),
  ),
})

type ForecastEntry = z.infer<typeof entrySchema>

async function readEntry(
  runtime: WeatherRuntime,
  key: string,
): Promise<ForecastEntry | null> {
  let raw: string | null = null
  try {
    raw = await runtime.cache.get(key)
  } catch (cause) {
    // A cache that cannot be read is a miss, never a failure: the answer is one call away.
    runtime.logger?.warn('weather.cache.read_failed', {
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return null
  }
  if (raw === null) {
    return null
  }
  try {
    const parsed = entrySchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    // A malformed value is a miss as well; the next write replaces it.
    return null
  }
}

async function writeEntry(
  runtime: WeatherRuntime,
  key: string,
  fetched: Pick<ForecastFetch, 'series' | 'expires' | 'lastModified'>,
): Promise<void> {
  const at = runtime.now()
  const stated = fetched.expires
  const expires =
    stated !== null && stated.getTime() > at.getTime()
      ? stated
      : new Date(at.getTime() + MIN_FRESH_MS)
  const entry: ForecastEntry = {
    v: 2,
    fetchedAt: at.toISOString(),
    expires: expires.toISOString(),
    lastModified: fetched.lastModified,
    series: [...fetched.series],
  }
  try {
    await runtime.cache.put(key, JSON.stringify(entry), {
      expirationTtl: RETENTION_SECONDS,
    })
  } catch (cause) {
    // Logged and swallowed: the answer is already in hand, and failing it over its own bookkeeping
    // helps nobody.
    runtime.logger?.warn('weather.cache.write_failed', {
      message: cause instanceof Error ? cause.message : String(cause),
    })
  }
}

/* -------------------------------------------------------------- one location */

/**
 * Runs `run` with a signal that is aborted, and a rejection that is raised, after `ms`.
 *
 * The rejection is raised here and not left to the aborted call, because a transport that ignores
 * its signal would otherwise hold the request open until the deadline.
 */
function withTimeout<T>(
  ms: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(
        new WeatherProviderError(
          'timeout',
          `The weather provider did not answer within ${ms} ms.`,
        ),
      )
    }, ms)
  })
  return Promise.race([run(controller.signal), expired]).finally(() => {
    clearTimeout(timer)
  })
}

/** Whether an entry may be served without asking: only until the expiry stored inside it. */
function isFresh(runtime: WeatherRuntime, entry: ForecastEntry): boolean {
  return runtime.now().getTime() < Date.parse(entry.expires)
}

const failureSchema = z.object({
  v: z.literal(1),
  lat: z.number(),
  lng: z.number(),
})

/** Whether `provider` failed at this coordinate within {@link FAILURE_TTL_SECONDS}. */
async function hasFailed(
  runtime: WeatherRuntime,
  provider: string,
  coordinate: WeatherCoordinate,
): Promise<boolean> {
  try {
    const raw = await runtime.cache.get(
      failureCacheKey(provider, coordinate.lat, coordinate.lng),
    )
    return raw !== null && failureSchema.safeParse(JSON.parse(raw)).success
  } catch (cause) {
    // A failure that cannot be read is no failure: the worst case is one call we could have saved.
    runtime.logger?.warn('weather.cache.read_failed', {
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return false
  }
}

/** Remembers that `provider` failed here, as the coordinate and nothing else. */
async function rememberFailure(
  runtime: WeatherRuntime,
  provider: string,
  coordinate: WeatherCoordinate,
): Promise<void> {
  const entry: z.infer<typeof failureSchema> = {
    v: 1,
    lat: Number(roundCoordinate(coordinate.lat)),
    lng: Number(roundCoordinate(coordinate.lng)),
  }
  try {
    await runtime.cache.put(
      failureCacheKey(provider, coordinate.lat, coordinate.lng),
      JSON.stringify(entry),
      { expirationTtl: FAILURE_TTL_SECONDS },
    )
  } catch (cause) {
    runtime.logger?.warn('weather.cache.write_failed', {
      message: cause instanceof Error ? cause.message : String(cause),
    })
  }
}

/**
 * One place's series from the provider, or `null` when it cannot be had.
 *
 * `previous` is the entry that went stale, when there is one: its validator makes the call
 * conditional, and its series is what a "not modified" answer keeps. Every failure collapses to
 * `null` here, including a defect of our own: this runs after first paint and must not be able to
 * reject, and an `unavailable` day is the honest rendering of all of them. A failure of the call
 * itself is remembered, so the next resolution spends nothing on a provider that has just failed.
 */
async function fetchSeries(
  runtime: WeatherRuntime,
  key: string,
  coordinate: WeatherCoordinate,
  previous: ForecastEntry | null,
): Promise<ReadonlyArray<ForecastStep> | null> {
  try {
    const answer = await callProvider(
      runtime.outbound,
      {
        provider: FORECAST_PROVIDER,
        operation: 'forecast',
        organizationId: runtime.organizationId,
      },
      () =>
        withTimeout(WEATHER_CALL_TIMEOUT_MS, (signal) =>
          runtime.metNorway.forecast(coordinate.lat, coordinate.lng, {
            signal,
            lastModified: previous?.lastModified ?? null,
          }),
        ),
    )
    if ('notModified' in answer) {
      // Only a request that carried a validator can be answered "not modified".
      if (previous === null || previous.lastModified === null) {
        throw new WeatherProviderError(
          'malformed',
          'The weather provider answered "not modified" to an unconditional request.',
        )
      }
      const revalidated = {
        series: previous.series,
        expires: answer.expires,
        lastModified: answer.lastModified ?? previous.lastModified,
      }
      await writeEntry(runtime, key, revalidated)
      return revalidated.series
    }
    await writeEntry(runtime, key, answer)
    return answer.series
  } catch (cause) {
    runtime.logger?.warn('weather.forecast_unavailable', {
      reason: cause instanceof Error ? cause.name : 'unknown',
      message: cause instanceof Error ? cause.message : String(cause),
    })
    await rememberFailure(runtime, FORECAST_PROVIDER, coordinate)
    return null
  }
}

/* ------------------------------------------------------------- recorded days */

const recordedEntrySchema = z.object({
  v: z.literal(2),
  fetchedAt: z.string(),
  day: z.object({
    tempMinC: z.number().nullable(),
    tempMaxC: z.number().nullable(),
    precipitationMm: z.number().nullable(),
    windMs: z.number().nullable(),
  }),
})

/** Whether a day or a month can be drawn: at least one temperature is a number. */
function hasTemperature(
  values: Pick<RecordedValues, 'tempMinC' | 'tempMaxC'>,
): boolean {
  return values.tempMinC !== null || values.tempMaxC !== null
}

/**
 * What the cache holds for one recorded day: `miss` when it holds nothing usable, `empty` for a day
 * the provider answered with no temperature in it, otherwise the figures.
 */
type RecordedRead = 'miss' | 'empty' | RecordedValues

async function readRecordedEntry(
  runtime: WeatherRuntime,
  coordinate: WeatherCoordinate,
  date: string,
): Promise<RecordedRead> {
  let raw: string | null = null
  try {
    raw = await runtime.cache.get(
      recordedCacheKey(coordinate.lat, coordinate.lng, date),
    )
  } catch (cause) {
    runtime.logger?.warn('weather.cache.read_failed', {
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return 'miss'
  }
  if (raw === null) {
    return 'miss'
  }
  try {
    const parsed = recordedEntrySchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      return 'miss'
    }
    return hasTemperature(parsed.data.day) ? parsed.data.day : 'empty'
  } catch {
    return 'miss'
  }
}

/** Kept a day while it can still be revised, a month once it is settled, an hour when it is empty. */
function recordedTtl(
  date: string,
  today: string,
  values: RecordedValues,
): number {
  if (!hasTemperature(values)) {
    return RECORDED_EMPTY_TTL_SECONDS
  }
  return date > shiftDate(today, -RECORDED_RECENT_DAYS)
    ? RECORDED_RECENT_TTL_SECONDS
    : RECORDED_SETTLED_TTL_SECONDS
}

async function writeRecordedEntry(
  runtime: WeatherRuntime,
  coordinate: WeatherCoordinate,
  date: string,
  today: string,
  values: RecordedValues,
): Promise<void> {
  const entry: z.infer<typeof recordedEntrySchema> = {
    v: 2,
    fetchedAt: runtime.now().toISOString(),
    day: values,
  }
  try {
    await runtime.cache.put(
      recordedCacheKey(coordinate.lat, coordinate.lng, date),
      JSON.stringify(entry),
      { expirationTtl: recordedTtl(date, today, values) },
    )
  } catch (cause) {
    runtime.logger?.warn('weather.cache.write_failed', {
      message: cause instanceof Error ? cause.message : String(cause),
    })
  }
}

const NO_VALUES: RecordedValues = {
  tempMinC: null,
  tempMaxC: null,
  precipitationMm: null,
  windMs: null,
}

/** One place's recorded days: a date to its figures, or to `null` when the day cannot be drawn. */
type RecordedDays = Map<string, RecordedValues | null>

/**
 * One cell's missing recorded days from the provider, in one call spanning them.
 *
 * Every date asked for ends up in `into`: its figures when the provider had a temperature for it,
 * otherwise `null`. A day without one is kept as empty for a short while rather than not at all, so
 * that the next view does not spend a unit to hear the same thing; a failure of the call itself is
 * remembered per provider and cell, and leaves nothing in the cache.
 */
async function fetchRecorded(
  runtime: WeatherRuntime,
  coordinate: WeatherCoordinate,
  dates: ReadonlyArray<string>,
  today: string,
  into: RecordedDays,
): Promise<void> {
  const ordered = [...dates].sort()
  const range = { start: ordered[0], end: ordered[ordered.length - 1] }
  try {
    const days = await callProvider(
      runtime.outbound,
      {
        provider: NASA_PROVIDER,
        operation: 'daily',
        organizationId: runtime.organizationId,
      },
      () =>
        withTimeout(WEATHER_CALL_TIMEOUT_MS, (signal) =>
          runtime.nasaPower.daily(coordinate.lat, coordinate.lng, range, {
            signal,
          }),
        ),
    )
    await Promise.all(
      ordered.map(async (date) => {
        const values = days.get(date) ?? NO_VALUES
        into.set(date, hasTemperature(values) ? values : null)
        await writeRecordedEntry(runtime, coordinate, date, today, values)
      }),
    )
  } catch (cause) {
    runtime.logger?.warn('weather.recorded_unavailable', {
      reason: cause instanceof Error ? cause.name : 'unknown',
      message: cause instanceof Error ? cause.message : String(cause),
    })
    for (const date of ordered) {
      into.set(date, null)
    }
    await rememberFailure(runtime, NASA_PROVIDER, coordinate)
  }
}

/* ------------------------------------------------------------ estimated days */

const estimateEntrySchema = z.object({
  v: z.literal(2),
  fetchedAt: z.string(),
  months: z
    .array(
      z.object({
        tempMinC: z.number().nullable(),
        tempMaxC: z.number().nullable(),
        precipitationMm: z.number().nullable(),
      }),
    )
    .length(12),
})

/** A place's climatology, January first, or `null` when the cache holds nothing usable. */
type Climate = ReadonlyArray<ClimateMonth>

async function readEstimateEntry(
  runtime: WeatherRuntime,
  coordinate: WeatherCoordinate,
): Promise<Climate | null> {
  let raw: string | null = null
  try {
    raw = await runtime.cache.get(
      estimateCacheKey(coordinate.lat, coordinate.lng),
    )
  } catch (cause) {
    runtime.logger?.warn('weather.cache.read_failed', {
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return null
  }
  if (raw === null) {
    return null
  }
  try {
    const parsed = estimateEntrySchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data.months : null
  } catch {
    return null
  }
}

async function writeEstimateEntry(
  runtime: WeatherRuntime,
  coordinate: WeatherCoordinate,
  months: Climate,
): Promise<void> {
  const entry: z.infer<typeof estimateEntrySchema> = {
    v: 2,
    fetchedAt: runtime.now().toISOString(),
    months: [...months],
  }
  try {
    await runtime.cache.put(
      estimateCacheKey(coordinate.lat, coordinate.lng),
      JSON.stringify(entry),
      {
        expirationTtl: months.some(hasTemperature)
          ? ESTIMATE_TTL_SECONDS
          : ESTIMATE_EMPTY_TTL_SECONDS,
      },
    )
  } catch (cause) {
    runtime.logger?.warn('weather.cache.write_failed', {
      message: cause instanceof Error ? cause.message : String(cause),
    })
  }
}

/**
 * One cell's climatology from the provider, into `into` under `cell`: the twelve months, or `null`
 * when the call failed, which is also remembered per provider and cell and leaves nothing in the
 * cache.
 */
async function fetchEstimate(
  runtime: WeatherRuntime,
  coordinate: WeatherCoordinate,
  cell: string,
  into: Map<string, Climate | null>,
): Promise<void> {
  try {
    const months = await callProvider(
      runtime.outbound,
      {
        provider: NASA_PROVIDER,
        operation: 'climatology',
        organizationId: runtime.organizationId,
      },
      () =>
        withTimeout(WEATHER_CALL_TIMEOUT_MS, (signal) =>
          runtime.nasaPower.climatology(coordinate.lat, coordinate.lng, {
            signal,
          }),
        ),
    )
    into.set(cell, months)
    await writeEstimateEntry(runtime, coordinate, months)
  } catch (cause) {
    runtime.logger?.warn('weather.estimate_unavailable', {
      reason: cause instanceof Error ? cause.name : 'unknown',
      message: cause instanceof Error ? cause.message : String(cause),
    })
    into.set(cell, null)
    await rememberFailure(runtime, NASA_PROVIDER, coordinate)
  }
}

/* -------------------------------------------------------------- which kind */

/** What a day of a trip is read as, by where it sits in time. */
export type DayKind =
  'forecast' | 'recorded' | 'not-yet-recorded' | 'estimate' | 'none'

export interface KindWindow {
  /** Today in the trip's zone. */
  readonly today: string
  /** The last date a forecast covers in full, and never earlier than today. */
  readonly forecastEnd: string
  /** The last date the recorded provider has published; see {@link lastRecordedDate}. */
  readonly recordedEnd: string
  /** The first date the recorded provider holds data for. */
  readonly recordedStart: string
}

/**
 * Which kind of reading a date gets. Pure, and the one place the boundaries between the kinds are
 * written: today is always a forecast day, the forecast stops where its window ends, and a past day
 * is recorded once the provider has published it and not yet recorded until then. A past day from
 * before the provider's data begins is `none`. A day after the forecast's last is an estimate.
 */
export function selectKind(date: string, window: KindWindow): DayKind {
  if (date >= window.today) {
    return date <= window.forecastEnd ? 'forecast' : 'estimate'
  }
  if (date < window.recordedStart) {
    return 'none'
  }
  return date <= window.recordedEnd ? 'recorded' : 'not-yet-recorded'
}

/**
 * The last date a recorded provider has published, given a lag in whole days.
 *
 * The lag is counted from the provider's own today, which is UTC's, and not from the traveller's: in
 * Tokyo it is already tomorrow while the provider is still on yesterday, and a day it has not
 * published must not be asked for and reported as a failure. And it never reaches today in the
 * trip's zone, because a day that has not ended has no record.
 */
export function lastRecordedDate(
  today: string,
  utcToday: string,
  lagDays: number,
): string {
  const published = shiftDate(utcToday, -lagDays)
  const yesterday = shiftDate(today, -1)
  return published < yesterday ? published : yesterday
}

/* ---------------------------------------------------------------- one request */

/** The places a request resolves, by what is asked of each. */
interface Plan {
  /** Every location the request resolves, by forecast key, for the line it leaves. */
  readonly locations: ReadonlySet<string>
  readonly forecast: ReadonlyMap<string, WeatherCoordinate>
  readonly estimate: ReadonlyMap<string, EstimatePlace>
  readonly recorded: ReadonlyMap<string, RecordedPlace>
}

/** A one-decimal cell whose climatology is asked of the provider, and the locations that ask. */
interface EstimatePlace {
  readonly coordinate: WeatherCoordinate
  readonly locations: Set<string>
}

/** A one-decimal cell, the recorded days asked of it and the locations those days belong to. */
interface RecordedPlace {
  readonly coordinate: WeatherCoordinate
  readonly dates: Set<string>
  readonly locations: Set<string>
}

/** What a request found, filled as it goes so that a deadline leaves what had arrived. */
interface Resolved {
  readonly forecast: Map<string, ReadonlyArray<ForecastStep> | null>
  readonly estimate: Map<string, Climate | null>
  readonly recorded: Map<string, RecordedDays>
}

/** What reading the cache for a request found, for the line each resolution leaves. */
interface CacheTally {
  /** Locations every reading of which was served from an entry still inside its expiry. */
  hits: number
}

/**
 * Resolves each place into `into`: the cache first, then the provider for as many cold places as
 * the allowance grants, in the order forecast, estimate, recorded, and the earliest day first.
 *
 * A cold place is one with no entry inside its expiry, or a recorded cell with a date nobody has
 * kept. If the provider failed there a moment ago it is `null` at once, before the allowance is
 * touched. The allowance is spent once for the whole request, after the cache has been read, so a
 * warm place costs nothing and the grant goes to the days that come first rather than to whichever
 * read finished first. A place the grant does not reach is `null` - unavailable, the same as a
 * failed call.
 */
async function resolvePlaces(
  runtime: WeatherRuntime,
  plan: Plan,
  today: string,
  into: Resolved,
  tally: CacheTally,
): Promise<void> {
  try {
    const stale = new Map<string, ForecastEntry>()
    const pending = new Map<string, Array<string>>()
    const unserved = new Set<string>()

    await Promise.all([
      ...[...plan.forecast].map(async ([key]) => {
        const entry = await readEntry(runtime, key)
        if (entry !== null && isFresh(runtime, entry)) {
          into.forecast.set(key, entry.series)
          return
        }
        unserved.add(key)
        if (entry !== null) {
          stale.set(key, entry)
        }
      }),
      ...[...plan.estimate].map(async ([cell, place]) => {
        const months = await readEstimateEntry(runtime, place.coordinate)
        if (months !== null) {
          into.estimate.set(cell, months)
          return
        }
        for (const location of place.locations) {
          unserved.add(location)
        }
      }),
      ...[...plan.recorded].map(async ([cell, place]) => {
        const days: RecordedDays = new Map()
        into.recorded.set(cell, days)
        const missing: Array<string> = []
        await Promise.all(
          [...place.dates].map(async (date) => {
            const read = await readRecordedEntry(
              runtime,
              place.coordinate,
              date,
            )
            if (read === 'miss') {
              missing.push(date)
            } else {
              days.set(date, read === 'empty' ? null : read)
            }
          }),
        )
        if (missing.length > 0) {
          pending.set(cell, missing)
          for (const location of place.locations) {
            unserved.add(location)
          }
        }
      }),
    ])
    tally.hits += [...plan.locations].filter(
      (location) => !unserved.has(location),
    ).length

    const failedForecast = new Set<string>()
    const failedRecorded = new Set<string>()
    await Promise.all([
      ...[...plan.forecast]
        .filter(([key]) => !into.forecast.has(key))
        .map(async ([key, coordinate]) => {
          if (await hasFailed(runtime, FORECAST_PROVIDER, coordinate)) {
            failedForecast.add(key)
          }
        }),
      ...[...plan.estimate]
        .filter(([cell]) => !into.estimate.has(cell))
        .map(async ([cell, place]) => {
          if (await hasFailed(runtime, NASA_PROVIDER, place.coordinate)) {
            into.estimate.set(cell, null)
          }
        }),
      ...[...pending.keys()].map(async (cell) => {
        const place = plan.recorded.get(cell)
        if (
          place &&
          (await hasFailed(runtime, NASA_PROVIDER, place.coordinate))
        ) {
          failedRecorded.add(cell)
        }
      }),
    ])
    for (const key of failedForecast) {
      into.forecast.set(key, null)
    }
    for (const cell of failedRecorded) {
      for (const date of pending.get(cell) ?? []) {
        into.recorded.get(cell)?.set(date, null)
      }
      pending.delete(cell)
    }

    const coldForecast = [...plan.forecast].filter(
      ([key]) => !into.forecast.has(key),
    )
    const coldEstimate = [...plan.estimate].filter(
      ([cell]) => !into.estimate.has(cell),
    )
    // In the order of the plan, not of the reads: which cell the grant reaches must not depend on
    // which cache read finished first.
    const coldRecorded = [...plan.recorded.keys()].flatMap((cell) => {
      const dates = pending.get(cell)
      return dates === undefined ? [] : [[cell, dates] as const]
    })
    const granted = await spendRateUnits(
      runtime.counters,
      {
        metric: 'weather_lookups_per_month',
        organizationId: runtime.organizationId,
        ceiling: runtime.ceiling,
        now: runtime.now,
        logger: runtime.logger,
      },
      coldForecast.length + coldEstimate.length + coldRecorded.length,
    )

    await Promise.all([
      ...coldForecast.map(async ([key, coordinate], index) => {
        into.forecast.set(
          key,
          index < granted
            ? await fetchSeries(
                runtime,
                key,
                coordinate,
                stale.get(key) ?? null,
              )
            : null,
        )
      }),
      ...coldEstimate.map(async ([cell, place], index) => {
        if (coldForecast.length + index < granted) {
          await fetchEstimate(runtime, place.coordinate, cell, into.estimate)
          return
        }
        into.estimate.set(cell, null)
      }),
      ...coldRecorded.map(async ([cell, dates], index) => {
        const place = plan.recorded.get(cell)
        const days = into.recorded.get(cell)
        if (place === undefined || days === undefined) {
          return
        }
        if (coldForecast.length + coldEstimate.length + index < granted) {
          await fetchRecorded(runtime, place.coordinate, dates, today, days)
          return
        }
        for (const date of dates) {
          days.set(date, null)
        }
      }),
    ])
  } catch (cause) {
    // A defect of our own: what is already in `into` stands, the rest is unavailable.
    runtime.logger?.warn('weather.resolve_failed', {
      message: cause instanceof Error ? cause.message : String(cause),
    })
  }
}

/* ---------------------------------------------------------------- the request */

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

/** The kinds of reading a day can ask the policy for; the log counts days per kind. */
type WeatherKind = Exclude<DayKind, 'none'>

interface Eligible {
  readonly kind: WeatherKind
  readonly date: string
  readonly coordinate: WeatherCoordinate
  readonly key: string
}

/** Settles when `work` does, or at `ms`, whichever is first; whatever `work` leaves behind stays. */
async function untilDeadline(
  work: Promise<unknown>,
  ms: number,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms)
  })
  try {
    await Promise.race([work, deadline])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The one line each resolution leaves, so the two rates that say whether the feature works - how
 * often the cache answers and how many days render `unavailable` - can be read without waiting for
 * a traveller to report a blank badge.
 *
 * `hits` and `misses` count locations, not days: a location is a hit when entries inside their
 * expiry served every reading it needed and a miss otherwise, whether the provider was then asked
 * or not. The only identifier is the organisation's, which the call was already metered against.
 */
function logResolution(
  runtime: WeatherRuntime,
  resolution: {
    readonly locations: number
    readonly eligible: ReadonlyArray<Eligible | null>
    readonly hits: number
    readonly outcomes: ReadonlyArray<WeatherOutcome>
  },
): void {
  const days: Record<string, number> = {}
  for (const entry of resolution.eligible) {
    if (entry !== null) {
      days[entry.kind] = (days[entry.kind] ?? 0) + 1
    }
  }
  runtime.logger?.info('weather.resolved', {
    organizationId: runtime.organizationId,
    locations: resolution.locations,
    days,
    hits: resolution.hits,
    misses: resolution.locations - resolution.hits,
    unavailable: resolution.outcomes.filter(
      (outcome) => outcome.status === 'unavailable',
    ).length,
  })
}

/** Whether a reader that asked for `options` draws a day of this kind at all. */
function isAsked(kind: WeatherKind, options: ResolveOptions): boolean {
  switch (kind) {
    case 'forecast':
      return true
    case 'estimate':
      return options.estimate === true
    case 'recorded':
    case 'not-yet-recorded':
      return options.recorded === true
  }
}

export interface ResolveOptions {
  /**
   * Whether the reader draws recorded days. A reader that does not (a tab loaded before they
   * existed, which would draw a measurement as a forecast or fail on a status it does not know) is
   * answered as it always was: a past day is `none`, nothing is asked of the recorded provider and
   * nothing is spent on it.
   */
  readonly recorded?: boolean
  /**
   * Whether the reader draws estimated days. A reader that does not (a tab loaded before they
   * existed, which would draw an average as a forecast) is answered as it always was: a day beyond
   * the forecast is `none`, nothing is asked of the climatology and nothing is spent on it.
   */
  readonly estimate?: boolean
}

/** One-decimal cell of a point: the unit the recorded provider and the recorded keys are in. */
const cellOf = (coordinate: WeatherCoordinate): string =>
  `${roundCoordinate(coordinate.lat, 1)}:${roundCoordinate(coordinate.lng, 1)}`

/**
 * The weather of a trip's days, in one batched resolution that never rejects.
 *
 * `queries` are the trip's days in day order; the outcome at an index answers the query at that
 * index. A day with no date or no location and a day further out than any forecast reaches ask
 * nothing of a provider and come back `none`; so does a day already gone, unless the reader asked
 * for recorded days, in which case it is `recorded` or, inside the provider's publication lag,
 * `not-yet-recorded`. A day beyond the forecast is `none` too, unless the reader asked for
 * estimates, in which case it is an `estimate`. The rest are grouped by rounded coordinate - one
 * call serves every forecast day at a place, one every recorded day of a cell and one every
 * estimated day of it - and at most {@link WEATHER_MAX_LOCATIONS} places are resolved, those with a
 * forecast first, then an estimate, and each kind earliest first.
 */
export async function resolveTripWeather(
  runtime: WeatherRuntime,
  queries: ReadonlyArray<WeatherQuery>,
  timeZone: string,
  options: ResolveOptions = {},
): Promise<Array<WeatherOutcome>> {
  const zone = resolveTimeZone(timeZone)
  const today = todayKeyIn(zone, runtime.now())
  const window: KindWindow = {
    today,
    forecastEnd: shiftDate(today, FORECAST_LOOKAHEAD_DAYS),
    recordedEnd: lastRecordedDate(
      today,
      todayKeyIn('UTC', runtime.now()),
      runtime.nasaPower.lagDays,
    ),
    recordedStart: runtime.nasaPower.firstDate,
  }

  const eligible = queries.map((query): Eligible | null => {
    const { date, location } = query
    if (
      date === null ||
      location === null ||
      !DATE_KEY.test(date) ||
      !Number.isFinite(location.lat) ||
      !Number.isFinite(location.lng)
    ) {
      return null
    }
    const kind = selectKind(date, window)
    if (kind === 'none' || !isAsked(kind, options)) {
      return null
    }
    return {
      kind,
      date,
      coordinate: location,
      key: forecastCacheKey(location.lat, location.lng),
    }
  })

  // A day not yet recorded asks nothing of anyone, so it takes no place in the cap.
  // The forecast takes its places before the estimates and the estimates before the recorded days,
  // each in day order: a trip under way keeps today's forecast however many places it has already
  // left behind.
  const kept = new Map<string, WeatherCoordinate>()
  for (const kind of ['forecast', 'estimate', 'recorded'] as const) {
    for (const entry of eligible) {
      if (
        entry !== null &&
        entry.kind === kind &&
        !kept.has(entry.key) &&
        kept.size < WEATHER_MAX_LOCATIONS
      ) {
        kept.set(entry.key, entry.coordinate)
      }
    }
  }

  const forecast = new Map<string, WeatherCoordinate>()
  const estimate = new Map<string, EstimatePlace>()
  const recorded = new Map<string, RecordedPlace>()
  const beyondCertain = (date: string): boolean =>
    options.estimate === true && date > shiftDate(today, FORECAST_CERTAIN_DAYS)
  const askForEstimate = (entry: Eligible) => {
    const cell = cellOf(entry.coordinate)
    const place = estimate.get(cell) ?? {
      coordinate: {
        lat: Number(roundCoordinate(entry.coordinate.lat, 1)),
        lng: Number(roundCoordinate(entry.coordinate.lng, 1)),
      },
      locations: new Set<string>(),
    }
    place.locations.add(entry.key)
    estimate.set(cell, place)
  }
  for (const entry of eligible) {
    if (entry === null || !kept.has(entry.key)) {
      continue
    }
    if (entry.kind === 'forecast') {
      forecast.set(entry.key, entry.coordinate)
      // The forecast may stop short of a day this far out; it would then have nothing to fall back on.
      if (beyondCertain(entry.date)) {
        askForEstimate(entry)
      }
    } else if (entry.kind === 'estimate') {
      askForEstimate(entry)
    } else if (entry.kind === 'recorded') {
      const cell = cellOf(entry.coordinate)
      const place = recorded.get(cell) ?? {
        coordinate: {
          lat: Number(roundCoordinate(entry.coordinate.lat, 1)),
          lng: Number(roundCoordinate(entry.coordinate.lng, 1)),
        },
        dates: new Set<string>(),
        locations: new Set<string>(),
      }
      place.dates.add(entry.date)
      place.locations.add(entry.key)
      recorded.set(cell, place)
    }
  }

  const resolved: Resolved = {
    forecast: new Map(),
    estimate: new Map(),
    recorded: new Map(),
  }
  const tally: CacheTally = { hits: 0 }
  await untilDeadline(
    resolvePlaces(
      runtime,
      { locations: new Set(kept.keys()), forecast, estimate, recorded },
      today,
      resolved,
      tally,
    ),
    WEATHER_DEADLINE_MS,
  )

  const grouped = new Map<string, GroupedForecast>()
  const groupedFor = (key: string, steps: ReadonlyArray<ForecastStep>) => {
    const known = grouped.get(key)
    if (known !== undefined) {
      return known
    }
    const made = groupForecastDays(steps, zone)
    grouped.set(key, made)
    return made
  }

  /** An estimated day: its month's figures, or `unavailable` when the climatology did not arrive. */
  const estimateOutcome = (entry: Eligible): WeatherOutcome => {
    const month = resolved.estimate
      .get(cellOf(entry.coordinate))
      ?.at(Number(entry.date.slice(5, 7)) - 1)
    if (month === undefined || !hasTemperature(month)) {
      return { status: 'unavailable' }
    }
    return {
      status: 'ok',
      reading: {
        kind: 'estimate',
        source: 'nasa-power',
        tempMinC: month.tempMinC,
        tempMaxC: month.tempMaxC,
        precipitationMm: month.precipitationMm,
        windMs: null,
      },
      // Computed from the place and the date, like every other kind's.
      sun: sunTimes(
        entry.coordinate.lat,
        entry.coordinate.lng,
        entry.date,
        zone,
      ),
    }
  }

  const outcomes = eligible.map((entry): WeatherOutcome => {
    if (entry === null) {
      return { status: 'none' }
    }
    if (entry.kind === 'not-yet-recorded') {
      return { status: 'not-yet-recorded' }
    }

    if (entry.kind === 'recorded') {
      const values = resolved.recorded
        .get(cellOf(entry.coordinate))
        ?.get(entry.date)
      // Not resolved (over the cap, past the deadline, failed) or a day with no temperature.
      if (values === undefined || values === null) {
        return { status: 'unavailable' }
      }
      return {
        status: 'ok',
        reading: { kind: 'recorded', source: 'nasa-power', ...values },
        // Computed from the place and the date, so a measured day has its sun like a forecast one.
        sun: sunTimes(
          entry.coordinate.lat,
          entry.coordinate.lng,
          entry.date,
          zone,
        ),
      }
    }

    if (entry.kind === 'estimate') {
      return estimateOutcome(entry)
    }

    // A forecast that could not be had leaves a day far enough out for an estimate to have been asked
    // for with one; a nearer day is `unavailable`, as it always was.
    const steps = resolved.forecast.get(entry.key)
    // Not resolved: over the cap, past the deadline, or failed.
    if (steps === undefined || steps === null) {
      return beyondCertain(entry.date)
        ? estimateOutcome(entry)
        : { status: 'unavailable' }
    }

    const grouping = groupedFor(entry.key, steps)
    const day = grouping.days.get(entry.date)
    const covered =
      selectKind(entry.date, {
        ...window,
        forecastEnd:
          grouping.lastCompleteDate !== null &&
          grouping.lastCompleteDate > today
            ? grouping.lastCompleteDate
            : today,
      }) === 'forecast'
    if (day === undefined || !covered) {
      // The forecast ends before this day: whatever place asked for its climatology gets an estimate
      // here, so a forecast that stops short leaves no hole between it and the days past it.
      return estimate.has(cellOf(entry.coordinate))
        ? estimateOutcome(entry)
        : { status: 'none' }
    }
    return {
      status: 'ok',
      reading: {
        kind: 'forecast',
        source: 'met-norway',
        ...day,
      },
      // Computed from the place and the date: no request, no unit of the allowance.
      sun: sunTimes(
        entry.coordinate.lat,
        entry.coordinate.lng,
        entry.date,
        zone,
      ),
    }
  })

  logResolution(runtime, {
    locations: kept.size,
    eligible,
    hits: tally.hits,
    outcomes,
  })
  return outcomes
}
