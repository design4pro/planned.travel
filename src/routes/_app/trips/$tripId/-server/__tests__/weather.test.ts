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

const { loadTripWeather } = await import('../weather')

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
    if (first.status !== 'ok') {
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
    if (today.status !== 'ok' || tomorrow.status !== 'ok') {
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
    expect(first.status === 'ok' && first.reading.tempMaxC).toBeLessThan(30)
  })

  it('groups a trip with no time zone in UTC, whatever zone the reader is in', async () => {
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

    expect(await readings(unzoned)).toEqual(await readings(utc))
  })

  it('is not-found for a private trip the caller is not on, before the runtime is built', async () => {
    const port = ports()

    await expect(
      loadTripWeather(outsider, { tripId }, port),
    ).rejects.toBeInstanceOf(NotFoundError)

    expect(port.weather).not.toHaveBeenCalled()
    expect(port.requested).toEqual([])
  })

  it('is not-found for another workspace’s trip', async () => {
    const port = ports()

    await expect(
      loadTripWeather(owner, { tripId: foreignTripId }, port),
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

  it('contains nothing but the day ids, the statuses, the readings and the unit', async () => {
    const result = await loadTripWeather(owner, { tripId }, ports())

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
})
