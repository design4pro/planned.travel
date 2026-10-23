/**
 * The planner module over every caller a trip can have: what the board read tells them, and which
 * writes they are refused.
 *
 * Both halves answer PRD #104 decision 6 — an owner and an editor write the plan, a viewer reads it,
 * and a stranger learns nothing — from the two sides a reader meets it. `editable` is what every
 * write control on the board is drawn from; the handlers are what a stale tab, or a hand-made call,
 * reaches when that control is gone. `archived` rides beside `editable` because the rail explains
 * which of the two reasons took the controls away.
 *
 * The read is driven as a plain function, because outside a Start build a handler's return value is
 * discarded. The writes are driven through Start's storage, as `plan-reorder.test.ts` explains, and
 * what a refused write did is read back through the repositories rather than off the call.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  RepositoryError,
  addTripMember,
  archiveTrip,
  createAccommodation,
  createAssignment,
  createPlace,
  createReservation,
  createTrip,
  listDayAssignments,
  listTripDays,
  listTripPlaces,
  listTravelStats,
} from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'

import type { TaskBindings, TaskEnvelopeOf } from '#/server/queue/types'
import type { SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'

/* ------------------------------------------------------------------ mocking */

const stubs = vi.hoisted(() => ({
  /** The scope `appScope()` resolves to. */
  scope: null as TenantScope | null,
  sent: [] as Array<unknown>,
  rejects: false,
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

vi.mock('#/server/fns/context', () => ({
  mirrorToRoom: async () => undefined,
  patch: (kind: string, id: string, fields: unknown) => ({
    entity: { kind, id },
    op: 'upsert',
    fields,
  }),
}))

vi.mock('#/server/auth/env', () => ({
  taskQueue: () => ({
    sendBatch: async (messages: Array<{ body: unknown }>) => {
      if (stubs.rejects) throw new Error('queue unavailable')
      stubs.sent.push(...messages.map((message) => message.body))
    },
  }),
}))

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
    request: new Request('https://planned.travel/_serverFn/plan', {
      method: 'POST',
    }),
  }
}

const {
  createPlanPlaceFn,
  deletePlanPlaceFn,
  rankIdeasFn,
  readPlanBoard,
  reorderPlanFn,
  schedulePlaceFn,
  unschedulePlaceFn,
  updatePlanPlaceFn,
  updateStopFn,
} = await import('../plan')

const tripHandlers = await import('../../../../-server/trip')

/** Runs a handler inside a request context, the way the runtime does. */
async function inRequest<T>(run: () => Promise<T>): Promise<T> {
  return startStorage.run(startContext(), run)
}

/** Asserts that `run` rejects, and returns the error so the caller can name its class. */
async function captureError(run: () => Promise<unknown>): Promise<Error> {
  try {
    await run()
  } catch (error) {
    if (error instanceof Error) {
      return error
    }
    throw error
  }
  throw new Error('Expected the call to reject, but it resolved.')
}

/* ------------------------------------------------------------------ fixture */

interface Fixture {
  readonly tripId: string
  readonly dayId: string
  /** Scheduled on the first day. */
  readonly operaId: string
  readonly stopId: string
  /** In the ideas rail, on no day. */
  readonly cafeId: string
}

let seedOtherTenant: (label: string) => Promise<SeededTenant>
let tenant: SeededTenant
let database: TenantScope['db']
let owner: TenantScope
let editor: TenantScope
let viewer: TenantScope
let stranger: TenantScope
let fixture: Fixture

beforeEach(async () => {
  const harness = await createHarness()
  seedOtherTenant = harness.seedTenant
  database = harness.db
  tenant = await harness.seedTenant('planner')
  owner = tenant.scope
  stubs.scope = owner
  stubs.sent = []
  stubs.rejects = false

  const editorId = await tenant.addUser('A co-planner')
  const viewerId = await tenant.addUser('A reader')
  const strangerId = await tenant.addUser('Nobody on this trip')
  editor = tenant.scopeFor(editorId)
  viewer = tenant.scopeFor(viewerId)
  stranger = tenant.scopeFor(strangerId)

  const trip = await createTrip(owner, {
    title: 'Vienna in October',
    startDate: '2026-10-05',
    endDate: '2026-10-07',
    currency: 'EUR',
  })
  await addTripMember(owner, {
    tripId: trip.id,
    userId: editorId,
    role: 'editor',
  })
  await addTripMember(owner, {
    tripId: trip.id,
    userId: viewerId,
    role: 'viewer',
  })

  const first = (await listTripDays(owner, trip.id)).at(0)
  if (first === undefined) {
    throw new Error('A dated trip must have a day run.')
  }

  const opera = await createPlace(owner, {
    tripId: trip.id,
    name: 'Staatsoper',
  })
  const cafe = await createPlace(owner, {
    tripId: trip.id,
    name: 'Café Sperl',
  })
  const stop = await createAssignment(owner, {
    tripId: trip.id,
    dayId: first.id,
    placeId: opera.id,
    orderIndex: 0,
  })

  fixture = {
    tripId: trip.id,
    dayId: first.id,
    operaId: opera.id,
    stopId: stop.id,
    cafeId: cafe.id,
  }
})

/* --------------------------------------------------------------------- read */

describe('readPlanBoard', () => {
  it('lets an owner write the plan', async () => {
    const payload = await readPlanBoard(owner, fixture.tripId)

    expect(payload).toMatchObject({ editable: true, archived: false })
  })

  it('lets an editor write the plan', async () => {
    const payload = await readPlanBoard(editor, fixture.tripId)

    expect(payload).toMatchObject({ editable: true, archived: false })
  })

  it('gives a viewer the whole board and no write', async () => {
    const payload = await readPlanBoard(viewer, fixture.tripId)

    expect(payload).toMatchObject({ editable: false, archived: false })
    expect(payload.days).toHaveLength(3)
    expect(payload.days[0].stops.map((stop) => stop.placeId)).toEqual([
      fixture.operaId,
    ])
    expect(payload.unscheduledIds).toEqual([fixture.cafeId])
    expect(payload.places).toHaveLength(2)
  })

  it('refuses a non-member with not-found, and tells them nothing else', async () => {
    const error = await captureError(() =>
      readPlanBoard(stranger, fixture.tripId),
    )

    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).code).toBe('NOT_FOUND')
  })

  it('lets a workspace member read an organization-visible trip, and write none of it', async () => {
    // Organization visibility grants the read, never a role on the trip.
    const shared = await createTrip(owner, {
      title: 'Porto in June',
      startDate: '2026-06-01',
      endDate: '2026-06-02',
      visibility: 'organization',
    })

    const payload = await readPlanBoard(stranger, shared.id)

    expect(payload).toMatchObject({ editable: false, archived: false })
  })

  it('carries a stay under every day it covers, with its days, its times and its booking', async () => {
    const days = await listTripDays(owner, fixture.tripId)
    const booking = await createReservation(owner, {
      tripId: fixture.tripId,
      type: 'accommodation',
      title: 'Hotel Sacher',
    })
    const stay = await createAccommodation(owner, {
      tripId: fixture.tripId,
      startDayId: days[0].id,
      endDayId: days[2].id,
      name: 'Hotel Sacher',
      checkInTime: '15:00',
      checkInEndTime: '18:00',
      checkOutTime: '11:00',
      reservationId: booking.id,
    })

    const payload = await readPlanBoard(viewer, fixture.tripId)

    for (const day of payload.days) {
      expect(day.stays).toEqual([
        {
          id: stay.id,
          name: 'Hotel Sacher',
          startDayId: days[0].id,
          endDayId: days[2].id,
          checkInTime: '15:00',
          checkInEndTime: '18:00',
          checkOutTime: '11:00',
          reservationId: booking.id,
        },
      ])
    }
  })

  it('hands the stay dialog the trip’s currency and its days with the stops named', async () => {
    const payload = await readPlanBoard(owner, fixture.tripId)

    expect(payload.currency).toBe('EUR')
    expect(payload.bookingDays.map((day) => day.id)).toEqual(
      payload.days.map((day) => day.dayId),
    )
    expect(payload.bookingDays[0].stops).toEqual([
      {
        assignmentId: fixture.stopId,
        placeName: 'Staatsoper',
        startTime: null,
      },
    ])
  })

  it('takes writes away from everyone on an archived trip, and says it is the archive', async () => {
    await archiveTrip(owner, fixture.tripId)

    for (const scope of [owner, editor, viewer]) {
      const payload = await readPlanBoard(scope, fixture.tripId)
      expect(payload).toMatchObject({ editable: false, archived: true })
    }
  })
})

/* ------------------------------------------------------------------- writes */

describe('who may write the plan', () => {
  /** Every row a plan write can touch, read as the owner. */
  async function planState(): Promise<unknown> {
    const [stops, places] = await Promise.all([
      listDayAssignments(owner, fixture.dayId),
      listTripPlaces(owner, { tripId: fixture.tripId }),
    ])
    return { stops, places }
  }

  const blankPlace = {
    city: '',
    address: '',
    categoryId: '',
    durationMinutes: 0,
    rating: 0,
    lat: null,
    lng: null,
  }

  it('exposes no inventory-only place writer alongside the guarded planner', () => {
    expect(Object.keys(tripHandlers).sort()).toEqual([
      'loadPeople',
      'loadTripCosts',
      'loadTripFiles',
      'loadTripHeader',
      'loadTripLists',
      'loadTripPlan',
      'tripInput',
    ])
  })

  it.each(['editor', 'viewer'] as const)(
    'refuses an archived-trip add by an %s before checking the role',
    async (role) => {
      await archiveTrip(owner, fixture.tripId)
      const before = await planState()
      stubs.scope = role === 'editor' ? editor : viewer

      const error = await captureError(() =>
        inRequest(() =>
          createPlanPlaceFn({
            data: {
              tripId: fixture.tripId,
              name: 'Archived add',
              ...blankPlace,
              dayId: '',
            },
          }),
        ),
      )

      expect(error).toBeInstanceOf(RepositoryError)
      expect((error as RepositoryError).code).toBe('TRIP_ARCHIVED')
      expect(await planState()).toEqual(before)
    },
  )

  it('refuses an add by a non-member of an organization-visible trip', async () => {
    const trip = await createTrip(owner, {
      title: 'Workspace trip',
      visibility: 'organization',
    })
    const before = await listTripPlaces(owner, { tripId: trip.id })
    stubs.scope = stranger

    const error = await captureError(() =>
      inRequest(() =>
        createPlanPlaceFn({
          data: {
            tripId: trip.id,
            name: 'Non-member add',
            ...blankPlace,
            dayId: '',
          },
        }),
      ),
    )

    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).code).toBe('FORBIDDEN')
    expect(await listTripPlaces(owner, { tripId: trip.id })).toEqual(before)
  })

  it('reveals no trip to an add from another workspace and writes nothing', async () => {
    const before = await planState()
    const foreign = await seedOtherTenant('foreign-planner')
    stubs.scope = foreign.scope

    const error = await captureError(() =>
      inRequest(() =>
        createPlanPlaceFn({
          data: {
            tripId: fixture.tripId,
            name: 'Foreign add',
            ...blankPlace,
            dayId: '',
          },
        }),
      ),
    )

    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).code).toBe('NOT_FOUND')
    expect(await planState()).toEqual(before)
  })

  it('refuses every write from a viewer, and changes nothing', async () => {
    const before = await planState()
    stubs.scope = viewer

    const attempts: ReadonlyArray<() => Promise<unknown>> = [
      () =>
        schedulePlaceFn({
          data: {
            tripId: fixture.tripId,
            placeId: fixture.cafeId,
            dayId: fixture.dayId,
            index: 0,
          },
        }),
      () =>
        unschedulePlaceFn({
          data: { tripId: fixture.tripId, assignmentId: fixture.stopId },
        }),
      () =>
        rankIdeasFn({
          data: {
            tripId: fixture.tripId,
            placeIds: [fixture.cafeId, fixture.operaId],
          },
        }),
      () =>
        updateStopFn({
          data: {
            tripId: fixture.tripId,
            assignmentId: fixture.stopId,
            startTime: '19:00',
            endTime: '',
            durationMinutes: 0,
            notes: 'Rewritten by a reader.',
            reservationStatus: 'none',
          },
        }),
      () =>
        createPlanPlaceFn({
          data: {
            tripId: fixture.tripId,
            name: 'Not mine to add',
            ...blankPlace,
            dayId: '',
          },
        }),
      () =>
        updatePlanPlaceFn({
          data: {
            tripId: fixture.tripId,
            placeId: fixture.operaId,
            name: 'Renamed by a reader',
            ...blankPlace,
            isVisited: true,
          },
        }),
      () =>
        deletePlanPlaceFn({
          data: { tripId: fixture.tripId, placeId: fixture.operaId },
        }),
    ]
    for (const attempt of attempts) {
      const error = await captureError(() => inRequest(attempt))
      expect(error).toBeInstanceOf(RepositoryError)
      expect((error as RepositoryError).code).toBe('FORBIDDEN')
    }

    expect(await planState()).toEqual(before)
  })

  it('refuses a write that names a trip of the caller’s own to reach this one, and changes nothing', async () => {
    // Anyone in the workspace may start a trip and own it, so the role checked on the
    // named trip proves nothing about the rows the call addresses.
    const own = await createTrip(viewer, {
      title: 'My own weekend',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
    })
    const before = await planState()
    stubs.scope = viewer

    const attempts: ReadonlyArray<() => Promise<unknown>> = [
      () =>
        unschedulePlaceFn({
          data: { tripId: own.id, assignmentId: fixture.stopId },
        }),
      () =>
        updateStopFn({
          data: {
            tripId: own.id,
            assignmentId: fixture.stopId,
            startTime: '19:00',
            endTime: '',
            durationMinutes: 0,
            notes: 'Rewritten from next door.',
            reservationStatus: 'none',
          },
        }),
      () =>
        updatePlanPlaceFn({
          data: {
            tripId: own.id,
            placeId: fixture.operaId,
            name: 'Renamed from next door',
            ...blankPlace,
            isVisited: true,
          },
        }),
      () =>
        deletePlanPlaceFn({
          data: { tripId: own.id, placeId: fixture.operaId },
        }),
    ]
    for (const attempt of attempts) {
      const error = await captureError(() => inRequest(attempt))
      expect(error).toBeInstanceOf(RepositoryError)
      expect((error as RepositoryError).code).toBe('NOT_FOUND')
    }

    // A ranking carrying another trip's ids ranks none of them. It is not refused,
    // as a stale tab's ranking is not, so what it did is read from `sortOrder` below.
    await inRequest(() =>
      rankIdeasFn({
        data: { tripId: own.id, placeIds: [fixture.cafeId, fixture.operaId] },
      }),
    )

    expect(await planState()).toEqual(before)
  })

  it('refuses an add onto a day that is not this trip’s, and writes no place', async () => {
    // A stale tab can still name a day the trip no longer has (#511); a day of another
    // trip takes the same refusal in `requireTripDay`.
    const other = await createTrip(owner, {
      title: 'Graz in November',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
    })
    const [elsewhere] = await listTripDays(owner, other.id)
    const before = await planState()

    const error = await captureError(() =>
      inRequest(() =>
        createPlanPlaceFn({
          data: {
            tripId: fixture.tripId,
            name: 'Added from a stale tab',
            ...blankPlace,
            dayId: elsewhere.id,
          },
        }),
      ),
    )

    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).code).toBe('NOT_FOUND')
    expect(await planState()).toEqual(before)
  })

  it('tells a stranger the trip is not found before it tells them anything else', async () => {
    stubs.scope = stranger

    const error = await captureError(() =>
      inRequest(() =>
        deletePlanPlaceFn({
          data: { tripId: fixture.tripId, placeId: fixture.operaId },
        }),
      ),
    )

    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).code).toBe('NOT_FOUND')
  })

  it('tells a viewer of an archived trip it is the archive, not their role', async () => {
    // A viewer, because an editor passes the role check either way: only a caller
    // both checks would refuse tells which of the two runs first.
    await archiveTrip(owner, fixture.tripId)
    stubs.scope = viewer

    const error = await captureError(() =>
      inRequest(() =>
        deletePlanPlaceFn({
          data: { tripId: fixture.tripId, placeId: fixture.operaId },
        }),
      ),
    )

    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).code).toBe('TRIP_ARCHIVED')
  })

  it('still lets an editor write the plan', async () => {
    stubs.scope = editor

    await inRequest(() =>
      updateStopFn({
        data: {
          tripId: fixture.tripId,
          assignmentId: fixture.stopId,
          startTime: '19:00',
          endTime: '',
          durationMinutes: 0,
          notes: '',
          reservationStatus: 'none',
        },
      }),
    )

    const [stop] = await listDayAssignments(owner, fixture.dayId)
    expect(stop).toMatchObject({ id: fixture.stopId, startTime: '19:00' })
  })
})

describe('plan content statistics envelopes', () => {
  const fields = {
    city: '',
    address: '',
    categoryId: '',
    durationMinutes: 0,
    rating: 0,
    lat: null,
    lng: null,
  }
  const add = (tripId = fixture.tripId) =>
    inRequest(() =>
      createPlanPlaceFn({
        data: { tripId, name: 'Museum', ...fields, dayId: '' },
      }),
    )
  function expectYears() {
    expect(stubs.sent).toHaveLength(6)
    for (const scope of [owner, editor, viewer]) {
      for (const statYear of [0, 2026])
        expect(stubs.sent).toContainEqual(
          expect.objectContaining({
            orgId: tenant.organizationId,
            id: expect.stringContaining(
              `travel-stats:${tenant.organizationId}:${scope.ctx.userId}:${statYear}:`,
            ),
            payload: { userId: scope.ctx.userId, statYear },
          }),
        )
    }
  }
  it('enqueues after add and delete, and only a changed city on edit', async () => {
    await add()
    expectYears()
    const { createTravelStatsHandler } =
      await import('#/server/queue/handlers/travel-stats')
    const { createLogger, createMemorySink } =
      await import('#/server/observability/logger')
    const handler = createTravelStatsHandler(() => database)
    for (const envelope of stubs.sent as Array<
      TaskEnvelopeOf<'travel-stats'>
    >) {
      await handler(envelope.payload, {
        orgId: envelope.orgId,
        taskId: envelope.id,
        attempt: 1,
        now: Date.now,
        logger: createLogger({ sink: createMemorySink() }),
        env: {
          DB: {} as D1Database,
        } as TaskBindings,
        callProvider: async (_provider, send) => send(),
      })
    }
    expect(
      (await listTravelStats(owner, owner.ctx.userId)).find(
        (row) => row.statYear === 0,
      )?.placeCount,
    ).toBe(3)
    stubs.sent = []
    const data = {
      tripId: fixture.tripId,
      placeId: fixture.cafeId,
      name: 'Renamed',
      ...fields,
      isVisited: false,
    }
    await inRequest(() => updatePlanPlaceFn({ data }))
    expect(stubs.sent).toEqual([])
    await inRequest(() =>
      updatePlanPlaceFn({ data: { ...data, city: 'Vienna' } }),
    )
    expectYears()
    stubs.sent = []
    await inRequest(() =>
      deletePlanPlaceFn({
        data: { tripId: fixture.tripId, placeId: fixture.cafeId },
      }),
    )
    expectYears()
  })
  it('a refused queue leaves the place durable', async () => {
    stubs.rejects = true
    await add()
    expect(
      (await listTripPlaces(owner, { tripId: fixture.tripId })).some(
        (place) => place.name === 'Museum',
      ),
    ).toBe(true)
  })
  it('refuses viewers, private non-members, shared non-members, archived and foreign trips without envelopes', async () => {
    for (const scope of [viewer, stranger]) {
      stubs.scope = scope
      await expect(add()).rejects.toThrow()
      expect(stubs.sent).toEqual([])
    }
    stubs.scope = owner
    const foreign = await seedOtherTenant('foreign')
    const foreignTrip = await createTrip(foreign.scope, { title: 'Foreign' })
    await expect(add(foreignTrip.id)).rejects.toThrow()
    const shared = await createTrip(owner, {
      title: 'Shared',
      visibility: 'organization',
    })
    stubs.scope = stranger
    await expect(add(shared.id)).rejects.toThrow()
    stubs.scope = owner
    await archiveTrip(owner, fixture.tripId)
    await expect(add()).rejects.toThrow()
    expect(stubs.sent).toEqual([])
  })
  it('ranking, scheduling and stop edits enqueue nothing', async () => {
    await inRequest(() =>
      rankIdeasFn({
        data: { tripId: fixture.tripId, placeIds: [fixture.cafeId] },
      }),
    )
    await inRequest(() =>
      schedulePlaceFn({
        data: {
          tripId: fixture.tripId,
          placeId: fixture.cafeId,
          dayId: fixture.dayId,
          index: 0,
        },
      }),
    )
    await inRequest(() =>
      updateStopFn({
        data: {
          tripId: fixture.tripId,
          assignmentId: fixture.stopId,
          startTime: '19:00',
          endTime: '',
          durationMinutes: 0,
          notes: 'Changed stop',
          reservationStatus: 'none',
        },
      }),
    )
    await inRequest(() =>
      unschedulePlaceFn({
        data: { tripId: fixture.tripId, assignmentId: fixture.stopId },
      }),
    )
    const { createDayNoteFn } = await import('../day-notes')
    await inRequest(() =>
      createDayNoteFn({
        data: {
          tripId: fixture.tripId,
          dayId: fixture.dayId,
          body: 'Meet here',
        },
      }),
    )
    await inRequest(() =>
      reorderPlanFn({
        data: {
          tripId: fixture.tripId,
          days: [{ dayId: fixture.dayId, items: [] }],
        },
      }),
    )
    expect(stubs.sent).toEqual([])
  })
})
