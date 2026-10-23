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
  getFileByStorageKey,
  getTrip,
  recordFile,
  updateTrip as writeTrip,
} from '#/server/repos'
import {
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'
import { fakeBucket } from '#/server/storage/__tests__/fake-bucket'

import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { FakeBucket } from '#/server/storage/__tests__/fake-bucket'
import type { TenantScope } from '#/server/repos'
import type * as Observability from '#/server/observability'

const ORIGIN = 'https://planned.travel'

const stubs = vi.hoisted(() => ({
  scope: null as TenantScope | null,
  /** The `FILES` bucket `filesBucket()` answers with. */
  bucket: null as FakeBucket | null,
  /** Every record the module's logger wrote at `warn`. */
  warnings: [] as Array<{ message: string; fields: Record<string, unknown> }>,
}))

vi.mock('#/server/fns/context', () => ({
  closeRoom: async (): Promise<void> => undefined,
  filesBucket: (): FakeBucket => {
    if (stubs.bucket === null) {
      throw new Error('This case has no FILES bucket.')
    }
    return stubs.bucket
  },
}))

/** The module's logger, replaced with a recorder so a case can assert what a failed delete says. */
vi.mock('#/server/observability', async (importOriginal) => {
  const actual = await importOriginal<typeof Observability>()
  return {
    ...actual,
    createLogger: () => ({
      warn: (message: string, fields: Record<string, unknown>) => {
        stubs.warnings.push({ message, fields })
      },
      error: () => undefined,
      info: () => undefined,
      debug: () => undefined,
    }),
  }
})

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
  stubs.bucket = fakeBucket()
  stubs.warnings = []
})

afterEach(() => {
  harness.close()
  stubs.scope = null
  stubs.bucket = null
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

/**
 * A trip whose cover is the row-less object a copy leaves: the object is in the bucket and its key
 * is on the trip, and there is no file row for it (spec: the copied cover "is not a file row").
 */
async function tripWithCopiedCover(
  scope: TenantScope,
  organizationId: string,
): Promise<{ tripId: string; coverKey: string }> {
  const trip = await createTrip(scope, { title: 'Lisbon (copy)' })
  const coverKey = `trips/${organizationId}/${trip.id}/copied00000000000000001-cover.jpg`
  stubs.bucket = fakeBucket([...(stubs.bucket?.remaining ?? []), coverKey])
  await writeTrip(scope, trip.id, {
    coverImageKey: coverKey,
    coverImageUrl: `${ORIGIN}/api/trips/${trip.id}/cover?v=copied`,
  })
  return { tripId: trip.id, coverKey }
}

/** Puts a file's object in the bucket, beside whatever is already there. */
function putObject(key: string): void {
  stubs.bucket = fakeBucket([...(stubs.bucket?.remaining ?? []), key])
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

describe('updateTripFn reclaiming the cover it leaves behind', () => {
  it('deletes the row-less object when the cover is cleared', async () => {
    const { tripId, coverKey } = await tripWithCopiedCover(
      tenant.scope,
      tenant.organizationId,
    )

    await updateTrip({ tripId, coverFileId: null })

    expect(stubs.bucket?.remaining.has(coverKey)).toBe(false)
    expect((await getTrip(tenant.scope, tripId))?.coverImageKey).toBeNull()
  })

  it('deletes the old object and keeps the new cover when the cover is replaced', async () => {
    const { tripId, coverKey } = await tripWithCopiedCover(
      tenant.scope,
      tenant.organizationId,
    )
    const filename = 'new.jpg'
    const storageKey = `trips/${tenant.organizationId}/${tripId}/f2-${filename}`
    const file = await recordFile(tenant.scope, {
      tripId,
      storageKey,
      filename,
      contentType: 'image/jpeg',
      sizeBytes: 10,
    })
    putObject(storageKey)

    await updateTrip({ tripId, coverFileId: file.id })

    expect(stubs.bucket?.remaining.has(coverKey)).toBe(false)
    expect(stubs.bucket?.remaining.has(storageKey)).toBe(true)
    expect((await getTrip(tenant.scope, tripId))?.coverImageKey).toBe(
      storageKey,
    )
  })

  it('leaves no object that is neither a file row nor the cover', async () => {
    const { tripId, coverKey } = await tripWithCopiedCover(
      tenant.scope,
      tenant.organizationId,
    )
    const attachment = `trips/${tenant.organizationId}/${tripId}/f3-ticket.pdf`
    await recordFile(tenant.scope, {
      tripId,
      storageKey: attachment,
      filename: 'ticket.pdf',
      contentType: 'application/pdf',
      sizeBytes: 10,
    })
    putObject(attachment)

    await updateTrip({ tripId, coverFileId: null })

    const prefix = `trips/${tenant.organizationId}/${tripId}/`
    const left = [...(stubs.bucket?.remaining ?? [])].filter((key) =>
      key.startsWith(prefix),
    )
    expect(left).toEqual([attachment])
    expect(left).not.toContain(coverKey)
  })

  it.each(['cleared', 'replaced'] as const)(
    'keeps the object of a cover that is a file row when it is %s',
    async (change) => {
      const { tripId, fileId, storageKey } = await tripWithFile(
        tenant.scope,
        tenant.organizationId,
      )
      putObject(storageKey)
      await updateTrip({ tripId, coverFileId: fileId })
      const other = await recordFile(tenant.scope, {
        tripId,
        storageKey: `trips/${tenant.organizationId}/${tripId}/f9-other.jpg`,
        filename: 'other.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 10,
      })

      await updateTrip({
        tripId,
        coverFileId: change === 'cleared' ? null : other.id,
      })

      expect(stubs.bucket?.remaining.has(storageKey)).toBe(true)
      expect(await getFileByStorageKey(tenant.scope, storageKey)).not.toBeNull()
    },
  )

  it('deletes nothing when the update does not change the cover', async () => {
    const { tripId, coverKey } = await tripWithCopiedCover(
      tenant.scope,
      tenant.organizationId,
    )

    await updateTrip({ tripId, title: 'Lisbon in May' })

    expect(stubs.bucket?.calls).toEqual([])
    expect(stubs.bucket?.remaining.has(coverKey)).toBe(true)
  })

  it('deletes nothing when the cover is set to the one it already is', async () => {
    const { tripId, fileId, storageKey } = await tripWithFile(
      tenant.scope,
      tenant.organizationId,
    )
    putObject(storageKey)
    await updateTrip({ tripId, coverFileId: fileId })

    await updateTrip({ tripId, coverFileId: fileId })

    expect(stubs.bucket?.calls).toEqual([])
    expect(stubs.bucket?.remaining.has(storageKey)).toBe(true)
  })

  it('deletes nothing when the trip write is refused', async () => {
    const { tripId, coverKey } = await tripWithCopiedCover(
      tenant.scope,
      tenant.organizationId,
    )
    const foreign = await tripWithFile(tenant.scope, tenant.organizationId)

    await expect(
      updateTrip({ tripId, coverFileId: foreign.fileId }),
    ).rejects.toBeInstanceOf(NotFoundError)

    expect(stubs.bucket?.calls).toEqual([])
    expect(stubs.bucket?.remaining.has(coverKey)).toBe(true)
    expect((await getTrip(tenant.scope, tripId))?.coverImageKey).toBe(coverKey)
  })

  it('deletes nothing for a trip member who is not the owner', async () => {
    const { tripId, coverKey } = await tripWithCopiedCover(
      tenant.scope,
      tenant.organizationId,
    )
    const userId = await tenant.addUser('Companion')
    await addTripMember(tenant.scope, { tripId, userId, role: 'editor' })
    stubs.scope = tenant.scopeFor(userId)

    await expect(
      updateTrip({ tripId, coverFileId: null }),
    ).rejects.toBeInstanceOf(TripRoleError)

    expect(stubs.bucket?.calls).toEqual([])
    expect(stubs.bucket?.remaining.has(coverKey)).toBe(true)
  })

  it('logs a warning and still saves when the bucket delete fails', async () => {
    const { tripId, coverKey } = await tripWithCopiedCover(
      tenant.scope,
      tenant.organizationId,
    )
    const bucket = stubs.bucket as FakeBucket
    stubs.bucket = {
      ...bucket,
      delete: async () => {
        throw new Error('FILES is unreachable')
      },
    }

    await updateTrip({ tripId, coverFileId: null })

    expect((await getTrip(tenant.scope, tripId))?.coverImageKey).toBeNull()
    expect(stubs.warnings).toHaveLength(1)
    expect(stubs.warnings[0]?.fields).toMatchObject({
      tripId,
      storageKey: coverKey,
    })
  })

  describe('tenant isolation', () => {
    it("never deletes another workspace's object named by the cover key", async () => {
      const other = await harness.seedTenant('cover-reclaim-other')
      await subscribeTenant(other.scope, 'crew')
      const otherTrip = await createTrip(other.scope, { title: 'Porto' })
      const foreignKey = `trips/${other.organizationId}/${otherTrip.id}/f1-cover.jpg`
      const foreignFile = await recordFile(other.scope, {
        tripId: otherTrip.id,
        storageKey: foreignKey,
        filename: 'cover.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 10,
      })
      const { tripId } = await tripWithCopiedCover(
        tenant.scope,
        tenant.organizationId,
      )
      putObject(foreignKey)
      await writeTrip(tenant.scope, tripId, { coverImageKey: foreignKey })

      await updateTrip({ tripId, coverFileId: null })

      expect(stubs.bucket?.remaining.has(foreignKey)).toBe(true)
      expect(await getFileByStorageKey(other.scope, foreignKey)).toMatchObject({
        id: foreignFile.id,
      })
    })

    it("never deletes another trip's object of the same workspace", async () => {
      const { tripId } = await tripWithCopiedCover(
        tenant.scope,
        tenant.organizationId,
      )
      const sibling = await tripWithCopiedCover(
        tenant.scope,
        tenant.organizationId,
      )
      await writeTrip(tenant.scope, tripId, {
        coverImageKey: sibling.coverKey,
      })

      await updateTrip({ tripId, coverFileId: null })

      expect(stubs.bucket?.remaining.has(sibling.coverKey)).toBe(true)
    })

    it("does not let another workspace's file row for the key keep the object", async () => {
      const other = await harness.seedTenant('cover-reclaim-row')
      await subscribeTenant(other.scope, 'crew')
      const otherTrip = await createTrip(other.scope, { title: 'Porto' })
      const { tripId, coverKey } = await tripWithCopiedCover(
        tenant.scope,
        tenant.organizationId,
      )
      await recordFile(other.scope, {
        tripId: otherTrip.id,
        storageKey: coverKey,
        filename: 'cover.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 10,
      })

      await updateTrip({ tripId, coverFileId: null })

      expect(stubs.bucket?.remaining.has(coverKey)).toBe(false)
      expect(await getFileByStorageKey(tenant.scope, coverKey)).toBeNull()
    })

    it('never deletes a key that only shares the trip id as a prefix', async () => {
      const { tripId } = await tripWithCopiedCover(
        tenant.scope,
        tenant.organizationId,
      )
      const lookalike = `trips/${tenant.organizationId}/${tripId}x/f1-cover.jpg`
      putObject(lookalike)
      await writeTrip(tenant.scope, tripId, { coverImageKey: lookalike })

      await updateTrip({ tripId, coverFileId: null })

      expect(stubs.bucket?.remaining.has(lookalike)).toBe(true)
    })
  })
})
