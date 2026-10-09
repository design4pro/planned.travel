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
 * ## The cache is shared across tenants, and holds nothing about them
 *
 * A key is a kind, a coordinate and nothing else: that a point has a forecast is a public fact, not
 * a fact about anybody's trip. No function exported here takes a trip, a place or a member, and
 * `__tests__/seam.test.ts` keeps it so. Days are grouped into a trip's local days when an entry is
 * *read*, never when it is stored, because two trips at one coordinate can sit in two zones.
 *
 * ## Bounds
 *
 * A request resolves at most {@link WEATHER_MAX_LOCATIONS} distinct locations, in the order given.
 * Each call is aborted at {@link WEATHER_CALL_TIMEOUT_MS}, inside a {@link WEATHER_DEADLINE_MS}
 * deadline for the whole request. The per-call bound is the smaller on purpose: calls fan out under
 * the deadline, and a per-call bound above it could never fire - one hung provider would take every
 * location down together instead of only itself.
 */

import { z } from 'zod'

import { dayKeyIn, resolveTimeZone, todayKeyIn } from '#/lib/time'
import { hourIn } from '#/lib/timezones'
import { callProvider } from '#/server/metering/outbound'
import { spendRateUnits } from '#/server/metering/rate'

import type { DayReading, DaySlot } from '#/lib/weather'
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
  | { readonly status: 'ok'; readonly reading: DayReading }

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

/** A missing or already-past expiry is read as this long from the fetch. */
const MIN_FRESH_MS = 60_000

/** Retention, not freshness: how long an entry is kept whatever its expiry says. */
const RETENTION_SECONDS = 6 * 60 * 60

/** How long a failed provider is left alone at a coordinate. */
export const FAILURE_TTL_SECONDS = 5 * 60

/** The vendor behind the forecast kind; the failure entry is keyed on it. */
const FORECAST_PROVIDER = 'met-norway'

/* --------------------------------------------------------------------- keys */

/** Bumped when a stored shape changes; the previous prefix is left to expire on its own. */
export const WEATHER_CACHE_VERSION = 'v2'

/**
 * A coordinate cut to four decimals, as the provider's terms require and as every key uses.
 *
 * Four decimals is about eleven metres, so one doorway is one entry. `-0.0000` is folded into
 * `0.0000` so that two spellings of the equator are one key.
 */
export function roundCoordinate(value: number): string {
  const fixed = value.toFixed(4)
  return Number(fixed) === 0 ? '0.0000' : fixed
}

/** `wx:v2:forecast:{lat}:{lng}` - a kind and a coordinate, and nothing about who asked. */
export function forecastCacheKey(lat: number, lng: number): string {
  return `wx:${WEATHER_CACHE_VERSION}:forecast:${roundCoordinate(lat)}:${roundCoordinate(lng)}`
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

type ForecastDay = Omit<DayReading, 'kind' | 'source'>

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

/** What reading the cache for a request found, for the line each resolution leaves. */
interface CacheTally {
  /** Places served from an entry still inside its expiry. */
  hits: number
}

/**
 * Resolves each place into `into`: the cache first, then the provider for as many cold places as
 * the allowance grants, earliest day first.
 *
 * A cold place is one with no entry inside its expiry. If the provider failed there a moment ago
 * it is `null` at once, before the allowance is touched. The allowance is spent once for the whole
 * request, after the cache has been read, so a warm place costs nothing and the grant goes to the
 * days that come first rather than to whichever read finished first. A place the grant does not
 * reach is `null` - unavailable, the same as a failed call.
 */
async function resolvePlaces(
  runtime: WeatherRuntime,
  places: ReadonlyMap<string, WeatherCoordinate>,
  into: Map<string, ReadonlyArray<ForecastStep> | null>,
  tally: CacheTally,
): Promise<void> {
  try {
    const stale = new Map<string, ForecastEntry>()
    await Promise.all(
      [...places].map(async ([key]) => {
        const entry = await readEntry(runtime, key)
        if (entry !== null && isFresh(runtime, entry)) {
          into.set(key, entry.series)
          tally.hits += 1
        } else if (entry !== null) {
          stale.set(key, entry)
        }
      }),
    )

    const missing = [...places].filter(([key]) => !into.has(key))
    const failed = new Set<string>()
    await Promise.all(
      missing.map(async ([key, coordinate]) => {
        if (await hasFailed(runtime, FORECAST_PROVIDER, coordinate)) {
          failed.add(key)
        }
      }),
    )
    for (const key of failed) {
      into.set(key, null)
    }

    const cold = missing.filter(([key]) => !failed.has(key))
    const granted = await spendRateUnits(
      runtime.counters,
      {
        metric: 'weather_lookups_per_month',
        organizationId: runtime.organizationId,
        ceiling: runtime.ceiling,
        now: runtime.now,
        logger: runtime.logger,
      },
      cold.length,
    )

    await Promise.all(
      cold.map(async ([key, coordinate], index) => {
        into.set(
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
    )
  } catch (cause) {
    // A defect of our own: what is already in `into` stands, the rest is unavailable.
    runtime.logger?.warn('weather.resolve_failed', {
      message: cause instanceof Error ? cause.message : String(cause),
    })
  }
}

/* ---------------------------------------------------------------- the request */

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

/** The kinds of reading a day can ask for; the log counts days per kind. */
type WeatherKind = 'forecast'

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
 * `hits` and `misses` count locations, not days: a location is a hit when an entry inside its
 * expiry served it and a miss otherwise, whether the provider was then asked or not. The only
 * identifier is the organisation's, which the call was already metered against.
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

/**
 * The weather of a trip's days, in one batched resolution that never rejects.
 *
 * `queries` are the trip's days in day order; the outcome at an index answers the query at that
 * index. A day with no date or no location, a day already gone and a day further out than any
 * forecast reaches ask nothing of the provider and come back `none`. The rest are grouped by
 * rounded coordinate - one call serves every forecast day at a place - and at most
 * {@link WEATHER_MAX_LOCATIONS} places are resolved, the earliest first.
 */
export async function resolveTripWeather(
  runtime: WeatherRuntime,
  queries: ReadonlyArray<WeatherQuery>,
  timeZone: string,
): Promise<Array<WeatherOutcome>> {
  const zone = resolveTimeZone(timeZone)
  const today = todayKeyIn(zone, runtime.now())
  const horizon = shiftDate(today, FORECAST_LOOKAHEAD_DAYS)

  const eligible = queries.map((query): Eligible | null => {
    const { date, location } = query
    if (
      date === null ||
      location === null ||
      !DATE_KEY.test(date) ||
      date < today ||
      date > horizon ||
      !Number.isFinite(location.lat) ||
      !Number.isFinite(location.lng)
    ) {
      return null
    }
    return {
      kind: 'forecast',
      date,
      coordinate: location,
      key: forecastCacheKey(location.lat, location.lng),
    }
  })

  const kept = new Map<string, WeatherCoordinate>()
  for (const entry of eligible) {
    if (
      entry !== null &&
      !kept.has(entry.key) &&
      kept.size < WEATHER_MAX_LOCATIONS
    ) {
      kept.set(entry.key, entry.coordinate)
    }
  }

  const series = new Map<string, ReadonlyArray<ForecastStep> | null>()
  const tally: CacheTally = { hits: 0 }
  await untilDeadline(
    resolvePlaces(runtime, kept, series, tally),
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

  const outcomes = eligible.map((entry): WeatherOutcome => {
    if (entry === null) {
      return { status: 'none' }
    }
    const steps = series.get(entry.key)
    // Not resolved: over the cap, past the deadline, or failed.
    if (steps === undefined || steps === null) {
      return { status: 'unavailable' }
    }

    const forecast = groupedFor(entry.key, steps)
    const day = forecast.days.get(entry.date)
    const covered =
      entry.date === today ||
      (forecast.lastCompleteDate !== null &&
        entry.date <= forecast.lastCompleteDate)
    if (day === undefined || !covered) {
      return { status: 'none' }
    }
    return {
      status: 'ok',
      reading: {
        kind: 'forecast',
        source: 'met-norway',
        ...day,
      },
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
