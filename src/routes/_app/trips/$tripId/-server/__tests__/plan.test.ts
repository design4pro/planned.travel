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
  createAssignment,
  createPlace,
  createTrip,
  listDayAssignments,
  listTripDays,
  listTripPlaces,
} from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'

import type { SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'

/* ------------------------------------------------------------------ mocking */

const stubs = vi.hoisted(() => ({
  /** The scope `appScope()` resolves to. */
  scope: null as TenantScope | null,
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
  schedulePlaceFn,
  unschedulePlaceFn,
  updatePlanPlaceFn,
  updateStopFn,
} = await import('../plan')

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

let tenant: SeededTenant
let owner: TenantScope
let editor: TenantScope
let viewer: TenantScope
let stranger: TenantScope
let fixture: Fixture

beforeEach(async () => {
  const harness = await createHarness()
  tenant = await harness.seedTenant('planner')
  owner = tenant.scope
  stubs.scope = owner

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

  it('tells an editor of an archived trip it is the archive, not their role', async () => {
    await archiveTrip(owner, fixture.tripId)
    stubs.scope = editor

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
