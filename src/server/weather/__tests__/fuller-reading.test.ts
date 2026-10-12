/**
 * The fuller reading of a forecast day: precipitation, its chance, wind, and the four six-hour
 * slots across the day.
 *
 * Driven the way the weather policy is everywhere else - through `resolveTripWeather` with the real
 * vendor client over a recorded answer - plus `groupForecastDays` directly for the shapes the
 * recording does not contain (a step with no wind, a provider that does send a chance of rain).
 * Every expected figure is computed here from the recording's own instants, independently of the
 * code under test.
 *
 * "Now" is 2026-10-09T13:35:00Z, five minutes after the recording was taken: 15:35 in Europe/Oslo
 * (UTC+2 until 25 October), so 9 October is today and partial, 10 to 17 October are whole days
 * and the recording's last step is on 19 October.
 */
import { describe, expect, it } from 'vitest'

import { createMetNorwayClient } from '../met-norway'
import { createNasaPowerClient } from '../nasa-power'
import { groupForecastDays, resolveTripWeather } from '../weather'
import { OSLO_FORECAST_DETAIL } from './locationforecast-detail.fixture'

import type { ForecastStep, WeatherRuntime } from '../weather'
import type { OutboundRuntime } from '#/server/metering/outbound'

const NOW = new Date('2026-10-09T13:35:00Z')
const ZONE = 'Europe/Oslo'
const OSLO = { lat: 59.9139, lng: 10.7522 }

/* --------------------------------------------------------------------- world */

function runtime(): WeatherRuntime {
  const entries = new Map<string, string>()
  const store = {
    get: (key: string) => Promise.resolve(entries.get(key) ?? null),
    put: (key: string, value: string) => {
      entries.set(key, value)
      return Promise.resolve()
    },
  }
  const upstream = () =>
    Promise.resolve(
      new Response(JSON.stringify(OSLO_FORECAST_DETAIL), {
        status: 200,
        headers: { Expires: 'Fri, 09 Oct 2026 13:59:00 GMT' },
      }),
    )
  return {
    cache: store,
    counters: store,
    outbound: {
      db: null,
      waitUntil: () => undefined,
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      } as unknown as OutboundRuntime['logger'],
      now: () => NOW,
    },
    organizationId: 'org-alpha',
    ceiling: 300,
    now: () => NOW,
    logger: null,
    metNorway: createMetNorwayClient({
      fetch: upstream as unknown as typeof fetch,
    }),
    nasaPower: createNasaPowerClient({
      fetch: upstream as unknown as typeof fetch,
    }),
  }
}

async function reading(date: string) {
  const [outcome] = await resolveTripWeather(
    runtime(),
    [{ date, location: OSLO }],
    ZONE,
  )
  if (outcome.status !== 'ok' || outcome.reading.kind !== 'forecast') {
    throw new Error(`${date} should be a forecast day, got ${outcome.status}.`)
  }
  return outcome.reading
}

/** The recording's steps that fall on a local date in Oslo, shifted by the zone's +2 h. */
function stepsOn(date: string) {
  return OSLO_FORECAST_DETAIL.properties.timeseries.filter(
    (step) =>
      new Date(Date.parse(step.time) + 2 * 3_600_000)
        .toISOString()
        .slice(0, 10) === date,
  )
}

const localHour = (time: string) =>
  new Date(Date.parse(time) + 2 * 3_600_000).getUTCHours()

const tenth = (value: number) => Math.round(value * 10) / 10

/* ------------------------------------------------------------ the recording */

describe('a whole day in the hourly stretch of the forecast', () => {
  const DATE = '2026-10-10'

  it('adds up the hourly precipitation and takes the strongest wind', async () => {
    const steps = stepsOn(DATE)
    expect(steps).toHaveLength(24)
    const rain = steps.reduce(
      (sum, step) =>
        sum + (step.data.next_1_hours?.details.precipitation_amount ?? 0),
      0,
    )
    const wind = Math.max(
      ...steps.map((step) => step.data.instant.details.wind_speed),
    )
    // The recording is not a dry day: a total of zero would pass for a code path that ignores it.
    expect(rain).toBeGreaterThan(0)

    const day = await reading(DATE)

    expect(day.precipitationMm).toBe(tenth(rain))
    expect(day.windMs).toBe(wind)
  })

  it('has no chance of rain, because the compact product sends none', async () => {
    expect((await reading(DATE)).precipitationProbability).toBeNull()
  })

  it('splits the day into night, morning, afternoon and evening, in the trip’s local time', async () => {
    const day = await reading(DATE)

    expect(day.slots?.map((slot) => slot.from)).toEqual([
      '00:00',
      '06:00',
      '12:00',
      '18:00',
    ])
    const steps = stepsOn(DATE)
    for (const [index, slot] of (day.slots ?? []).entries()) {
      const inSlot = steps.filter(
        (step) => Math.floor(localHour(step.time) / 6) === index,
      )
      const mean =
        inSlot.reduce(
          (sum, step) => sum + step.data.instant.details.air_temperature,
          0,
        ) / inSlot.length
      expect(slot.tempC).toBe(tenth(mean))
      expect(slot.symbol).toMatch(/^[a-z]+$/)
    }
  })
})

describe('a whole day in the six-hour stretch of the forecast', () => {
  const DATE = '2026-10-14'

  it('adds up the six-hour precipitation, one figure per step', async () => {
    const steps = stepsOn(DATE)
    expect(steps).toHaveLength(4)
    const rain = steps.reduce(
      (sum, step) =>
        sum + (step.data.next_6_hours?.details.precipitation_amount ?? 0),
      0,
    )

    expect((await reading(DATE)).precipitationMm).toBe(tenth(rain))
  })

  it('still has four slots, one step each, so the block keeps one shape across a trip', async () => {
    const day = await reading(DATE)

    expect(day.slots).toHaveLength(4)
    expect(day.slots?.map((slot) => slot.from)).toEqual([
      '00:00',
      '06:00',
      '12:00',
      '18:00',
    ])
    expect(day.slots?.map((slot) => slot.tempC)).toEqual(
      stepsOn(DATE).map((step) => step.data.instant.details.air_temperature),
    )
  })
})

describe('today, which is only partly ahead', () => {
  it('has the slots that are still to come and no empty ones for the hours already gone', async () => {
    const day = await reading('2026-10-09')

    // The recording starts at 15:00 local, so the night and the morning have no step at all.
    expect(day.slots?.map((slot) => slot.from)).toEqual(['12:00', '18:00'])
  })
})

/* ------------------------------------------------- shapes the recording lacks */

const step = (
  over: Partial<ForecastStep> & { time: string },
): ForecastStep => ({
  tempC: 10,
  symbol: null,
  windMs: null,
  precipitationMm: null,
  precipitationProbability: null,
  ...over,
})

describe('six-hour steps in a zone whose slots do not start where the steps do', () => {
  // Los Angeles is UTC-7: the provider's 00, 06, 12 and 18 UTC steps fall at 17, 23, 05 and 11 local.
  const series = [
    step({ time: '2026-10-11T00:00:00Z', symbol: 'rain' }),
    step({ time: '2026-10-11T06:00:00Z', symbol: 'cloudy' }),
    step({ time: '2026-10-11T12:00:00Z', symbol: 'clearsky' }),
    step({ time: '2026-10-11T18:00:00Z', symbol: 'fair' }),
    step({ time: '2026-10-12T00:00:00Z', symbol: 'rain' }),
  ]

  it('gives a slot the sky of the hours it covers, and none where no step covers them', () => {
    const day = groupForecastDays(series, 'America/Los_Angeles').days.get(
      '2026-10-11',
    )

    // The day's steps are at 05:00, 11:00 and 17:00 local. The 05:00 step covers one hour of the
    // night, less than half of it; the evening has no step inside it, but 17:00 covers five of it.
    expect(day?.slots).toEqual([
      { from: '00:00', symbol: null, tempC: 10 },
      { from: '06:00', symbol: 'clearsky', tempC: 10 },
      { from: '12:00', symbol: 'fair', tempC: 10 },
      { from: '18:00', symbol: 'rain', tempC: 10 },
    ])
  })
})

describe('a day the provider says little about', () => {
  it('leaves precipitation, wind and chance empty rather than zero', () => {
    const grouped = groupForecastDays(
      [
        step({ time: '2026-10-10T08:00:00Z' }),
        step({ time: '2026-10-11T08:00:00Z' }),
      ],
      'UTC',
    )

    expect(grouped.days.get('2026-10-10')).toMatchObject({
      precipitationMm: null,
      precipitationProbability: null,
      windMs: null,
    })
  })

  it('takes the highest chance of rain the provider gave, when it gives one', () => {
    const grouped = groupForecastDays(
      [
        step({ time: '2026-10-10T02:00:00Z', precipitationProbability: 20 }),
        step({ time: '2026-10-10T08:00:00Z', precipitationProbability: 65 }),
        step({ time: '2026-10-10T14:00:00Z' }),
        step({ time: '2026-10-11T08:00:00Z' }),
      ],
      'UTC',
    )

    expect(grouped.days.get('2026-10-10')?.precipitationProbability).toBe(65)
  })

  it('keeps a day’s total free of floating-point dust', () => {
    const grouped = groupForecastDays(
      [
        step({ time: '2026-10-10T01:00:00Z', precipitationMm: 0.1 }),
        step({ time: '2026-10-10T02:00:00Z', precipitationMm: 0.2 }),
        step({ time: '2026-10-11T01:00:00Z' }),
      ],
      'UTC',
    )

    expect(grouped.days.get('2026-10-10')?.precipitationMm).toBe(0.3)
  })
})
