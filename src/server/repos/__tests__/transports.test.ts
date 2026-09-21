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
import { createDay, createDayNote, deleteDay, listTripDays } from '../days'
import { createAssignment } from '../itinerary'
import { createPlace } from '../places'
import { TripRoleError, addTripMember, createTrip, updateTrip } from '../trips'
import {
  CHAIN_MAX_LEGS,
  createTransport,
  deleteTransport,
  getTransport,
  listDayTransports,
  listTransportLegs,
  listTripDayTransports,
  listTripLegs,
  listTripTransports,
  reorderDayTransports,
  replaceTransportChain,
  saveSearchedConnection,
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

/**
 * A day is one number line, and a journey's place on it.
 *
 * The writer that renumbers a day's stops and notes — `reorderDayTimeline` — belongs to another
 * module, so a journey cannot be inside that renumbering and expresses where it sits *between* two
 * of its positions instead, through the fractional key `sort_order` was declared to be. These cases
 * are about that arithmetic and about the three rules the payload is read under; the client half
 * that decides *which* gap a drag names is asserted in `-ui/__tests__/plan-transport-model.test.ts`.
 */
describe('a journey between the stops and notes of its day', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let days: Array<Day>

  /** A stop at an explicit stored position, so a case can name the day's numbering exactly. */
  async function stopAt(dayId: string, orderIndex: number): Promise<string> {
    const place = await createPlace(tenant.scope, {
      tripId,
      name: `Place ${orderIndex}`,
    })
    const assignment = await createAssignment(tenant.scope, {
      tripId,
      dayId,
      placeId: place.id,
      orderIndex,
    })
    return assignment.id
  }

  async function noteAt(dayId: string, sortOrder: number): Promise<string> {
    const note = await createDayNote(tenant.scope, {
      tripId,
      dayId,
      body: `Note ${sortOrder}`,
      sortOrder,
    })
    return note.id
  }

  async function journeyOn(
    dayId: string | null,
    extra: { readonly arrivalDayId?: string } = {},
  ): Promise<string> {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'The 14:05',
      mode: 'train',
      dayId,
      ...extra,
    })
    return created.id
  }

  async function sortOrderOf(transportId: string): Promise<number> {
    const row = await getTransport(tenant.scope, transportId)
    if (row === null) throw new Error('the journey went missing')
    return row.sortOrder
  }

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('number-line')
    const trip = await createTrip(tenant.scope, {
      title: 'Kansai run',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
      currency: 'JPY',
    })
    tripId = trip.id
    days = await listTripDays(tenant.scope, trip.id)
  })

  it('answers every journey of the trip, including a chained record that names no day', async () => {
    const chained = await journeyOn(null)
    await replaceTransportChain(tenant.scope, chained, {
      stations: [{ name: 'Shin-Osaka' }, { name: 'Nagoya' }, { name: 'Tokyo' }],
      legs: [{ departureDayId: days[0].id }, { departureDayId: days[1].id }],
    })
    const whole = await journeyOn(days[0].id)

    const { records, legs } = await listTripDayTransports(tenant.scope, tripId)

    // The record is returned even though it names no day: its legs carry the day
    // references, and the mode, the status and the title live only on the parent.
    expect(records.map((row) => row.id).sort()).toEqual([chained, whole].sort())
    expect(legs).toHaveLength(2)
    expect(legs.map((leg) => leg.position)).toEqual([0, 1])
  })

  it('places a journey strictly between the stored positions of its neighbours', async () => {
    const first = await stopAt(days[0].id, 0)
    const second = await stopAt(days[0].id, 1)
    const journey = await journeyOn(days[0].id)

    await reorderDayTransports(tenant.scope, {
      tripId,
      dayId: days[0].id,
      items: [
        { kind: 'stop', id: first },
        { kind: 'transport', id: journey },
        { kind: 'stop', id: second },
      ],
    })

    expect(await sortOrderOf(journey)).toBe(0.5)
  })

  it('takes an open end one unit wide, at either end and on an empty day', async () => {
    const only = await stopAt(days[0].id, 0)
    const ahead = await journeyOn(days[0].id)
    const behind = await journeyOn(days[0].id)

    await reorderDayTransports(tenant.scope, {
      tripId,
      dayId: days[0].id,
      items: [
        { kind: 'transport', id: ahead },
        { kind: 'stop', id: only },
        { kind: 'transport', id: behind },
      ],
    })

    expect(await sortOrderOf(ahead)).toBe(-0.5)
    expect(await sortOrderOf(behind)).toBe(0.5)

    const alone = await journeyOn(days[1].id)
    await reorderDayTransports(tenant.scope, {
      tripId,
      dayId: days[1].id,
      items: [{ kind: 'transport', id: alone }],
    })
    expect(await sortOrderOf(alone)).toBe(0.5)
  })

  it('splits one gap between two journeys, in the order the client sent', async () => {
    const first = await stopAt(days[0].id, 0)
    const second = await stopAt(days[0].id, 1)
    const early = await journeyOn(days[0].id)
    const late = await journeyOn(days[0].id)

    await reorderDayTransports(tenant.scope, {
      tripId,
      dayId: days[0].id,
      items: [
        { kind: 'stop', id: first },
        { kind: 'transport', id: late },
        { kind: 'transport', id: early },
        { kind: 'stop', id: second },
      ],
    })

    const lateOrder = await sortOrderOf(late)
    const earlyOrder = await sortOrderOf(early)
    expect(lateOrder).toBeCloseTo(1 / 3, 10)
    expect(earlyOrder).toBeCloseTo(2 / 3, 10)
    // Neither can collide with a stop, which is the property the gap split exists for.
    expect(lateOrder).toBeGreaterThan(0)
    expect(earlyOrder).toBeLessThan(1)
  })

  it('names the gap from stored positions, not from a count of entries', async () => {
    // The day `unschedulePlaceFn` leaves behind: stops at 0 and 2, with nothing at 1.
    const first = await stopAt(days[0].id, 0)
    const second = await stopAt(days[0].id, 2)
    const journey = await journeyOn(days[0].id)

    await reorderDayTransports(tenant.scope, {
      tripId,
      dayId: days[0].id,
      items: [
        { kind: 'stop', id: first },
        { kind: 'stop', id: second },
        { kind: 'transport', id: journey },
      ],
    })

    // An index formula would write 1.5 — ahead of the second stop it was dropped behind.
    expect(await sortOrderOf(journey)).toBe(2.5)
  })

  it('places a journey behind a stop scheduled at a midpoint', async () => {
    const first = await stopAt(days[0].id, 0)
    const middle = await stopAt(days[0].id, 0.5)
    const last = await stopAt(days[0].id, 1)
    const journey = await journeyOn(days[0].id)

    await reorderDayTransports(tenant.scope, {
      tripId,
      dayId: days[0].id,
      items: [
        { kind: 'stop', id: first },
        { kind: 'stop', id: middle },
        { kind: 'transport', id: journey },
        { kind: 'stop', id: last },
      ],
    })

    expect(await sortOrderOf(journey)).toBe(0.75)
  })

  it('counts a journey the payload omitted among the journeys sharing its gap', async () => {
    const first = await stopAt(days[0].id, 0)
    const second = await stopAt(days[0].id, 1)
    const omitted = await journeyOn(days[0].id)

    // Give the omitted one a stored place first, so the splice has something to follow.
    await reorderDayTransports(tenant.scope, {
      tripId,
      dayId: days[0].id,
      items: [
        { kind: 'stop', id: first },
        { kind: 'transport', id: omitted },
        { kind: 'stop', id: second },
      ],
    })
    expect(await sortOrderOf(omitted)).toBe(0.5)

    // A second journey arrives and is dragged in ahead of it, naming only itself.
    const named = await journeyOn(days[0].id)
    const written = await reorderDayTransports(tenant.scope, {
      tripId,
      dayId: days[0].id,
      items: [
        { kind: 'stop', id: first },
        { kind: 'transport', id: named },
        { kind: 'stop', id: second },
      ],
    })

    // Both are rewritten together, so the named one cannot land on the omitted one's value.
    expect(await sortOrderOf(named)).toBeCloseTo(1 / 3, 10)
    expect(await sortOrderOf(omitted)).toBeCloseTo(2 / 3, 10)
    // And what comes back is the day as written — the omitted journey included, in its place.
    expect(written).toEqual([
      { kind: 'transport', id: named },
      { kind: 'transport', id: omitted },
    ])
  })

  it('rebuilds a journey tied with a note after that note', async () => {
    const note = await noteAt(days[0].id, 0)
    const stop = await stopAt(days[0].id, 1)
    // `sortOrder` defaults to 0 — the value every journey on disk today holds.
    const journey = await journeyOn(days[0].id)

    await reorderDayTransports(tenant.scope, {
      tripId,
      dayId: days[0].id,
      // The client omits the journey entirely, so only the stored run decides.
      items: [
        { kind: 'note', id: note },
        { kind: 'stop', id: stop },
      ],
    })

    expect(await sortOrderOf(journey)).toBe(0.5)
  })

  it('writes nothing for a journey that only arrives on the day', async () => {
    const stop = await stopAt(days[1].id, 0)
    const journey = await journeyOn(days[0].id, { arrivalDayId: days[1].id })

    await reorderDayTransports(tenant.scope, {
      tripId,
      dayId: days[1].id,
      items: [
        { kind: 'stop', id: stop },
        { kind: 'transport', id: journey },
      ],
    })

    // Its `sort_order` belongs to day 1's ruler; day 2 measures against a different one.
    expect(await sortOrderOf(journey)).toBe(0)
  })

  it('drops an id the day does not hold, and moves nothing for it', async () => {
    const stop = await stopAt(days[0].id, 0)
    const elsewhere = await journeyOn(days[1].id)
    const here = await journeyOn(days[0].id)

    const written = await reorderDayTransports(tenant.scope, {
      tripId,
      dayId: days[0].id,
      items: [
        { kind: 'transport', id: elsewhere },
        { kind: 'stop', id: stop },
        { kind: 'transport', id: here },
      ],
    })

    expect(await sortOrderOf(elsewhere)).toBe(0)
    expect(await sortOrderOf(here)).toBe(0.5)
    // The dropped id is absent from what comes back, so nothing mirrors it to the room either.
    expect(written).toEqual([{ kind: 'transport', id: here }])
  })

  it('refuses a day belonging to another trip', async () => {
    const other = await createTrip(tenant.scope, { title: 'Osaka weekend' })
    const foreignDay = await createDay(tenant.scope, {
      tripId: other.id,
      dayNumber: 1,
    })

    expect(
      await captureError(() =>
        reorderDayTransports(tenant.scope, {
          tripId,
          dayId: foreignDay.id,
          items: [],
        }),
      ),
    ).toBeInstanceOf(NotFoundError)
  })

  it('leaves a record of this day out of the run when it is drawn as its legs', async () => {
    // The record keeps the `day_id` it was created with — `replaceTransportChain` does not clear
    // it — and a journey drawn as its legs is never also drawn whole. Neither leg departs from
    // this day, so nothing in the day's own rows says the record is chained: the read has to ask.
    const chained = await journeyOn(days[0].id)
    await replaceTransportChain(tenant.scope, chained, {
      stations: [{ name: 'Kyoto' }, { name: 'Nagoya' }, { name: 'Tokyo' }],
      legs: [{ departureDayId: days[1].id }, { departureDayId: days[2].id }],
    })
    const stop = await stopAt(days[0].id, 0)
    const whole = await journeyOn(days[0].id)

    const written = await reorderDayTransports(tenant.scope, {
      tripId,
      dayId: days[0].id,
      items: [
        { kind: 'stop', id: stop },
        { kind: 'transport', id: whole },
      ],
    })

    // Placed, it would be written a fraction and mirrored to the room as a row no board draws.
    expect(written).toEqual([{ kind: 'transport', id: whole }])
    expect(await sortOrderOf(chained)).toBe(0)
    expect(await sortOrderOf(whole)).toBe(0.5)
  })

  it('keeps a leg on its day when the chain is rewritten around it', async () => {
    const chained = await journeyOn(null)
    await replaceTransportChain(tenant.scope, chained, {
      stations: [{ name: 'Kyoto' }, { name: 'Nagoya' }, { name: 'Tokyo' }],
      legs: [{ departureDayId: days[0].id }, { departureDayId: days[1].id }],
    })

    const stop = await stopAt(days[0].id, 0)
    const [firstLeg] = await listTransportLegs(tenant.scope, chained)
    await reorderDayTransports(tenant.scope, {
      tripId,
      dayId: days[0].id,
      items: [
        { kind: 'stop', id: stop },
        { kind: 'leg', id: firstLeg.id },
      ],
    })
    const placed = (await listTransportLegs(tenant.scope, chained))[0].sortOrder
    expect(placed).toBe(0.5)

    // A service number is renamed: without the carry-forward this leg would go to
    // the head of its day, because the chain writer would hand it its chain index.
    await replaceTransportChain(tenant.scope, chained, {
      stations: [{ name: 'Kyoto' }, { name: 'Nagoya' }, { name: 'Tokyo' }],
      legs: [
        { departureDayId: days[0].id, serviceNumber: 'Hikari 501' },
        { departureDayId: days[1].id },
      ],
    })
    const after = await listTransportLegs(tenant.scope, chained)
    expect(after[0].sortOrder).toBe(placed)
    expect(after[0].serviceNumber).toBe('Hikari 501')
  })

  it('hands a leg its chain index when it now departs from another day, and lets an explicit value win', async () => {
    const chained = await journeyOn(null)
    await replaceTransportChain(tenant.scope, chained, {
      stations: [{ name: 'Kyoto' }, { name: 'Tokyo' }],
      legs: [{ departureDayId: days[0].id, sortOrder: 4.25 }],
    })
    expect((await listTransportLegs(tenant.scope, chained))[0].sortOrder).toBe(
      4.25,
    )

    // The day changed, so the fraction was measured against a ruler this leg has left.
    await replaceTransportChain(tenant.scope, chained, {
      stations: [{ name: 'Kyoto' }, { name: 'Tokyo' }],
      legs: [{ departureDayId: days[2].id }],
    })
    expect((await listTransportLegs(tenant.scope, chained))[0].sortOrder).toBe(
      0,
    )

    // And an explicit value always wins over the carry-forward.
    await replaceTransportChain(tenant.scope, chained, {
      stations: [{ name: 'Kyoto' }, { name: 'Tokyo' }],
      legs: [{ departureDayId: days[2].id, sortOrder: 9.5 }],
    })
    expect((await listTransportLegs(tenant.scope, chained))[0].sortOrder).toBe(
      9.5,
    )
  })
})

/**
 * What the day's read costs, measured the only way that means anything: the query plan.
 *
 * A `WHERE` clause that names the day proves nothing on its own. `tenantFilter()` puts
 * `organization_id` in every statement this layer sends, and with no `sqlite_stat1` — nothing in
 * this repository runs `ANALYZE` — SQLite picks the index that can match the most equality terms.
 * A bare `(day_id)` index therefore loses to `(organization_id, trip_id)`, and a read written as
 * one day's is answered by walking the whole trip's rows. D1 bills rows read, not rows returned,
 * so that difference is the entire point of reading the day rather than the trip.
 *
 * Built from `drizzle/*.sql` rather than from `schema.ts`, because the subject is which indexes
 * exist on the database D1 is actually running.
 */
describe('the plan behind one day’s journey read', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let days: Array<Day>

  beforeEach(async () => {
    harness = await createHarness({ ddl: 'migrations' })
    tenant = await harness.seedTenant('query-plan')
    const trip = await createTrip(tenant.scope, {
      title: 'Kansai run',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
    })
    tripId = trip.id
    days = await listTripDays(tenant.scope, trip.id)
  })

  it('seeks an index for every row it reads, and scans nothing', async () => {
    const chained = await createTransport(tenant.scope, {
      tripId,
      title: 'The 14:05',
      mode: 'train',
      dayId: days[0].id,
    })
    await replaceTransportChain(tenant.scope, chained.id, {
      stations: [{ name: 'Kyoto' }, { name: 'Tokyo' }],
      legs: [{ departureDayId: days[1].id }],
    })

    harness.statements.length = 0
    await reorderDayTransports(tenant.scope, {
      tripId,
      dayId: days[0].id,
      items: [],
    })

    // The three reads the day costs, by the table each one drives on.
    const reads = harness.statements.filter(
      (sql) =>
        sql.startsWith('select') &&
        (sql.includes('from "transports" where') ||
          sql.includes('from "transport_legs" where')),
    )
    expect(reads).toHaveLength(3)

    for (const sql of reads) {
      const statement = harness.sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`)
      statement.setReturnArrays(true)
      const plan = (statement.all() as unknown as Array<Array<unknown>>)
        .map((row) => String(row[3]))
        .join('\n')

      // Never a scan, and never the trip-wide index: those are the two shapes that read every
      // journey of the trip to place one day of it.
      expect(plan, sql).not.toMatch(/\bSCAN\b/)
      expect(plan, sql).toContain('USING INDEX')
      expect(plan, sql).not.toContain(
        'transports_org_trip_idx (organization_id=? AND trip_id=?)',
      )
      expect(plan, sql).not.toContain(
        'transport_legs_org_trip_idx (organization_id=? AND trip_id=?)',
      )
    }
  })
})

/**
 * Deleting the day a journey lands on, on the database D1 is actually running (#186).
 *
 * `{ ddl: 'migrations' }` is the whole test. `schema.ts` declares `transports.arrival_day_id` as
 * `on delete: 'set null'`, so a schema-built database unlinks the transport by itself and these
 * pass whatever the day deleters do. What ships is the `NO ACTION` an `ADD COLUMN` leaves behind,
 * where the delete fails unless the column was cleared first.
 */
describe('a day deleted under a transport that arrives on it', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let days: Array<Day>

  beforeEach(async () => {
    harness = await createHarness({ ddl: 'migrations' })
    tenant = await harness.seedTenant('arrival-day-delete')
    const trip = await createTrip(tenant.scope, {
      title: 'Night flight',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
    })
    tripId = trip.id
    days = await listTripDays(tenant.scope, trip.id)
  })

  async function overnight(): Promise<string> {
    const transport = await createTransport(tenant.scope, {
      tripId,
      title: 'NH 10',
      mode: 'flight',
      dayId: days[2].id,
      arrivalDayId: days[3].id,
    })
    return transport.id
  }

  it('unlinks the arrival day when that day is deleted', async () => {
    const transportId = await overnight()

    await deleteDay(tenant.scope, days[3].id)

    const survivor = await getTransport(tenant.scope, transportId)
    expect(survivor?.arrivalDayId).toBeNull()
    expect(survivor?.dayId).toBe(days[2].id)
  })

  it('unlinks the arrival day when the trip’s range drops it', async () => {
    const transportId = await overnight()

    await updateTrip(tenant.scope, tripId, { endDate: '2026-04-12' })

    expect(await listTripDays(tenant.scope, tripId)).toHaveLength(3)
    const survivor = await getTransport(tenant.scope, transportId)
    expect(survivor?.arrivalDayId).toBeNull()
    expect(survivor?.dayId).toBe(days[2].id)
  })
})

/**
 * The ordering rule at the one place every writer passes through.
 *
 * The rule is `arrivesBeforeDeparts` (`#/lib/transport-timing`), the same function the dialog
 * asks: real instants when both ends name a zone, wall clocks otherwise. Each writer is asked
 * twice - once with a journey that really lands before it leaves, once with the westbound flight
 * whose wall clocks only *look* backwards - because a check that refuses both is as wrong as one
 * that refuses neither.
 */
describe('a journey that arrives before it departs', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string

  const TOKYO = { name: 'Narita', code: 'NRT', timezone: 'Asia/Tokyo' }
  const HONOLULU = {
    name: 'Honolulu',
    code: 'HNL',
    timezone: 'Pacific/Honolulu',
  }
  const LONDON = { name: 'Heathrow', code: 'LHR', timezone: 'Europe/London' }
  const NEW_YORK = { name: 'JFK', code: 'JFK', timezone: 'America/New_York' }

  /** 21:00 in Tokyo is 12:00Z, 09:00 in Honolulu is 19:00Z: seven hours in the air. */
  const WESTBOUND = {
    departureDate: '2026-04-16',
    departureTime: '21:00',
    arrivalDate: '2026-04-16',
    arrivalTime: '09:00',
  }
  /** 09:00 in London is 08:00Z, 03:00 in New York is 07:00Z: it really does land first. */
  const INVERTED = {
    departureDate: '2026-04-16',
    departureTime: '09:00',
    arrivalDate: '2026-04-16',
    arrivalTime: '03:00',
  }

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('timing')
    const trip = await createTrip(tenant.scope, {
      title: 'Pacific crossing',
      startDate: '2026-04-15',
      endDate: '2026-04-18',
      currency: 'USD',
    })
    tripId = trip.id
  })

  async function expectTimeOrder(write: () => Promise<unknown>) {
    const error = await captureError(write)
    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).code).toBe('TIME_ORDER')
  }

  it('refuses to create a zoned journey that lands first, and writes nothing', async () => {
    await expectTimeOrder(() =>
      createTransport(tenant.scope, {
        tripId,
        title: 'BA 117',
        mode: 'flight',
        ...INVERTED,
        departureTimezone: LONDON.timezone,
        arrivalTimezone: NEW_YORK.timezone,
      }),
    )
    expect(await listTripTransports(tenant.scope, tripId)).toEqual([])
  })

  it('creates the westbound journey its zones put in order', async () => {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'NH 184',
      mode: 'flight',
      ...WESTBOUND,
      departureTimezone: TOKYO.timezone,
      arrivalTimezone: HONOLULU.timezone,
    })
    expect(created.arrivalTime).toBe('09:00')
  })

  it('judges a journey with no zones by its wall clocks, as before', async () => {
    await expectTimeOrder(() =>
      createTransport(tenant.scope, {
        tripId,
        title: 'Typed by hand',
        mode: 'flight',
        ...WESTBOUND,
      }),
    )
  })

  it('reads a missing arrival time as the end of the day', async () => {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'Evening ferry',
      mode: 'ferry',
      departureDate: '2026-04-16',
      departureTime: '18:00',
      arrivalDate: '2026-04-16',
    })
    expect(created.arrivalTime).toBeNull()
  })

  /**
   * On the row that results, not on the fields that arrived: the flat form sends clocks and no
   * zones, so the zones are the ones already stored, and moving one end alone is ordered against
   * the end already there.
   */
  it('orders an update against the zones and clocks already stored', async () => {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'NH 184',
      mode: 'flight',
      departureTimezone: TOKYO.timezone,
      arrivalTimezone: HONOLULU.timezone,
    })

    const updated = await updateTransport(tenant.scope, created.id, WESTBOUND)
    expect(updated.departureTime).toBe('21:00')

    await expectTimeOrder(() =>
      updateTransport(tenant.scope, created.id, { arrivalDate: '2026-04-15' }),
    )
    expect((await getTransport(tenant.scope, created.id))?.arrivalDate).toBe(
      '2026-04-16',
    )
  })

  /**
   * The dialog's edit of a chain whose outer stations change: the record is written before the
   * chain, so the patch carries the new zones, and the clocks are judged in them, not in the
   * zones the chain is about to replace.
   */
  it('orders an update in the zones it sends, not the ones it replaces', async () => {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'Reversed',
      mode: 'flight',
      departureTimezone: HONOLULU.timezone,
      arrivalTimezone: TOKYO.timezone,
    })

    const updated = await updateTransport(tenant.scope, created.id, {
      ...WESTBOUND,
      departureTimezone: TOKYO.timezone,
      arrivalTimezone: HONOLULU.timezone,
    })
    expect(updated.departureTimezone).toBe(TOKYO.timezone)

    await expectTimeOrder(() =>
      updateTransport(tenant.scope, created.id, {
        ...INVERTED,
        departureTimezone: LONDON.timezone,
        arrivalTimezone: NEW_YORK.timezone,
      }),
    )
  })

  it('refuses a chain with a leg that lands first, and leaves the chain as it was', async () => {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'Round the world',
      mode: 'flight',
    })

    await expectTimeOrder(() =>
      replaceTransportChain(tenant.scope, created.id, {
        stations: [TOKYO, HONOLULU, LONDON, NEW_YORK],
        legs: [WESTBOUND, {}, INVERTED],
      }),
    )
    expect(await listTransportLegs(tenant.scope, created.id)).toEqual([])
  })

  it('writes a chain whose westbound leg lands on an earlier clock', async () => {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'NH 184',
      mode: 'flight',
    })

    const legs = await replaceTransportChain(tenant.scope, created.id, {
      stations: [TOKYO, HONOLULU],
      legs: [WESTBOUND],
    })
    expect(legs).toHaveLength(1)
  })

  it('refuses a found connection with a leg that lands first, and creates no record', async () => {
    await expectTimeOrder(() =>
      saveSearchedConnection(tenant.scope, {
        tripId,
        mode: 'flight',
        title: 'Tokyo to New York',
        stations: [TOKYO, LONDON, NEW_YORK],
        legs: [{}, INVERTED],
      }),
    )
    expect(await listTripTransports(tenant.scope, tripId)).toEqual([])
  })

  it('saves the westbound connection a search found', async () => {
    const saved = await saveSearchedConnection(tenant.scope, {
      tripId,
      mode: 'flight',
      title: 'Tokyo to Honolulu',
      stations: [TOKYO, HONOLULU],
      legs: [WESTBOUND],
    })
    expect(saved.legs).toHaveLength(1)
    expect(saved.transport.arrivalTime).toBe('09:00')
  })
})
