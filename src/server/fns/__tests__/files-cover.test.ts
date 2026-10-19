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
  listAuditLog,
  listTripFiles,
  recordFile,
  resolveQuotas,
  updateTrip,
  updateTripMember,
} from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'

import type * as Repositories from '#/server/repos'
import type { TenantScope } from '#/server/repos'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'

const stubs = vi.hoisted(() => ({
  scope: null as TenantScope | null,
  deletedKeys: [] as Array<string>,
  putKeys: [] as Array<string>,
  objects: new Set<string>(),
  afterPut: null as (() => Promise<void>) | null,
  room: vi.fn(async () => undefined),
  bucket: vi.fn(),
}))

// Observe the boundary calls while retaining their real repository implementations.
vi.mock('#/server/repos', async (importOriginal) => {
  const actual = await importOriginal<typeof Repositories>()
  return {
    ...actual,
    getStorageUsage: vi.fn(actual.getStorageUsage),
    resolveQuotas: vi.fn(actual.resolveQuotas),
  }
})

/** `./context` imports `cloudflare:workers` at module scope, which plain Node cannot resolve. */
vi.mock('../context', () => ({
  appScope: async (): Promise<unknown> => {
    if (stubs.scope === null) {
      throw new Error('unauthenticated')
    }
    return stubs.scope
  },
  filesBucket: () => {
    stubs.bucket()
    return {
      put: async (key: string): Promise<void> => {
        stubs.putKeys.push(key)
        stubs.objects.add(key)
        await stubs.afterPut?.()
      },
      delete: async (key: string): Promise<void> => {
        stubs.deletedKeys.push(key)
        stubs.objects.delete(key)
      },
    }
  },
  mirrorToRoom: stubs.room,
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
let harness: Harness

beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('files-cover')
  stubs.scope = tenant.scope
  stubs.deletedKeys = []
  stubs.putKeys = []
  stubs.objects.clear()
  stubs.afterPut = null
  vi.clearAllMocks()
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
  stubs.objects.add(storageKey)
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
    expect(stubs.objects.has(storageKey)).toBe(false)
    expect(stubs.room).toHaveBeenCalledExactlyOnceWith(tenant.scope, tripId, [
      expect.objectContaining({
        entity: { kind: 'trip', id: tripId },
        op: 'upsert',
      }),
    ])
    expect(
      (await listAuditLog(tenant.scope, { action: 'file.deleted' })).items,
    ).toEqual([
      expect.objectContaining({
        entityId: fileId,
        metadata: expect.objectContaining({ tripId }),
      }),
    ])
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
    expect(stubs.room).not.toHaveBeenCalled()
    expect(
      (await listAuditLog(tenant.scope, { action: 'file.deleted' })).items,
    ).toEqual([])
    expect(stubs.objects.has(storageKey)).toBe(true)
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
    expect(getStorageUsage).not.toHaveBeenCalled()
    expect(resolveQuotas).not.toHaveBeenCalled()
    expect(stubs.bucket).not.toHaveBeenCalled()
    expect(upload.status).toBe(200)
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

  it('refuses a visible nonmember before usage, quotas or storage, including stale rename and delete', async () => {
    const { tripId, fileId, storageKey } = await tripWithCover()
    await updateTrip(tenant.scope, tripId, { visibility: 'organization' })
    stubs.scope = tenant.scopeFor(await tenant.addUser('Visible nonmember'))

    const upload = await uploadFile(tripId)
    expect(upload.status).toBe(200)
    expect(await upload.json()).toEqual({
      ok: false,
      code: 'FORBIDDEN',
      message: new TripRoleError(['owner', 'editor'], null).message,
    })
    expect(getStorageUsage).not.toHaveBeenCalled()
    expect(resolveQuotas).not.toHaveBeenCalled()
    expect(stubs.bucket).not.toHaveBeenCalled()
    await expect(renameFile({ tripId, fileId })).rejects.toBeInstanceOf(
      TripRoleError,
    )
    await expect(deleteFile({ tripId, fileId })).rejects.toBeInstanceOf(
      TripRoleError,
    )
    await expectUntouched(tripId, fileId, storageKey, 2048)
  })

  it.each(['missing', 'other trip', 'other workspace'] as const)(
    'refuses a delete of a %s file before bucket, room or audit effects',
    async (kind) => {
      const { tripId, fileId, storageKey } = await tripWithCover()
      const before = await getFile(tenant.scope, fileId)
      let requestedFileId = 'missing-file'
      let foreign: {
        tenant: SeededTenant
        fileId: string
        storageKey: string
        row: Awaited<ReturnType<typeof getFile>>
      } | null = null
      if (kind === 'other trip') {
        const decoy = await createTrip(tenant.scope, { title: 'Decoy' })
        await expect(deleteFile({ tripId: decoy.id, fileId })).rejects.toEqual(
          new NotFoundError('file', fileId),
        )
      } else {
        if (kind === 'other workspace') {
          const beta = await harness.seedTenant('foreign-files')
          const trip = await createTrip(beta.scope, { title: 'Foreign' })
          const row = await recordFile(beta.scope, {
            tripId: trip.id,
            storageKey: 'foreign/ticket.pdf',
            filename: 'ticket.pdf',
            contentType: 'application/pdf',
            sizeBytes: 10,
          })
          foreign = {
            tenant: beta,
            fileId: row.id,
            storageKey: row.storageKey,
            row,
          }
          stubs.objects.add(row.storageKey)
          requestedFileId = row.id
        }
        await expect(
          deleteFile({ tripId, fileId: requestedFileId }),
        ).rejects.toEqual(new NotFoundError('file', requestedFileId))
      }
      expect(stubs.bucket).not.toHaveBeenCalled()
      await expectUntouched(tripId, fileId, storageKey, 2048)
      expect(await getFile(tenant.scope, fileId)).toEqual(before)
      if (foreign !== null) {
        expect(await getFile(foreign.tenant.scope, foreign.fileId)).toEqual(
          foreign.row,
        )
        expect(stubs.objects.has(foreign.storageKey)).toBe(true)
        expect(
          (await listAuditLog(foreign.tenant.scope, { action: 'file.deleted' }))
            .items,
        ).toEqual([])
      }
    },
  )

  it('cleans the stored object when recordFile refuses a role revoked after put', async () => {
    const { tripId, storageKey } = await tripWithCover()
    const editorId = await tenant.addUser('Editor losing access')
    const membership = await addTripMember(tenant.scope, {
      tripId,
      userId: editorId,
      role: 'editor',
    })
    stubs.scope = tenant.scopeFor(editorId)
    const before = await listTripFiles(tenant.scope, tripId)
    stubs.afterPut = async () => {
      await updateTripMember(tenant.scope, membership.id, { role: 'viewer' })
    }

    const response = await uploadFile(tripId)

    expect(await response.json()).toEqual({
      ok: false,
      code: 'rejected',
      message: new TripRoleError(['owner', 'editor'], 'viewer').message,
    })
    expect(getStorageUsage).toHaveBeenCalledOnce()
    expect(resolveQuotas).toHaveBeenCalled()
    expect(stubs.putKeys).toHaveLength(1)
    expect(stubs.deletedKeys).toEqual(stubs.putKeys)
    expect([...stubs.objects]).toEqual([storageKey])
    expect(await listTripFiles(tenant.scope, tripId)).toEqual(before)
    expect(stubs.room).not.toHaveBeenCalled()
    expect(
      (await listAuditLog(tenant.scope, { action: 'file.uploaded' })).items,
    ).toEqual([])
  })

  it('refuses every write on an archived trip, owner included', async () => {
    const { tripId, fileId, storageKey } = await tripWithCover()
    await archiveTrip(tenant.scope, tripId)

    const upload = await uploadFile(tripId)
    expect(getStorageUsage).not.toHaveBeenCalled()
    expect(resolveQuotas).not.toHaveBeenCalled()
    expect(stubs.bucket).not.toHaveBeenCalled()
    expect(upload.status).toBe(200)
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
    expect(getStorageUsage).not.toHaveBeenCalled()
    expect(resolveQuotas).not.toHaveBeenCalled()
    expect(stubs.bucket).not.toHaveBeenCalled()
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

  it('answers a refused type with the file name as a parameter beside the English message', async () => {
    const { tripId } = await tripWithCover()
    const form = new FormData()
    form.set('tripId', tripId)
    form.set(
      'file',
      new File(['<svg/>'], 'plan.svgz', { type: 'application/pdf' }),
    )

    const answer = await inRequest(() => uploadTripFileFn({ data: form }))

    expect(await answer.json()).toMatchObject({
      ok: false,
      code: 'blocked-type',
      message: expect.stringContaining('plan.svgz'),
      params: { name: 'plan.svgz' },
    })
    expect(stubs.putKeys).toHaveLength(0)
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
