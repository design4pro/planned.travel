/**
 * Deleting the file that is a trip's cover.
 *
 * The cover is a file of the trip, so deleting it must not leave the tile pointing at bytes that are
 * gone. The clear is keyed on the file row's own trip and storage key (never on the `tripId` the
 * client sent) and runs for every role that may delete, so an editor's delete cannot fail halfway.
 * Everything but the bucket is real: a migrated SQLite database and the real repositories.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addTripMember,
  createTrip,
  getFile,
  getTrip,
  recordFile,
  updateTrip,
} from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'

import type { TenantScope } from '#/server/repos'
import type { SeededTenant } from '#/server/repos/__tests__/harness'

const stubs = vi.hoisted(() => ({
  scope: null as TenantScope | null,
  deletedKeys: [] as Array<string>,
}))

/** `./context` imports `cloudflare:workers` at module scope, which plain Node cannot resolve. */
vi.mock('../context', () => ({
  appScope: async (): Promise<unknown> => {
    if (stubs.scope === null) {
      throw new Error('unauthenticated')
    }
    return stubs.scope
  },
  filesBucket: () => ({
    delete: async (key: string): Promise<void> => {
      stubs.deletedKeys.push(key)
    },
  }),
  mirrorToRoom: async (): Promise<void> => undefined,
  orNull: (value: string): string | null => (value === '' ? null : value),
  patch: (kind: string, id: string, fields: unknown) => ({
    entity: { kind, id },
    op: 'upsert',
    fields,
  }),
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

const { deleteTripFileFn } = await import('../files')

function deleteFile(data: {
  tripId: string
  fileId: string
}): Promise<unknown> {
  return startStorage.run(
    {
      startOptions: {},
      request: new Request('https://planned.travel/_serverFn/files', {
        method: 'POST',
      }),
    },
    () => deleteTripFileFn({ data }),
  )
}

let tenant: SeededTenant

beforeEach(async () => {
  const harness = await createHarness()
  tenant = await harness.seedTenant('files-cover')
  stubs.scope = tenant.scope
  stubs.deletedKeys = []
})

async function tripWithCover(): Promise<{
  tripId: string
  fileId: string
  storageKey: string
}> {
  const trip = await createTrip(tenant.scope, { title: 'Lisbon' })
  const storageKey = `trips/${tenant.organizationId}/${trip.id}/f1-cover.jpg`
  const file = await recordFile(tenant.scope, {
    tripId: trip.id,
    storageKey,
    filename: 'cover.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 2048,
  })
  await updateTrip(tenant.scope, trip.id, {
    coverImageKey: storageKey,
    coverImageUrl: `https://planned.travel/api/trips/${trip.id}/cover?v=${file.id}`,
  })
  return { tripId: trip.id, fileId: file.id, storageKey }
}

describe('deleteTripFileFn and the cover', () => {
  it('clears the cover when the deleted file is the cover', async () => {
    const { tripId, fileId, storageKey } = await tripWithCover()

    await deleteFile({ tripId, fileId })

    const trip = await getTrip(tenant.scope, tripId)
    expect(trip?.coverImageKey).toBeNull()
    expect(trip?.coverImageUrl).toBeNull()
    expect(await getFile(tenant.scope, fileId)).toBeNull()
    expect(stubs.deletedKeys).toEqual([storageKey])
  })

  it('leaves the cover when another file is deleted', async () => {
    const { tripId, storageKey } = await tripWithCover()
    const other = await recordFile(tenant.scope, {
      tripId,
      storageKey: `trips/${tenant.organizationId}/${tripId}/f2-ticket.pdf`,
      filename: 'ticket.pdf',
      contentType: 'application/pdf',
      sizeBytes: 100,
    })

    await deleteFile({ tripId, fileId: other.id })

    expect((await getTrip(tenant.scope, tripId))?.coverImageKey).toBe(
      storageKey,
    )
  })

  it('clears the trip the file row names, not the one the request names', async () => {
    const { tripId, fileId } = await tripWithCover()
    const decoy = await createTrip(tenant.scope, { title: 'Porto' })

    await deleteFile({ tripId: decoy.id, fileId })

    expect((await getTrip(tenant.scope, tripId))?.coverImageKey).toBeNull()
  })

  it('lets an editor delete the cover file without failing halfway', async () => {
    const { tripId, fileId } = await tripWithCover()
    const editorId = await tenant.addUser('Editor')
    await addTripMember(tenant.scope, {
      tripId,
      userId: editorId,
      role: 'editor',
    })
    stubs.scope = tenant.scopeFor(editorId)

    await deleteFile({ tripId, fileId })

    expect((await getTrip(tenant.scope, tripId))?.coverImageKey).toBeNull()
    expect(stubs.deletedKeys).toHaveLength(1)
  })
})
