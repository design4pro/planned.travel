/**
 * A day's reorder is one write, journeys included (#239).
 *
 * `reorderDayTimelines` owns the day's number line, so one call renumbers the stops and notes
 * `0..n-1` and re-places the day's journeys against that new numbering, in the same batch. What
 * is asserted here is the part the two-call design could not promise: the journey values come
 * from the numbering the same write produces, and a failure anywhere leaves all four position
 * columns as they were.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { RepositoryError } from '../context'
import { createDayNote, listDayNotes, listTripDays } from '../days'
import {
  createAssignment,
  listDayAssignments,
  reorderDayTimelines,
} from '../itinerary'
import { createPlace } from '../places'
import { addTripMember, createTrip } from '../trips'
import {
  createTransport,
  listTransportLegs,
  replaceTransportChain,
} from '../transports'
import { captureError, createHarness } from './harness'
import type { Day } from '#/server/db/types'
import type { Harness, SeededTenant } from './harness'

describe('a day reordered in one write', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let days: Array<Day>

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

  async function journeyOn(dayId: string): Promise<string> {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'The 14:05',
      mode: 'train',
      dayId,
    })
    return created.id
  }

  /** The four position columns of the trip, read back as one comparable snapshot. */
  async function positions(): Promise<Record<string, number>> {
    const snapshot: Record<string, number> = {}
    for (const day of days) {
      for (const row of await listDayAssignments(tenant.scope, day.id)) {
        snapshot[`stop/${row.id}`] = row.orderIndex
      }
      for (const row of await listDayNotes(tenant.scope, day.id)) {
        snapshot[`note/${row.id}`] = row.sortOrder
      }
    }
    const statement = harness.sqlite.prepare(
      'select id, sort_order from transports',
    )
    for (const row of statement.all() as Array<{
      id: string
      sort_order: number
    }>) {
      snapshot[`transport/${row.id}`] = row.sort_order
    }
    const legs = harness.sqlite.prepare(
      'select id, sort_order from transport_legs',
    )
    for (const row of legs.all() as Array<{ id: string; sort_order: number }>) {
      snapshot[`leg/${row.id}`] = row.sort_order
    }
    return snapshot
  }

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('one-write')
    const trip = await createTrip(tenant.scope, {
      title: 'Kansai run',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
      currency: 'JPY',
    })
    tripId = trip.id
    days = await listTripDays(tenant.scope, trip.id)
  })

  it('renumbers the stops and notes and re-places the journeys from that numbering', async () => {
    const dayId = days[0].id
    // Stored on a numbering that has drifted: fractions from a mid-list insert, and a journey
    // measured against the old gaps.
    const first = await stopAt(dayId, 0)
    const second = await stopAt(dayId, 2.5)
    const note = await noteAt(dayId, 7)
    const journey = await journeyOn(dayId)
    harness.sqlite
      .prepare('update transports set sort_order = 1.25 where id = ?')
      .run(journey)

    const chained = await createTransport(tenant.scope, {
      tripId,
      title: 'The Hikari',
      mode: 'train',
    })
    await replaceTransportChain(tenant.scope, chained.id, {
      stations: [{ name: 'Kyoto' }, { name: 'Nagoya' }, { name: 'Tokyo' }],
      legs: [{ departureDayId: dayId }, { departureDayId: days[1].id }],
    })
    const [leg] = await listTransportLegs(tenant.scope, chained.id)

    const written = await reorderDayTimelines(tenant.scope, {
      tripId,
      days: [
        {
          dayId,
          items: [
            { kind: 'transport', id: journey },
            { kind: 'stop', id: second },
            { kind: 'note', id: note },
            { kind: 'leg', id: leg.id },
            { kind: 'stop', id: first },
          ],
        },
      ],
    })

    const after = await positions()
    // Anchors are `0..n-1` in the order sent, journeys sit strictly between them.
    expect(after[`stop/${second}`]).toBe(0)
    expect(after[`note/${note}`]).toBe(1)
    expect(after[`stop/${first}`]).toBe(2)
    expect(after[`transport/${journey}`]).toBe(-0.5)
    expect(after[`leg/${leg.id}`]).toBe(1.5)

    // The room hears the run as written: anchors under `items`, journeys beside them.
    expect(written).toEqual([
      {
        dayId,
        items: [
          { kind: 'stop', id: second },
          { kind: 'note', id: note },
          { kind: 'stop', id: first },
        ],
        journeys: [
          { kind: 'transport', id: journey },
          { kind: 'leg', id: leg.id },
        ],
      },
    ])
  })

  it('splits a gap between two journeys in the order sent', async () => {
    const dayId = days[0].id
    const stop = await stopAt(dayId, 0)
    const early = await journeyOn(dayId)
    const late = await journeyOn(dayId)

    await reorderDayTimelines(tenant.scope, {
      tripId,
      days: [
        {
          dayId,
          items: [
            { kind: 'stop', id: stop },
            { kind: 'transport', id: late },
            { kind: 'transport', id: early },
          ],
        },
      ],
    })

    const after = await positions()
    expect(after[`transport/${late}`]).toBeCloseTo(1 / 3, 5)
    expect(after[`transport/${early}`]).toBeCloseTo(2 / 3, 5)
    expect(after[`transport/${late}`]).toBeLessThan(after[`transport/${early}`])
  })

  it('puts back a journey the payload left out, behind the row it currently follows', async () => {
    const dayId = days[0].id
    const first = await stopAt(dayId, 0)
    const second = await stopAt(dayId, 1)
    const journey = await journeyOn(dayId)
    harness.sqlite
      .prepare('update transports set sort_order = 1.5 where id = ?')
      .run(journey)

    // A tab that predates journeys on the wire: stops only, swapped.
    await reorderDayTimelines(tenant.scope, {
      tripId,
      days: [
        {
          dayId,
          items: [
            { kind: 'stop', id: second },
            { kind: 'stop', id: first },
          ],
        },
      ],
    })

    const after = await positions()
    expect(after[`stop/${second}`]).toBe(0)
    expect(after[`stop/${first}`]).toBe(1)
    // It followed `second`, which is now first; it follows it still.
    expect(after[`transport/${journey}`]).toBe(0.5)
  })

  it('drops a journey that does not depart from the day, and a foreign tenant’s', async () => {
    const dayId = days[0].id
    const stop = await stopAt(dayId, 0)
    const elsewhere = await journeyOn(days[1].id)
    const stranger = await harness.seedTenant('stranger')
    const foreignTrip = await createTrip(stranger.scope, {
      title: 'Elsewhere',
      startDate: '2026-04-10',
      endDate: '2026-04-11',
    })
    const foreignDay = (await listTripDays(stranger.scope, foreignTrip.id))[0]
    const foreign = await createTransport(stranger.scope, {
      tripId: foreignTrip.id,
      title: 'Not yours',
      mode: 'train',
      dayId: foreignDay.id,
    })
    const before = await positions()

    const [written] = await reorderDayTimelines(tenant.scope, {
      tripId,
      days: [
        {
          dayId,
          items: [
            { kind: 'transport', id: elsewhere },
            { kind: 'transport', id: foreign.id },
            { kind: 'stop', id: stop },
          ],
        },
      ],
    })

    expect(written.journeys).toEqual([])
    const after = await positions()
    expect(after[`transport/${elsewhere}`]).toBe(
      before[`transport/${elsewhere}`],
    )
    expect(after[`transport/${foreign.id}`]).toBe(
      before[`transport/${foreign.id}`],
    )
  })

  it('leaves all four columns as they were when a statement of the batch fails', async () => {
    const dayId = days[0].id
    const first = await stopAt(dayId, 0)
    const second = await stopAt(dayId, 3)
    const note = await noteAt(dayId, 5)
    const journey = await journeyOn(dayId)

    const chained = await createTransport(tenant.scope, {
      tripId,
      title: 'The Hikari',
      mode: 'train',
    })
    await replaceTransportChain(tenant.scope, chained.id, {
      stations: [{ name: 'Kyoto' }, { name: 'Nagoya' }],
      legs: [{ departureDayId: dayId }],
    })
    const [leg] = await listTransportLegs(tenant.scope, chained.id)

    const before = await positions()
    // The last statement of the batch is a leg: everything before it has already run.
    harness.sqlite.exec(
      `create trigger refuse_leg_move before update on transport_legs
       begin select raise(abort, 'forced failure'); end`,
    )

    const error = await captureError(() =>
      reorderDayTimelines(tenant.scope, {
        tripId,
        days: [
          {
            dayId,
            items: [
              { kind: 'note', id: note },
              { kind: 'transport', id: journey },
              { kind: 'stop', id: second },
              { kind: 'stop', id: first },
              { kind: 'leg', id: leg.id },
            ],
          },
        ],
      }),
    )

    expect(error).toBeInstanceOf(Error)
    expect(await positions()).toEqual(before)
  })

  it('writes the stops, the notes and both journey tables in a single batch', async () => {
    const dayId = days[0].id
    const stop = await stopAt(dayId, 0)
    const note = await noteAt(dayId, 1)
    const journey = await journeyOn(dayId)
    const chained = await createTransport(tenant.scope, {
      tripId,
      title: 'The Hikari',
      mode: 'train',
    })
    await replaceTransportChain(tenant.scope, chained.id, {
      stations: [{ name: 'Kyoto' }, { name: 'Nagoya' }],
      legs: [{ departureDayId: dayId }],
    })
    const [leg] = await listTransportLegs(tenant.scope, chained.id)

    harness.statements.length = 0
    await reorderDayTimelines(tenant.scope, {
      tripId,
      days: [
        {
          dayId,
          items: [
            { kind: 'note', id: note },
            { kind: 'transport', id: journey },
            { kind: 'stop', id: stop },
            { kind: 'leg', id: leg.id },
          ],
        },
      ],
    })

    const updates = harness.statements.filter((sql) => sql.startsWith('update'))
    for (const table of [
      'day_assignments',
      'day_notes',
      'transports',
      'transport_legs',
    ]) {
      expect(
        updates.filter((sql) => sql.startsWith(`update "${table}"`)),
        table,
      ).toHaveLength(1)
    }
  })

  it('refuses a viewer and writes nothing, journeys included', async () => {
    const dayId = days[0].id
    const stop = await stopAt(dayId, 0)
    const journey = await journeyOn(dayId)
    const viewerId = await tenant.addUser('Viewer')
    await addTripMember(tenant.scope, {
      tripId,
      userId: viewerId,
      role: 'viewer',
    })
    const before = await positions()

    const error = await captureError(() =>
      reorderDayTimelines(tenant.scopeFor(viewerId), {
        tripId,
        days: [
          {
            dayId,
            items: [
              { kind: 'transport', id: journey },
              { kind: 'stop', id: stop },
            ],
          },
        ],
      }),
    )

    expect(error).toBeInstanceOf(RepositoryError)
    expect(await positions()).toEqual(before)
  })
})
