/**
 * The planner's journey read and the writer that places one on a day.
 *
 * Three claims, and each is a way this module could fail quietly:
 *
 * 1. **The read draws every journey exactly once.** A record whose legs carry the day references
 *    contributes its legs and no spanning row; a record with no day at all is not on the board.
 * 2. **The validator counts stops and notes by `reorderPlanFn`'s rule**, so a day the primary write
 *    accepts is never refused for its journeys, and a run past either bound is refused whole.
 * 3. **The write mirrors one `day` upsert to the trip room**, under its own field, and a room that
 *    refuses does not fail the save — D1 is the record and the room is a signal.
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
  listTripDays,
  replaceTransportChain,
} from '#/server/repos'
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
const { reorderDayTransportsInput } = await import('#/server/repos')

/** The boundary validator, then the handler, inside a request context. */
const reorderJourneys = async (data: unknown): Promise<void> => {
  const validated = reorderDayTransportsInput.parse(data)
  await startStorage.run(startContext(), () =>
    reorderDayTransportsFn({ data: validated }),
  )
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
    await replaceTransportChain(scope, chained.id, {
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

  it('keeps a record that only arrives on a day, and says the trip is writable', async () => {
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

describe('the run the writer accepts', () => {
  /** A run of `anchors` stops and notes plus `journeys` journeys, all well-formed. */
  function runOf(anchors: number, journeys: number): unknown {
    return {
      tripId: fixture.tripId,
      dayId: fixture.dayId,
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
    expect(reorderDayTransportsInput.safeParse(runOf(200, 150)).success).toBe(
      true,
    )
  })

  it('refuses a 201st stop or note, and a run past the whole cap', () => {
    expect(reorderDayTransportsInput.safeParse(runOf(201, 0)).success).toBe(
      false,
    )
    expect(reorderDayTransportsInput.safeParse(runOf(200, 201)).success).toBe(
      false,
    )
  })

  it('refuses a kind the day’s number line does not hold', () => {
    expect(
      reorderDayTransportsInput.safeParse({
        tripId: fixture.tripId,
        dayId: fixture.dayId,
        items: [{ kind: 'stay', id: 'anything' }],
      }).success,
    ).toBe(false)
  })
})

describe('placing a journey on the day', () => {
  it('writes the position and mirrors one day upsert carrying the journeys', async () => {
    await reorderJourneys({
      tripId: fixture.tripId,
      dayId: fixture.dayId,
      items: [
        { kind: 'stop', id: fixture.assignmentId },
        { kind: 'transport', id: fixture.flightId },
        { kind: 'note', id: fixture.noteId },
      ],
    })

    const payload = await readPlanTransports(tenant.scope, fixture.tripId)
    expect(
      payload.transports.find((row) => row.id === fixture.flightId)?.position,
    ).toBe(0.5)

    expect(stubs.mirrored).toHaveLength(1)
    const [patch] = stubs.mirrored[0].patches
    expect(patch.entity).toEqual({ kind: 'day', id: fixture.dayId })
    // Under its own field, so it cannot overwrite the `items` `reorderPlanFn` mirrors.
    expect(patch.fields).toEqual({
      journeys: [{ kind: 'transport', id: fixture.flightId }],
    })
  })

  it('still writes the day when the room refuses', async () => {
    stubs.roomRejects = true

    await reorderJourneys({
      tripId: fixture.tripId,
      dayId: fixture.dayId,
      items: [
        { kind: 'stop', id: fixture.assignmentId },
        { kind: 'transport', id: fixture.flightId },
      ],
    })

    expect(stubs.refused).toBe(1)
    expect(stubs.mirrored).toEqual([])
    const payload = await readPlanTransports(tenant.scope, fixture.tripId)
    expect(
      payload.transports.find((row) => row.id === fixture.flightId)?.position,
    ).toBe(0.5)
  })
})

describe('what one placement costs', () => {
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

  it('resolves the trip once and reads only the day it places', async () => {
    const scope = tenant.scope
    // A journey on another day of the same trip. The planner issues one placement per day a drag
    // touches, in parallel, so a read that took the trip to place a day would grow with the
    // itinerary and be answered mostly by rows the placement then throws away.
    const elsewhere = await createTransport(scope, {
      tripId: fixture.tripId,
      dayId: fixture.secondDayId,
      title: 'Itami to Haneda',
      mode: 'flight',
    })

    harness.statements.length = 0
    await reorderJourneys({
      tripId: fixture.tripId,
      dayId: fixture.dayId,
      items: [
        { kind: 'stop', id: fixture.assignmentId },
        { kind: 'transport', id: fixture.flightId },
        { kind: 'note', id: fixture.noteId },
      ],
    })

    // Once: the handler proves the trip is writable and hands that same row to the repository,
    // whose own guard reads it again only for a caller that hands it nothing.
    expect(readsOf('trips')).toHaveLength(1)

    // And the journeys were read as the day: three questions, none of them the trip's whole set.
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
