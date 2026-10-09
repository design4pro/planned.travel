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
  createTransport,
  createTrip,
  getTransport,
} from '#/server/repos'
import { NotFoundError } from '#/server/repos/context'
import { captureError, createHarness } from '#/server/repos/__tests__/harness'

import type { TenantScope } from '#/server/repos'
import type { SeededTenant } from '#/server/repos/__tests__/harness'

/* ------------------------------------------------------------------ mocking */

const stubs = vi.hoisted(() => ({
  scope: null as TenantScope | null,
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

/** The two modules below import `cloudflare:workers`; the handlers under test never reach them. */
vi.mock('#/server/billing/runtime.cloudflare', () => ({ billingRuntime: {} }))
vi.mock('#/server/transit/bindings', () => ({ transitRuntime: {} }))

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

const { deleteTransportFn, setTransportStatusFn } =
  await import('../transports')

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
let caller: TenantScope

beforeEach(async () => {
  stubs.mirrorToRoom.mockClear()
  const harness = await createHarness()
  tenant = await harness.seedTenant('transports')
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
