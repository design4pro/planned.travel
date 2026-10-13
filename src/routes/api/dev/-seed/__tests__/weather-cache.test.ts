/**
 * The weather the demo workspace opens with, read back through the real policy.
 *
 * The seed writes cache entries and spends an allowance, and neither means anything until the
 * policy reads them. So this drives `resolveTripWeather` - the function the planner's server read
 * calls - over the dataset's own days, on the clock the e2e suite pins, with providers that fail the
 * test if they are touched. What it asserts is what a traveller is shown: the kind of every day of
 * the two trips the journey opens, and that nothing was ever asked of a vendor.
 */
import { describe, expect, it, vi } from 'vitest'

import { resolveTripWeather } from '#/server/weather/weather'
import type { WeatherOutcome, WeatherRuntime } from '#/server/weather/weather'
import { PLAN_RATE_CEILINGS } from '#/server/billing/limits'
import { rateMeterKey } from '#/server/metering/rate'
import { SEED_ANCHOR_INSTANT, flagshipTrip, lisbonTrip } from '../dataset'
import { seedWeatherCache } from '../weather-cache'

import type { SeedTrip } from '../types'

const ORGANIZATION = 'org-demo'
const MS_PER_DAY = 86_400_000

function memoryStore() {
  const entries = new Map<string, string>()
  return {
    entries,
    get: (key: string) => Promise.resolve(entries.get(key) ?? null),
    put: (key: string, value: string) => {
      entries.set(key, value)
      return Promise.resolve()
    },
  }
}

/** A vendor that fails the test when it is called: the journey must never reach one. */
function refusedVendor(calls: Array<string>) {
  const refuse = (name: string) => () => {
    calls.push(name)
    return Promise.reject(new Error(`${name} was called`))
  }
  return {
    metNorway: { fetch: refuse('met-norway') },
    nasaPower: {
      lagDays: 3,
      firstDate: '1981-01-01',
      daily: refuse('nasa-power daily'),
      climatology: refuse('nasa-power climatology'),
    },
  }
}

/** The trip's days as the planner reads them: a date, and the first stop's point. */
function queriesOf(trip: SeedTrip) {
  const start = Date.parse(`${trip.startDate}T00:00:00.000Z`)
  const days = Math.round(
    (Date.parse(`${trip.endDate}T00:00:00.000Z`) - start) / MS_PER_DAY,
  )
  return Array.from({ length: days + 1 }, (_, index) => {
    const stop = (trip.stops ?? []).find((s) => s.dayNumber === index + 1)
    const place = (trip.places ?? []).find((p) => p.key === stop?.placeKey)
    return {
      date: new Date(start + index * MS_PER_DAY).toISOString().slice(0, 10),
      location: place === undefined ? null : { lat: place.lat, lng: place.lng },
    }
  })
}

async function resolve(trip: SeedTrip) {
  const cache = memoryStore()
  await seedWeatherCache(cache, ORGANIZATION)
  const calls: Array<string> = []
  const runtime = {
    cache,
    counters: cache,
    outbound: { logger: { info: vi.fn(), warn: vi.fn() } },
    organizationId: ORGANIZATION,
    ceiling: PLAN_RATE_CEILINGS.crew.weather_lookups_per_month,
    now: () => SEED_ANCHOR_INSTANT,
    logger: null,
    ...refusedVendor(calls),
  } as unknown as WeatherRuntime
  const outcomes = await resolveTripWeather(
    runtime,
    queriesOf(trip),
    trip.timezone ?? 'UTC',
    { recorded: true, estimate: true },
  )
  return { outcomes, calls, cache }
}

const statuses = (outcomes: ReadonlyArray<WeatherOutcome>) =>
  outcomes.map((outcome) =>
    outcome.status === 'ok' ? outcome.reading.kind : outcome.status,
  )

describe('the seeded weather, read through the policy on the fixture day', () => {
  it('gives the Lisbon trip a recorded, two unrecorded, two forecast, an unavailable and an empty day', async () => {
    const { outcomes, calls } = await resolve(lisbonTrip)

    expect(statuses(outcomes)).toEqual([
      'recorded',
      'not-yet-recorded',
      'not-yet-recorded',
      'forecast',
      'forecast',
      'unavailable',
      'none',
    ])
    expect(calls).toEqual([])
  })

  it('gives the first Tokyo day an estimate and the days without an entry no number', async () => {
    const { outcomes, calls } = await resolve(flagshipTrip)

    expect(statuses(outcomes)[0]).toBe('estimate')
    expect(statuses(outcomes).slice(1)).not.toContain('forecast')
    expect(statuses(outcomes).slice(1)).toContain('unavailable')
    expect(calls).toEqual([])
  })

  it('spends the whole allowance of the workspace it is given, in the fixture month', async () => {
    const cache = memoryStore()
    const report = await seedWeatherCache(cache, ORGANIZATION)

    expect(report.allowanceWindow).toBe('2026-08')
    expect(
      cache.entries.get(
        rateMeterKey('weather_lookups_per_month', ORGANIZATION, '2026-08'),
      ),
    ).toBe(String(report.allowance))
    expect(report.allowance).toBeGreaterThan(0)
  })

  it('is idempotent and keeps no entry that expires on the real clock', async () => {
    const put = vi.fn(() => Promise.resolve())
    const first = await seedWeatherCache({ put }, ORGANIZATION)
    const second = await seedWeatherCache({ put }, ORGANIZATION)

    expect(second).toEqual(first)
    for (const call of put.mock.calls as ReadonlyArray<
      ReadonlyArray<unknown>
    >) {
      expect(call).toHaveLength(2)
    }
  })
})
