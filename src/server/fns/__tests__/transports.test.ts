/**
 * The transport write boundary: a transport id named together with a trip (#1027).
 *
 * Set-status and delete take a trip id and a transport id and act on the *trip's* id - the room they
 * tell, the screen that refetches - while the repository looks the transport up by its own id. So a
 * caller who may see trip A and holds a writer role on trip B could change B's transport while
 * naming A, and the change would be committed to A's room instead of B's. The handlers pair the two
 * ids before they write, and a mismatch answers `NotFoundError` exactly as a missing id does.
 *
 * Driven through the real handlers inside a Start context, for what they *do* to the database and
 * the room: outside a Start build a server function discards its answer (see `reservations.test.ts`).
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addTripMember,
  archiveTrip,
  createTransport,
  createTrip,
  getTransport,
  listTravelStats,
} from '#/server/repos'
import { NotFoundError } from '#/server/repos/context'
import {
  captureError,
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'

import type { TenantScope } from '#/server/repos'
import type { TaskBindings, TaskEnvelopeOf } from '#/server/queue/types'
import type { SeededTenant } from '#/server/repos/__tests__/harness'

/* ------------------------------------------------------------------ mocking */

const stubs = vi.hoisted(() => ({
  scope: null as TenantScope | null,
  sent: [] as Array<unknown>,
  rejects: false,
  mirrorToRoom: vi.fn(async (): Promise<void> => undefined),
}))

/** `./context` imports `cloudflare:workers`; these are its pure helpers and a no-op room. */
vi.mock('../context', () => ({
  appScope: async (): Promise<unknown> => {
    if (stubs.scope === null) {
      throw new Error('unauthenticated')
    }
    return stubs.scope
  },
  mirrorToRoom: stubs.mirrorToRoom,
  patch: (kind: string, id: string, fields: unknown) => ({
    entity: { kind, id },
    op: 'upsert',
    fields,
  }),
  tombstone: (kind: string, id: string) => ({
    entity: { kind, id },
    op: 'delete',
    fields: {},
  }),
  orNull: (value: string | undefined): string | null => {
    if (value === undefined) {
      return null
    }
    const trimmed = value.trim()
    return trimmed.length === 0 ? null : trimmed
  },
}))

vi.mock('#/routes/_app/-server/context', () => ({
  appScope: async () => stubs.scope,
}))

/** The two modules below import `cloudflare:workers`; the handlers under test never reach them. */
vi.mock('#/server/billing/runtime.cloudflare', () => ({ billingRuntime: {} }))
vi.mock('#/server/transit/bindings', () => ({ transitRuntime: {} }))

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
    request: new Request('https://planned.travel/_serverFn/transports', {
      method: 'POST',
    }),
  }
}

const {
  deleteTransportFn,
  setTransportStatusFn,
  saveTransportFn,
  saveSearchedConnectionFn,
} = await import('../transports')

const setStatus = (data: {
  tripId: string
  transportId: string
  status: 'pending' | 'confirmed' | 'cancelled'
}) => startStorage.run(startContext(), () => setTransportStatusFn({ data }))

const remove = (data: { tripId: string; transportId: string }) =>
  startStorage.run(startContext(), () => deleteTransportFn({ data }))

/* -------------------------------------------------------------------- setup */

let tenant: SeededTenant
let owner: TenantScope
let tripA: string
let tripB: string
let transportB: string
/** A writer on trip B and a viewer of trip A: sees both, may change only B. */
let database: TenantScope['db']
let seedForeign: (name: string) => Promise<SeededTenant>
let caller: TenantScope

beforeEach(async () => {
  stubs.mirrorToRoom.mockClear()
  stubs.sent = []
  stubs.rejects = false
  const harness = await createHarness()
  database = harness.db
  seedForeign = harness.seedTenant
  tenant = await harness.seedTenant('transports')
  await subscribeTenant(tenant.scope, 'crew', 5)
  owner = tenant.scope
  tripA = (
    await createTrip(owner, {
      title: 'Tokyo in spring',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
    })
  ).id
  tripB = (
    await createTrip(owner, {
      title: 'Osaka later',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
    })
  ).id
  transportB = (
    await createTransport(owner, {
      tripId: tripB,
      title: 'Shinkansen to Osaka',
      mode: 'train',
    })
  ).id

  const callerId = await tenant.addUser('Writer on B, viewer of A')
  await addTripMember(owner, {
    tripId: tripA,
    userId: callerId,
    role: 'viewer',
  })
  await addTripMember(owner, {
    tripId: tripB,
    userId: callerId,
    role: 'editor',
  })
  caller = tenant.scopeFor(callerId)
  stubs.scope = caller
})

describe('a transport write naming another trip of the same caller', () => {
  async function expectUntouched(): Promise<void> {
    expect(stubs.mirrorToRoom).not.toHaveBeenCalled()
    const row = await getTransport(owner, transportB)
    expect(row?.tripId).toBe(tripB)
    expect(row?.status).toBe('pending')
  }

  it('refuses a status change with NotFoundError, before the write and the room update', async () => {
    const error = await captureError(() =>
      setStatus({
        tripId: tripA,
        transportId: transportB,
        status: 'cancelled',
      }),
    )
    expect(error).toBeInstanceOf(NotFoundError)
    await expectUntouched()
  })

  it('refuses a delete with NotFoundError, before the write and the room update', async () => {
    const error = await captureError(() =>
      remove({ tripId: tripA, transportId: transportB }),
    )
    expect(error).toBeInstanceOf(NotFoundError)
    await expectUntouched()
  })

  it('answers the same as a transport id that is not there', async () => {
    const paired = await captureError(() =>
      setStatus({
        tripId: tripA,
        transportId: transportB,
        status: 'cancelled',
      }),
    )
    const missing = await captureError(() =>
      setStatus({
        tripId: tripA,
        transportId: 'no-such-transport',
        status: 'cancelled',
      }),
    )
    expect(paired).toBeInstanceOf(NotFoundError)
    expect(missing).toBeInstanceOf(NotFoundError)
    expect((paired as NotFoundError).code).toBe((missing as NotFoundError).code)
  })
})

describe('the pairing is checked before the role', () => {
  it('answers NotFoundError, not the role refusal, to a viewer of the transport’s trip naming another trip', async () => {
    // Editor on A, viewer on B: the role guard on B would refuse with TripRoleError, so only a
    // pairing that runs first can answer NotFoundError.
    const viewerOfB = await tenant.addUser('Editor on A, viewer of B')
    await addTripMember(owner, {
      tripId: tripA,
      userId: viewerOfB,
      role: 'editor',
    })
    await addTripMember(owner, {
      tripId: tripB,
      userId: viewerOfB,
      role: 'viewer',
    })
    stubs.scope = tenant.scopeFor(viewerOfB)

    const status = await captureError(() =>
      setStatus({
        tripId: tripA,
        transportId: transportB,
        status: 'cancelled',
      }),
    )
    const removal = await captureError(() =>
      remove({ tripId: tripA, transportId: transportB }),
    )

    expect(status).toBeInstanceOf(NotFoundError)
    expect(removal).toBeInstanceOf(NotFoundError)
    expect(stubs.mirrorToRoom).not.toHaveBeenCalled()
    expect((await getTransport(owner, transportB))?.status).toBe('pending')
  })
})

it.each(['private', 'foreign'] as const)(
  'hides an archived %s transport named with a readable trip in status/delete calls',
  async (kind) => {
    const actualOwner =
      kind === 'foreign' ? (await seedForeign('hidden-transport')).scope : owner
    const hiddenTrip = await createTrip(actualOwner, {
      title: 'Hidden',
      visibility: 'private',
    })
    const hidden = await createTransport(actualOwner, {
      tripId: hiddenTrip.id,
      title: 'Hidden train',
      mode: 'train',
    })
    await archiveTrip(actualOwner, hiddenTrip.id)
    stubs.scope = caller
    await expect(
      setStatus({ tripId: tripA, transportId: hidden.id, status: 'confirmed' }),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      remove({ tripId: tripA, transportId: hidden.id }),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(await getTransport(actualOwner, hidden.id)).toEqual(hidden)
    expect(stubs.mirrorToRoom).not.toHaveBeenCalled()
    expect(stubs.sent).toEqual([])
  },
)

describe('a transport write naming its own trip', () => {
  it('changes the status and tells that trip’s room', async () => {
    await setStatus({
      tripId: tripB,
      transportId: transportB,
      status: 'confirmed',
    })
    expect((await getTransport(owner, transportB))?.status).toBe('confirmed')
    expect(stubs.mirrorToRoom).toHaveBeenCalledTimes(1)
    expect(stubs.mirrorToRoom).toHaveBeenCalledWith(
      expect.anything(),
      tripB,
      expect.anything(),
    )
  })

  it('deletes the transport and tells that trip’s room', async () => {
    await remove({ tripId: tripB, transportId: transportB })
    expect(await getTransport(owner, transportB)).toBeNull()
    expect(stubs.mirrorToRoom).toHaveBeenCalledTimes(1)
  })
})

describe('transport content roll-up', () => {
  function record(departureDate: string) {
    return {
      tripId: tripB,
      transportId: transportB,
      mode: 'train' as const,
      status: 'pending' as const,
      title: 'Journey',
      departureDayId: '',
      arrivalDayId: '',
      carrier: '',
      serviceNumber: '',
      bookingCode: '',
      seat: '',
      departureName: '',
      departureCode: '',
      departureDate,
      departureTime: '',
      arrivalName: '',
      arrivalCode: '',
      arrivalDate: '',
      arrivalTime: '',
      distanceMetres: 123000,
      priceMinor: 0,
      currency: '',
      notes: '',
      stations: [],
      legs: [],
    }
  }
  it('refuses archived writes before room notifications or roll-up messages', async () => {
    await archiveTrip(owner, tripB)
    const before = await getTransport(owner, transportB)
    const operations = [
      () =>
        setStatus({
          tripId: tripB,
          transportId: transportB,
          status: 'confirmed',
        }),
      () => remove({ tripId: tripB, transportId: transportB }),
      () =>
        startStorage.run(startContext(), () =>
          saveTransportFn({ data: record('2026-06-01') }),
        ),
      () =>
        startStorage.run(startContext(), () =>
          saveSearchedConnectionFn({
            data: {
              tripId: tripB,
              transportId: '',
              mode: 'train',
              title: 'Searched journey',
              priceMinor: 0,
              currency: '',
              stations: [
                { name: 'Osaka', code: '', lat: null, lng: null, timezone: '' },
                { name: 'Tokyo', code: '', lat: null, lng: null, timezone: '' },
              ],
              legs: [
                {
                  serviceNumber: '',
                  platform: '',
                  seat: '',
                  departureDayId: '',
                  arrivalDayId: '',
                  departureDate: '',
                  departureTime: '',
                  arrivalDate: '',
                  arrivalTime: '',
                },
              ],
            },
          }),
        ),
    ]
    for (const operation of operations) {
      await expect(operation()).rejects.toMatchObject({ code: 'TRIP_ARCHIVED' })
      expect(await getTransport(owner, transportB)).toEqual(before)
      expect(stubs.mirrorToRoom).not.toHaveBeenCalled()
      expect(stubs.sent).toEqual([])
    }
    for (const requestedTrip of [tripA, tripB]) {
      await expect(
        setStatus({
          tripId: requestedTrip,
          transportId: 'missing',
          status: 'confirmed',
        }),
      ).rejects.toBeInstanceOf(NotFoundError)
    }
    await expect(
      setStatus({
        tripId: tripA,
        transportId: transportB,
        status: 'confirmed',
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      remove({ tripId: tripA, transportId: transportB }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  function expectEnvelopes(years: Array<number>) {
    expect(stubs.sent).toHaveLength(years.length * 2)
    for (const scope of [owner, caller])
      for (const statYear of years)
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
  for (const intent of ['edit', undefined] as const)
    it(`saves both departure years with intent ${intent} and updates the stored distances`, async () => {
      await startStorage.run(startContext(), () =>
        saveTransportFn({ data: record('2027-01-01') }),
      )
      expectEnvelopes([0, 2026, 2027])
      stubs.sent = []
      await startStorage.run(startContext(), () =>
        saveTransportFn({ data: { ...record('2028-01-01'), intent } }),
      )
      expectEnvelopes([0, 2026, 2028, 2027])
      const { createPlanPlaceFn } =
        await import('#/routes/_app/trips/$tripId/-server/plan')
      await startStorage.run(startContext(), () =>
        createPlanPlaceFn({
          data: {
            tripId: tripB,
            name: 'Station museum',
            city: 'Osaka',
            address: '',
            categoryId: '',
            durationMinutes: 0,
            rating: 0,
            lat: null,
            lng: null,
            dayId: '',
          },
        }),
      )
      const { createTravelStatsHandler } =
        await import('#/server/queue/handlers/travel-stats')
      const { createLogger, createMemorySink } =
        await import('#/server/observability/logger')
      const handler = createTravelStatsHandler(() => database)
      const orgId = tenant.organizationId
      for (const envelope of stubs.sent as Array<
        TaskEnvelopeOf<'travel-stats'>
      >) {
        await handler(envelope.payload, {
          orgId,
          taskId: envelope.id,
          attempt: 1,
          now: Date.now,
          logger: createLogger({ sink: createMemorySink() }),
          env: {
            DB: {} as D1Database,
          } as TaskBindings,
          callProvider: async (_provider, operation) => operation(),
        })
      }
      const rows = await listTravelStats(owner, owner.ctx.userId)
      expect(rows.find((row) => row.statYear === 2027)?.distanceMetres).toBe(0)
      expect(rows.find((row) => row.statYear === 2028)?.distanceMetres).toBe(
        123000,
      )
      expect(rows.find((row) => row.statYear === 0)?.distanceMetres).toBe(
        123000,
      )
      expect(rows.find((row) => row.statYear === 0)?.placeCount).toBe(1)
    })
  it('deleting sends the removed departure year and status changes send nothing', async () => {
    await startStorage.run(startContext(), () =>
      saveTransportFn({ data: record('2027-01-01') }),
    )
    stubs.sent = []
    await setStatus({
      tripId: tripB,
      transportId: transportB,
      status: 'confirmed',
    })
    expect(stubs.sent).toEqual([])
    await remove({ tripId: tripB, transportId: transportB })
    expectEnvelopes([0, 2026, 2027])
  })
  it('refusing the queue does not fail a save', async () => {
    stubs.rejects = true
    await startStorage.run(startContext(), () =>
      saveTransportFn({ data: record('2027-01-01') }),
    )
    expect((await getTransport(owner, transportB))?.departureDate).toBe(
      '2027-01-01',
    )
  })
  it('refuses foreign and private non-member trips with no envelopes', async () => {
    const foreign = await seedForeign('foreign')
    const foreignTrip = await createTrip(foreign.scope, { title: 'Foreign' })
    await expect(
      startStorage.run(startContext(), () =>
        saveTransportFn({
          data: { ...record('2027-01-01'), tripId: foreignTrip.id },
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundError)
    const nonMember = tenant.scopeFor(await tenant.addUser('Not a traveller'))
    stubs.scope = nonMember
    await expect(
      startStorage.run(startContext(), () =>
        saveTransportFn({ data: record('2027-01-01') }),
      ),
    ).rejects.toThrow()
    expect(stubs.sent).toEqual([])
    const shared = await createTrip(owner, {
      title: 'Shared',
      visibility: 'organization',
    })
    await expect(
      startStorage.run(startContext(), () =>
        saveTransportFn({
          data: {
            ...record('2027-01-01'),
            transportId: 'new-shared',
            tripId: shared.id,
          },
        }),
      ),
    ).rejects.toThrow()
    stubs.scope = caller
    await expect(
      startStorage.run(startContext(), () =>
        saveTransportFn({
          data: {
            ...record('2027-01-01'),
            transportId: 'new-viewer',
            tripId: tripA,
          },
        }),
      ),
    ).rejects.toThrow()
    expect(stubs.sent).toEqual([])
  })
  it('searched connections send old and new departure years', async () => {
    await startStorage.run(startContext(), () =>
      saveTransportFn({ data: record('2027-01-01') }),
    )
    stubs.sent = []
    await startStorage.run(startContext(), () =>
      saveSearchedConnectionFn({
        data: {
          tripId: tripB,
          transportId: transportB,
          mode: 'train',
          title: 'Searched',
          priceMinor: 0,
          currency: '',
          stations: [
            { name: 'Paris', code: '', lat: null, lng: null, timezone: '' },
            { name: 'Lyon', code: '', lat: null, lng: null, timezone: '' },
          ],
          legs: [
            {
              serviceNumber: '',
              platform: '',
              seat: '',
              departureDayId: '',
              arrivalDayId: '',
              departureDate: '2028-01-01',
              departureTime: '',
              arrivalDate: '2028-01-01',
              arrivalTime: '',
            },
          ],
        },
      }),
    )
    expectEnvelopes([0, 2026, 2028, 2027])
  })
})
