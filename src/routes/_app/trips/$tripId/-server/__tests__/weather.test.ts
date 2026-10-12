/**
 * The planner's weather read: who may ask, what it costs, and what is allowed to cross the wire.
 *
 * The property the ordering exists for - a caller who may not read the trip costs nothing and
 * learns nothing - is asserted on the ports: the weather runtime factory has zero calls for a
 * refused caller. The policy behind it is the real one, driven through an in-memory cache and a
 * `fetch` that answers with the recorded MET Norway response.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  NotFoundError,
  addTripMember,
  createAccommodation,
  createPlace,
  createTrip,
  listTripDays,
  updateOrganizationSettings,
} from '#/server/repos'
import {
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'
import { createMetNorwayClient } from '#/server/weather/met-norway'
import { createNasaPowerClient } from '#/server/weather/nasa-power'
import { OSLO_CLIMATOLOGY } from '#/server/weather/__tests__/nasa-power-climatology.fixture'
import { OSLO_DAILY } from '#/server/weather/__tests__/nasa-power.fixture'
import { OSLO_FORECAST_DETAIL } from '#/server/weather/__tests__/locationforecast-detail.fixture'
import { OSLO_FORECAST } from '#/server/weather/__tests__/locationforecast.fixture'

import type { OutboundRuntime } from '#/server/metering/outbound'
import type { SeededTenant } from '#/server/repos/__tests__/harness'
import type { WeatherRuntimeOptions } from '#/server/weather/bindings'
import type { WeatherRuntime } from '#/server/weather/weather'
import type { TenantScope } from '#/server/repos'

/** `cloudflare:workers` does not resolve here; every test hands the runtime in as a port. */
vi.mock('#/server/weather/bindings', () => ({
  weatherRuntime: () => {
    throw new Error('weatherRuntime is not reached: these tests hand it in.')
  },
}))

vi.mock('../../../../-server/context', () => ({
  appScope: () => {
    throw new Error('appScope is not reached: these tests hand the scope in.')
  },
}))

const { loadTripWeather, tripWeatherInputSchema } = await import('../weather')

const NOW = new Date('2026-10-08T19:10:00Z')

/* ------------------------------------------------------------------ runtime */

interface Ports {
  readonly weather: ReturnType<
    typeof vi.fn<(options: WeatherRuntimeOptions) => WeatherRuntime>
  >
  readonly requested: Array<string>
}

/** An in-memory runtime over a provider that answers with the recording, or fails. */
function ports(
  options: {
    readonly failing?: boolean
    readonly recording?: unknown
    readonly now?: Date
  } = {},
): Ports {
  const at = options.now ?? NOW
  const requested: Array<string> = []
  const entries = new Map<string, string>()
  const store = {
    get: (key: string) => Promise.resolve(entries.get(key) ?? null),
    put: (key: string, value: string) => {
      entries.set(key, value)
      return Promise.resolve()
    },
  }
  const fake = (input: string): Promise<Response> => {
    requested.push(input)
    if (new URL(input).host === 'power.larc.nasa.gov') {
      return options.failing === true
        ? Promise.reject(new TypeError('offline'))
        : Promise.resolve(
            new Response(
              JSON.stringify(
                input.includes('/climatology/') ? OSLO_CLIMATOLOGY : OSLO_DAILY,
              ),
            ),
          )
    }
    return options.failing === true
      ? Promise.reject(new TypeError('offline'))
      : Promise.resolve(
          new Response(JSON.stringify(options.recording ?? OSLO_FORECAST), {
            status: 200,
            headers: { Expires: 'Thu, 08 Oct 2026 19:29:27 GMT' },
          }),
        )
  }
  const weather = vi.fn((runtime: WeatherRuntimeOptions): WeatherRuntime => ({
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
      now: () => at,
    },
    organizationId: runtime.organizationId,
    ceiling: runtime.ceiling,
    now: () => at,
    logger: null,
    metNorway: createMetNorwayClient({
      fetch: fake as unknown as typeof fetch,
    }),
    nasaPower: createNasaPowerClient({
      fetch: fake as unknown as typeof fetch,
    }),
  }))
  return { weather, requested }
}

/* ------------------------------------------------------------------ fixture */

let tenant: SeededTenant
let owner: TenantScope
let reader: TenantScope
let outsider: TenantScope
let tripId: string
let foreignTripId: string

beforeEach(async () => {
  const harness = await createHarness()
  tenant = await harness.seedTenant('planner')
  owner = tenant.scope

  const readerId = await tenant.addUser('A reader')
  reader = tenant.scopeFor(readerId)
  outsider = tenant.scopeFor(await tenant.addUser('A colleague'))

  const trip = await createTrip(owner, {
    title: 'Oslo in October',
    startDate: '2026-10-08',
    endDate: '2026-10-10',
    currency: 'NOK',
    timezone: 'Europe/Oslo',
  })
  tripId = trip.id
  await addTripMember(owner, { tripId, userId: readerId, role: 'viewer' })

  const days = await listTripDays(owner, tripId)
  const hotel = await createPlace(owner, {
    tripId,
    name: 'Hotel',
    lat: 59.9139,
    lng: 10.7522,
  })
  await createAccommodation(owner, {
    tripId,
    startDayId: days[0].id,
    endDayId: days[2].id,
    placeId: hotel.id,
    name: 'Hotel',
  })

  const other = await harness.seedTenant('elsewhere')
  foreignTripId = (
    await createTrip(other.scope, {
      title: 'Not yours',
      startDate: '2026-10-08',
      endDate: '2026-10-09',
      currency: 'EUR',
    })
  ).id
})

/* -------------------------------------------------------------------- cases */

describe('loadTripWeather', () => {
  it('answers one entry per day, in day order, with a forecast for each located day', async () => {
    const port = ports()

    const result = await loadTripWeather(owner, { tripId }, port)

    const days = await listTripDays(owner, tripId)
    expect(result.distanceUnit).toBe('metric')
    expect(result.days.map((day) => day.dayId)).toEqual(days.map((d) => d.id))
    expect(result.days.map((day) => day.status)).toEqual(['ok', 'ok', 'ok'])
    const first = result.days[0]
    if (first.status !== 'ok' || first.reading.kind !== 'forecast') {
      throw new Error(
        'The first day has a stay and today is inside the window.',
      )
    }
    expect(first.reading.source).toBe('met-norway')
    expect(first.reading.tempMaxC).toBeGreaterThan(first.reading.tempMinC)
    // One call serves every forecast day at the same location.
    expect(port.requested).toHaveLength(1)
  })

  it('carries the fuller reading across the wire: wind, precipitation and the day’s slots', async () => {
    // A recording that carries wind and amounts, read on the day it was taken.
    const result = await loadTripWeather(
      owner,
      { tripId },
      ports({
        recording: OSLO_FORECAST_DETAIL,
        now: new Date('2026-10-09T13:35:00Z'),
      }),
    )

    const [past, today, tomorrow] = result.days
    expect(past.status).toBe('none')
    if (
      today.status !== 'ok' ||
      today.reading.kind !== 'forecast' ||
      tomorrow.status !== 'ok' ||
      tomorrow.reading.kind !== 'forecast'
    ) {
      throw new Error('Today and tomorrow are inside the recording.')
    }
    expect(tomorrow.reading.windMs).toBeGreaterThan(0)
    expect(tomorrow.reading.precipitationMm).toBeGreaterThanOrEqual(0)
    expect(tomorrow.reading.slots?.map((slot) => slot.from)).toEqual([
      '00:00',
      '06:00',
      '12:00',
      '18:00',
    ])
    // The hours of today already gone are not drawn as empty slots.
    expect(today.reading.slots?.map((slot) => slot.from)).toEqual([
      '12:00',
      '18:00',
    ])
    // Nothing about who looked a point up, and nothing about where it is.
    expect(JSON.stringify(result)).not.toMatch(/fetchedAt|lat|lng|59\.9/)
  })

  it('carries each located day’s sunrise and sunset, in the trip’s zone, for no further call', async () => {
    const port = ports()

    const result = await loadTripWeather(owner, { tripId }, port)

    const last = result.days[2]
    if (last.status !== 'ok') {
      throw new Error('The last day has a stay and is inside the window.')
    }
    // Oslo on 10 October at UTC+2, as the NOAA Solar Calculator's own code works it out.
    expect(last.sun).toEqual({ sunrise: '07:44', sunset: '18:23' })
    expect(port.requested).toHaveLength(1)
  })

  it('lets a viewer of the trip read it', async () => {
    const result = await loadTripWeather(reader, { tripId }, ports())

    expect(result.days).toHaveLength(3)
  })

  it('draws the plan allowance from the plan table and the caller’s workspace', async () => {
    const free = ports()
    await loadTripWeather(owner, { tripId }, free)
    await subscribeTenant(owner, 'solo')
    const solo = ports()
    await loadTripWeather(owner, { tripId }, solo)

    expect(free.weather).toHaveBeenCalledWith({
      organizationId: tenant.organizationId,
      ceiling: 300,
    })
    expect(solo.weather).toHaveBeenCalledWith({
      organizationId: tenant.organizationId,
      ceiling: 3000,
    })
  })

  it('reports the reader’s distance unit so the badge can convert at render', async () => {
    await updateOrganizationSettings(owner, { distanceUnit: 'imperial' })

    const result = await loadTripWeather(owner, { tripId }, ports())

    expect(result.distanceUnit).toBe('imperial')
    // The reading itself stays metric: the cached entry behind it is shared by every workspace.
    const first = result.days[0]
    expect(
      first.status === 'ok' && first.reading.kind === 'forecast'
        ? first.reading.tempMaxC
        : null,
    ).toBeLessThan(30)
  })

  it('groups a trip with no time zone in UTC, whatever zone the reader is in, and gives it no sun times', async () => {
    const make = async (timezone: string | undefined) => {
      const trip = await createTrip(owner, {
        title: 'Zone check',
        startDate: '2026-10-08',
        endDate: '2026-10-10',
        currency: 'NOK',
        ...(timezone === undefined ? {} : { timezone }),
      })
      const days = await listTripDays(owner, trip.id)
      const place = await createPlace(owner, {
        tripId: trip.id,
        name: 'Hotel',
        lat: 59.9139,
        lng: 10.7522,
      })
      await createAccommodation(owner, {
        tripId: trip.id,
        startDayId: days[0].id,
        endDayId: days[2].id,
        placeId: place.id,
        name: 'Hotel',
      })
      return trip.id
    }
    const readings = async (id: string) =>
      (await loadTripWeather(owner, { tripId: id }, ports())).days.map(
        ({ dayId: _dayId, ...rest }) => rest,
      )
    // The free plan holds two trips and the fixture already has one.
    await subscribeTenant(owner, 'solo')
    const unzoned = await make(undefined)
    const utc = await make('UTC')
    await updateOrganizationSettings(owner, { timezone: 'Pacific/Auckland' })

    const withSun = await readings(utc)
    // The groupings are one and the same; the unzoned trip simply carries no sun, because sunrise
    // and sunset in UTC would be the wrong clock for the place.
    expect(await readings(unzoned)).toEqual(
      withSun.map((day) =>
        day.status === 'ok' ? { status: 'ok', reading: day.reading } : day,
      ),
    )
    expect(withSun.some((day) => day.status === 'ok' && day.sun)).toBe(true)
  })

  it('is not-found for a private trip the caller is not on, before the runtime is built', async () => {
    const port = ports()

    await expect(
      loadTripWeather(outsider, { tripId, recorded: true }, port),
    ).rejects.toBeInstanceOf(NotFoundError)

    expect(port.weather).not.toHaveBeenCalled()
    expect(port.requested).toEqual([])
  })

  it('is not-found for another workspace’s trip', async () => {
    const port = ports()

    await expect(
      loadTripWeather(owner, { tripId: foreignTripId, recorded: true }, port),
    ).rejects.toBeInstanceOf(NotFoundError)

    expect(port.weather).not.toHaveBeenCalled()
  })

  it('resolves with unavailable days when the provider fails, rather than rejecting', async () => {
    const result = await loadTripWeather(
      owner,
      { tripId },
      ports({ failing: true }),
    )

    expect(result.days.map((day) => day.status)).toEqual([
      'unavailable',
      'unavailable',
      'unavailable',
    ])
  })

  it('does not ask a provider that has just failed again on the next load', async () => {
    const port = ports({ failing: true })

    await loadTripWeather(owner, { tripId }, port)
    const reload = await loadTripWeather(owner, { tripId }, port)

    expect(port.requested).toHaveLength(1)
    expect(reload.days.map((day) => day.status)).toEqual([
      'unavailable',
      'unavailable',
      'unavailable',
    ])
  })

  it('contains nothing but the day ids, the statuses, the readings and the unit', async () => {
    const result = await loadTripWeather(
      owner,
      { tripId, recorded: true },
      ports(),
    )

    const text = JSON.stringify(result)
    const hotelStayKeys = ['placeId', 'accommodation', 'userId', 'memberId']
    for (const key of hotelStayKeys) {
      expect(text).not.toContain(key)
    }
    expect(text).not.toContain('Hotel')
    expect(text).not.toContain('59.9139')
    expect(text).not.toContain('fetchedAt')
    expect(Object.keys(result).sort()).toEqual(['days', 'distanceUnit'])
  })

  describe('the days that are already over', () => {
    /** A trip that ended before the forecast window: 1 to 8 October, with "now" on the 8th. */
    async function pastTrip(): Promise<string> {
      const trip = await createTrip(owner, {
        title: 'Oslo, last week',
        startDate: '2026-10-01',
        endDate: '2026-10-08',
        currency: 'NOK',
        timezone: 'Europe/Oslo',
      })
      const days = await listTripDays(owner, trip.id)
      const hotel = await createPlace(owner, {
        tripId: trip.id,
        name: 'Hotel',
        lat: 59.9139,
        lng: 10.7522,
      })
      await createAccommodation(owner, {
        tripId: trip.id,
        startDayId: days[0].id,
        endDayId: days[days.length - 1].id,
        placeId: hotel.id,
        name: 'Hotel',
      })
      return trip.id
    }

    it('shows nothing for them to a caller that did not ask for them, as before', async () => {
      const past = await pastTrip()
      const port = ports()

      const result = await loadTripWeather(owner, { tripId: past }, port)

      expect(result.days.slice(0, 7).map((day) => day.status)).toEqual(
        Array.from({ length: 7 }, () => 'none'),
      )
      expect(port.requested.every((url) => !url.includes('nasa.gov'))).toBe(
        true,
      )
    })

    it('reads them as recorded when asked, and names the days inside the lag', async () => {
      const past = await pastTrip()
      const port = ports()

      const result = await loadTripWeather(
        owner,
        { tripId: past, recorded: true },
        port,
      )

      expect(result.days.map((day) => day.status)).toEqual([
        'ok',
        'ok',
        'ok',
        'ok',
        'ok',
        'not-yet-recorded',
        'not-yet-recorded',
        'ok',
      ])
      const first = result.days[0]
      if (first.status !== 'ok' || first.reading.kind !== 'recorded') {
        throw new Error('The first day is long enough ago to be recorded.')
      }
      expect(first.reading.source).toBe('nasa-power')
      expect(first.reading.tempMaxC).toBe(15.47)
    })

    it('sends only a rounded coordinate and a date range to the recorded provider', async () => {
      const past = await pastTrip()
      const port = ports()

      await loadTripWeather(owner, { tripId: past, recorded: true }, port)

      const sent = port.requested.filter((url) => url.includes('nasa.gov'))
      expect(sent).toHaveLength(1)
      const url = new URL(sent[0])
      expect(url.searchParams.get('latitude')).toBe('59.9')
      expect(url.searchParams.get('longitude')).toBe('10.8')
    })

    it('rejects a flag that is not a boolean', () => {
      expect(
        tripWeatherInputSchema.safeParse({ tripId, recorded: 'yes' }).success,
      ).toBe(false)
      expect(tripWeatherInputSchema.safeParse({ tripId }).success).toBe(true)
    })
  })
  describe('the days beyond the forecast', () => {
    /** A trip next summer: far past any forecast, so every day is an estimate when asked for. */
    async function farTrip(): Promise<string> {
      const trip = await createTrip(owner, {
        title: 'Oslo, next summer',
        startDate: '2027-06-20',
        endDate: '2027-06-22',
        currency: 'NOK',
        timezone: 'Europe/Oslo',
      })
      const days = await listTripDays(owner, trip.id)
      const hotel = await createPlace(owner, {
        tripId: trip.id,
        name: 'Hotel',
        lat: 59.9139,
        lng: 10.7522,
      })
      await createAccommodation(owner, {
        tripId: trip.id,
        startDayId: days[0].id,
        endDayId: days[days.length - 1].id,
        placeId: hotel.id,
        name: 'Hotel',
      })
      return trip.id
    }

    it('shows nothing for them to a caller that did not ask for them, as before', async () => {
      const far = await farTrip()
      const port = ports()

      const result = await loadTripWeather(owner, { tripId: far }, port)

      expect(result.days.map((day) => day.status)).toEqual([
        'none',
        'none',
        'none',
      ])
      expect(port.requested).toEqual([])
    })

    it('reads them as estimates when asked, from one climatology call', async () => {
      const far = await farTrip()
      const port = ports()

      const result = await loadTripWeather(
        owner,
        { tripId: far, estimate: true },
        port,
      )

      const readings = result.days.map((day) =>
        day.status === 'ok' ? day.reading : null,
      )
      expect(readings.map((reading) => reading?.kind)).toEqual([
        'estimate',
        'estimate',
        'estimate',
      ])
      expect(readings[0]).toMatchObject({
        source: 'nasa-power',
        tempMaxC: 29.67,
        tempMinC: 2.31,
        windMs: null,
      })
      expect(port.requested).toHaveLength(1)
      expect(port.requested[0]).toContain('/climatology/')
    })

    it('rejects a flag that is not a boolean', () => {
      expect(
        tripWeatherInputSchema.safeParse({ tripId, estimate: 'yes' }).success,
      ).toBe(false)
      expect(
        tripWeatherInputSchema.safeParse({ tripId, estimate: true }).success,
      ).toBe(true)
    })
  })
})
