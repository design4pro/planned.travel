/**
 * Estimated days - what a day typically has, for a day beyond the forecast - driven through
 * `resolveTripWeather` together with the other two kinds, because what this file owns is what only
 * shows when all three are in one trip: how many calls a place costs, what the allowance buys when
 * it is short, and what survives when one provider does not answer.
 *
 * "Now" is 2026-10-12T11:42:00Z. The recorded forecast fixture runs to the end of 17 October, so a
 * forecast covers 12 to 17 October in full; POWER has published through 9 October, so 10 and 11
 * October are not yet recorded. A day after the 17th is therefore an estimate once the forecast has
 * been read, and one after the 26th (`today` plus the lookahead) is an estimate before it is asked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createMetNorwayClient } from '../met-norway'
import { createNasaPowerClient } from '../nasa-power'
import {
  WEATHER_CALL_TIMEOUT_MS,
  estimateCacheKey,
  failureCacheKey,
  resolveTripWeather,
  selectKind,
} from '../weather'
import { OSLO_CLIMATOLOGY } from './nasa-power-climatology.fixture'
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
}

function memoryKv(): MemoryKv {
  const entries = new Map<string, string>()
  const ttls = new Map<string, number | undefined>()
  return {
    entries,
    ttls,
    get: (key) => Promise.resolve(entries.get(key) ?? null),
    put: (key, value, options) => {
      entries.set(key, value)
      ttls.set(key, options?.expirationTtl)
      return Promise.resolve()
    },
  }
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

/** A daily answer for the range asked: every day a plain temperature pair, so only the kind matters. */
function dailyBody(start: string, end: string) {
  const compact = (date: string) => date.replaceAll('-', '')
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
    const key = compact(new Date(cursor).toISOString().slice(0, 10))
    parameter.T2M_MAX[key] = 12
    parameter.T2M_MIN[key] = 4
    parameter.PRECTOTCORR[key] = 0.5
    parameter.WS2M[key] = 1.5
  }
  return { properties: { parameter }, header: { fill_value: -999.0 } }
}

type Responder = (url: string) => Promise<Response> | Response | null

interface Vendors {
  readonly fetch: typeof fetch
  readonly met: Array<string>
  /** Daily point requests. */
  readonly daily: Array<string>
  readonly climatology: Array<string>
}

/** Answers as MET Norway or NASA POWER (either endpoint) by URL; `override` may take a request over. */
function vendors(
  climatology: unknown = OSLO_CLIMATOLOGY,
  override?: Responder,
): Vendors {
  const met: Array<string> = []
  const daily: Array<string> = []
  const climate: Array<string> = []
  const fake = (input: string): Promise<Response> => {
    const url = new URL(input)
    if (url.host === 'api.met.no') met.push(input)
    else if (url.pathname.includes('/climatology/')) climate.push(input)
    else daily.push(input)
    const taken = override?.(input) ?? null
    if (taken !== null) return Promise.resolve(taken)
    if (url.host === 'api.met.no') {
      return Promise.resolve(
        new Response(JSON.stringify(OSLO_FORECAST), {
          status: 200,
          headers: { Expires: 'Mon, 12 Oct 2026 12:00:00 GMT' },
        }),
      )
    }
    if (url.pathname.includes('/climatology/')) {
      return Promise.resolve(
        new Response(JSON.stringify(climatology), { status: 200 }),
      )
    }
    const expand = (date: string) =>
      `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
    return Promise.resolve(
      new Response(
        JSON.stringify(
          dailyBody(
            expand(url.searchParams.get('start') ?? ''),
            expand(url.searchParams.get('end') ?? ''),
          ),
        ),
        { status: 200 },
      ),
    )
  }
  return {
    fetch: fake as unknown as typeof fetch,
    met,
    daily,
    climatology: climate,
  }
}

const calls = (v: Vendors): number =>
  v.met.length + v.daily.length + v.climatology.length

interface World {
  readonly runtime: WeatherRuntime
  readonly cache: MemoryKv
  readonly counters: MemoryKv
  readonly vendors: Vendors
}

function world(overrides: { ceiling?: number; vendors?: Vendors } = {}): World {
  const cache = memoryKv()
  const counters = memoryKv()
  const upstream = overrides.vendors ?? vendors()
  const runtime: WeatherRuntime = {
    cache,
    counters,
    outbound: silentOutbound(),
    organizationId: 'org-alpha',
    ceiling: overrides.ceiling ?? 300,
    now: () => NOW,
    logger: null,
    metNorway: createMetNorwayClient({ fetch: upstream.fetch }),
    nasaPower: createNasaPowerClient({ fetch: upstream.fetch }),
  }
  return { runtime, cache, counters, vendors: upstream }
}

function trip(from: string, to: string, location = OSLO): Array<WeatherQuery> {
  const days: Array<WeatherQuery> = []
  for (
    let cursor = Date.parse(`${from}T00:00:00Z`);
    cursor <= Date.parse(`${to}T00:00:00Z`);
    cursor += DAY_MS
  ) {
    days.push({
      date: new Date(cursor).toISOString().slice(0, 10),
      location,
    })
  }
  return days
}

const spent = (counters: MemoryKv): number =>
  [...counters.entries.values()].reduce((sum, value) => sum + Number(value), 0)

const statuses = (outcomes: ReadonlyArray<{ status: string }>) =>
  outcomes.map((outcome) => outcome.status)

const kinds = (
  outcomes: ReadonlyArray<{ status: string; reading?: { kind: string } }>,
) => outcomes.map((outcome) => outcome.reading?.kind ?? outcome.status)

const ALL = { recorded: true, estimate: true } as const

/** Seven to twenty October: recorded 7-9, not yet 10-11, forecast 12-17, estimate 18-20. */
const STRADDLE = trip('2026-10-07', '2026-10-20')

/* ------------------------------------------------------------- choosing a kind */

describe('choosing the kind of an estimated day', () => {
  const window = {
    today: '2026-10-12',
    forecastEnd: '2026-10-17',
    recordedEnd: '2026-10-09',
    recordedStart: '1981-01-01',
  }

  it('gives the day after the last covered forecast day an estimate', () => {
    expect(selectKind('2026-10-17', window)).toBe('forecast')
    expect(selectKind('2026-10-18', window)).toBe('estimate')
    expect(selectKind('2027-06-01', window)).toBe('estimate')
  })

  it('keeps today a forecast day however short the forecast is', () => {
    expect(
      selectKind('2026-10-12', { ...window, forecastEnd: '2026-10-12' }),
    ).toBe('forecast')
    expect(
      selectKind('2026-10-13', { ...window, forecastEnd: '2026-10-12' }),
    ).toBe('estimate')
  })
})

/* -------------------------------------------------------------- the three kinds */

describe('a trip that straddles all three kinds', () => {
  it('makes exactly three calls and spends exactly three units on a cold cache', async () => {
    const w = world()

    const outcomes = await resolveTripWeather(w.runtime, STRADDLE, ZONE, ALL)

    expect(kinds(outcomes)).toEqual([
      'recorded',
      'recorded',
      'recorded',
      'not-yet-recorded',
      'not-yet-recorded',
      'forecast',
      'forecast',
      'forecast',
      'forecast',
      'forecast',
      'forecast',
      'estimate',
      'estimate',
      'estimate',
    ])
    expect(w.vendors.met).toHaveLength(1)
    expect(w.vendors.daily).toHaveLength(1)
    expect(w.vendors.climatology).toHaveLength(1)
    expect(spent(w.counters)).toBe(3)
  })

  it('reads an estimated day as the typical figures of its month, with no wind and no slots', async () => {
    const w = world()

    const outcomes = await resolveTripWeather(w.runtime, STRADDLE, ZONE, ALL)

    expect(outcomes.at(-1)).toEqual({
      status: 'ok',
      reading: {
        kind: 'estimate',
        source: 'nasa-power',
        tempMaxC: 13.62,
        tempMinC: -4.4,
        precipitationMm: 3.35,
        windMs: null,
      },
      sun: { sunrise: '08:08', sunset: '17:54' },
    })
  })

  it('makes no call and spends nothing on a warm cache', async () => {
    const w = world()
    await resolveTripWeather(w.runtime, STRADDLE, ZONE, ALL)
    const before = calls(w.vendors)
    const units = spent(w.counters)

    const again = await resolveTripWeather(w.runtime, STRADDLE, ZONE, ALL)

    expect(kinds(again).at(-1)).toBe('estimate')
    expect(calls(w.vendors)).toBe(before)
    expect(spent(w.counters)).toBe(units)
  })

  it('makes two calls for a trip that starts today, which has no recorded days', async () => {
    const w = world()

    const outcomes = await resolveTripWeather(
      w.runtime,
      trip('2026-10-12', '2026-10-25'),
      ZONE,
      ALL,
    )

    expect(w.vendors.met).toHaveLength(1)
    expect(w.vendors.climatology).toHaveLength(1)
    expect(w.vendors.daily).toHaveLength(0)
    expect(spent(w.counters)).toBe(2)
    expect(kinds(outcomes).slice(0, 7)).toEqual([
      'forecast',
      'forecast',
      'forecast',
      'forecast',
      'forecast',
      'forecast',
      'estimate',
    ])
  })

  it('makes one call for an all-past trip beyond the lag', async () => {
    const w = world()

    await resolveTripWeather(
      w.runtime,
      trip('2026-09-26', '2026-10-09'),
      ZONE,
      ALL,
    )

    expect(calls(w.vendors)).toBe(1)
    expect(w.vendors.daily).toHaveLength(1)
    expect(spent(w.counters)).toBe(1)
  })

  it('makes one call for a trip in the far future, and every day is an estimate', async () => {
    const w = world()

    const outcomes = await resolveTripWeather(
      w.runtime,
      trip('2027-06-20', '2027-07-03'),
      ZONE,
      ALL,
    )

    expect(kinds(outcomes)).toEqual(Array(14).fill('estimate'))
    expect(calls(w.vendors)).toBe(1)
    expect(w.vendors.climatology).toHaveLength(1)
    expect(spent(w.counters)).toBe(1)
  })

  it('draws each day from its own month of the one climatology', async () => {
    const w = world()

    const outcomes = await resolveTripWeather(
      w.runtime,
      [
        { date: '2027-06-30', location: OSLO },
        { date: '2027-07-01', location: OSLO },
      ],
      ZONE,
      ALL,
    )

    const highs = outcomes.map((outcome) =>
      outcome.status === 'ok' ? outcome.reading.tempMaxC : null,
    )
    expect(highs).toEqual([24.26, 26.04])
    expect(w.vendors.climatology).toHaveLength(1)
  })
})

/* ----------------------------------------------------------- what the cache keeps */

describe('what is kept of an estimate', () => {
  it('is one entry per one-decimal point holding twelve months, kept thirty days', async () => {
    const w = world()

    await resolveTripWeather(
      w.runtime,
      trip('2027-06-20', '2027-06-21'),
      ZONE,
      ALL,
    )

    const key = estimateCacheKey(OSLO.lat, OSLO.lng)
    expect(key).toBe('wx:v2:estimate:59.9:10.8')
    expect(w.cache.ttls.get(key)).toBe(30 * 24 * 60 * 60)
    const stored = JSON.parse(w.cache.entries.get(key) ?? 'null') as {
      months: Array<unknown>
    }
    expect(Object.keys(stored).sort()).toEqual(['fetchedAt', 'months', 'v'])
    expect(stored.months).toHaveLength(12)
  })

  it('treats a malformed entry as a miss', async () => {
    const w = world()
    w.cache.entries.set(estimateCacheKey(OSLO.lat, OSLO.lng), '{"v":2}')

    const outcomes = await resolveTripWeather(
      w.runtime,
      trip('2027-06-20', '2027-06-20'),
      ZONE,
      ALL,
    )

    expect(kinds(outcomes)).toEqual(['estimate'])
    expect(w.vendors.climatology).toHaveLength(1)
  })

  it('sends the provider the point cut to one decimal and nothing about the trip', async () => {
    const w = world()

    await resolveTripWeather(
      w.runtime,
      trip('2027-06-20', '2027-06-21'),
      ZONE,
      ALL,
    )

    const sent = w.vendors.climatology[0]
    expect(sent).not.toContain('59.9139')
    expect(sent).not.toContain('10.7522')
    expect(new URL(sent).searchParams.get('latitude')).toBe('59.9')
  })
})

/* -------------------------------------------------------------- a reader's opt-in */

describe('a reader that does not ask for estimates', () => {
  it('sees what it saw before: a day beyond the forecast is nothing, and no climatology is asked for', async () => {
    const w = world()

    const outcomes = await resolveTripWeather(w.runtime, STRADDLE, ZONE, {
      recorded: true,
    })

    expect(statuses(outcomes).slice(-3)).toEqual(['none', 'none', 'none'])
    expect(w.vendors.climatology).toHaveLength(0)
    expect(spent(w.counters)).toBe(2)
  })

  it('asks for nothing at all when the whole trip is far out', async () => {
    const w = world()

    const outcomes = await resolveTripWeather(
      w.runtime,
      trip('2027-06-20', '2027-06-22'),
      ZONE,
    )

    expect(statuses(outcomes)).toEqual(['none', 'none', 'none'])
    expect(calls(w.vendors)).toBe(0)
  })
})

/* ------------------------------------------------------------------ the failures */

describe('when a provider does not give', () => {
  it('leaves every recorded and estimated day drawn through a forecast outage, and resolves', async () => {
    const w = world({
      vendors: vendors(OSLO_CLIMATOLOGY, (url) =>
        url.includes('api.met.no')
          ? new Response('down', { status: 503 })
          : null,
      ),
    })

    const outcomes = await resolveTripWeather(w.runtime, STRADDLE, ZONE, ALL)

    // The 18th and 19th are inside the days a forecast has always covered, so they are asked of it
    // and are unavailable with it; the 20th is past them, and has its estimate to fall back on.
    expect(kinds(outcomes)).toEqual([
      'recorded',
      'recorded',
      'recorded',
      'not-yet-recorded',
      'not-yet-recorded',
      ...Array(8).fill('unavailable'),
      'estimate',
    ])
    expect(
      w.cache.entries.has(failureCacheKey('met-norway', OSLO.lat, OSLO.lng)),
    ).toBe(true)
  })

  it('draws the estimates of a far trip through a forecast outage', async () => {
    const w = world({
      vendors: vendors(OSLO_CLIMATOLOGY, (url) =>
        url.includes('api.met.no')
          ? new Response('down', { status: 503 })
          : null,
      ),
    })

    const outcomes = await resolveTripWeather(
      w.runtime,
      [
        ...trip('2026-10-13', '2026-10-13'),
        ...trip('2027-06-20', '2027-06-21'),
      ],
      ZONE,
      ALL,
    )

    expect(kinds(outcomes)).toEqual(['unavailable', 'estimate', 'estimate'])
  })

  it('leaves the forecast and the recorded days drawn through a climatology outage, and remembers it', async () => {
    const w = world({
      vendors: vendors(OSLO_CLIMATOLOGY, (url) =>
        url.includes('/climatology/')
          ? new Response('down', { status: 500 })
          : null,
      ),
    })

    const outcomes = await resolveTripWeather(w.runtime, STRADDLE, ZONE, ALL)

    expect(kinds(outcomes)).toEqual([
      'recorded',
      'recorded',
      'recorded',
      'not-yet-recorded',
      'not-yet-recorded',
      'forecast',
      'forecast',
      'forecast',
      'forecast',
      'forecast',
      'forecast',
      'unavailable',
      'unavailable',
      'unavailable',
    ])
    const before = calls(w.vendors)
    await resolveTripWeather(w.runtime, STRADDLE, ZONE, ALL)
    expect(w.vendors.climatology).toHaveLength(1)
    expect(calls(w.vendors)).toBe(before)
  })

  it('remembers a climatology failure apart from the daily service, so the recorded days are not blanked', async () => {
    const w = world({
      vendors: vendors(OSLO_CLIMATOLOGY, (url) =>
        url.includes('/climatology/')
          ? new Response('down', { status: 500 })
          : null,
      ),
    })

    await resolveTripWeather(w.runtime, STRADDLE, ZONE, ALL)

    const failures = [...w.cache.entries.keys()].filter((key) =>
      key.includes(':fail:'),
    )
    expect(failures).toEqual([
      'wx:v2:fail:nasa-power-climatology:59.9000:10.8000',
    ])
  })

  it('aborts a hung climatology at the per-call timeout and still draws the other kinds', async () => {
    vi.useFakeTimers({ now: NOW })
    const w = world({
      vendors: vendors(OSLO_CLIMATOLOGY, (url) =>
        url.includes('/climatology/')
          ? (new Promise<Response>(() => undefined) as unknown as Response)
          : null,
      ),
    })

    const pending = resolveTripWeather(w.runtime, STRADDLE, ZONE, ALL)
    await vi.advanceTimersByTimeAsync(WEATHER_CALL_TIMEOUT_MS)

    expect(kinds(await pending)).toEqual([
      'recorded',
      'recorded',
      'recorded',
      'not-yet-recorded',
      'not-yet-recorded',
      'forecast',
      'forecast',
      'forecast',
      'forecast',
      'forecast',
      'forecast',
      'unavailable',
      'unavailable',
      'unavailable',
    ])
  })

  it('aborts a hung forecast at the per-call timeout and still draws the other kinds', async () => {
    vi.useFakeTimers({ now: NOW })
    const w = world({
      vendors: vendors(OSLO_CLIMATOLOGY, (url) =>
        url.includes('api.met.no')
          ? (new Promise<Response>(() => undefined) as unknown as Response)
          : null,
      ),
    })

    const pending = resolveTripWeather(w.runtime, STRADDLE, ZONE, ALL)
    await vi.advanceTimersByTimeAsync(WEATHER_CALL_TIMEOUT_MS)

    const answer = kinds(await pending)
    expect(answer.slice(0, 3)).toEqual(['recorded', 'recorded', 'recorded'])
    expect(answer.slice(5, 13)).toEqual(Array(8).fill('unavailable'))
    expect(answer.at(-1)).toBe('estimate')
  })

  it('is unavailable for a month with neither temperature, and draws one temperature on its own', async () => {
    const body = structuredClone(OSLO_CLIMATOLOGY) as unknown as {
      properties: { parameter: Record<string, Record<string, number>> }
    }
    body.properties.parameter.T2M_MAX_AVG.JUN = -999
    body.properties.parameter.T2M_MIN_AVG.JUN = -999
    body.properties.parameter.T2M_MIN_AVG.JUL = -999
    const w = world({ vendors: vendors(body) })

    const outcomes = await resolveTripWeather(
      w.runtime,
      [
        { date: '2027-06-20', location: OSLO },
        { date: '2027-07-20', location: OSLO },
      ],
      ZONE,
      ALL,
    )

    expect(statuses(outcomes)).toEqual(['unavailable', 'ok'])
    expect(outcomes[1]).toMatchObject({
      reading: { kind: 'estimate', tempMaxC: 26.04, tempMinC: null },
    })
  })
})

/* ------------------------------------------------------------------- the allowance */

describe('the allowance', () => {
  it('yields unavailable for every uncached day with no outbound call at a ceiling of zero', async () => {
    const w = world({ ceiling: 0 })

    const outcomes = await resolveTripWeather(w.runtime, STRADDLE, ZONE, ALL)

    expect(kinds(outcomes)).toEqual([
      'unavailable',
      'unavailable',
      'unavailable',
      'not-yet-recorded',
      'not-yet-recorded',
      ...Array(9).fill('unavailable'),
    ])
    expect(calls(w.vendors)).toBe(0)
  })

  it('spends one unit against three needed calls on the forecast', async () => {
    const w = world({ ceiling: 1 })

    const outcomes = await resolveTripWeather(w.runtime, STRADDLE, ZONE, ALL)

    expect(w.vendors.met).toHaveLength(1)
    expect(w.vendors.climatology).toHaveLength(0)
    expect(w.vendors.daily).toHaveLength(0)
    expect(spent(w.counters)).toBe(1)
    expect(kinds(outcomes).slice(5, 11)).toEqual(Array(6).fill('forecast'))
    expect(kinds(outcomes).slice(11)).toEqual(Array(3).fill('unavailable'))
    expect(kinds(outcomes).slice(0, 3)).toEqual(Array(3).fill('unavailable'))
  })

  it('spends the second unit on the estimate and not on the recorded days', async () => {
    const w = world({ ceiling: 2 })

    const outcomes = await resolveTripWeather(w.runtime, STRADDLE, ZONE, ALL)

    expect(w.vendors.met).toHaveLength(1)
    expect(w.vendors.climatology).toHaveLength(1)
    expect(w.vendors.daily).toHaveLength(0)
    expect(kinds(outcomes).slice(11)).toEqual(Array(3).fill('estimate'))
    expect(kinds(outcomes).slice(0, 3)).toEqual(Array(3).fill('unavailable'))
  })
})
