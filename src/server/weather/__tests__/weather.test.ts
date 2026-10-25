/**
 * The weather policy, driven through `resolveTripWeather` with an in-memory cache, a counter store
 * of its own, a clock the test owns and a `fetch` it wrote.
 *
 * Every case asserts what a caller can observe - the calls that were made, the units that were
 * spent and the outcome of each day - and none reaches past that interface. The vendor client is
 * the real one, so the request the provider would see is the request that is asserted on, and the
 * answer it parses is the recorded one in `./locationforecast.fixture`.
 *
 * "Now" is 2026-10-08T19:10:00Z, five minutes after the recording was taken. In Europe/Oslo
 * (UTC+2 until 25 October) that is 21:10 on 8 October, the recording starts at 20:00 local that
 * evening, and its last step is 20:00 local on 18 October - so 8 October is a partial day that is
 * still today, 9 to 17 October are whole days and 18 October is the partial last day.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createMetNorwayClient } from '../met-norway'
import { createNasaPowerClient } from '../nasa-power'
import {
  WEATHER_CALL_TIMEOUT_MS,
  WEATHER_DEADLINE_MS,
  WEATHER_MAX_LOCATIONS,
  failureCacheKey,
  forecastCacheKey,
  resolveTripWeather,
} from '../weather'
import { OSLO_FORECAST } from './locationforecast.fixture'

import type { WeatherOutcome, WeatherQuery, WeatherRuntime } from '../weather'
import type { OutboundRuntime } from '#/server/metering/outbound'

const NOW = new Date('2026-10-08T19:10:00Z')
const ZONE = 'Europe/Oslo'
const OSLO = { lat: 59.9139, lng: 10.7522 }
const EXPIRES = 'Thu, 08 Oct 2026 19:29:27 GMT'
const LAST_MODIFIED = 'Thu, 08 Oct 2026 19:05:00 GMT'

afterEach(() => {
  vi.useRealTimers()
})

/* --------------------------------------------------------------------- fakes */

interface MemoryKv {
  get: (key: string) => Promise<string | null>
  put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ) => Promise<void>
  readonly entries: Map<string, string>
  readonly ttls: Map<string, number | undefined>
  /** When set, an entry whose TTL has run out by this clock is gone, as in Workers KV. */
  clock: (() => Date) | null
}

function memoryKv(): MemoryKv {
  const entries = new Map<string, string>()
  const ttls = new Map<string, number | undefined>()
  const expiresAt = new Map<string, number>()
  const kv: MemoryKv = {
    entries,
    ttls,
    clock: null,
    get: (key) => {
      const until = expiresAt.get(key)
      if (
        kv.clock !== null &&
        until !== undefined &&
        kv.clock().getTime() >= until
      ) {
        entries.delete(key)
        expiresAt.delete(key)
      }
      return Promise.resolve(entries.get(key) ?? null)
    },
    put: (key, value, options) => {
      entries.set(key, value)
      ttls.set(key, options?.expirationTtl)
      if (kv.clock !== null && options?.expirationTtl !== undefined) {
        expiresAt.set(key, kv.clock().getTime() + options.expirationTtl * 1000)
      }
      return Promise.resolve()
    },
  }
  return kv
}

function silentOutbound(): OutboundRuntime {
  return {
    db: null,
    waitUntil: () => undefined,
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    } as unknown as OutboundRuntime['logger'],
    now: () => NOW,
  }
}

interface Provider {
  readonly fetch: typeof fetch
  readonly urls: Array<string>
  /** The `If-Modified-Since` each request carried, `null` when it carried none. */
  readonly validators: Array<string | null>
}

/** A MET Norway that answers every request with the recording, or with whatever `respond` says. */
function provider(
  respond: (url: string, validator: string | null) => Promise<Response> = () =>
    Promise.resolve(
      new Response(JSON.stringify(OSLO_FORECAST), {
        status: 200,
        headers: { Expires: EXPIRES, 'Last-Modified': LAST_MODIFIED },
      }),
    ),
): Provider {
  const urls: Array<string> = []
  const validators: Array<string | null> = []
  const fake = (input: string, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers)
    const validator = headers.get('If-Modified-Since')
    urls.push(input)
    validators.push(validator)
    return respond(input, validator)
  }
  return { fetch: fake as unknown as typeof fetch, urls, validators }
}

interface World {
  readonly runtime: WeatherRuntime
  readonly cache: MemoryKv
  readonly counters: MemoryKv
  readonly provider: Provider
  now: Date
}

function world(
  overrides: {
    ceiling?: number
    provider?: Provider
    cache?: MemoryKv
    counters?: MemoryKv
    logger?: WeatherRuntime['logger']
    waitUntil?: OutboundRuntime['waitUntil']
  } = {},
): World {
  const cache = overrides.cache ?? memoryKv()
  const counters = overrides.counters ?? memoryKv()
  const upstream = overrides.provider ?? provider()
  const state: { now: Date } = { now: NOW }
  cache.clock = () => state.now
  const runtime: WeatherRuntime = {
    cache,
    counters,
    outbound: {
      ...silentOutbound(),
      ...(overrides.waitUntil ? { waitUntil: overrides.waitUntil } : {}),
    },
    organizationId: 'org-alpha',
    ceiling: overrides.ceiling ?? 300,
    now: () => state.now,
    logger: overrides.logger ?? null,
    metNorway: createMetNorwayClient({ fetch: upstream.fetch }),
    nasaPower: createNasaPowerClient({ fetch: upstream.fetch }),
  }
  return {
    runtime,
    cache,
    counters,
    provider: upstream,
    get now() {
      return state.now
    },
    set now(value: Date) {
      state.now = value
    },
  }
}

const day = (date: string | null, location = OSLO): WeatherQuery => ({
  date,
  location,
})

/** Every date from `from` to `to`, inclusive, as one query each at one place. */
function trip(from: string, to: string, location = OSLO): Array<WeatherQuery> {
  const days: Array<WeatherQuery> = []
  for (
    let cursor = Date.parse(`${from}T00:00:00Z`);
    cursor <= Date.parse(`${to}T00:00:00Z`);
    cursor += 86_400_000
  ) {
    days.push(day(new Date(cursor).toISOString().slice(0, 10), location))
  }
  return days
}

const spent = (counters: MemoryKv): number =>
  [...counters.entries.values()].reduce((sum, value) => sum + Number(value), 0)

/* ------------------------------------------------------------- what a day gets */

describe('a forecast for the days of a trip', () => {
  it('serves every forecast day from one call and spends one unit', async () => {
    const w = world()

    const outcomes = await resolveTripWeather(
      w.runtime,
      trip('2026-10-08', '2026-10-17'),
      ZONE,
    )

    expect(outcomes.map((outcome) => outcome.status)).toEqual(
      Array.from({ length: 10 }, () => 'ok'),
    )
    expect(w.provider.urls).toHaveLength(1)
    expect(spent(w.counters)).toBe(1)
    expect([...w.counters.entries.keys()]).toEqual([
      'rate:v1:weather_lookups_per_month:org-alpha:2026-10',
    ])
  })

  it('buckets the steps into the trip’s local days, not UTC ones', async () => {
    const w = world()

    const [outcome] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-14')],
      ZONE,
    )

    // 14 October in Oslo runs from 13-Oct 22:00Z to 14-Oct 22:00Z, in the part of the recording
    // where steps are six hours apart. Computed here from the instants,
    // independently of the code under test and of Intl, by shifting each step by the zone's offset.
    const inLocalDay = OSLO_FORECAST.properties.timeseries.filter((step) => {
      const local = new Date(Date.parse(step.time) + 2 * 3_600_000)
      return local.toISOString().slice(0, 10) === '2026-10-14'
    })
    const temperatures = inLocalDay.map(
      (step) => step.data.instant.details.air_temperature,
    )
    expect(inLocalDay).toHaveLength(4)

    expect(outcome).toMatchObject({
      status: 'ok',
      reading: {
        kind: 'forecast',
        source: 'met-norway',
        tempMinC: Math.min(...temperatures),
        tempMaxC: Math.max(...temperatures),
      },
    })
  })

  it('gives the same day a different reading in a zone whose midnight falls elsewhere', async () => {
    const oslo = await resolveTripWeather(
      world().runtime,
      [day('2026-10-10')],
      'Europe/Oslo',
    )
    const auckland = await resolveTripWeather(
      world().runtime,
      [day('2026-10-10')],
      'Pacific/Auckland',
    )

    expect(oslo[0]).not.toEqual(auckland[0])
  })

  it('falls back to UTC for a zone Intl does not know', async () => {
    const outcomes = await resolveTripWeather(
      world().runtime,
      [day('2026-10-10')],
      'Not/AZone',
    )

    expect(outcomes[0].status).toBe('ok')
  })

  it('carries the day’s dominant condition, without the day/night suffix', async () => {
    const [outcome] = await resolveTripWeather(
      world().runtime,
      [day('2026-10-10')],
      ZONE,
    )

    expect(
      outcome.status === 'ok' && outcome.reading.kind === 'forecast'
        ? outcome.reading.symbol
        : null,
    ).toMatch(/^[a-z]+$/)
  })

  it('treats today as a forecast day although the series started part-way through it', async () => {
    const [outcome] = await resolveTripWeather(
      world().runtime,
      [day('2026-10-08')],
      ZONE,
    )

    expect(outcome.status).toBe('ok')
  })

  it('does not treat the partial last day as a forecast day', async () => {
    const outcomes = await resolveTripWeather(
      world().runtime,
      [day('2026-10-17'), day('2026-10-18'), day('2026-10-19')],
      ZONE,
    )

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'ok',
      'none',
      'none',
    ])
  })

  it('shows nothing for a day without a date, without a location, or already gone', async () => {
    const w = world()

    const outcomes = await resolveTripWeather(
      w.runtime,
      [
        day(null),
        { date: '2026-10-10', location: null },
        day('2026-10-07'),
        day('2026-01-01'),
      ],
      ZONE,
    )

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'none',
      'none',
      'none',
      'none',
    ])
    expect(w.provider.urls).toHaveLength(0)
    expect(spent(w.counters)).toBe(0)
  })

  it('makes no call for a day further out than any forecast reaches', async () => {
    const w = world()

    const outcomes = await resolveTripWeather(
      w.runtime,
      [day('2027-06-01')],
      ZONE,
    )

    expect(outcomes[0].status).toBe('none')
    expect(w.provider.urls).toHaveLength(0)
    expect(spent(w.counters)).toBe(0)
  })

  it('answers each query in the position it was asked', async () => {
    const outcomes = await resolveTripWeather(
      world().runtime,
      [day(null), day('2026-10-10'), day('2026-10-19')],
      ZONE,
    )

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'none',
      'ok',
      'none',
    ])
  })
})

/* ------------------------------------------------------------------ the cache */

describe('sunrise and sunset', () => {
  it('rides with every forecast day in the trip’s zone, taken from the NOAA Solar Calculator', async () => {
    const [outcome] = await resolveTripWeather(
      world().runtime,
      [day('2026-10-10')],
      ZONE,
    )

    // 07:44 and 18:23 are what the calculator's own code gives for Oslo on 10 October at UTC+2.
    expect(outcome).toMatchObject({
      status: 'ok',
      sun: { sunrise: '07:44', sunset: '18:23' },
    })
  })

  it('is written in the trip’s zone, not the place’s', async () => {
    const [outcome] = await resolveTripWeather(
      world().runtime,
      [day('2026-10-10')],
      'UTC',
    )

    expect(outcome).toMatchObject({
      sun: { sunrise: '05:44', sunset: '16:23' },
    })
  })

  it('makes no request and spends no unit of its own', async () => {
    const w = world()
    const days = trip('2026-10-09', '2026-10-17')

    const cold = await resolveTripWeather(w.runtime, days, ZONE)
    const callsAfterCold = w.provider.urls.length
    const spentAfterCold = spent(w.counters)
    const warm = await resolveTripWeather(w.runtime, days, ZONE)

    // The sun of nine days costs exactly the one call and the one unit the forecast does...
    expect(callsAfterCold).toBe(1)
    expect(spentAfterCold).toBe(1)
    // ...and a warm second read of them, sun and all, costs nothing at all.
    expect(w.provider.urls).toHaveLength(1)
    expect(spent(w.counters)).toBe(1)
    expect(warm).toEqual(cold)
    expect(
      warm.every(
        (outcome) => outcome.status === 'ok' && outcome.sun !== undefined,
      ),
    ).toBe(true)
  })

  it('is carried only by a day that has a reading', async () => {
    const outcomes = await resolveTripWeather(
      world({
        provider: provider(() =>
          Promise.resolve(new Response('', { status: 500 })),
        ),
      }).runtime,
      [day('2026-10-10'), day(null), day('2026-10-01')],
      ZONE,
    )

    expect(outcomes).toEqual([
      { status: 'unavailable' },
      { status: 'none' },
      { status: 'none' },
    ])
  })
})

describe('the cache', () => {
  it('serves a warm entry inside its stated expiry with no call and no unit', async () => {
    const w = world()
    await resolveTripWeather(w.runtime, trip('2026-10-08', '2026-10-17'), ZONE)
    w.provider.urls.length = 0
    w.now = new Date('2026-10-08T19:29:00Z')

    const outcomes = await resolveTripWeather(
      w.runtime,
      trip('2026-10-08', '2026-10-17'),
      ZONE,
    )

    expect(outcomes.every((outcome) => outcome.status === 'ok')).toBe(true)
    expect(w.provider.urls).toHaveLength(0)
    expect(spent(w.counters)).toBe(1)
  })

  it('asks again once the stated expiry has passed, and spends a unit for it', async () => {
    const w = world()
    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)
    w.now = new Date('2026-10-08T19:29:28Z')

    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)

    expect(w.provider.urls).toHaveLength(2)
    expect(spent(w.counters)).toBe(2)
  })

  it('floors a missing expiry at one minute', async () => {
    const w = world({
      provider: provider(() =>
        Promise.resolve(new Response(JSON.stringify(OSLO_FORECAST))),
      ),
    })
    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)

    w.now = new Date(NOW.getTime() + 59_000)
    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)
    expect(w.provider.urls).toHaveLength(1)

    w.now = new Date(NOW.getTime() + 61_000)
    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)
    expect(w.provider.urls).toHaveLength(2)
  })

  it('floors an expiry that is already in the past at one minute, too', async () => {
    const w = world({
      provider: provider(() =>
        Promise.resolve(
          new Response(JSON.stringify(OSLO_FORECAST), {
            headers: { Expires: 'Thu, 01 Jan 1970 00:00:00 GMT' },
          }),
        ),
      ),
    })
    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)

    w.now = new Date(NOW.getTime() + 30_000)
    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)

    expect(w.provider.urls).toHaveLength(1)
  })

  it('keeps the entry for six hours whatever the header says', async () => {
    const w = world()
    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)

    expect(w.cache.ttls.get(forecastCacheKey(OSLO.lat, OSLO.lng))).toBe(
      6 * 60 * 60,
    )
  })

  it('treats a malformed cached value as a miss', async () => {
    const cache = memoryKv()
    const key = forecastCacheKey(OSLO.lat, OSLO.lng)
    for (const garbage of [
      'not json',
      '{}',
      '{"v":3,"fetchedAt":"x","expires":"2999-01-01T00:00:00Z","series":[]}',
      // The shape before the fuller reading: right version for then, wrong for now.
      '{"v":1,"fetchedAt":"x","expires":"2999-01-01T00:00:00Z","series":[]}',
      // A step missing the fields the fuller reading reads is not served as if it had them.
      '{"v":2,"fetchedAt":"x","expires":"2999-01-01T00:00:00Z","series":[{"time":"2026-10-10T00:00:00Z","tempC":1,"symbol":null}]}',
      '{"v":2,"fetchedAt":"x","expires":"2999-01-01T00:00:00Z","series":"no"}',
      '{"v":2,"fetchedAt":"x","expires":"not a date","series":[]}',
    ]) {
      cache.entries.set(key, garbage)
      const w = world({ cache })

      const [outcome] = await resolveTripWeather(
        w.runtime,
        [day('2026-10-10')],
        ZONE,
      )

      expect(outcome.status, garbage).toBe('ok')
      expect(w.provider.urls, garbage).toHaveLength(1)
    }
  })

  it('treats a cache that cannot be read or written as a miss and still answers', async () => {
    const broken: MemoryKv = {
      ...memoryKv(),
      get: () => Promise.reject(new Error('KV is down')),
      put: () => Promise.reject(new Error('KV is down')),
    }
    const warn = vi.fn()
    const w = world({ cache: broken, logger: { warn, info: vi.fn() } })

    const [outcome] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10')],
      ZONE,
    )

    expect(outcome.status).toBe('ok')
    expect(warn).toHaveBeenCalled()
  })

  it('shares one entry between two coordinates that round to the same four decimals', async () => {
    const w = world()

    await resolveTripWeather(
      w.runtime,
      [
        day('2026-10-10', { lat: 59.913_912, lng: 10.752_201 }),
        day('2026-10-11', { lat: 59.913_899, lng: 10.752_249 }),
      ],
      ZONE,
    )

    expect(w.provider.urls).toHaveLength(1)
    expect(spent(w.counters)).toBe(1)
  })

  it('keeps tenant data out of every key it writes', async () => {
    const w = world()

    await resolveTripWeather(w.runtime, trip('2026-10-08', '2026-10-17'), ZONE)

    const keys = [...w.cache.entries.keys()]
    expect(keys).toEqual(['wx:v2:forecast:59.9139:10.7522'])
    expect(keys.join()).not.toContain('org-alpha')
  })

  it('stores no more than the fields it reads', async () => {
    const w = world()
    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)

    const stored = JSON.parse(
      w.cache.entries.get(forecastCacheKey(OSLO.lat, OSLO.lng)) ?? 'null',
    ) as Record<string, unknown>

    expect(Object.keys(stored).sort()).toEqual([
      'expires',
      'fetchedAt',
      'lastModified',
      'series',
      'v',
    ])
  })
})

/* ------------------------------------------------------- re-validation */

/** The recording with every temperature shifted, so a replaced entry can be told from a kept one. */
function warmer(delta: number): string {
  return JSON.stringify({
    ...OSLO_FORECAST,
    properties: {
      ...OSLO_FORECAST.properties,
      timeseries: OSLO_FORECAST.properties.timeseries.map((step) => ({
        ...step,
        data: {
          ...step.data,
          instant: {
            details: {
              air_temperature:
                step.data.instant.details.air_temperature + delta,
            },
          },
        },
      })),
    },
  })
}

const NOT_MODIFIED = (expires: string, lastModified?: string): Response =>
  new Response(null, {
    status: 304,
    headers: {
      Expires: expires,
      ...(lastModified === undefined ? {} : { 'Last-Modified': lastModified }),
    },
  })

const storedEntry = (w: World): Record<string, unknown> =>
  JSON.parse(
    w.cache.entries.get(forecastCacheKey(OSLO.lat, OSLO.lng)) ?? 'null',
  ) as Record<string, unknown>

const reading = (outcome: WeatherOutcome | undefined) =>
  outcome?.status === 'ok' ? outcome.reading : null

describe('a cached forecast past its expiry', () => {
  const PAST_EXPIRY = new Date('2026-10-08T19:29:28Z')
  const NEW_EXPIRES = 'Thu, 08 Oct 2026 19:59:27 GMT'

  it('is asked about once, carrying the last-modified validator, and a "not modified" answer keeps the series', async () => {
    const w = world({
      provider: provider((_, validator) =>
        Promise.resolve(
          validator === null
            ? new Response(JSON.stringify(OSLO_FORECAST), {
                headers: { Expires: EXPIRES, 'Last-Modified': LAST_MODIFIED },
              })
            : NOT_MODIFIED(NEW_EXPIRES),
        ),
      ),
    })
    const [first] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10')],
      ZONE,
    )
    const before = storedEntry(w)
    w.now = PAST_EXPIRY

    const [second] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10')],
      ZONE,
    )

    expect(w.provider.validators).toEqual([null, LAST_MODIFIED])
    expect(spent(w.counters)).toBe(2)
    expect(second).toEqual(first)
    const after = storedEntry(w)
    expect(after.series).toEqual(before.series)
    expect(after.lastModified).toBe(LAST_MODIFIED)
    expect(after.expires).toBe('2026-10-08T19:59:27.000Z')
  })

  it('is served from the cache again once re-validated, with no further call', async () => {
    const w = world({
      provider: provider((_, validator) =>
        Promise.resolve(
          validator === null
            ? new Response(JSON.stringify(OSLO_FORECAST), {
                headers: { Expires: EXPIRES, 'Last-Modified': LAST_MODIFIED },
              })
            : NOT_MODIFIED(NEW_EXPIRES),
        ),
      ),
    })
    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)
    w.now = PAST_EXPIRY
    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)

    w.now = new Date('2026-10-08T19:50:00Z')
    const [outcome] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10')],
      ZONE,
    )

    expect(outcome.status).toBe('ok')
    expect(w.provider.urls).toHaveLength(2)
    expect(spent(w.counters)).toBe(2)
  })

  it('keeps the entry another six hours after a "not modified" answer, not six hours from the first fetch', async () => {
    const w = world({
      provider: provider((_, validator) =>
        Promise.resolve(
          validator === null
            ? new Response(JSON.stringify(OSLO_FORECAST), {
                headers: { Expires: EXPIRES, 'Last-Modified': LAST_MODIFIED },
              })
            : NOT_MODIFIED('Fri, 09 Oct 2026 01:30:00 GMT'),
        ),
      ),
    })
    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)
    w.now = new Date('2026-10-09T01:00:00Z')
    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)

    // 01:20Z is past the six hours the first fetch bought, inside the six the validation bought.
    w.now = new Date('2026-10-09T01:20:00Z')
    const [outcome] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10')],
      ZONE,
    )

    expect(outcome.status).toBe('ok')
    expect(w.provider.urls).toHaveLength(2)
    expect(storedEntry(w).series).toBeDefined()
  })

  it('is replaced wholesale by a full answer', async () => {
    let answers = 0
    const w = world({
      provider: provider(() => {
        answers += 1
        return Promise.resolve(
          new Response(
            answers === 1 ? JSON.stringify(OSLO_FORECAST) : warmer(10),
            {
              headers: {
                Expires: answers === 1 ? EXPIRES : NEW_EXPIRES,
                'Last-Modified':
                  answers === 1
                    ? LAST_MODIFIED
                    : 'Thu, 08 Oct 2026 19:25:00 GMT',
              },
            },
          ),
        )
      }),
    })
    const [first] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10')],
      ZONE,
    )
    w.now = PAST_EXPIRY

    const [second] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10')],
      ZONE,
    )

    expect(w.provider.validators).toEqual([null, LAST_MODIFIED])
    expect(reading(second)?.tempMaxC).toBeCloseTo(
      (reading(first)?.tempMaxC ?? 0) + 10,
    )
    expect(storedEntry(w).lastModified).toBe('Thu, 08 Oct 2026 19:25:00 GMT')
    expect(spent(w.counters)).toBe(2)
  })

  it('is fetched unconditionally once it has been evicted', async () => {
    const w = world()
    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)
    w.cache.entries.clear()
    w.now = PAST_EXPIRY

    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)

    expect(w.provider.validators).toEqual([null, null])
  })

  it('is fetched unconditionally when it was stored without a validator', async () => {
    const cache = memoryKv()
    cache.entries.set(
      forecastCacheKey(OSLO.lat, OSLO.lng),
      JSON.stringify({
        v: 2,
        fetchedAt: '2026-10-08T19:00:00.000Z',
        expires: '2026-10-08T19:05:00.000Z',
        lastModified: null,
        series: [],
      }),
    )
    const w = world({ cache })

    const [outcome] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10')],
      ZONE,
    )

    expect(outcome.status).toBe('ok')
    expect(w.provider.validators).toEqual([null])
  })

  it('ignores an entry stored under the previous cache version', async () => {
    const cache = memoryKv()
    cache.entries.set(
      forecastCacheKey(OSLO.lat, OSLO.lng).replace('wx:v2:', 'wx:v1:'),
      JSON.stringify({
        v: 1,
        fetchedAt: '2026-10-08T19:00:00.000Z',
        expires: '2026-10-08T19:05:00.000Z',
        lastModified: 'Thu, 08 Oct 2026 19:00:00 GMT',
        series: [],
      }),
    )
    const w = world({ cache })

    const [outcome] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10')],
      ZONE,
    )

    expect(outcome.status).toBe('ok')
    expect(w.provider.validators).toEqual([null])
  })

  it('is not kept on a "not modified" answer to a request that carried no validator', async () => {
    const cache = memoryKv()
    cache.entries.set(
      forecastCacheKey(OSLO.lat, OSLO.lng),
      JSON.stringify({
        v: 2,
        fetchedAt: '2026-10-08T19:00:00.000Z',
        expires: '2026-10-08T19:05:00.000Z',
        lastModified: null,
        series: [],
      }),
    )
    const w = world({
      cache,
      provider: provider(() => Promise.resolve(NOT_MODIFIED(NEW_EXPIRES))),
    })

    const [outcome] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10')],
      ZONE,
    )

    expect(w.provider.validators).toEqual([null])
    expect(outcome.status).toBe('unavailable')
  })

  it('is never served past its expiry when the provider cannot be asked', async () => {
    let answers = 0
    const w = world({
      provider: provider(() => {
        answers += 1
        return Promise.resolve(
          answers === 1
            ? new Response(JSON.stringify(OSLO_FORECAST), {
                headers: { Expires: EXPIRES, 'Last-Modified': LAST_MODIFIED },
              })
            : new Response('no', { status: 503 }),
        )
      }),
    })
    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)
    w.now = PAST_EXPIRY

    const [outcome] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10')],
      ZONE,
    )

    expect(outcome.status).toBe('unavailable')
  })

  it('is unavailable when the provider says "not modified" to a request that asked no question', async () => {
    const w = world({
      provider: provider(() => Promise.resolve(NOT_MODIFIED(NEW_EXPIRES))),
    })

    const [outcome] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10')],
      ZONE,
    )

    expect(outcome.status).toBe('unavailable')
    expect(w.cache.entries.has(forecastCacheKey(OSLO.lat, OSLO.lng))).toBe(
      false,
    )
  })
})

/* ------------------------------------------------------ a remembered failure */

describe('a provider that failed', () => {
  const failing = () =>
    provider(() => Promise.resolve(new Response('no', { status: 503 })))
  const FAILURE_KEY = 'wx:v2:fail:met-norway:59.9139:10.7522'

  it('is not asked again, and costs nothing, while the failure is remembered', async () => {
    const w = world({ provider: failing() })
    await resolveTripWeather(w.runtime, trip('2026-10-08', '2026-10-12'), ZONE)
    expect(w.provider.urls).toHaveLength(1)
    expect(spent(w.counters)).toBe(1)

    w.now = new Date(NOW.getTime() + 4 * 60_000)
    const outcomes = await resolveTripWeather(
      w.runtime,
      trip('2026-10-08', '2026-10-12'),
      ZONE,
    )

    expect(outcomes.every((outcome) => outcome.status === 'unavailable')).toBe(
      true,
    )
    expect(w.provider.urls).toHaveLength(1)
    expect(spent(w.counters)).toBe(1)
  })

  it('is asked again once the five minutes are over', async () => {
    const w = world({ provider: failing() })
    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)

    w.now = new Date(NOW.getTime() + 5 * 60_000 + 1000)
    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)

    expect(w.provider.urls).toHaveLength(2)
    expect(spent(w.counters)).toBe(2)
  })

  it('is remembered for a timeout, too', async () => {
    vi.useFakeTimers({ now: NOW })
    const w = world({
      provider: provider(() => new Promise<Response>(() => undefined)),
    })
    const pending = resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)
    await vi.advanceTimersByTimeAsync(WEATHER_CALL_TIMEOUT_MS)
    await pending

    const [outcome] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10')],
      ZONE,
    )

    expect(outcome.status).toBe('unavailable')
    expect(w.provider.urls).toHaveLength(1)
    expect(spent(w.counters)).toBe(1)
  })

  it('leaves a remembered failure carrying a coordinate and nothing else, for five minutes', async () => {
    const w = world({ provider: failing() })

    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)

    expect(w.cache.entries.get(FAILURE_KEY)).toBeDefined()
    expect(JSON.parse(w.cache.entries.get(FAILURE_KEY) ?? 'null')).toEqual({
      v: 1,
      lat: 59.9139,
      lng: 10.7522,
    })
    expect(w.cache.ttls.get(FAILURE_KEY)).toBe(5 * 60)
    expect([...w.cache.entries.keys()].join()).not.toContain('org-alpha')
    expect([...w.cache.entries.values()].join()).not.toContain('org-alpha')
  })

  it('hides only the days of the place that failed', async () => {
    const paris = { lat: 48.8566, lng: 2.3522 }
    const w = world({
      provider: provider((url) =>
        url.includes('lat=48.8566')
          ? Promise.resolve(new Response('no', { status: 500 }))
          : Promise.resolve(
              new Response(JSON.stringify(OSLO_FORECAST), {
                headers: { Expires: EXPIRES },
              }),
            ),
      ),
    })
    const queries = [day('2026-10-10'), day('2026-10-10', paris)]
    await resolveTripWeather(w.runtime, queries, ZONE)

    const outcomes = await resolveTripWeather(w.runtime, queries, ZONE)

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'ok',
      'unavailable',
    ])
    expect(w.provider.urls).toHaveLength(2)
  })

  it('is keyed per provider, so another provider’s outage hides nothing here', async () => {
    const cache = memoryKv()
    cache.entries.set(
      failureCacheKey('nasa-power', OSLO.lat, OSLO.lng),
      JSON.stringify({ v: 1, lat: OSLO.lat, lng: OSLO.lng }),
    )
    const w = world({ cache })

    const [outcome] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10')],
      ZONE,
    )

    expect(outcome.status).toBe('ok')
    expect(failureCacheKey('nasa-power', OSLO.lat, OSLO.lng)).not.toBe(
      failureCacheKey('met-norway', OSLO.lat, OSLO.lng),
    )
    expect(failureCacheKey('met-norway', OSLO.lat, OSLO.lng)).toBe(FAILURE_KEY)
  })

  it('treats a failure entry that cannot be read as no failure, and logs it', async () => {
    const warn = vi.fn()
    const cache = memoryKv()
    const read = cache.get
    cache.get = (key) =>
      key.includes(':fail:')
        ? Promise.reject(new Error('KV is down'))
        : read(key)
    const w = world({ cache, logger: { warn, info: vi.fn() } })

    const [outcome] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10')],
      ZONE,
    )

    expect(outcome.status).toBe('ok')
    expect(warn).toHaveBeenCalledWith(
      'weather.cache.read_failed',
      expect.anything(),
    )
  })

  it('stays unavailable, and resolves, when the failure cannot be written down', async () => {
    const warn = vi.fn()
    const cache = memoryKv()
    cache.put = () => Promise.reject(new Error('KV is down'))
    const w = world({
      cache,
      provider: failing(),
      logger: { warn, info: vi.fn() },
    })

    const [outcome] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10')],
      ZONE,
    )

    expect(outcome.status).toBe('unavailable')
    expect(warn).toHaveBeenCalledWith(
      'weather.cache.write_failed',
      expect.anything(),
    )
  })
})

/* ---------------------------------------------------------- the resolve log */

describe('the line each resolution leaves', () => {
  function logged() {
    const info = vi.fn()
    return { info, logger: { warn: vi.fn(), info } }
  }

  it('counts the locations, the days per kind, the hits, the misses and the unavailable days', async () => {
    const { info, logger } = logged()
    const w = world({ logger })

    await resolveTripWeather(w.runtime, trip('2026-10-08', '2026-10-12'), ZONE)

    expect(info).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith('weather.resolved', {
      organizationId: 'org-alpha',
      locations: 1,
      days: { forecast: 5 },
      hits: 0,
      misses: 1,
      unavailable: 0,
    })
  })

  it('counts a warm location as a hit', async () => {
    const { info, logger } = logged()
    const w = world({ logger })
    await resolveTripWeather(w.runtime, trip('2026-10-08', '2026-10-12'), ZONE)
    info.mockClear()

    await resolveTripWeather(w.runtime, trip('2026-10-08', '2026-10-12'), ZONE)

    expect(info).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith(
      'weather.resolved',
      expect.objectContaining({ hits: 1, misses: 0, unavailable: 0 }),
    )
  })

  it('counts the days it could not answer', async () => {
    const { info, logger } = logged()
    const w = world({
      logger,
      provider: provider(() =>
        Promise.resolve(new Response('no', { status: 503 })),
      ),
    })

    await resolveTripWeather(w.runtime, trip('2026-10-08', '2026-10-12'), ZONE)

    expect(info).toHaveBeenCalledWith(
      'weather.resolved',
      expect.objectContaining({ hits: 0, misses: 1, unavailable: 5 }),
    )
  })

  it('is left even when nothing was asked of a provider, and names no one but the organisation', async () => {
    const { info, logger } = logged()
    const w = world({ logger })

    await resolveTripWeather(w.runtime, [day(null)], ZONE)

    expect(info).toHaveBeenCalledTimes(1)
    const [, fields] = info.mock.calls[0] as [string, Record<string, unknown>]
    expect(fields).toEqual({
      organizationId: 'org-alpha',
      locations: 0,
      days: {},
      hits: 0,
      misses: 0,
      unavailable: 0,
    })
  })
})

/* ------------------------------------------------------------- the allowance */

describe('the monthly allowance', () => {
  it('serves cached days and refuses uncached ones when the ceiling is zero', async () => {
    const cache = memoryKv()
    await resolveTripWeather(
      world({ cache }).runtime,
      [day('2026-10-10')],
      ZONE,
    )
    const elsewhere = { lat: 48.8566, lng: 2.3522 }
    const w = world({ cache, ceiling: 0 })

    const outcomes = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10'), day('2026-10-10', elsewhere)],
      ZONE,
    )

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'ok',
      'unavailable',
    ])
    expect(w.provider.urls).toHaveLength(0)
    expect(w.counters.entries.size).toBe(0)
  })

  it('goes unavailable, never an error, once the month’s allowance is spent', async () => {
    const counters = memoryKv()
    counters.entries.set(
      'rate:v1:weather_lookups_per_month:org-alpha:2026-10',
      '3',
    )
    const w = world({ ceiling: 3, counters })

    const outcomes = await resolveTripWeather(
      w.runtime,
      trip('2026-10-08', '2026-10-12'),
      ZONE,
    )

    expect(outcomes.every((outcome) => outcome.status === 'unavailable')).toBe(
      true,
    )
    expect(w.provider.urls).toHaveLength(0)
  })

  it('spends one unit per outbound call and no more', async () => {
    const w = world({ ceiling: 2 })
    const paris = { lat: 48.8566, lng: 2.3522 }
    const rome = { lat: 41.9028, lng: 12.4964 }

    const outcomes = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10'), day('2026-10-10', paris), day('2026-10-10', rome)],
      ZONE,
    )

    expect(w.provider.urls).toHaveLength(2)
    expect(spent(w.counters)).toBe(2)
    expect(outcomes.filter((o) => o.status === 'unavailable')).toHaveLength(1)
  })

  it('grants what is left to the earliest days, whichever read finishes first', async () => {
    const w = world({ ceiling: 2 })
    const paris = { lat: 48.8566, lng: 2.3522 }
    const rome = { lat: 41.9028, lng: 12.4964 }

    const outcomes = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10'), day('2026-10-11', paris), day('2026-10-12', rome)],
      ZONE,
    )

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'ok',
      'ok',
      'unavailable',
    ])
  })

  it('writes the tally once for the whole request, however many places it spends on', async () => {
    const w = world({ ceiling: 300 })
    const puts = vi.spyOn(w.counters, 'put')
    const places = [
      { lat: 59.9139, lng: 10.7522 },
      { lat: 48.8566, lng: 2.3522 },
      { lat: 41.9028, lng: 12.4964 },
      { lat: 52.52, lng: 13.405 },
    ]

    await resolveTripWeather(
      w.runtime,
      places.map((place) => day('2026-10-10', place)),
      ZONE,
    )

    expect(puts).toHaveBeenCalledTimes(1)
    expect(spent(w.counters)).toBe(4)
  })

  it('spends nothing for a request whose places are all warm', async () => {
    const cache = memoryKv()
    await resolveTripWeather(
      world({ cache }).runtime,
      [day('2026-10-10')],
      ZONE,
    )
    const w = world({ cache })
    const puts = vi.spyOn(w.counters, 'put')

    await resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)

    expect(puts).not.toHaveBeenCalled()
  })
})

/* ---------------------------------------------------------- provider trouble */

describe('when the provider is in trouble', () => {
  it.each([
    ['an error', () => Promise.resolve(new Response('no', { status: 503 }))],
    [
      'an unreadable answer',
      () => Promise.resolve(new Response('<html>', { status: 200 })),
    ],
    ['a dropped connection', () => Promise.reject(new TypeError('offline'))],
  ])('turns %s into unavailable days, and resolves', async (_, respond) => {
    const w = world({ provider: provider(respond) })

    const outcomes = await resolveTripWeather(
      w.runtime,
      trip('2026-10-08', '2026-10-12'),
      ZONE,
    )

    expect(outcomes.every((outcome) => outcome.status === 'unavailable')).toBe(
      true,
    )
    expect([...w.cache.entries.keys()]).toEqual([
      failureCacheKey('met-norway', OSLO.lat, OSLO.lng),
    ])
  })

  it('leaves the locations that did answer intact', async () => {
    const paris = { lat: 48.8566, lng: 2.3522 }
    const w = world({
      provider: provider((url) =>
        url.includes('lat=48.8566')
          ? Promise.resolve(new Response('no', { status: 500 }))
          : Promise.resolve(
              new Response(JSON.stringify(OSLO_FORECAST), {
                headers: { Expires: EXPIRES },
              }),
            ),
      ),
    })

    const outcomes = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10'), day('2026-10-10', paris)],
      ZONE,
    )

    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'ok',
      'unavailable',
    ])
  })

  it('aborts a hung call at the per-call timeout, well before the request deadline', async () => {
    vi.useFakeTimers({ now: NOW })
    const signals: Array<AbortSignal> = []
    const hung = provider(() => new Promise<Response>(() => undefined))
    const fetchWithSignal = ((input: string, init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal)
      return hung.fetch(input, init)
    }) as unknown as typeof fetch
    const w = world({ provider: { ...hung, fetch: fetchWithSignal } })

    let settled = false
    const pending = resolveTripWeather(
      w.runtime,
      [day('2026-10-10')],
      ZONE,
    ).then((outcomes) => {
      settled = true
      return outcomes
    })

    await vi.advanceTimersByTimeAsync(WEATHER_CALL_TIMEOUT_MS - 1)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    // Settled at 6 s, with two seconds of the 8 s deadline still unspent.
    expect(settled).toBe(true)
    expect(WEATHER_CALL_TIMEOUT_MS).toBeLessThan(WEATHER_DEADLINE_MS)
    expect(signals[0]?.aborted).toBe(true)
    expect((await pending)[0].status).toBe('unavailable')
  })

  it('keeps the locations that answered when another one hangs', async () => {
    vi.useFakeTimers({ now: NOW })
    const paris = { lat: 48.8566, lng: 2.3522 }
    const w = world({
      provider: provider((url) =>
        url.includes('lat=48.8566')
          ? new Promise<Response>(() => undefined)
          : Promise.resolve(
              new Response(JSON.stringify(OSLO_FORECAST), {
                headers: { Expires: EXPIRES },
              }),
            ),
      ),
    })

    const pending = resolveTripWeather(
      w.runtime,
      [day('2026-10-10'), day('2026-10-10', paris)],
      ZONE,
    )
    await vi.advanceTimersByTimeAsync(WEATHER_CALL_TIMEOUT_MS)

    expect((await pending).map((outcome) => outcome.status)).toEqual([
      'ok',
      'unavailable',
    ])
  })

  it('gives up at the request deadline on a cache that never answers', async () => {
    vi.useFakeTimers({ now: NOW })
    const stuck: MemoryKv = {
      ...memoryKv(),
      get: () => new Promise<string | null>(() => undefined),
    }
    const w = world({ cache: stuck })

    const pending = resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)
    await vi.advanceTimersByTimeAsync(WEATHER_DEADLINE_MS)

    expect((await pending)[0].status).toBe('unavailable')
  })
})

describe('work still in flight when the request deadline answers', () => {
  const FAILURE_KEY = failureCacheKey('met-norway', OSLO.lat, OSLO.lng)

  /** A cache whose first read of the Oslo forecast waits for `release()`; every other read answers. */
  function slowFirstRead() {
    const cache = memoryKv()
    const read = cache.get
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let held = false
    cache.get = async (key) => {
      if (key === forecastCacheKey(OSLO.lat, OSLO.lng) && !held) {
        held = true
        await gate
      }
      return read(key)
    }
    return { cache, release }
  }

  function captured() {
    const handed: Array<Promise<unknown>> = []
    return { handed, waitUntil: (p: Promise<unknown>) => void handed.push(p) }
  }

  it('hands the resolution to waitUntil once, and the refreshed entry lands after the deadline answered', async () => {
    vi.useFakeTimers({ now: NOW })
    const { cache, release } = slowFirstRead()
    const { handed, waitUntil } = captured()
    const w = world({ cache, waitUntil })

    const pending = resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)
    await vi.advanceTimersByTimeAsync(WEATHER_DEADLINE_MS)

    expect((await pending)[0].status).toBe('unavailable')
    expect(handed).toHaveLength(1)
    expect(w.cache.entries.has(forecastCacheKey(OSLO.lat, OSLO.lng))).toBe(
      false,
    )

    release()
    await handed[0]

    expect(w.provider.urls).toHaveLength(1)
    expect(w.cache.entries.has(forecastCacheKey(OSLO.lat, OSLO.lng))).toBe(true)
  })

  it('writes the failure entry after the deadline answered, so the next reload spends nothing', async () => {
    vi.useFakeTimers({ now: NOW })
    const { cache, release } = slowFirstRead()
    const { handed, waitUntil } = captured()
    const w = world({
      cache,
      waitUntil,
      provider: provider(() =>
        Promise.resolve(new Response('no', { status: 503 })),
      ),
    })

    const pending = resolveTripWeather(w.runtime, [day('2026-10-10')], ZONE)
    await vi.advanceTimersByTimeAsync(WEATHER_DEADLINE_MS)
    expect((await pending)[0].status).toBe('unavailable')
    expect(w.cache.entries.has(FAILURE_KEY)).toBe(false)

    release()
    await handed[0]
    expect(w.cache.entries.has(FAILURE_KEY)).toBe(true)
    const callsAfterFirst = w.provider.urls.length
    const spentAfterFirst = spent(w.counters)

    const second = await resolveTripWeather(
      w.runtime,
      [day('2026-10-10')],
      ZONE,
    )

    expect(second[0].status).toBe('unavailable')
    expect(w.provider.urls).toHaveLength(callsAfterFirst)
    expect(spent(w.counters)).toBe(spentAfterFirst)
  })
})

describe('the hit and miss counts when the deadline cuts the reads short', () => {
  const PARIS = { lat: 48.8566, lng: 2.3522 }

  async function resolveLogged(hang: (key: string) => boolean) {
    vi.useFakeTimers({ now: NOW })
    const info = vi.fn()
    const cache = memoryKv()
    const read = cache.get
    cache.get = (key) =>
      hang(key) ? new Promise<string | null>(() => undefined) : read(key)
    const w = world({ cache, logger: { warn: vi.fn(), info } })

    const pending = resolveTripWeather(
      w.runtime,
      [day('2026-10-10'), day('2026-10-10', PARIS)],
      ZONE,
    )
    await vi.advanceTimersByTimeAsync(WEATHER_DEADLINE_MS)
    await pending
    return info
  }

  it('counts neither a hit nor a miss when no cache read answered', async () => {
    const info = await resolveLogged(() => true)

    expect(info).toHaveBeenCalledWith(
      'weather.resolved',
      expect.objectContaining({ locations: 2, hits: 0, misses: 0 }),
    )
  })

  it('counts a miss only for the location whose read answered', async () => {
    const info = await resolveLogged(
      (key) => key === forecastCacheKey(PARIS.lat, PARIS.lng),
    )

    expect(info).toHaveBeenCalledWith(
      'weather.resolved',
      expect.objectContaining({ locations: 2, hits: 0, misses: 1 }),
    )
  })
})

/* ------------------------------------------------------------------- the cap */

describe('the cap on a single request', () => {
  const places = Array.from({ length: WEATHER_MAX_LOCATIONS + 3 }, (_, i) => ({
    lat: 40 + i,
    lng: 10 + i,
  }))

  it('resolves twelve distinct locations in day order and leaves the rest unavailable', async () => {
    const w = world()
    const queries = places.map((place, i) =>
      day(`2026-10-${String(9 + (i % 5)).padStart(2, '0')}`, place),
    )

    const outcomes = await resolveTripWeather(w.runtime, queries, ZONE)

    expect(w.provider.urls).toHaveLength(WEATHER_MAX_LOCATIONS)
    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      ...Array.from({ length: WEATHER_MAX_LOCATIONS }, () => 'ok'),
      'unavailable',
      'unavailable',
      'unavailable',
    ])
  })

  it('counts a place once however many days it serves', async () => {
    const w = world()
    const queries = [
      ...places
        .slice(0, WEATHER_MAX_LOCATIONS)
        .map((p) => day('2026-10-09', p)),
      ...places
        .slice(0, WEATHER_MAX_LOCATIONS)
        .map((p) => day('2026-10-10', p)),
    ]

    const outcomes = await resolveTripWeather(w.runtime, queries, ZONE)

    expect(w.provider.urls).toHaveLength(WEATHER_MAX_LOCATIONS)
    expect(outcomes.every((outcome) => outcome.status === 'ok')).toBe(true)
  })

  it('does not spend a place on a day that can have no forecast', async () => {
    const w = world()
    const useless = places.map((place) => day('2026-10-01', place))

    const outcomes = await resolveTripWeather(
      w.runtime,
      [...useless, day('2026-10-10')],
      ZONE,
    )

    expect(outcomes.at(-1)?.status).toBe('ok')
    expect(w.provider.urls).toHaveLength(1)
  })

  it('issues the calls together rather than one after another', async () => {
    vi.useFakeTimers({ now: NOW })
    const w = world({
      provider: provider(() => new Promise<Response>(() => undefined)),
    })

    const pending = resolveTripWeather(
      w.runtime,
      places.slice(0, 5).map((place) => day('2026-10-10', place)),
      ZONE,
    )
    await vi.advanceTimersByTimeAsync(0)

    // All five requests are out before any one of them has had a chance to time out.
    expect(w.provider.urls).toHaveLength(5)
    await vi.advanceTimersByTimeAsync(WEATHER_CALL_TIMEOUT_MS)
    await pending
  })
})
