/**
 * The widened reorder, driven the way the runtime drives it.
 *
 * `reorderPlanFn` used to take a day's `assignmentIds`; since PRD #104 decision 9 it
 * takes the day's whole sequence — stops and notes on one number line — plus the
 * `clearTime` the reader agreed to when they were asked whether to drop a time. This
 * file holds the four claims that widening has to keep:
 *
 * 1. the merged order reaches both position columns;
 * 2. `clearTime` nulls the time and writes the order together, and a `clearTime`
 *    entry that is not being moved never reaches the handler at all;
 * 3. the write still mirrors **one `day` upsert per touched day** to the trip room —
 *    the behaviour this module inherits, and the one a change to the body of the
 *    handler is most likely to drop silently;
 * 4. a room that refuses does not fail the save, because D1 is the record and the
 *    room is a signal.
 *
 * Three properties of `createServerFn` shape the wrappers below, all the framework's
 * and all met the same way in `src/server/fns/__tests__/atlas.test.ts`: a handler only
 * runs inside Start's `AsyncLocalStorage`; outside a Start build the boundary
 * validator is not applied on the way in, so it is applied here explicitly; and a
 * handler's return value is discarded on that path, so what a write *did* is read
 * back through the repository rather than off the call.
 *
 * Everything below the mocks is real: a fully migrated SQLite database from the
 * Drizzle schema, real repositories, a real two-table batch.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  RepositoryError,
  addTripMember,
  createAssignment,
  createDayNote,
  createPlace,
  createTrip,
  listDayAssignments,
  listDayNotes,
  listTripDays,
} from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'

import type { TripPatch } from '#/server/do'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'

/* ------------------------------------------------------------------ mocking */

const stubs = vi.hoisted(() => ({
  /** The scope `appScope()` resolves to. */
  scope: null as TenantScope | null,
  /** Every `mirrorToRoom` call, as the patches it carried. */
  mirrored: [] as Array<{ tripId: string; patches: ReadonlyArray<TripPatch> }>,
  /** When true, the room refuses the way an unreachable Durable Object does. */
  roomRejects: false,
  /** Mirrors that were attempted and refused, so a silence is over a real attempt. */
  refused: 0,
}))

/**
 * `#/server/fns/context` is where `mirrorToRoom` lives, and it imports
 * `cloudflare:workers` at module scope — a specifier that does not resolve in plain
 * Node. It is therefore replaced wholesale rather than partially, and `mirrorToRoom`
 * becomes the spy the third and fourth claims above are asserted against.
 *
 * The stand-in reproduces the shipped one's shape rather than its internals: an
 * unreachable room throws inside it, and it swallows that itself — which is the
 * whole of the real function's contribution (`src/server/fns/context.ts`, which logs
 * and returns). Reproducing it here is what lets the last case ask the question that
 * belongs to *this* handler: with the mirror refusing, is the day still written? It
 * can only be if the mirror is the last thing the handler does.
 */
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
    request: new Request('https://planned.travel/_serverFn/plan-reorder', {
      method: 'POST',
    }),
  }
}

const { reorderPlanFn, reorderPlanInputSchema } = await import('../plan')

/** The boundary validator, then the handler, inside a request context. */
const reorderPlan = async (data: unknown): Promise<void> => {
  const validated = reorderPlanInputSchema.parse(data)
  await startStorage.run(startContext(), () =>
    reorderPlanFn({ data: validated }),
  )
}

/* -------------------------------------------------------------------- setup */

interface Fixture {
  readonly tripId: string
  readonly dayId: string
  readonly otherDayId: string
  /** Two stops on the day; the first carries `09:00`, the second `17:00`. */
  readonly morningId: string
  readonly eveningId: string
  /** Two notes on the same day, neither timed. */
  readonly firstNoteId: string
  readonly secondNoteId: string
}

let harness: Harness
let tenant: SeededTenant
let fixture: Fixture

beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('planner')
  stubs.scope = tenant.scope
  stubs.mirrored = []
  stubs.roomRejects = false
  stubs.refused = 0

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

  const cafe = await createPlace(scope, {
    tripId: trip.id,
    name: 'Café Sacher',
  })
  const opera = await createPlace(scope, {
    tripId: trip.id,
    name: 'Staatsoper',
  })

  const morning = await createAssignment(scope, {
    tripId: trip.id,
    dayId: first.id,
    placeId: cafe.id,
    orderIndex: 0,
    startTime: '09:00',
  })
  const evening = await createAssignment(scope, {
    tripId: trip.id,
    dayId: first.id,
    placeId: opera.id,
    orderIndex: 1,
    startTime: '17:00',
  })
  const firstNote = await createDayNote(scope, {
    tripId: trip.id,
    dayId: first.id,
    body: 'Tickets are at the hotel desk.',
    sortOrder: 2,
  })
  const secondNote = await createDayNote(scope, {
    tripId: trip.id,
    dayId: first.id,
    body: 'Dress code is formal.',
    sortOrder: 3,
  })

  fixture = {
    tripId: trip.id,
    dayId: first.id,
    otherDayId: second.id,
    morningId: morning.id,
    eveningId: evening.id,
    firstNoteId: firstNote.id,
    secondNoteId: secondNote.id,
  }
})

afterEach(() => {
  harness.close()
})

/** The day's two tables read back as one number line, `id → position`. */
async function sequenceOf(dayId: string): Promise<Array<[string, number]>> {
  const scope = tenant.scope
  const [stops, notes] = await Promise.all([
    listDayAssignments(scope, dayId),
    listDayNotes(scope, dayId),
  ])
  return [
    ...stops.map((row) => [row.id, row.orderIndex] as [string, number]),
    ...notes.map((row) => [row.id, row.sortOrder] as [string, number]),
  ].sort((a, b) => a[1] - b[1])
}

/* --------------------------------------------------------------- the writes */

describe('the merged day reaches both position columns', () => {
  it('interleaves a note between two stops and numbers the day 0..n-1', async () => {
    await reorderPlan({
      tripId: fixture.tripId,
      days: [
        {
          dayId: fixture.dayId,
          items: [
            { kind: 'stop', id: fixture.morningId },
            { kind: 'note', id: fixture.firstNoteId },
            { kind: 'stop', id: fixture.eveningId },
            { kind: 'note', id: fixture.secondNoteId },
          ],
        },
      ],
    })

    expect(await sequenceOf(fixture.dayId)).toEqual([
      [fixture.morningId, 0],
      [fixture.firstNoteId, 1],
      [fixture.eveningId, 2],
      [fixture.secondNoteId, 3],
    ])
  })

  it('drops an id the day does not hold and keeps the rest a clean sequence', async () => {
    await reorderPlan({
      tripId: fixture.tripId,
      days: [
        {
          dayId: fixture.dayId,
          items: [
            { kind: 'note', id: fixture.secondNoteId },
            { kind: 'stop', id: 'assignment_that_was_deleted' },
            { kind: 'stop', id: fixture.morningId },
          ],
        },
      ],
    })

    // The two the client never mentioned keep their relative position rather than
    // being sent to the end of the day.
    expect(await sequenceOf(fixture.dayId)).toEqual([
      [fixture.secondNoteId, 0],
      [fixture.morningId, 1],
      [fixture.eveningId, 2],
      [fixture.firstNoteId, 3],
    ])
  })

  it('moves a stop onto another day and renumbers both', async () => {
    await reorderPlan({
      tripId: fixture.tripId,
      days: [
        {
          dayId: fixture.otherDayId,
          items: [{ kind: 'stop', id: fixture.eveningId }],
        },
        {
          dayId: fixture.dayId,
          items: [
            { kind: 'stop', id: fixture.morningId },
            { kind: 'note', id: fixture.firstNoteId },
            { kind: 'note', id: fixture.secondNoteId },
          ],
        },
      ],
    })

    expect(await sequenceOf(fixture.otherDayId)).toEqual([
      [fixture.eveningId, 0],
    ])
    expect(await sequenceOf(fixture.dayId)).toEqual([
      [fixture.morningId, 0],
      [fixture.firstNoteId, 1],
      [fixture.secondNoteId, 2],
    ])
  })
})

describe('dropping a time as part of the move', () => {
  it('nulls the stop’s time and writes the order together', async () => {
    await reorderPlan({
      tripId: fixture.tripId,
      days: [
        {
          dayId: fixture.dayId,
          items: [
            { kind: 'stop', id: fixture.eveningId },
            { kind: 'stop', id: fixture.morningId },
            { kind: 'note', id: fixture.firstNoteId },
            { kind: 'note', id: fixture.secondNoteId },
          ],
          clearTime: [{ kind: 'stop', id: fixture.eveningId }],
        },
      ],
    })

    const stops = await listDayAssignments(tenant.scope, fixture.dayId)
    const evening = stops.find((row) => row.id === fixture.eveningId)
    const morning = stops.find((row) => row.id === fixture.morningId)

    // The 17:00 is gone and the row is first, in that one write: never a moment in
    // which it has a time and the wrong position.
    expect(evening?.startTime).toBeNull()
    expect(evening?.orderIndex).toBe(0)
    // The row that was not asked about keeps its own time.
    expect(morning?.startTime).toBe('09:00')
    expect(morning?.orderIndex).toBe(1)
  })

  it('nulls a note’s time the same way', async () => {
    const scope = tenant.scope
    const timed = await createDayNote(scope, {
      tripId: fixture.tripId,
      dayId: fixture.dayId,
      body: 'Leave for the airport.',
      time: '06:30',
      sortOrder: 4,
    })

    await reorderPlan({
      tripId: fixture.tripId,
      days: [
        {
          dayId: fixture.dayId,
          items: [
            { kind: 'stop', id: fixture.morningId },
            { kind: 'note', id: timed.id },
          ],
          clearTime: [{ kind: 'note', id: timed.id }],
        },
      ],
    })

    const notes = await listDayNotes(scope, fixture.dayId)
    expect(notes.find((row) => row.id === timed.id)?.time).toBeNull()
  })

  it('is refused by the validator when the row is not being moved', async () => {
    expect(() =>
      reorderPlanInputSchema.parse({
        tripId: fixture.tripId,
        days: [
          {
            dayId: fixture.dayId,
            items: [{ kind: 'stop', id: fixture.morningId }],
            clearTime: [{ kind: 'stop', id: fixture.eveningId }],
          },
        ],
      }),
    ).toThrow(/only be dropped by the move/i)
  })

  it('is refused for a kind that does not match the moved row', async () => {
    // Same id, other table: the pair is the identity, not the id alone.
    expect(() =>
      reorderPlanInputSchema.parse({
        tripId: fixture.tripId,
        days: [
          {
            dayId: fixture.dayId,
            items: [{ kind: 'stop', id: fixture.morningId }],
            clearTime: [{ kind: 'note', id: fixture.morningId }],
          },
        ],
      }),
    ).toThrow(/only be dropped by the move/i)
  })

  it('never reaches the write when the validator refuses', async () => {
    const before = await sequenceOf(fixture.dayId)
    await expect(
      reorderPlan({
        tripId: fixture.tripId,
        days: [
          {
            dayId: fixture.dayId,
            items: [{ kind: 'stop', id: fixture.morningId }],
            clearTime: [{ kind: 'stop', id: fixture.eveningId }],
          },
        ],
      }),
    ).rejects.toThrow()

    expect(await sequenceOf(fixture.dayId)).toEqual(before)
    expect(stubs.mirrored).toEqual([])
  })
})

describe('the trip room still hears about it', () => {
  it('mirrors one `day` upsert per touched day, carrying the merged order', async () => {
    await reorderPlan({
      tripId: fixture.tripId,
      days: [
        {
          dayId: fixture.otherDayId,
          items: [{ kind: 'stop', id: fixture.eveningId }],
        },
        {
          dayId: fixture.dayId,
          items: [
            { kind: 'note', id: fixture.firstNoteId },
            { kind: 'stop', id: fixture.morningId },
            { kind: 'note', id: fixture.secondNoteId },
          ],
        },
      ],
    })

    expect(stubs.mirrored).toHaveLength(1)
    const call = stubs.mirrored.at(0)
    expect(call?.tripId).toBe(fixture.tripId)
    expect(call?.patches.map((entry) => entry.entity)).toEqual([
      { kind: 'day', id: fixture.otherDayId },
      { kind: 'day', id: fixture.dayId },
    ])
    expect(call?.patches.every((entry) => entry.op === 'upsert')).toBe(true)
    expect(call?.patches.at(1)?.fields).toEqual({
      items: [
        { kind: 'note', id: fixture.firstNoteId },
        { kind: 'stop', id: fixture.morningId },
        { kind: 'note', id: fixture.secondNoteId },
      ],
    })
  })

  it('mirrors one patch per day and no more, however many rows moved', async () => {
    await reorderPlan({
      tripId: fixture.tripId,
      days: [
        {
          dayId: fixture.dayId,
          items: [
            { kind: 'note', id: fixture.secondNoteId },
            { kind: 'note', id: fixture.firstNoteId },
            { kind: 'stop', id: fixture.eveningId },
            { kind: 'stop', id: fixture.morningId },
          ],
        },
      ],
    })

    expect(stubs.mirrored.at(0)?.patches).toHaveLength(1)
  })

  it('does not fail the save when the room refuses', async () => {
    stubs.roomRejects = true

    await reorderPlan({
      tripId: fixture.tripId,
      days: [
        {
          dayId: fixture.dayId,
          items: [
            { kind: 'note', id: fixture.firstNoteId },
            { kind: 'stop', id: fixture.morningId },
            { kind: 'stop', id: fixture.eveningId },
            { kind: 'note', id: fixture.secondNoteId },
          ],
        },
      ],
    })

    // D1 is the record: the order is written even though nobody was told, and the
    // silence is over an attempt that happened rather than over one never made.
    expect(stubs.refused).toBe(1)
    expect(stubs.mirrored).toEqual([])
    expect(await sequenceOf(fixture.dayId)).toEqual([
      [fixture.firstNoteId, 0],
      [fixture.morningId, 1],
      [fixture.eveningId, 2],
      [fixture.secondNoteId, 3],
    ])
  })
})

describe('who may rearrange a day', () => {
  it('refuses a viewer before a single row has moved', async () => {
    const viewerId = await tenant.addUser('A viewer')
    await addTripMember(tenant.scope, {
      tripId: fixture.tripId,
      userId: viewerId,
      role: 'viewer',
    })
    const before = await sequenceOf(fixture.dayId)
    stubs.scope = tenant.scopeFor(viewerId)

    // A cross-day move, which is the step that runs *before* the per-day write: the
    // one place a role check the handler forgot would have let a read-only member
    // through.
    const refusal = await reorderPlan({
      tripId: fixture.tripId,
      days: [
        {
          dayId: fixture.otherDayId,
          items: [{ kind: 'stop', id: fixture.eveningId }],
        },
      ],
    }).catch((error: unknown) => error)

    expect(refusal).toBeInstanceOf(RepositoryError)
    expect((refusal as RepositoryError).code).toBe('FORBIDDEN')
    expect(await sequenceOf(fixture.otherDayId)).toEqual([])
    expect(await sequenceOf(fixture.dayId)).toEqual(before)
    expect(stubs.mirrored).toEqual([])
  })
})
