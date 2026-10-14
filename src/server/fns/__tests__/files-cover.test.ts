/**
 * Deleting the file that is a trip's cover, and the guards in front of every file write.
 *
 * The cover is a file of the trip, so deleting it must not leave the tile pointing at bytes that are
 * gone. The clear is keyed on the file row's own trip and storage key (never on the `tripId` the
 * client sent) and runs for every role that may delete, so an editor's delete cannot fail halfway.
 * A viewer, an archived trip and a file of another trip are refused before any of it: no bucket
 * write or delete, no cover clear, no row change. Everything but the bucket is real: a migrated
 * SQLite database and the real repositories.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  NotFoundError,
  TripArchivedError,
  TripRoleError,
  addTripMember,
  archiveTrip,
  createTrip,
  getFile,
  getStorageUsage,
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
  putKeys: [] as Array<string>,
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
    put: async (key: string): Promise<void> => {
      stubs.putKeys.push(key)
    },
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

const { deleteTripFileFn, updateTripFileFn, uploadTripFileFn } =
  await import('../files')

function inRequest<T>(run: () => Promise<T>): Promise<T> {
  return startStorage.run(
    {
      startOptions: {},
      request: new Request('https://planned.travel/_serverFn/files', {
        method: 'POST',
      }),
    },
    run,
  )
}

function deleteFile(data: {
  tripId: string
  fileId: string
}): Promise<unknown> {
  return inRequest(() => deleteTripFileFn({ data }))
}

function renameFile(data: {
  tripId: string
  fileId: string
}): Promise<unknown> {
  return inRequest(() =>
    updateTripFileFn({
      data: {
        ...data,
        filename: 'renamed.jpg',
        kind: 'other',
        description: '',
      },
    }),
  )
}

async function uploadFile(tripId: string): Promise<Response> {
  const form = new FormData()
  form.set('tripId', tripId)
  form.set(
    'file',
    new File(['%PDF-1.4'], 'ticket.pdf', { type: 'application/pdf' }),
  )
  return inRequest(() => uploadTripFileFn({ data: form }))
}

let tenant: SeededTenant

beforeEach(async () => {
  const harness = await createHarness()
  tenant = await harness.seedTenant('files-cover')
  stubs.scope = tenant.scope
  stubs.deletedKeys = []
  stubs.putKeys = []
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

  it('refuses a file that is not on the requested trip and clears nothing', async () => {
    const { tripId, fileId, storageKey } = await tripWithCover()
    const decoy = await createTrip(tenant.scope, { title: 'Porto' })

    await expect(
      deleteFile({ tripId: decoy.id, fileId }),
    ).rejects.toBeInstanceOf(NotFoundError)

    expect((await getTrip(tenant.scope, tripId))?.coverImageKey).toBe(
      storageKey,
    )
    expect(await getFile(tenant.scope, fileId)).not.toBeNull()
    expect(stubs.deletedKeys).toEqual([])
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

describe('file writes and the trip guards', () => {
  async function member(
    tripId: string,
    role: 'viewer' | 'editor',
  ): Promise<void> {
    const userId = await tenant.addUser(role)
    await addTripMember(tenant.scope, { tripId, userId, role })
    stubs.scope = tenant.scopeFor(userId)
  }

  /** Every refusal leaves the bucket, the cover, the row and the storage count as they were. */
  async function expectUntouched(
    tripId: string,
    fileId: string,
    storageKey: string,
    bytes: number,
  ): Promise<void> {
    expect(stubs.putKeys).toEqual([])
    expect(stubs.deletedKeys).toEqual([])
    expect((await getTrip(tenant.scope, tripId))?.coverImageKey).toBe(
      storageKey,
    )
    expect((await getFile(tenant.scope, fileId))?.filename).toBe('cover.jpg')
    expect((await getStorageUsage(tenant.scope)).bytes).toBe(bytes)
  }

  it('refuses a viewer upload, rename and delete, and touches nothing', async () => {
    const { tripId, fileId, storageKey } = await tripWithCover()
    await member(tripId, 'viewer')

    const upload = await uploadFile(tripId)
    expect(await upload.json()).toEqual({
      ok: false,
      code: 'FORBIDDEN',
      message: new TripRoleError(['owner', 'editor'], 'viewer').message,
    })
    await expect(renameFile({ tripId, fileId })).rejects.toBeInstanceOf(
      TripRoleError,
    )
    await expect(deleteFile({ tripId, fileId })).rejects.toBeInstanceOf(
      TripRoleError,
    )

    await expectUntouched(tripId, fileId, storageKey, 2048)
  })

  it('refuses every write on an archived trip, owner included', async () => {
    const { tripId, fileId, storageKey } = await tripWithCover()
    await archiveTrip(tenant.scope, tripId)

    const upload = await uploadFile(tripId)
    expect(await upload.json()).toEqual({
      ok: false,
      code: 'TRIP_ARCHIVED',
      message: new TripArchivedError().message,
    })
    await expect(renameFile({ tripId, fileId })).rejects.toBeInstanceOf(
      TripArchivedError,
    )
    await expect(deleteFile({ tripId, fileId })).rejects.toBeInstanceOf(
      TripArchivedError,
    )

    await expectUntouched(tripId, fileId, storageKey, 2048)
  })

  it('answers someone who cannot see a private trip with NotFound, not the role refusal', async () => {
    const { tripId, fileId, storageKey } = await tripWithCover()
    stubs.scope = tenant.scopeFor(await tenant.addUser('Stranger'))

    await expect(uploadFile(tripId)).rejects.toBeInstanceOf(NotFoundError)
    await expect(renameFile({ tripId, fileId })).rejects.toBeInstanceOf(
      NotFoundError,
    )
    await expect(deleteFile({ tripId, fileId })).rejects.toBeInstanceOf(
      NotFoundError,
    )

    await expectUntouched(tripId, fileId, storageKey, 2048)
  })

  it('refuses a rename aimed at a file of another trip', async () => {
    const { fileId, storageKey, tripId } = await tripWithCover()
    const decoy = await createTrip(tenant.scope, { title: 'Porto' })

    await expect(
      renameFile({ tripId: decoy.id, fileId }),
    ).rejects.toBeInstanceOf(NotFoundError)

    await expectUntouched(tripId, fileId, storageKey, 2048)
  })

  it('lets an editor upload and rename', async () => {
    const { tripId, fileId } = await tripWithCover()
    await member(tripId, 'editor')

    const upload = await uploadFile(tripId)
    expect(await upload.json()).toMatchObject({ ok: true })
    expect(stubs.putKeys).toHaveLength(1)
    await renameFile({ tripId, fileId })
    expect((await getFile(tenant.scope, fileId))?.filename).toBe('renamed.jpg')
  })
})
