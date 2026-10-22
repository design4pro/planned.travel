/**
 * A drag that touches several days, at the repository seam (#212).
 *
 * `reorderDayTimelines` is the only writer of a day's number line, and it takes every day a drag
 * touched, so a row that changes day is moved, renumbered and written in one batch. The isolation
 * files own "whose day is this?"; what is left here is what the batch does with the rows it is
 * given: where a moved stop or note ends up, what an omission means, and what a refused payload
 * leaves behind.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError, RepositoryError } from '../context'
import {
  createDayNote,
  listDayNotes,
  listTripDayNotes,
  listTripDays,
} from '../days'
import {
  createAssignment,
  listDayAssignments,
  reorderDayTimelines,
  reorderDayTimelinesInput,
} from '../itinerary'
import { createPlace } from '../places'
import { addTripMember, createTrip } from '../trips'
import { captureError, createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'

describe('a drag across days', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let dayA: string
  let dayB: string
  let stopA1: string
  let stopA2: string
  let stopB1: string
  let noteA: string
  let noteB: string
  let placeA1: string

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('alpha')
    const scope = tenant.scope

    const trip = await createTrip(scope, {
      title: 'Vienna in October',
      startDate: '2026-10-05',
      endDate: '2026-10-07',
      currency: 'EUR',
    })
    const days = await listTripDays(scope, trip.id)
    const first = days.at(0)
    const second = days.at(1)
    if (first === undefined || second === undefined) {
      throw new Error('A dated trip must have a day run.')
    }
    tripId = trip.id
    dayA = first.id
    dayB = second.id

    const cafe = await createPlace(scope, { tripId, name: 'Café Sacher' })
    const opera = await createPlace(scope, { tripId, name: 'Staatsoper' })
    const market = await createPlace(scope, { tripId, name: 'Naschmarkt' })
    placeA1 = cafe.id

    const a1 = await createAssignment(scope, {
      tripId,
      dayId: dayA,
      placeId: cafe.id,
      orderIndex: 0,
      startTime: '09:00',
    })
    const a2 = await createAssignment(scope, {
      tripId,
      dayId: dayA,
      placeId: opera.id,
      orderIndex: 1,
    })
    const b1 = await createAssignment(scope, {
      tripId,
      dayId: dayB,
      placeId: market.id,
      orderIndex: 0,
    })
    stopA1 = a1.id
    stopA2 = a2.id
    stopB1 = b1.id

    noteA = (
      await createDayNote(scope, {
        tripId,
        dayId: dayA,
        body: 'Tickets are at the hotel desk.',
        sortOrder: 2,
      })
    ).id
    noteB = (
      await createDayNote(scope, {
        tripId,
        dayId: dayB,
        body: 'Closed on Sundays.',
        sortOrder: 1,
      })
    ).id
  })

  /** A day's stops and notes read back as one number line, `id → { position, dayId }`. */
  async function lineOf(
    dayId: string,
  ): Promise<Array<{ id: string; position: number }>> {
    const scope = tenant.scope
    const [stops, notes] = await Promise.all([
      listDayAssignments(scope, dayId),
      listDayNotes(scope, dayId),
    ])
    return [
      ...stops.map((row) => ({ id: row.id, position: row.orderIndex })),
      ...notes.map((row) => ({ id: row.id, position: row.sortOrder })),
    ].sort((a, b) => a.position - b.position)
  }

  it('gives a note that changed day its new day, and does not splice it back', async () => {
    const written = await reorderDayTimelines(tenant.scope, {
      tripId,
      days: [
        {
          dayId: dayB,
          items: [
            { kind: 'stop', id: stopB1 },
            { kind: 'note', id: noteA },
            { kind: 'note', id: noteB },
          ],
        },
        {
          dayId: dayA,
          items: [
            { kind: 'stop', id: stopA1 },
            { kind: 'stop', id: stopA2 },
          ],
        },
      ],
    })

    expect(await lineOf(dayB)).toEqual([
      { id: stopB1, position: 0 },
      { id: noteA, position: 1 },
      { id: noteB, position: 2 },
    ])
    expect(await lineOf(dayA)).toEqual([
      { id: stopA1, position: 0 },
      { id: stopA2, position: 1 },
    ])
    expect(
      (await listDayNotes(tenant.scope, dayB)).map((row) => row.id),
    ).toContain(noteA)
    expect(
      (await listTripDayNotes(tenant.scope, tripId)).find(
        (row) => row.id === noteA,
      )?.dayId,
    ).toBe(dayB)
    // The return value stays per day, in the order the days were named.
    expect(written.map((day) => day.dayId)).toEqual([dayB, dayA])
    expect(written.at(0)?.items).toEqual([
      { kind: 'stop', id: stopB1 },
      { kind: 'note', id: noteA },
      { kind: 'note', id: noteB },
    ])
  })

  it('moves a stop across days the same way, in one call', async () => {
    await reorderDayTimelines(tenant.scope, {
      tripId,
      days: [
        {
          dayId: dayB,
          items: [
            { kind: 'note', id: noteB },
            { kind: 'stop', id: stopA2 },
            { kind: 'stop', id: stopB1 },
          ],
        },
        {
          dayId: dayA,
          items: [
            { kind: 'stop', id: stopA1 },
            { kind: 'note', id: noteA },
          ],
        },
      ],
    })

    expect(await lineOf(dayB)).toEqual([
      { id: noteB, position: 0 },
      { id: stopA2, position: 1 },
      { id: stopB1, position: 2 },
    ])
    expect(await lineOf(dayA)).toEqual([
      { id: stopA1, position: 0 },
      { id: noteA, position: 1 },
    ])
    const moved = (await listDayAssignments(tenant.scope, dayB)).find(
      (row) => row.id === stopA2,
    )
    expect(moved?.dayId).toBe(dayB)
  })

  it('swaps two different stops between their days', async () => {
    await reorderDayTimelines(tenant.scope, {
      tripId,
      days: [
        {
          dayId: dayA,
          items: [
            { kind: 'stop', id: stopB1 },
            { kind: 'stop', id: stopA2 },
          ],
        },
        {
          dayId: dayB,
          items: [{ kind: 'stop', id: stopA1 }],
        },
      ],
    })

    expect(
      (await listDayAssignments(tenant.scope, dayA)).map((row) => row.id),
    ).toEqual([stopB1, stopA2])
    expect(
      (await listDayAssignments(tenant.scope, dayB)).map((row) => row.id),
    ).toEqual([stopA1])
  })

  it('writes nothing on any day when one place would be on a day twice', async () => {
    // A third day holds a second stop at the first stop's place, so moving the first stop
    // there collides on `day_assignments_day_place_unq` — after the earlier statements ran.
    const days = await listTripDays(tenant.scope, tripId)
    const dayC = days.at(2)
    if (dayC === undefined) {
      throw new Error('A three-day trip must have a third day.')
    }
    const twin = await createAssignment(tenant.scope, {
      tripId,
      dayId: dayC.id,
      placeId: placeA1,
      orderIndex: 0,
    })
    const before = {
      a: await lineOf(dayA),
      b: await lineOf(dayB),
      c: await lineOf(dayC.id),
    }

    const error = await captureError(() =>
      reorderDayTimelines(tenant.scope, {
        tripId,
        days: [
          {
            dayId: dayB,
            items: [
              { kind: 'note', id: noteB },
              { kind: 'stop', id: stopB1 },
              { kind: 'note', id: noteA },
            ],
          },
          {
            dayId: dayC.id,
            items: [
              { kind: 'stop', id: stopA1 },
              { kind: 'stop', id: twin.id },
            ],
          },
        ],
      }),
    )

    expect(error).toBeInstanceOf(Error)
    expect(await lineOf(dayA)).toEqual(before.a)
    expect(await lineOf(dayB)).toEqual(before.b)
    expect(await lineOf(dayC.id)).toEqual(before.c)
  })

  it('drops unknown ids and applies a row named under two days once, under the first', async () => {
    await reorderDayTimelines(tenant.scope, {
      tripId,
      days: [
        {
          dayId: dayB,
          items: [
            { kind: 'stop', id: 'assignment_that_was_deleted' },
            { kind: 'note', id: noteA },
            { kind: 'stop', id: stopB1 },
          ],
        },
        {
          dayId: dayA,
          items: [
            { kind: 'note', id: noteA },
            { kind: 'stop', id: stopA2 },
          ],
        },
      ],
    })

    const notes = await listTripDayNotes(tenant.scope, tripId)
    expect(notes.find((row) => row.id === noteA)?.dayId).toBe(dayB)
    expect(await lineOf(dayB)).toEqual([
      { id: noteA, position: 0 },
      { id: stopB1, position: 1 },
      // The day's own note, which the client left out, goes back where it was.
      { id: noteB, position: 2 },
    ])
    // The omitted stop stays on the day that still holds it, ahead of the row it preceded.
    expect(await lineOf(dayA)).toEqual([
      { id: stopA1, position: 0 },
      { id: stopA2, position: 1 },
    ])
  })

  it('splices an omitted row back only on the day that still holds it', async () => {
    await reorderDayTimelines(tenant.scope, {
      tripId,
      days: [
        // `noteA` is named under B, so A must not take it back; `stopB1` is omitted from B
        // and stays on B.
        { dayId: dayB, items: [{ kind: 'note', id: noteA }] },
        { dayId: dayA, items: [{ kind: 'stop', id: stopA2 }] },
      ],
    })

    // Both of B's own rows were omitted, so they keep their places and the named note
    // trails them; A's `noteA` is not spliced back, because B took it.
    expect(await lineOf(dayB)).toEqual([
      { id: stopB1, position: 0 },
      { id: noteB, position: 1 },
      { id: noteA, position: 2 },
    ])
    expect(await lineOf(dayA)).toEqual([
      { id: stopA1, position: 0 },
      { id: stopA2, position: 1 },
    ])
  })

  it('clears the time of a moved stop and of a moved note in the same write', async () => {
    const timed = await createDayNote(tenant.scope, {
      tripId,
      dayId: dayA,
      body: 'Leave for the airport.',
      time: '06:30',
      sortOrder: 3,
    })

    await reorderDayTimelines(tenant.scope, {
      tripId,
      days: [
        {
          dayId: dayB,
          items: [
            { kind: 'stop', id: stopA1 },
            { kind: 'note', id: timed.id },
          ],
          clearTime: [
            { kind: 'stop', id: stopA1 },
            { kind: 'note', id: timed.id },
            // Not in `items`: the day does not move it, so it keeps its time.
            { kind: 'stop', id: stopB1 },
          ],
        },
      ],
    })

    const moved = (await listDayAssignments(tenant.scope, dayB)).find(
      (row) => row.id === stopA1,
    )
    expect(moved?.startTime).toBeNull()
    expect(moved?.endTime).toBeNull()
    expect(
      (await listTripDayNotes(tenant.scope, tripId)).find(
        (row) => row.id === timed.id,
      )?.time,
    ).toBeNull()
  })

  it('leaves a day alone that no entry names', async () => {
    const days = await listTripDays(tenant.scope, tripId)
    const dayC = days.at(2)
    if (dayC === undefined) {
      throw new Error('A three-day trip must have a third day.')
    }
    const lonely = await createDayNote(tenant.scope, {
      tripId,
      dayId: dayC.id,
      body: 'Fractional on purpose.',
      sortOrder: 7.5,
    })

    await reorderDayTimelines(tenant.scope, {
      tripId,
      days: [{ dayId: dayA, items: [{ kind: 'stop', id: stopA2 }] }],
    })

    expect(await lineOf(dayC.id)).toEqual([{ id: lonely.id, position: 7.5 }])
  })

  it('refuses a day named twice before it writes anything', async () => {
    const before = await lineOf(dayA)

    const error = await captureError(() =>
      reorderDayTimelines(tenant.scope, {
        tripId,
        days: [
          { dayId: dayA, items: [{ kind: 'stop', id: stopA2 }] },
          { dayId: dayA, items: [{ kind: 'stop', id: stopA1 }] },
        ],
      }),
    )

    expect(error).toBeInstanceOf(Error)
    expect(await lineOf(dayA)).toEqual(before)
  })

  it('answers NotFound for a day of another trip, and writes nothing', async () => {
    const other = await createTrip(tenant.scope, {
      title: 'Elsewhere',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
    })
    const foreignDay = (await listTripDays(tenant.scope, other.id)).at(0)
    if (foreignDay === undefined) {
      throw new Error('A dated trip must have a day run.')
    }
    const before = await lineOf(dayA)

    const error = await captureError(() =>
      reorderDayTimelines(tenant.scope, {
        tripId,
        days: [
          { dayId: dayA, items: [{ kind: 'stop', id: stopA2 }] },
          { dayId: foreignDay.id, items: [{ kind: 'stop', id: stopA1 }] },
        ],
      }),
    )

    expect(error).toBeInstanceOf(NotFoundError)
    expect(await lineOf(dayA)).toEqual(before)
  })

  it('refuses a viewer and writes nothing', async () => {
    const viewerId = await tenant.addUser('A viewer')
    await addTripMember(tenant.scope, {
      tripId,
      userId: viewerId,
      role: 'viewer',
    })
    const before = { a: await lineOf(dayA), b: await lineOf(dayB) }

    const error = await captureError(() =>
      reorderDayTimelines(tenant.scopeFor(viewerId), {
        tripId,
        days: [
          { dayId: dayB, items: [{ kind: 'note', id: noteA }] },
          { dayId: dayA, items: [{ kind: 'stop', id: stopA2 }] },
        ],
      }),
    )

    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).code).toBe('FORBIDDEN')
    expect(await lineOf(dayA)).toEqual(before.a)
    expect(await lineOf(dayB)).toEqual(before.b)
  })

  it('leaves the rows of another trip of the same workspace where they are', async () => {
    const other = await createTrip(tenant.scope, {
      title: 'Elsewhere',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
    })
    const otherDay = (await listTripDays(tenant.scope, other.id)).at(0)
    if (otherDay === undefined) {
      throw new Error('A dated trip must have a day run.')
    }
    const harbour = await createPlace(tenant.scope, {
      tripId: other.id,
      name: 'Harbour',
    })
    const foreignStop = await createAssignment(tenant.scope, {
      tripId: other.id,
      dayId: otherDay.id,
      placeId: harbour.id,
      orderIndex: 0,
      startTime: '10:00',
    })
    const foreignNote = await createDayNote(tenant.scope, {
      tripId: other.id,
      dayId: otherDay.id,
      body: 'Not this trip.',
      sortOrder: 1,
    })

    const result = await reorderDayTimelines(tenant.scope, {
      tripId,
      days: [
        {
          dayId: dayA,
          items: [
            { kind: 'stop', id: foreignStop.id },
            { kind: 'note', id: foreignNote.id },
            { kind: 'stop', id: stopA2 },
            { kind: 'stop', id: stopA1 },
          ],
          clearTime: [{ kind: 'stop', id: foreignStop.id }],
        },
      ],
    })

    expect(result).toEqual([
      {
        dayId: dayA,
        items: [
          { kind: 'stop', id: stopA2 },
          { kind: 'note', id: noteA },
          { kind: 'stop', id: stopA1 },
        ],
        journeys: [],
      },
    ])
    expect(await lineOf(otherDay.id)).toEqual([
      { id: foreignStop.id, position: 0 },
      { id: foreignNote.id, position: 1 },
    ])
    const [stillThere] = await listDayAssignments(tenant.scope, otherDay.id)
    expect(stillThere?.startTime).toBe('10:00')
  })

  it('bounds the batch: at most four days and 200 items a day', () => {
    const dayEntries = (count: number) => ({
      tripId,
      days: Array.from({ length: count }, (_, index) => ({
        dayId: `day-${index}`,
        items: [],
      })),
    })
    expect(reorderDayTimelinesInput.safeParse(dayEntries(4)).success).toBe(true)
    expect(reorderDayTimelinesInput.safeParse(dayEntries(5)).success).toBe(
      false,
    )

    const items = (count: number) =>
      Array.from({ length: count }, () => ({
        kind: 'stop' as const,
        id: stopA1,
      }))
    const oneDay = (count: number) => ({
      tripId,
      days: [{ dayId: dayA, items: items(count) }],
    })
    expect(reorderDayTimelinesInput.safeParse(oneDay(200)).success).toBe(true)
    expect(reorderDayTimelinesInput.safeParse(oneDay(201)).success).toBe(false)

    // The journeys of a day get their own 200 rather than taking them out of the stops' budget.
    const journeys = (count: number) =>
      Array.from({ length: count }, () => ({
        kind: 'transport' as const,
        id: stopA1,
      }))
    const withJourneys = (anchors: number, journeyCount: number) => ({
      tripId,
      days: [
        {
          dayId: dayA,
          items: [...items(anchors), ...journeys(journeyCount)],
        },
      ],
    })
    expect(
      reorderDayTimelinesInput.safeParse(withJourneys(200, 200)).success,
    ).toBe(true)
    expect(
      reorderDayTimelinesInput.safeParse(withJourneys(200, 201)).success,
    ).toBe(false)
    expect(
      reorderDayTimelinesInput.safeParse(withJourneys(201, 0)).success,
    ).toBe(false)
  })
})
