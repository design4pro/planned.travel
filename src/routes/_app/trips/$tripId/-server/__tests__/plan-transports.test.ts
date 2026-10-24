/**
 * The planner's journey read, and the writes that place a day's journeys with the stop they change.
 *
 * Four claims, and each is a way this module could fail quietly:
 *
 * 1. **The read draws every journey exactly once.** A record whose legs carry the day references
 *    contributes its legs and no spanning row; a record with no day at all is not on the board.
 * 2. **A schedule's validator counts stops and notes by `reorderPlanFn`'s rule**, so a day the
 *    primary write accepts is never refused for its journeys, and a run past either bound is
 *    refused whole.
 * 3. **Each write mirrors one `day` upsert to the trip room**, under its own field, and a room that
 *    refuses does not fail the save — D1 is the record and the room is a signal.
 * 4. **A write reads only the day it places**, not the trip's whole set of journeys.
 *
 * The three `createServerFn` properties the wrappers below work around are the framework's and are
 * recorded in full in `plan-reorder.test.ts`: a handler only runs inside Start's
 * `AsyncLocalStorage`, the boundary validator is not applied outside a Start build, and a handler's
 * return value is discarded on that path. Everything below the mocks is real.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createAssignment,
  createDayNote,
  createPlace,
  createTransport,
  createTrip,
  listDayAssignments,
  listTripDays,
  saveSearchedConnection,
} from '#/server/repos'
import { replaceChain } from '#/server/repos/__tests__/edit-transport'
import { createHarness } from '#/server/repos/__tests__/harness'

import type { TripPatch } from '#/server/do'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'

/* ------------------------------------------------------------------ mocking */

const stubs = vi.hoisted(() => ({
  scope: null as TenantScope | null,
  mirrored: [] as Array<{ tripId: string; patches: ReadonlyArray<TripPatch> }>,
  roomRejects: false,
  refused: 0,
}))

vi.mock('#/server/fns/context', () => ({
  mirrorToRoom: async (
    _scope: TenantScope,
    tripId: string,
    patches: ReadonlyArray<TripPatch>,
  ): Promise<void> => {
    try {
      if (stubs.roomRejects) {
        throw new Error('TRIP_ROOM is unreachable')
      }
      stubs.mirrored.push({ tripId, patches })
    } catch {
      stubs.refused += 1
    }
  },
  patch: (
    kind: TripPatch['entity']['kind'],
    id: string,
    fields: TripPatch['fields'],
  ): TripPatch => ({ entity: { kind, id }, op: 'upsert', fields }),
}))

vi.mock('#/server/auth/env', () => ({
  taskQueue: () => ({ sendBatch: async (): Promise<void> => undefined }),
}))

vi.mock('../../../../-server/context', async () => {
  const { AuthRequirementError } = await import('#/server/auth/tenant')
  return {
    appScope: async (): Promise<unknown> => {
      if (stubs.scope === null) {
        throw new AuthRequirementError(
          'unauthenticated',
          'You need to sign in to continue.',
        )
      }
      return stubs.scope
    },
  }
})

/* ------------------------------------------------------------ start context */

interface StartContext {
  readonly startOptions: Record<string, never>
  readonly request: Request
}

const startStorage = ((): AsyncLocalStorage<StartContext> => {
  const key = Symbol.for('tanstack-start:start-storage-context')
  const globals = globalThis as Record<symbol, unknown>
  globals[key] ??= new AsyncLocalStorage<StartContext>()
  return globals[key] as AsyncLocalStorage<StartContext>
})()

function startContext(): StartContext {
  return {
    startOptions: {},
    request: new Request('https://planned.travel/_serverFn/plan-transports', {
      method: 'POST',
    }),
  }
}

const { readPlanTransports, reorderDayTransportsFn } =
  await import('../plan-transports')
const {
  deletePlanPlaceFn,
  schedulePlaceFn,
  schedulePlaceInputSchema,
  unschedulePlaceFn,
} = await import('../plan')

/** A handler inside a request context, as the runtime runs it. */
const inRequest = <T>(run: () => Promise<T>): Promise<T> =>
  startStorage.run(startContext(), run)

/** The boundary validator, then the handler. */
const schedule = async (data: unknown): Promise<void> => {
  const validated = schedulePlaceInputSchema.parse(data)
  await inRequest(() => schedulePlaceFn({ data: validated }))
}

/* -------------------------------------------------------------------- setup */

interface Fixture {
  readonly tripId: string
  readonly dayId: string
  readonly secondDayId: string
  readonly assignmentId: string
  readonly noteId: string
  /** A whole-record journey departing from the first day. */
  readonly flightId: string
}

let harness: Harness
let tenant: SeededTenant
let fixture: Fixture

beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('journeys')
  stubs.scope = tenant.scope
  stubs.mirrored = []
  stubs.roomRejects = false
  stubs.refused = 0

  const scope = tenant.scope
  const trip = await createTrip(scope, {
    title: 'Kansai run',
    startDate: '2026-04-10',
    endDate: '2026-04-13',
    currency: 'JPY',
  })
  const days = await listTripDays(scope, trip.id)
  const place = await createPlace(scope, { tripId: trip.id, name: 'Sensō-ji' })
  const assignment = await createAssignment(scope, {
    tripId: trip.id,
    dayId: days[0].id,
    placeId: place.id,
    orderIndex: 0,
  })
  const note = await createDayNote(scope, {
    tripId: trip.id,
    dayId: days[0].id,
    body: 'Buy the rail pass.',
    sortOrder: 1,
  })
  const flight = await createTransport(scope, {
    tripId: trip.id,
    dayId: days[0].id,
    title: 'Haneda to Itami',
    mode: 'flight',
    departureName: 'Haneda',
    arrivalName: 'Itami',
    departureTime: '14:05',
  })

  fixture = {
    tripId: trip.id,
    dayId: days[0].id,
    secondDayId: days[1].id,
    assignmentId: assignment.id,
    noteId: note.id,
    flightId: flight.id,
  }
})

describe('the journeys a day can draw', () => {
  it('draws a chained journey as its legs and never also whole', async () => {
    const scope = tenant.scope
    const chained = await createTransport(scope, {
      tripId: fixture.tripId,
      title: 'Shin-Osaka to Tokyo',
      mode: 'train',
      status: 'confirmed',
    })
    await replaceChain(scope, fixture.tripId, chained.id, {
      stations: [{ name: 'Shin-Osaka' }, { name: 'Nagoya' }, { name: 'Tokyo' }],
      legs: [
        { departureDayId: fixture.dayId, departureTime: '09:00' },
        { departureDayId: fixture.secondDayId },
      ],
    })

    const payload = await readPlanTransports(scope, fixture.tripId)
    const legs = payload.transports.filter((row) => row.kind === 'leg')

    expect(payload.transports.map((row) => row.id)).not.toContain(chained.id)
    expect(legs).toHaveLength(2)
    // The mode and the status belong to the parent: a leg of a train is still a train.
    expect(legs.every((leg) => leg.mode === 'train')).toBe(true)
    expect(legs.every((leg) => leg.status === 'confirmed')).toBe(true)
    // A ticket is priced once, on the record, so no leg invents a fare of its own.
    expect(legs.every((leg) => leg.priceMinor === null)).toBe(true)
  })

  it('keeps a re-searched journey on the day it was anchored to', async () => {
    const scope = tenant.scope
    const stations = [{ name: 'Shin-Osaka' }, { name: 'Tokyo' }]
    const saved = await saveSearchedConnection(scope, {
      tripId: fixture.tripId,
      mode: 'train',
      title: 'Shin-Osaka to Tokyo',
      stations,
      legs: [{}],
    })
    await replaceChain(scope, fixture.tripId, saved.transport.id, {
      stations,
      legs: [{ departureDayId: fixture.secondDayId }],
    })

    // The dialog sends no day; the timetable moved by half an hour.
    await saveSearchedConnection(scope, {
      tripId: fixture.tripId,
      transportId: saved.transport.id,
      mode: 'train',
      title: 'Shin-Osaka to Tokyo',
      stations,
      legs: [{ departureTime: '09:30' }],
    })

    const payload = await readPlanTransports(scope, fixture.tripId)
    const legs = payload.transports.filter((entry) => entry.kind === 'leg')
    expect(legs.map((leg) => leg.departureDayId)).toEqual([fixture.secondDayId])
    expect(legs[0].departureTime).toBe('09:30')
  })

  it('leaves a journey with no day at all on the Transports tab', async () => {
    const scope = tenant.scope
    const idea = await createTransport(scope, {
      tripId: fixture.tripId,
      title: 'Maybe the ferry',
      mode: 'ferry',
    })

    const payload = await readPlanTransports(scope, fixture.tripId)
    expect(payload.transports.map((row) => row.id)).toEqual([fixture.flightId])
    expect(payload.transports.map((row) => row.id)).not.toContain(idea.id)
  })

  it('keeps a record that only arrives on a day', async () => {
    const scope = tenant.scope
    const landing = await createTransport(scope, {
      tripId: fixture.tripId,
      title: 'The night bus',
      mode: 'bus',
      arrivalDayId: fixture.secondDayId,
      arrivalTime: '06:15',
    })

    const payload = await readPlanTransports(scope, fixture.tripId)
    const row = payload.transports.find((entry) => entry.id === landing.id)

    expect(row?.departureDayId).toBeNull()
    expect(row?.arrivalDayId).toBe(fixture.secondDayId)
  })
})

describe('the run a schedule accepts', () => {
  /** A schedule carrying `anchors` stops and notes plus `journeys` journeys, all well-formed. */
  function runOf(anchors: number, journeys: number): unknown {
    return {
      tripId: fixture.tripId,
      placeId: 'place-1',
      dayId: fixture.dayId,
      index: 0,
      items: [
        ...Array.from({ length: anchors }, (_unused, index) => ({
          kind: index % 2 === 0 ? 'stop' : 'note',
          id: `anchor-${index}`,
        })),
        ...Array.from({ length: journeys }, (_unused, index) => ({
          kind: 'leg',
          id: `leg-${index}`,
        })),
      ],
    }
  }

  it('accepts 200 stops and notes beside journeys of their own', () => {
    expect(schedulePlaceInputSchema.safeParse(runOf(200, 150)).success).toBe(
      true,
    )
  })

  it('refuses a 201st stop or note, and a run past the whole cap', () => {
    expect(schedulePlaceInputSchema.safeParse(runOf(201, 0)).success).toBe(
      false,
    )
    expect(schedulePlaceInputSchema.safeParse(runOf(200, 201)).success).toBe(
      false,
    )
  })

  it('refuses a kind the day’s number line does not hold', () => {
    expect(
      schedulePlaceInputSchema.safeParse({
        tripId: fixture.tripId,
        placeId: 'place-1',
        dayId: fixture.dayId,
        index: 0,
        items: [{ kind: 'stay', id: 'anything' }],
      }).success,
    ).toBe(false)
  })

  it('still accepts the schedule a tab loaded before the run existed sends', () => {
    expect(
      schedulePlaceInputSchema.safeParse({
        tripId: fixture.tripId,
        placeId: 'place-1',
        dayId: fixture.dayId,
        index: 0,
      }).success,
    ).toBe(true)
  })
})

describe('placing the day’s journeys with the stop that changes', () => {
  async function flightPosition(): Promise<number | undefined> {
    const payload = await readPlanTransports(tenant.scope, fixture.tripId)
    return payload.transports.find((row) => row.id === fixture.flightId)
      ?.position
  }

  async function placeIdOfStop(): Promise<string> {
    const stops = await listDayAssignments(tenant.scope, fixture.dayId)
    return stops[0].placeId
  }

  function expectOneDayMirrored(): void {
    expect(stubs.mirrored).toHaveLength(1)
    const [patch] = stubs.mirrored[0].patches
    expect(patch.entity).toEqual({ kind: 'day', id: fixture.dayId })
    // Under its own field, so it cannot overwrite the `items` `reorderPlanFn` mirrors.
    expect(patch.fields).toEqual({
      journeys: [{ kind: 'transport', id: fixture.flightId }],
    })
  }

  it('schedules a place and mirrors one day upsert carrying the journeys', async () => {
    const place = await createPlace(tenant.scope, {
      tripId: fixture.tripId,
      name: 'Kinkaku-ji',
    })

    await schedule({
      tripId: fixture.tripId,
      placeId: place.id,
      dayId: fixture.dayId,
      index: 1,
      items: [
        { kind: 'stop', id: fixture.assignmentId },
        { kind: 'transport', id: fixture.flightId },
        { kind: 'stop', id: place.id },
        { kind: 'note', id: fixture.noteId },
      ],
    })

    // The flight sits between the first stop at 0 and the new one at 1.
    expect(await flightPosition()).toBe(0.5)
    expectOneDayMirrored()
  })

  it('unschedules a stop and mirrors one day upsert carrying the journeys', async () => {
    await inRequest(() =>
      unschedulePlaceFn({
        data: { tripId: fixture.tripId, assignmentId: fixture.assignmentId },
      }),
    )

    // Only the note is left at 1: an open end one unit wide puts the flight at 0.5.
    expect(await flightPosition()).toBe(0.5)
    expect(await listDayAssignments(tenant.scope, fixture.dayId)).toEqual([])
    expectOneDayMirrored()
  })

  it('deletes a place and mirrors one day upsert carrying the journeys', async () => {
    const placeId = await placeIdOfStop()

    await inRequest(() =>
      deletePlanPlaceFn({ data: { tripId: fixture.tripId, placeId } }),
    )

    expect(await flightPosition()).toBe(0.5)
    expect(await listDayAssignments(tenant.scope, fixture.dayId)).toEqual([])
    expectOneDayMirrored()
  })

  it('mirrors nothing for a day that has no journey', async () => {
    const place = await createPlace(tenant.scope, {
      tripId: fixture.tripId,
      name: 'Kinkaku-ji',
    })

    await schedule({
      tripId: fixture.tripId,
      placeId: place.id,
      dayId: fixture.secondDayId,
      index: 0,
    })

    expect(stubs.mirrored).toEqual([])
    expect(stubs.refused).toBe(0)
  })

  it('still writes the day when the room refuses', async () => {
    stubs.roomRejects = true

    await inRequest(() =>
      unschedulePlaceFn({
        data: { tripId: fixture.tripId, assignmentId: fixture.assignmentId },
      }),
    )

    expect(stubs.refused).toBe(1)
    expect(stubs.mirrored).toEqual([])
    expect(await listDayAssignments(tenant.scope, fixture.dayId)).toEqual([])
    expect(await flightPosition()).toBe(0.5)
  })
})

describe('what one write costs', () => {
  /**
   * The statements Drizzle sent, narrowed to the reads this table *drives*.
   *
   * Matched on the `FROM` of the outermost `SELECT` — everything before the first `WHERE` — so a
   * table named only inside a subquery counts towards the read that owns it and not towards two.
   */
  const readsOf = (table: string): Array<string> =>
    harness.statements.filter(
      (sql) =>
        sql.startsWith('select') &&
        sql.split(' where ')[0].endsWith(`from "${table}"`),
    )

  it('reads only the day it places, and leaves another day’s journey alone', async () => {
    const scope = tenant.scope
    // A journey on another day of the same trip. A read that took the trip to place a day would
    // grow with the itinerary and be answered mostly by rows the placement then throws away.
    const elsewhere = await createTransport(scope, {
      tripId: fixture.tripId,
      dayId: fixture.secondDayId,
      title: 'Itami to Haneda',
      mode: 'flight',
    })

    harness.statements.length = 0
    await inRequest(() =>
      unschedulePlaceFn({
        data: { tripId: fixture.tripId, assignmentId: fixture.assignmentId },
      }),
    )

    // The journeys were read as the day: three questions, none of them the trip's whole set.
    // *Which* rows each one reaches is the query plan's answer, not this file's — the assertion
    // that a `day_id` in the `WHERE` clause is worth anything lives in `transports.test.ts`.
    const journeyReads = [
      ...readsOf('transports'),
      ...readsOf('transport_legs'),
    ]
    expect(journeyReads).toHaveLength(3)

    // The other day's journey was neither drawn in nor rewritten.
    const payload = await readPlanTransports(scope, fixture.tripId)
    expect(
      payload.transports.find((row) => row.id === elsewhere.id)?.position,
    ).toBe(elsewhere.sortOrder)
  })
})

describe('the deprecated second call a tab loaded before the deploy still makes', () => {
  const staleCall = (tripId: string, dayId: string) =>
    inRequest(() =>
      reorderDayTransportsFn({
        data: {
          tripId,
          dayId,
          items: [
            { kind: 'stop', id: fixture.assignmentId },
            { kind: 'transport', id: fixture.flightId },
          ],
        },
      }),
    )

  it('resolves and writes and mirrors nothing', async () => {
    await inRequest(() =>
      unschedulePlaceFn({
        data: { tripId: fixture.tripId, assignmentId: fixture.assignmentId },
      }),
    )
    const written = await readPlanTransports(tenant.scope, fixture.tripId)
    stubs.mirrored = []
    harness.statements.length = 0

    // The `{ placed: 0 }` answer is not asserted: outside a Start build a handler's return value is
    // discarded, so what can be checked here is that it resolves and leaves the day alone.
    await staleCall(fixture.tripId, fixture.dayId)

    expect(stubs.mirrored).toEqual([])
    expect(
      harness.statements.filter((sql) => /^(insert|update|delete)/.test(sql)),
    ).toEqual([])
    expect(await readPlanTransports(tenant.scope, fixture.tripId)).toEqual(
      written,
    )
  })

  it('still refuses a trip or a day that is not the caller’s', async () => {
    await expect(staleCall('no-such-trip', fixture.dayId)).rejects.toThrow()
    await expect(staleCall(fixture.tripId, 'no-such-day')).rejects.toThrow()
  })
})
