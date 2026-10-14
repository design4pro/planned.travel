/**
 * How a trip's cover is derived on the server.
 *
 * The browser names a file; the server resolves it inside the caller's workspace and writes the
 * object key and the URL itself. Every case here is a way of naming a file that must not become a
 * cover, plus the one way that must. The handler's return value is discarded outside a Start build,
 * so what a write did is read back through the repository.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  NotFoundError,
  RepositoryError,
  TripRoleError,
  addTripMember,
  createTrip,
  getTrip,
  recordFile,
} from '#/server/repos'
import {
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'

import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'

const ORIGIN = 'https://planned.travel'

const stubs = vi.hoisted(() => ({ scope: null as TenantScope | null }))

vi.mock('#/server/fns/context', () => ({
  closeRoom: async (): Promise<void> => undefined,
}))

vi.mock('#/server/auth/env', () => ({
  appUrl: () => 'https://planned.travel',
  taskQueue: () => ({
    send: async (): Promise<void> => undefined,
    sendBatch: async (): Promise<void> => undefined,
  }),
}))

vi.mock('../context', () => ({
  appScope: async (): Promise<TenantScope> => {
    if (stubs.scope === null) {
      throw new Error('This case has no acting scope.')
    }
    return stubs.scope
  },
}))

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

const { coverPatchFor, updateTripFn, updateTripInputSchema } =
  await import('../trip-lifecycle')

async function updateTrip(data: Record<string, unknown>): Promise<void> {
  const parsed = updateTripInputSchema.parse(data)
  await startStorage.run(
    {
      startOptions: {},
      request: new Request('https://planned.travel/_serverFn/x', {
        method: 'POST',
      }),
    },
    () => updateTripFn({ data: parsed as never }),
  )
}

let harness: Harness
let tenant: SeededTenant

beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('cover-derivation')
  await subscribeTenant(tenant.scope, 'crew')
  stubs.scope = tenant.scope
})

afterEach(() => {
  harness.close()
  stubs.scope = null
})

async function tripWithFile(
  scope: TenantScope,
  organizationId: string,
  options: { contentType?: string; filename?: string } = {},
): Promise<{ tripId: string; fileId: string; storageKey: string }> {
  const trip = await createTrip(scope, { title: 'Lisbon' })
  const filename = options.filename ?? 'cover.jpg'
  const storageKey = `trips/${organizationId}/${trip.id}/f1-${filename}`
  const file = await recordFile(scope, {
    tripId: trip.id,
    storageKey,
    filename,
    contentType: options.contentType ?? 'image/jpeg',
    sizeBytes: 2048,
  })
  return { tripId: trip.id, fileId: file.id, storageKey }
}

describe('the update input', () => {
  it('never takes a cover key or a URL from the client', () => {
    expect(
      updateTripInputSchema.safeParse({ tripId: 't', coverImageKey: 'x' })
        .success,
    ).toBe(false)
    expect(
      updateTripInputSchema.safeParse({
        tripId: 't',
        coverImageUrl: 'https://evil.example/x.png',
      }).success,
    ).toBe(false)
  })

  it('takes a file id, null, or nothing', () => {
    for (const coverFileId of ['file1', null, undefined]) {
      expect(
        updateTripInputSchema.safeParse({ tripId: 't', coverFileId }).success,
      ).toBe(true)
    }
  })
})

describe('coverPatchFor', () => {
  it('derives the key and the URL from the file row', async () => {
    const { tripId, fileId, storageKey } = await tripWithFile(
      tenant.scope,
      tenant.organizationId,
    )

    expect(await coverPatchFor(tenant.scope, tripId, fileId, ORIGIN)).toEqual({
      coverImageKey: storageKey,
      coverImageUrl: `${ORIGIN}/api/trips/${tripId}/cover?v=${fileId}`,
    })
  })

  it('clears both columns for null', async () => {
    const { tripId } = await tripWithFile(tenant.scope, tenant.organizationId)

    expect(await coverPatchFor(tenant.scope, tripId, null, ORIGIN)).toEqual({
      coverImageKey: null,
      coverImageUrl: null,
    })
  })

  it('refuses a file attached to another trip of the same workspace', async () => {
    const first = await tripWithFile(tenant.scope, tenant.organizationId)
    const second = await createTrip(tenant.scope, { title: 'Porto' })

    await expect(
      coverPatchFor(tenant.scope, second.id, first.fileId, ORIGIN),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('answers a file of another workspace as not found', async () => {
    const other = await harness.seedTenant('cover-derivation-other')
    await subscribeTenant(other.scope, 'crew')
    const foreign = await tripWithFile(other.scope, other.organizationId)
    const own = await createTrip(tenant.scope, { title: 'Porto' })

    await expect(
      coverPatchFor(tenant.scope, own.id, foreign.fileId, ORIGIN),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it.each(['image/svg+xml', 'image/heic', 'application/pdf'])(
    'refuses a %s file',
    async (contentType) => {
      const { tripId, fileId } = await tripWithFile(
        tenant.scope,
        tenant.organizationId,
        { contentType, filename: 'not-a-cover.bin' },
      )

      const failure = await coverPatchFor(
        tenant.scope,
        tripId,
        fileId,
        ORIGIN,
      ).catch((cause: unknown) => cause)
      expect(failure).toBeInstanceOf(RepositoryError)
      expect((failure as RepositoryError).code).toBe('COVER_FILE_REFUSED')
    },
  )

  it.each(['editor', 'viewer'] as const)(
    'is refused for a trip %s before the file is read',
    async (role) => {
      const { tripId, fileId } = await tripWithFile(
        tenant.scope,
        tenant.organizationId,
      )
      const userId = await tenant.addUser('Companion')
      await addTripMember(tenant.scope, { tripId, userId, role })

      await expect(
        coverPatchFor(tenant.scopeFor(userId), tripId, fileId, ORIGIN),
      ).rejects.toBeInstanceOf(TripRoleError)
    },
  )

  it('answers a private trip the caller is not on as not found', async () => {
    const { tripId, fileId } = await tripWithFile(
      tenant.scope,
      tenant.organizationId,
    )
    const outsider = tenant.scopeFor(await tenant.addUser('Colleague'))

    await expect(
      coverPatchFor(outsider, tripId, fileId, ORIGIN),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('updateTripFn with a cover', () => {
  it('records the derived key and URL on the trip', async () => {
    const { tripId, fileId, storageKey } = await tripWithFile(
      tenant.scope,
      tenant.organizationId,
    )

    await updateTrip({ tripId, coverFileId: fileId })

    const trip = await getTrip(tenant.scope, tripId)
    expect(trip?.coverImageKey).toBe(storageKey)
    expect(trip?.coverImageUrl).toBe(
      `${ORIGIN}/api/trips/${tripId}/cover?v=${fileId}`,
    )
  })

  it('clears the cover for null and leaves it alone when the field is absent', async () => {
    const { tripId, fileId, storageKey } = await tripWithFile(
      tenant.scope,
      tenant.organizationId,
    )
    await updateTrip({ tripId, coverFileId: fileId })

    await updateTrip({ tripId, title: 'Lisbon in May' })
    expect((await getTrip(tenant.scope, tripId))?.coverImageKey).toBe(
      storageKey,
    )

    await updateTrip({ tripId, coverFileId: null })
    const trip = await getTrip(tenant.scope, tripId)
    expect(trip?.coverImageKey).toBeNull()
    expect(trip?.coverImageUrl).toBeNull()
  })

  it('writes nothing when the reference is refused', async () => {
    const first = await tripWithFile(tenant.scope, tenant.organizationId)
    const second = await createTrip(tenant.scope, { title: 'Porto' })

    await expect(
      updateTrip({
        tripId: second.id,
        title: 'Renamed',
        coverFileId: first.fileId,
      }),
    ).rejects.toBeInstanceOf(NotFoundError)

    const trip = await getTrip(tenant.scope, second.id)
    expect(trip?.title).toBe('Porto')
    expect(trip?.coverImageKey).toBeNull()
  })
})
