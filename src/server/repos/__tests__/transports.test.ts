/**
 * The two day references a transport is anchored to, at the repository seam.
 *
 * A journey leaves on one day and lands on another; neither is derived from the
 * other, and both are references into *this* trip's day run. That makes three
 * rules the repository owns rather than the form: a day of another trip is not a
 * day of this one, an arrival day before the departure day is refused, and a
 * transport with no day at all is a legal row — an idea has no day.
 *
 * A new file rather than a block appended to `repositories.test.ts`: this stage
 * owns `repos/transports.ts` and no shared repository test file except
 * `tenant-isolation.test.ts`, whose subject is the tenant boundary and not the
 * ordering of two days inside one trip. Cross-tenant day parenting is asserted
 * there, in this stage's own block, and deliberately not repeated here.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError, RepositoryError } from '../context'
import { createDay, listTripDays } from '../days'
import { addTripMember, createTrip } from '../trips'
import {
  CHAIN_MAX_LEGS,
  TripRoleError,
  createTransport,
  deleteTransport,
  getTransport,
  listDayTransports,
  listTransportLegs,
  listTripLegs,
  replaceTransportChain,
  setTransportStatus,
  updateTransport,
} from '../transports'
import { captureError, createHarness } from './harness'
import type { Day } from '#/server/db/types'
import type { Harness, SeededTenant } from './harness'

describe('a transport and the days it covers', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let days: Array<Day>

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('solo')
    const trip = await createTrip(tenant.scope, {
      title: 'Tokyo overnight',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
      currency: 'JPY',
    })
    tripId = trip.id
    days = await listTripDays(tenant.scope, trip.id)
  })

  it('anchors a night flight to the day it leaves and the day it lands', async () => {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'Overnight to Haneda',
      mode: 'flight',
      dayId: days[0].id,
      arrivalDayId: days[1].id,
      departureDate: '2026-04-10',
      departureTime: '23:40',
      arrivalDate: '2026-04-11',
      arrivalTime: '06:15',
    })

    expect(created.dayId).toBe(days[0].id)
    expect(created.arrivalDayId).toBe(days[1].id)

    const read = await getTransport(tenant.scope, created.id)
    expect(read?.arrivalDayId).toBe(days[1].id)
  })

  it('keeps a draft with no day at all, because an idea has no day', async () => {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'Maybe the ferry',
      mode: 'ferry',
    })

    expect(created.dayId).toBeNull()
    expect(created.arrivalDayId).toBeNull()
  })

  it('lets both ends sit on the same day', async () => {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'Airport train',
      mode: 'train',
      dayId: days[1].id,
      arrivalDayId: days[1].id,
    })

    expect(created.arrivalDayId).toBe(days[1].id)
  })

  it('refuses an arrival day that precedes the departure day', async () => {
    const error = await captureError(() =>
      createTransport(tenant.scope, {
        tripId,
        title: 'Backwards flight',
        mode: 'flight',
        dayId: days[2].id,
        arrivalDayId: days[0].id,
      }),
    )

    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).code).toBe('DAY_ORDER')
    expect(await listDayTransports(tenant.scope, days[2].id)).toEqual([])
  })

  /**
   * The rule is on the row that results, not on the fields that arrived: moving
   * only the arrival day has to be ordered against the departure day already
   * stored, or a two-step edit walks straight past the guard.
   */
  it('refuses a move that would leave the stored row out of order', async () => {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'Overnight to Haneda',
      mode: 'flight',
      dayId: days[2].id,
      arrivalDayId: days[3].id,
    })

    const error = await captureError(() =>
      updateTransport(tenant.scope, created.id, { arrivalDayId: days[0].id }),
    )
    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).code).toBe('DAY_ORDER')

    const unchanged = await getTransport(tenant.scope, created.id)
    expect(unchanged?.arrivalDayId).toBe(days[3].id)
  })

  it('lets either day be cleared back to nothing', async () => {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'Overnight to Haneda',
      mode: 'flight',
      dayId: days[0].id,
      arrivalDayId: days[1].id,
    })

    const cleared = await updateTransport(tenant.scope, created.id, {
      arrivalDayId: null,
    })
    expect(cleared.arrivalDayId).toBeNull()
    expect(cleared.dayId).toBe(days[0].id)

    // With the arrival day gone the departure day can move anywhere, including
    // past where the arrival day used to be.
    const moved = await updateTransport(tenant.scope, created.id, {
      dayId: days[3].id,
    })
    expect(moved.dayId).toBe(days[3].id)
  })

  it('refuses a day belonging to another trip of the same tenant', async () => {
    const other = await createTrip(tenant.scope, { title: 'Osaka weekend' })
    const foreignDay = await createDay(tenant.scope, {
      tripId: other.id,
      dayNumber: 1,
    })

    expect(
      await captureError(() =>
        createTransport(tenant.scope, {
          tripId,
          title: 'Cross-trip flight',
          mode: 'flight',
          arrivalDayId: foreignDay.id,
        }),
      ),
    ).toBeInstanceOf(NotFoundError)

    const own = await createTransport(tenant.scope, {
      tripId,
      title: 'Own flight',
      mode: 'flight',
      dayId: days[0].id,
    })
    expect(
      await captureError(() =>
        updateTransport(tenant.scope, own.id, { arrivalDayId: foreignDay.id }),
      ),
    ).toBeInstanceOf(NotFoundError)

    const unchanged = await getTransport(tenant.scope, own.id)
    expect(unchanged?.arrivalDayId).toBeNull()
  })
})

/**
 * The station chain: N stations, N−1 legs, and the two rules that make a chain a
 * journey rather than a bag of rows.
 *
 * Appended to this file rather than given one of its own for the reason `03-S1`
 * gave when it minted it: the subject is `repos/transports.ts`, which this stage
 * owns, and the only shared repository test file it owns is
 * `tenant-isolation.test.ts`, whose subject is the tenant boundary. Cross-tenant
 * leg parenting is asserted there and deliberately not repeated here.
 */
describe('a journey with more than two stations', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let days: Array<Day>
  let transportId: string

  const OSAKA = { name: 'Shin-Osaka', code: 'OSA', timezone: 'Asia/Tokyo' }
  const NAGOYA = { name: 'Nagoya', code: 'NGO', timezone: 'Asia/Tokyo' }
  const TOKYO = { name: 'Tokyo', code: 'TYO', timezone: 'Asia/Tokyo' }

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('chain')
    const trip = await createTrip(tenant.scope, {
      title: 'Sanyo line',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
      currency: 'JPY',
    })
    tripId = trip.id
    days = await listTripDays(tenant.scope, trip.id)
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'Osaka to Tokyo',
      mode: 'train',
      dayId: days[0].id,
    })
    transportId = created.id
  })

  it('reads as a one-leg chain built from the record while it has no rows', async () => {
    expect(await listTransportLegs(tenant.scope, transportId)).toEqual([])
    expect(await listTripLegs(tenant.scope, tripId)).toEqual([])
  })

  it('writes exactly N−1 legs for N stations, in chain order', async () => {
    const legs = await replaceTransportChain(tenant.scope, transportId, {
      stations: [OSAKA, NAGOYA, TOKYO],
      legs: [
        { serviceNumber: 'Hikari 500', departureTime: '09:00' },
        { serviceNumber: 'Nozomi 24', departureTime: '10:10' },
      ],
    })

    expect(legs).toHaveLength(2)
    expect(legs.map((leg) => leg.position)).toEqual([0, 1])
    expect(legs.map((leg) => [leg.fromName, leg.toName])).toEqual([
      ['Shin-Osaka', 'Nagoya'],
      ['Nagoya', 'Tokyo'],
    ])
    expect(legs[0].serviceNumber).toBe('Hikari 500')
    expect(legs[1].departureTime).toBe('10:10')
  })

  /**
   * The join is structural: the middle station is written once and read into two
   * rows, so leg 0's arrival endpoint and leg 1's departure endpoint cannot
   * disagree about which station they name.
   */
  it('writes the shared station into both rows that meet at it', async () => {
    const legs = await replaceTransportChain(tenant.scope, transportId, {
      stations: [OSAKA, NAGOYA, TOKYO],
      legs: [{}, {}],
    })

    expect(legs[0].toName).toBe(legs[1].fromName)
    expect(legs[0].toCode).toBe(legs[1].fromCode)
    expect(legs[0].toTimezone).toBe(legs[1].fromTimezone)
  })

  /** The two representations cannot disagree, so the record is rewritten too. */
  it('rewrites the record’s own endpoints from the outer two stations', async () => {
    await replaceTransportChain(tenant.scope, transportId, {
      stations: [OSAKA, NAGOYA, TOKYO],
      legs: [{ departureTime: '09:00' }, { arrivalTime: '12:40' }],
    })

    const record = await getTransport(tenant.scope, transportId)
    expect(record?.departureName).toBe('Shin-Osaka')
    expect(record?.departureCode).toBe('OSA')
    expect(record?.departureTime).toBe('09:00')
    expect(record?.arrivalName).toBe('Tokyo')
    expect(record?.arrivalCode).toBe('TYO')
    expect(record?.arrivalTime).toBe('12:40')
    expect(record?.arrivalTimezone).toBe('Asia/Tokyo')
  })

  it('replaces rather than appends, leaving no orphan from the previous chain', async () => {
    await replaceTransportChain(tenant.scope, transportId, {
      stations: [OSAKA, NAGOYA, TOKYO],
      legs: [{}, {}],
    })
    const legs = await replaceTransportChain(tenant.scope, transportId, {
      stations: [OSAKA, TOKYO],
      legs: [{}],
    })

    expect(legs).toHaveLength(1)
    expect(await listTransportLegs(tenant.scope, transportId)).toHaveLength(1)
  })

  it('clears the chain when handed no stations, and leaves the record standing', async () => {
    await replaceTransportChain(tenant.scope, transportId, {
      stations: [OSAKA, NAGOYA, TOKYO],
      legs: [{}, {}],
    })

    expect(
      await replaceTransportChain(tenant.scope, transportId, {
        stations: [],
        legs: [],
      }),
    ).toEqual([])
    expect(await getTransport(tenant.scope, transportId)).not.toBeNull()
  })

  it('refuses a chain that does not describe a journey', async () => {
    for (const input of [
      { stations: [OSAKA, NAGOYA, TOKYO], legs: [{}] },
      { stations: [OSAKA], legs: [] },
      { stations: [OSAKA, NAGOYA], legs: [{}, {}] },
    ]) {
      expect(
        await captureError(() =>
          replaceTransportChain(tenant.scope, transportId, input),
        ),
      ).not.toBeNull()
    }
    expect(await listTransportLegs(tenant.scope, transportId)).toEqual([])
  })

  /**
   * The cap is a bound on the validated array — a payload limit — and not a
   * statement about how many changes a journey may have.
   */
  it('accepts a chain at the cap and refuses the one past it', async () => {
    const stations = Array.from({ length: CHAIN_MAX_LEGS + 1 }, (_, index) => ({
      name: `Stop ${index}`,
    }))
    const legs = Array.from({ length: CHAIN_MAX_LEGS }, () => ({}))

    expect(
      await replaceTransportChain(tenant.scope, transportId, {
        stations,
        legs,
      }),
    ).toHaveLength(CHAIN_MAX_LEGS)

    expect(
      await captureError(() =>
        replaceTransportChain(tenant.scope, transportId, {
          stations: [...stations, { name: 'One too many' }],
          legs: [...legs, {}],
        }),
      ),
    ).not.toBeNull()
    expect(await listTransportLegs(tenant.scope, transportId)).toHaveLength(
      CHAIN_MAX_LEGS,
    )
  })

  it('resolves every day reference against the parent’s own trip', async () => {
    const other = await createTrip(tenant.scope, { title: 'Kyushu' })
    const foreignDay = await createDay(tenant.scope, {
      tripId: other.id,
      dayNumber: 1,
    })

    expect(
      await captureError(() =>
        replaceTransportChain(tenant.scope, transportId, {
          stations: [OSAKA, TOKYO],
          legs: [{ departureDayId: foreignDay.id }],
        }),
      ),
    ).toBeInstanceOf(NotFoundError)
    expect(await listTransportLegs(tenant.scope, transportId)).toEqual([])
  })

  it('refuses a leg that lands on a day before the one it left on', async () => {
    const error = await captureError(() =>
      replaceTransportChain(tenant.scope, transportId, {
        stations: [OSAKA, TOKYO],
        legs: [{ departureDayId: days[2].id, arrivalDayId: days[0].id }],
      }),
    )

    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).code).toBe('DAY_ORDER')
  })

  it('keeps a night leg that lands on the day after', async () => {
    const legs = await replaceTransportChain(tenant.scope, transportId, {
      stations: [OSAKA, TOKYO],
      legs: [
        {
          departureDayId: days[0].id,
          arrivalDayId: days[1].id,
          departureTime: '23:40',
          arrivalTime: '06:15',
        },
      ],
    })

    expect(legs[0].departureDayId).toBe(days[0].id)
    expect(legs[0].arrivalDayId).toBe(days[1].id)
  })

  it('lists every leg of the trip, across transports, in chain order', async () => {
    const second = await createTransport(tenant.scope, {
      tripId,
      title: 'Ferry to Shikoku',
      mode: 'ferry',
    })
    await replaceTransportChain(tenant.scope, transportId, {
      stations: [OSAKA, NAGOYA, TOKYO],
      legs: [{}, {}],
    })
    await replaceTransportChain(tenant.scope, second.id, {
      stations: [{ name: 'Kobe' }, { name: 'Takamatsu' }],
      legs: [{}],
    })

    const all = await listTripLegs(tenant.scope, tripId)
    expect(all).toHaveLength(3)
    expect(new Set(all.map((leg) => leg.transportId))).toEqual(
      new Set([transportId, second.id]),
    )
  })

  /**
   * The guard has to discriminate rather than merely to throw, so it is asserted
   * in both directions on the *same* trip: membership is not a role, and a viewer
   * writing here is exactly what the collaborative session already refuses
   * (`src/server/do/trip-room.ts:358`).
   */
  it('refuses a viewer and admits an editor on the same trip', async () => {
    const viewerId = await tenant.addUser('A viewer')
    const editorId = await tenant.addUser('An editor')
    await addTripMember(tenant.scope, {
      tripId,
      userId: viewerId,
      role: 'viewer',
    })
    await addTripMember(tenant.scope, {
      tripId,
      userId: editorId,
      role: 'editor',
    })

    const refused = await captureError(() =>
      replaceTransportChain(tenant.scopeFor(viewerId), transportId, {
        stations: [OSAKA, TOKYO],
        legs: [{}],
      }),
    )
    expect(refused).toBeInstanceOf(TripRoleError)
    expect(await listTransportLegs(tenant.scope, transportId)).toEqual([])

    expect(
      await replaceTransportChain(tenant.scopeFor(editorId), transportId, {
        stations: [OSAKA, TOKYO],
        legs: [{}],
      }),
    ).toHaveLength(1)
  })

  it('refuses every other write to a viewer, and lets them read', async () => {
    const viewerId = await tenant.addUser('A viewer')
    await addTripMember(tenant.scope, {
      tripId,
      userId: viewerId,
      role: 'viewer',
    })
    const viewer = tenant.scopeFor(viewerId)

    for (const attempt of [
      () =>
        createTransport(viewer, { tripId, title: 'Sneaked in', mode: 'bus' }),
      () => updateTransport(viewer, transportId, { title: 'Renamed' }),
      () => setTransportStatus(viewer, transportId, 'cancelled'),
      () => deleteTransport(viewer, transportId),
    ]) {
      expect(await captureError(attempt)).toBeInstanceOf(TripRoleError)
    }

    expect((await getTransport(viewer, transportId))?.title).toBe(
      'Osaka to Tokyo',
    )
  })
})
