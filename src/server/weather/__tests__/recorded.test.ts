/**
 * Recorded days - what the weather was on a day of a trip that is already past - driven through
 * `resolveTripWeather` the way `weather.test.ts` drives the forecast: an in-memory cache, a counter
 * store of its own, a clock the test owns and a `fetch` it wrote that answers as either vendor.
 *
 * "Now" is 2026-10-12T11:42:00Z, the moment the publication lag was measured: in Europe/Oslo that is
 * 13:42 on 12 October, POWER has published through 9 October (three days before today in UTC), so
 * 10 and 11 October are past and not yet recorded, 12 October is today and a forecast day, and the
 * recorded series ends at 9 October however long the trip is.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createMetNorwayClient } from '../met-norway'
import { createNasaPowerClient } from '../nasa-power'
import {
  WEATHER_CALL_TIMEOUT_MS,
  WEATHER_MAX_LOCATIONS,
  failureCacheKey,
  lastRecordedDate,
  recordedCacheKey,
  resolveTripWeather,
  selectKind,
} from '../weather'
import { OSLO_FORECAST } from './locationforecast.fixture'

import type { WeatherQuery, WeatherRuntime } from '../weather'
import type { OutboundRuntime } from '#/server/metering/outbound'

const NOW = new Date('2026-10-12T11:42:00Z')
const ZONE = 'Europe/Oslo'
const OSLO = { lat: 59.9139, lng: 10.7522 }
const DAY_MS = 86_400_000

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

const compact = (date: string): string => date.replaceAll('-', '')
const expanded = (date: string): string =>
  `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`

interface PowerShape {
  /** First date (inclusive) the fake answers with the fill value in every field. */
  readonly fillFrom?: string
  /** Dates answered with the fill value in both temperatures only. */
  readonly noTemperature?: ReadonlyArray<string>
  /** Dates answered with the fill value for the minimum only. */
  readonly noMinimum?: ReadonlyArray<string>
}

/** A NASA POWER answer for the range asked, in the service's own wire format. */
function powerBody(start: string, end: string, shape: PowerShape = {}) {
  const parameter: Record<string, Record<string, number>> = {
    T2M_MAX: {},
    T2M_MIN: {},
    PRECTOTCORR: {},
    WS2M: {},
  }
  for (
    let cursor = Date.parse(`${start}T00:00:00Z`);
    cursor <= Date.parse(`${end}T00:00:00Z`);
    cursor += DAY_MS
  ) {
    const date = new Date(cursor).toISOString().slice(0, 10)
    const key = compact(date)
    const dom = Number(date.slice(8, 10))
    const filled = shape.fillFrom !== undefined && date >= shape.fillFrom
    parameter.T2M_MAX[key] =
      filled || shape.noTemperature?.includes(date) ? -999 : 10 + dom
    parameter.T2M_MIN[key] =
      filled ||
      shape.noTemperature?.includes(date) ||
      shape.noMinimum?.includes(date)
        ? -999
        : 2 + dom
    parameter.PRECTOTCORR[key] = filled ? -999 : dom / 10
    parameter.WS2M[key] = filled ? -999 : 1.5
  }
  return {
    type: 'Feature',
    properties: { parameter },
    header: { fill_value: -999.0 },
  }
}

interface Vendors {
  readonly fetch: typeof fetch
  readonly met: Array<string>
  readonly nasa: Array<string>
}

type Responder = (url: string) => Promise<Response> | Response | null

/** Answers as MET Norway or NASA POWER by host; `override` may take a request over. */
function vendors(shape: PowerShape = {}, override?: Responder): Vendors {
  const met: Array<string> = []
  const nasa: Array<string> = []
  const fake = (input: string): Promise<Response> => {
    const host = new URL(input).host
    if (host === 'api.met.no') met.push(input)
    else nasa.push(input)
    const taken = override?.(input) ?? null
    if (taken !== null) return Promise.resolve(taken)
    if (host === 'api.met.no') {
      return Promise.resolve(
        new Response(JSON.stringify(OSLO_FORECAST), {
          status: 200,
          headers: { Expires: 'Mon, 12 Oct 2026 12:00:00 GMT' },
        }),
      )
    }
    const url = new URL(input)
    return Promise.resolve(
      new Response(
        JSON.stringify(
          powerBody(
            expanded(url.searchParams.get('start') ?? ''),
            expanded(url.searchParams.get('end') ?? ''),
            shape,
          ),
        ),
        { status: 200 },
      ),
    )
  }
  return { fetch: fake as unknown as typeof fetch, met, nasa }
}

interface World {
  readonly runtime: WeatherRuntime
  readonly cache: MemoryKv
  readonly counters: MemoryKv
  readonly vendors: Vendors
  now: Date
}

function world(
  overrides: {
    ceiling?: number
    vendors?: Vendors
    cache?: MemoryKv
    logger?: WeatherRuntime['logger']
    now?: Date
  } = {},
): World {
  const cache = overrides.cache ?? memoryKv()
  const counters = memoryKv()
  const upstream = overrides.vendors ?? vendors()
  const state = { now: overrides.now ?? NOW }
  cache.clock = () => state.now
  const runtime: WeatherRuntime = {
    cache,
    counters,
    outbound: silentOutbound(),
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
    vendors: upstream,
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

function trip(from: string, to: string, location = OSLO): Array<WeatherQuery> {
  const days: Array<WeatherQuery> = []
  for (
    let cursor = Date.parse(`${from}T00:00:00Z`);
    cursor <= Date.parse(`${to}T00:00:00Z`);
    cursor += DAY_MS
  ) {
    days.push(day(new Date(cursor).toISOString().slice(0, 10), location))
  }
  return days
}

const spent = (counters: MemoryKv): number =>
  [...counters.entries.values()].reduce((sum, value) => sum + Number(value), 0)

const RECORDED = { recorded: true } as const

const statuses = (outcomes: ReadonlyArray<{ status: string }>) =>
  outcomes.map((outcome) => outcome.status)

/* ------------------------------------------------------- choosing a kind (pure) */

describe('choosing the kind of reading a day gets', () => {
  const window = {
    today: '2026-10-12',
    forecastEnd: '2026-10-17',
    recordedEnd: '2026-10-09',
    recordedStart: '1981-01-01',
  }

  it('gives today a forecast, and the day before it a day not yet recorded', () => {
    expect(selectKind('2026-10-12', window)).toBe('forecast')
    expect(selectKind('2026-10-11', window)).toBe('not-yet-recorded')
  })

  it('gives the last fully covered forecast day a forecast and the day after it an estimate', () => {
    expect(selectKind('2026-10-17', window)).toBe('forecast')
    expect(selectKind('2026-10-18', window)).toBe('estimate')
  })

  it('keeps a past day inside the lag apart from one beyond it', () => {
    expect(selectKind('2026-10-10', window)).toBe('not-yet-recorded')
    expect(selectKind('2026-10-09', window)).toBe('recorded')
    expect(selectKind('2026-09-01', window)).toBe('recorded')
  })

  it('gives a past day from before the provider’s data begins nothing', () => {
    expect(selectKind('1981-01-01', window)).toBe('recorded')
    expect(selectKind('1980-12-31', window)).toBe('none')
  })

  it('treats today as a forecast day even when the forecast reaches no further than today', () => {
    expect(
      selectKind('2026-10-12', { ...window, forecastEnd: '2026-10-12' }),
    ).toBe('forecast')
    expect(
      selectKind('2026-10-13', { ...window, forecastEnd: '2026-10-12' }),
    ).toBe('estimate')
  })

  it('ends the recorded days lagDays before the provider’s own today, and never past yesterday', () => {
    // The provider counts in UTC. Oslo and UTC share the date at 11:42Z.
    expect(lastRecordedDate('2026-10-12', '2026-10-12', 3)).toBe('2026-10-09')
    // Tokyo is already on the 13th while the provider is still on the 12th.
    expect(lastRecordedDate('2026-10-13', '2026-10-12', 3)).toBe('2026-10-09')
    // Los Angeles is still on the 11th while the provider is on the 12th: yesterday is the cap.
    expect(lastRecordedDate('2026-10-11', '2026-10-12', 0)).toBe('2026-10-10')
    expect(lastRecordedDate('2026-10-11', '2026-10-12', 3)).toBe('2026-10-09')
  })
})

/* ------------------------------------------------------------ what a day gets */

describe('the days a trip has already lived', () => {
  it('never asks the provider for a day before its data begins, and blames no cell for the date', async () => {
    const w = world()

    const outcomes = await resolveTripWeather(
      w.runtime,
      [day('1026-10-05'), day('1980-12-31')],
      ZONE,
      RECORDED,
    )

    expect(statuses(outcomes)).toEqual(['none', 'none'])
    expect(w.vendors.nasa).toHaveLength(0)
    expect(spent(w.counters)).toBe(0)
    expect(
      [...w.cache.entries.keys()].filter((key) => key.includes(':fail:')),
    ).toEqual([])
  })

  it('reads every recorded day of a place from one call', async () => {
    const w = world()

    const outcomes = await resolveTripWeather(
      w.runtime,
      trip('2026-10-01', '2026-10-09'),
      ZONE,
      RECORDED,
    )

    expect(w.vendors.nasa).toHaveLength(1)
    expect(w.vendors.met).toHaveLength(0)
    const url = new URL(w.vendors.nasa[0])
    expect(url.searchParams.get('start')).toBe('20261001')
    expect(url.searchParams.get('end')).toBe('20261009')
    expect(spent(w.counters)).toBe(1)
    expect(statuses(outcomes)).toEqual(Array(9).fill('ok'))
    expect(outcomes[0]).toEqual({
      status: 'ok',
      reading: {
        kind: 'recorded',
        source: 'nasa-power',
        tempMaxC: 11,
        tempMinC: 3,
        precipitationMm: 0.1,
        windMs: 1.5,
      },
      // Worked out from the place and the date, so a measured day has its sun like a forecast one.
      sun: { sunrise: '07:22', sunset: '18:50' },
    })
  })

  it('asks the provider only for the point cut to one decimal', async () => {
    const w = world()

    await resolveTripWeather(
      w.runtime,
      trip('2026-10-01', '2026-10-02'),
      ZONE,
      RECORDED,
    )

    const url = new URL(w.vendors.nasa[0])
    expect(url.searchParams.get('latitude')).toBe('59.9')
    expect(url.searchParams.get('longitude')).toBe('10.8')
    for (const sent of w.vendors.nasa) {
      expect(sent).not.toContain('59.9139')
      expect(sent).not.toContain('10.7522')
    }
  })

  it('serves two points in one cell from one call', async () => {
    const w = world()
    const near = { lat: 59.9301, lng: 10.7801 }

    const outcomes = await resolveTripWeather(
      w.runtime,
      [day('2026-10-01'), day('2026-10-02', near)],
      ZONE,
      RECORDED,
    )

    expect(w.vendors.nasa).toHaveLength(1)
    expect(statuses(outcomes)).toEqual(['ok', 'ok'])
    expect(spent(w.counters)).toBe(1)
  })

  it('keeps a trip that straddles all three states to one call per kind', async () => {
    const w = world()

    const outcomes = await resolveTripWeather(
      w.runtime,
      trip('2026-10-05', '2026-10-16'),
      ZONE,
      RECORDED,
    )

    expect(statuses(outcomes)).toEqual([
      'ok',
      'ok',
      'ok',
      'ok',
      'ok', // 5 to 9 October: recorded
      'not-yet-recorded',
      'not-yet-recorded', // 10 and 11 October
      'ok',
      'ok',
      'ok',
      'ok',
      'ok', // 12 to 16 October: forecast
    ])
    expect(w.vendors.met).toHaveLength(1)
    expect(w.vendors.nasa).toHaveLength(1)
    expect(new URL(w.vendors.nasa[0]).searchParams.get('end')).toBe('20261009')
    expect(spent(w.counters)).toBe(2)
  })
})

describe('a day the provider has not published yet', () => {
  it('is its own answer, asks nothing of anyone and spends nothing', async () => {
    const w = world({ ceiling: 0 })

    const outcomes = await resolveTripWeather(
      w.runtime,
      trip('2026-10-10', '2026-10-11'),
      ZONE,
      RECORDED,
    )

    expect(outcomes).toEqual([
      { status: 'not-yet-recorded' },
      { status: 'not-yet-recorded' },
    ])
    expect(w.vendors.nasa).toHaveLength(0)
    expect(w.vendors.met).toHaveLength(0)
    expect(w.cache.entries.size).toBe(0)
    expect(spent(w.counters)).toBe(0)
  })

  it('is never filled in from a forecast', async () => {
    const w = world()

    const outcomes = await resolveTripWeather(
      w.runtime,
      [...trip('2026-10-10', '2026-10-11'), day('2026-10-12')],
      ZONE,
      RECORDED,
    )

    expect(statuses(outcomes)).toEqual([
      'not-yet-recorded',
      'not-yet-recorded',
      'ok',
    ])
    expect(w.vendors.nasa).toHaveLength(0)
    // The forecast was asked for today, and for nothing earlier.
    expect(w.vendors.met).toHaveLength(1)
    expect(outcomes[0]).not.toHaveProperty('reading')
  })

  it('follows the provider’s day and not the traveller’s, so Tokyo is not told a day exists that does not', async () => {
    // 23:00Z on the 12th is 08:00 on the 13th in Tokyo; POWER is still on the 12th.
    const w = world({ now: new Date('2026-10-12T23:00:00Z') })

    const outcomes = await resolveTripWeather(
      w.runtime,
      trip('2026-10-09', '2026-10-12'),
      'Asia/Tokyo',
      RECORDED,
    )

    expect(statuses(outcomes)).toEqual([
      'ok',
      'not-yet-recorded',
      'not-yet-recorded',
      'not-yet-recorded',
    ])
    expect(new URL(w.vendors.nasa[0]).searchParams.get('end')).toBe('20261009')
  })
})

describe('a reader that does not ask for recorded days', () => {
  it('sees what it saw before: a past day is nothing, and nothing is asked of NASA', async () => {
    const w = world()

    const outcomes = await resolveTripWeather(
      w.runtime,
      trip('2026-10-05', '2026-10-12'),
      ZONE,
    )

    expect(statuses(outcomes)).toEqual([
      'none',
      'none',
      'none',
      'none',
      'none',
      'none',
      'none',
      'ok',
    ])
    expect(w.vendors.nasa).toHaveLength(0)
    expect(
      [...w.cache.entries.keys()].filter((key) => key.includes(':recorded:')),
    ).toEqual([])
    expect(spent(w.counters)).toBe(1)
  })

  it('is told the same when it asks for recorded days explicitly turned off', async () => {
    const w = world()

    const outcomes = await resolveTripWeather(
      w.runtime,
      trip('2026-10-09', '2026-10-11'),
      ZONE,
      { recorded: false },
    )

    expect(statuses(outcomes)).toEqual(['none', 'none', 'none'])
    expect(w.vendors.nasa).toHaveLength(0)
  })
})

/* ---------------------------------------------------------------- the fill value */

describe('a value the provider does not have', () => {
  it('is an absent field and never a number', async () => {
    const w = world({
      vendors: vendors({ noMinimum: ['2026-10-03'] }),
    })

    const [outcome] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-03')],
      ZONE,
      RECORDED,
    )

    expect(outcome).toEqual({
      status: 'ok',
      reading: {
        kind: 'recorded',
        source: 'nasa-power',
        tempMaxC: 13,
        tempMinC: null,
        precipitationMm: 0.3,
        windMs: 1.5,
      },
      sun: { sunrise: '07:27', sunset: '18:44' },
    })
  })

  it('makes the day unavailable when both temperatures are missing', async () => {
    const w = world({
      vendors: vendors({ noTemperature: ['2026-10-03'] }),
    })

    const outcomes = await resolveTripWeather(
      w.runtime,
      trip('2026-10-02', '2026-10-04'),
      ZONE,
      RECORDED,
    )

    expect(statuses(outcomes)).toEqual(['ok', 'unavailable', 'ok'])
  })

  it('is remembered for an hour, not for the day a settled reading is kept for, and costs nothing meanwhile', async () => {
    const w = world({
      vendors: vendors({ noTemperature: ['2026-10-03'] }),
    })
    const queries = trip('2026-10-02', '2026-10-04')
    await resolveTripWeather(w.runtime, queries, ZONE, RECORDED)
    const key = recordedCacheKey(OSLO.lat, OSLO.lng, '2026-10-03')

    expect(w.cache.ttls.get(key)).toBeLessThanOrEqual(60 * 60)
    expect(w.cache.ttls.get(key)).toBeGreaterThan(0)
    const callsBefore = w.vendors.nasa.length
    const spentBefore = spent(w.counters)

    const again = await resolveTripWeather(w.runtime, queries, ZONE, RECORDED)

    expect(statuses(again)).toEqual(['ok', 'unavailable', 'ok'])
    expect(w.vendors.nasa).toHaveLength(callsBefore)
    expect(spent(w.counters)).toBe(spentBefore)

    // An hour on, the provider is asked again: the hole may have been filled in.
    w.now = new Date(NOW.getTime() + 61 * 60_000)
    await resolveTripWeather(w.runtime, queries, ZONE, RECORDED)
    expect(w.vendors.nasa).toHaveLength(callsBefore + 1)
    expect(new URL(w.vendors.nasa.at(-1) ?? '').searchParams.get('start')).toBe(
      '20261003',
    )
    expect(new URL(w.vendors.nasa.at(-1) ?? '').searchParams.get('end')).toBe(
      '20261003',
    )
  })

  it('is unavailable, and not an invented zero, for a day the answer does not mention', async () => {
    const w = world({
      vendors: vendors({}, (url) =>
        url.includes('power.larc.nasa.gov')
          ? new Response(
              JSON.stringify({
                properties: { parameter: { T2M_MAX: {}, T2M_MIN: {} } },
              }),
              { status: 200 },
            )
          : null,
      ),
    })

    const outcomes = await resolveTripWeather(
      w.runtime,
      trip('2026-10-02', '2026-10-03'),
      ZONE,
      RECORDED,
    )

    expect(statuses(outcomes)).toEqual(['unavailable', 'unavailable'])
  })
})

/* -------------------------------------------------------------------- the cache */

describe('what is kept of a recorded day', () => {
  it('is one entry per rounded point and date, kept a day when the date is recent', async () => {
    const w = world()

    await resolveTripWeather(
      w.runtime,
      trip('2026-10-01', '2026-10-02'),
      ZONE,
      RECORDED,
    )

    const key = recordedCacheKey(OSLO.lat, OSLO.lng, '2026-10-01')
    expect(key).toBe('wx:v2:recorded:59.9:10.8:2026-10-01')
    expect(w.cache.ttls.get(key)).toBe(24 * 60 * 60)
    const stored = JSON.parse(w.cache.entries.get(key) ?? 'null') as unknown
    expect(Object.keys(stored as Record<string, unknown>).sort()).toEqual([
      'day',
      'fetchedAt',
      'v',
    ])
  })

  it('is kept thirty days once the date is ninety days old or more', async () => {
    const w = world()

    await resolveTripWeather(
      w.runtime,
      [day('2026-07-13'), day('2026-07-14'), day('2026-07-15')],
      ZONE,
      RECORDED,
    )

    // Ninety days before 12 October is 14 July: the 13th is older, the 14th is ninety days old and
    // the 15th is under ninety.
    expect(
      w.cache.ttls.get(recordedCacheKey(OSLO.lat, OSLO.lng, '2026-07-13')),
    ).toBe(30 * 24 * 60 * 60)
    expect(
      w.cache.ttls.get(recordedCacheKey(OSLO.lat, OSLO.lng, '2026-07-14')),
    ).toBe(30 * 24 * 60 * 60)
    expect(
      w.cache.ttls.get(recordedCacheKey(OSLO.lat, OSLO.lng, '2026-07-15')),
    ).toBe(24 * 60 * 60)
  })

  it('makes no call and spends nothing when every day is in the cache', async () => {
    const w = world()
    const queries = trip('2026-10-01', '2026-10-09')
    await resolveTripWeather(w.runtime, queries, ZONE, RECORDED)
    const calls = w.vendors.nasa.length
    const units = spent(w.counters)

    const outcomes = await resolveTripWeather(
      w.runtime,
      queries,
      ZONE,
      RECORDED,
    )

    expect(statuses(outcomes)).toEqual(Array(9).fill('ok'))
    expect(w.vendors.nasa).toHaveLength(calls)
    expect(spent(w.counters)).toBe(units)
  })

  it('asks only for the days it does not have', async () => {
    const w = world()
    await resolveTripWeather(
      w.runtime,
      trip('2026-10-01', '2026-10-05'),
      ZONE,
      RECORDED,
    )

    await resolveTripWeather(
      w.runtime,
      trip('2026-10-01', '2026-10-08'),
      ZONE,
      RECORDED,
    )

    expect(w.vendors.nasa).toHaveLength(2)
    const second = new URL(w.vendors.nasa[1])
    expect(second.searchParams.get('start')).toBe('20261006')
    expect(second.searchParams.get('end')).toBe('20261008')
  })

  it('treats a malformed entry as a miss', async () => {
    const w = world()
    w.cache.entries.set(
      recordedCacheKey(OSLO.lat, OSLO.lng, '2026-10-01'),
      '{"v":1,"nope":true}',
    )

    const [outcome] = await resolveTripWeather(
      w.runtime,
      [day('2026-10-01')],
      ZONE,
      RECORDED,
    )

    expect(outcome.status).toBe('ok')
    expect(w.vendors.nasa).toHaveLength(1)
  })

  it('keeps nothing about who asked in a key or a value', async () => {
    const w = world()

    await resolveTripWeather(
      w.runtime,
      trip('2026-10-01', '2026-10-02'),
      ZONE,
      RECORDED,
    )

    for (const [key, value] of w.cache.entries) {
      expect(`${key} ${value}`).not.toContain('org-alpha')
    }
  })
})

/* ------------------------------------------------------------------ the failures */

describe('a provider that fails on a past day', () => {
  const failing = () =>
    vendors({}, (url) =>
      url.includes('power.larc.nasa.gov')
        ? new Response('no', { status: 503 })
        : null,
    )

  it('makes the day unavailable, and that is not the same answer as not yet recorded', async () => {
    const w = world({ vendors: failing() })

    const outcomes = await resolveTripWeather(
      w.runtime,
      trip('2026-10-08', '2026-10-11'),
      ZONE,
      RECORDED,
    )

    expect(statuses(outcomes)).toEqual([
      'unavailable',
      'unavailable',
      'not-yet-recorded',
      'not-yet-recorded',
    ])
  })

  it('is remembered at the one-decimal point, so the next resolution spends nothing and calls nothing', async () => {
    const w = world({ vendors: failing() })
    const queries = trip('2026-10-08', '2026-10-09')
    await resolveTripWeather(w.runtime, queries, ZONE, RECORDED)
    const entry = failureCacheKey('nasa-power', 59.9, 10.8)
    expect(w.cache.entries.has(entry)).toBe(true)
    expect(w.cache.ttls.get(entry)).toBe(5 * 60)
    expect(entry).toBe('wx:v2:fail:nasa-power:59.9000:10.8000')
    const calls = w.vendors.nasa.length
    const units = spent(w.counters)

    const again = await resolveTripWeather(w.runtime, queries, ZONE, RECORDED)

    expect(statuses(again)).toEqual(['unavailable', 'unavailable'])
    expect(w.vendors.nasa).toHaveLength(calls)
    expect(spent(w.counters)).toBe(units)
  })

  it('leaves the forecast days of the same trip intact', async () => {
    const w = world({ vendors: failing() })

    const outcomes = await resolveTripWeather(
      w.runtime,
      [day('2026-10-08'), day('2026-10-13')],
      ZONE,
      RECORDED,
    )

    expect(statuses(outcomes)).toEqual(['unavailable', 'ok'])
  })

  it('is not made worse by a forecast outage, which leaves the recorded days intact', async () => {
    const w = world({
      vendors: vendors({}, (url) =>
        url.includes('api.met.no') ? new Response('no', { status: 503 }) : null,
      ),
    })

    const outcomes = await resolveTripWeather(
      w.runtime,
      [day('2026-10-08'), day('2026-10-13')],
      ZONE,
      RECORDED,
    )

    expect(statuses(outcomes)).toEqual(['ok', 'unavailable'])
    expect(
      w.cache.entries.has(failureCacheKey('met-norway', 59.9139, 10.7522)),
    ).toBe(true)
    expect(w.cache.entries.has(failureCacheKey('nasa-power', 59.9, 10.8))).toBe(
      false,
    )
  })

  it('aborts a hung call at the per-call timeout and still draws the forecast', async () => {
    vi.useFakeTimers({ now: NOW })
    const w = world({
      vendors: vendors({}, (url) =>
        url.includes('power.larc.nasa.gov')
          ? (new Promise<Response>(() => undefined) as unknown as Response)
          : null,
      ),
    })

    const pending = resolveTripWeather(
      w.runtime,
      [day('2026-10-08'), day('2026-10-13')],
      ZONE,
      RECORDED,
    )
    await vi.advanceTimersByTimeAsync(WEATHER_CALL_TIMEOUT_MS)

    expect(statuses(await pending)).toEqual(['unavailable', 'ok'])
  })
})

/* ------------------------------------------------------------------- the allowance */

describe('the allowance', () => {
  it('serves the forecast first when it cannot pay for both', async () => {
    const w = world({ ceiling: 1 })

    const outcomes = await resolveTripWeather(
      w.runtime,
      [day('2026-10-08'), day('2026-10-13')],
      ZONE,
      RECORDED,
    )

    expect(statuses(outcomes)).toEqual(['unavailable', 'ok'])
    expect(w.vendors.met).toHaveLength(1)
    expect(w.vendors.nasa).toHaveLength(0)
    expect(spent(w.counters)).toBe(1)
  })

  it('grants the cells in the order of the trip, not of the cache reads', async () => {
    const w = world({ ceiling: 1 })
    const cells = [
      { lat: 59.9, lng: 10.8 },
      { lat: 48.9, lng: 2.4 },
      { lat: 41.9, lng: 12.5 },
    ]

    const outcomes = await resolveTripWeather(
      w.runtime,
      cells.map((location) => day('2026-10-05', location)),
      ZONE,
      RECORDED,
    )

    expect(statuses(outcomes)).toEqual(['ok', 'unavailable', 'unavailable'])
    expect(w.vendors.nasa).toHaveLength(1)
    expect(new URL(w.vendors.nasa[0]).searchParams.get('latitude')).toBe('59.9')
  })

  it('leaves cached recorded days drawn when it is spent', async () => {
    const w = world()
    const queries = trip('2026-10-01', '2026-10-03')
    await resolveTripWeather(w.runtime, queries, ZONE, RECORDED)
    const spentRuntime = { ...w.runtime, ceiling: 0 }

    const outcomes = await resolveTripWeather(
      spentRuntime,
      [...queries, day('2026-10-04')],
      ZONE,
      RECORDED,
    )

    expect(statuses(outcomes)).toEqual(['ok', 'ok', 'ok', 'unavailable'])
  })
})

/* ------------------------------------------------------------------------ the cap */

describe('the cap on a single request', () => {
  it('resolves recorded days for no more than the capped number of places', async () => {
    const w = world()
    const places = Array.from(
      { length: WEATHER_MAX_LOCATIONS + 1 },
      (_, i) => ({
        lat: 10 + i * 2,
        lng: 20,
      }),
    )

    const outcomes = await resolveTripWeather(
      w.runtime,
      places.map((place) => day('2026-10-01', place)),
      ZONE,
      RECORDED,
    )

    expect(statuses(outcomes).slice(0, WEATHER_MAX_LOCATIONS)).toEqual(
      Array(WEATHER_MAX_LOCATIONS).fill('ok'),
    )
    expect(outcomes[WEATHER_MAX_LOCATIONS]).toEqual({ status: 'unavailable' })
    expect(w.vendors.nasa).toHaveLength(WEATHER_MAX_LOCATIONS)
  })

  it('keeps today’s forecast however many places the trip has already left behind', async () => {
    const w = world()
    const places = Array.from(
      { length: WEATHER_MAX_LOCATIONS + 1 },
      (_, i) => ({ lat: 10 + i * 2, lng: 20 }),
    )
    const here = { lat: 59.9139, lng: 10.7522 }

    const outcomes = await resolveTripWeather(
      w.runtime,
      [
        ...places.map((place) => day('2026-10-01', place)),
        day('2026-10-13', here),
      ],
      ZONE,
      RECORDED,
    )

    expect(outcomes.at(-1)?.status).toBe('ok')
    expect(w.vendors.met).toHaveLength(1)
    expect(w.vendors.nasa).toHaveLength(WEATHER_MAX_LOCATIONS - 1)
  })
})

/* ---------------------------------------------------------------------- the log */

describe('the line a resolution leaves', () => {
  it('counts the days of each kind, including those not yet recorded, and names no one but the organisation', async () => {
    const info = vi.fn()
    const w = world({ logger: { info, warn: vi.fn() } })

    await resolveTripWeather(
      w.runtime,
      trip('2026-10-08', '2026-10-13'),
      ZONE,
      RECORDED,
    )

    expect(info).toHaveBeenCalledWith('weather.resolved', {
      organizationId: 'org-alpha',
      locations: 1,
      days: { recorded: 2, 'not-yet-recorded': 2, forecast: 2 },
      hits: 0,
      misses: 1,
      unavailable: 0,
    })
  })
})
