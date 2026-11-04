import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getStorageUsage,
  getTripStorageBytes,
  recordFile,
  deleteFile,
  updateFile,
} from '../files'
import {
  createTrip,
  deleteTrip,
  startTripCopy,
  updateTrip,
  finishTripCopy,
} from '../trips'
import { upsertSubscription } from '../billing'
import { createHarness, subscribeTenant } from './harness'
import {
  abandonStorage,
  cleanupStorage,
  copyStoredCover,
  purgeStorageKey,
  writeStorageObject,
} from '#/server/storage/admission'
import { fakeBucket } from '#/server/storage/__tests__/fake-bucket'
import {
  beginStorageWrite,
  cancelStorage,
  claimStorageCleanup,
  confirmStorageCleanup,
  findStorageObject,
  listedStorageKeys,
  removedFileStorage,
  legacyStorageCovers,
  observeLegacyCover,
  reserveStorage,
  retainTripStorage,
  settleStorage,
  STORAGE_RESERVATION_MS,
  storageCleanupCandidates,
} from '../storage-admission'
import { NotFoundError } from '../context'
import type { Harness, SeededTenant } from './harness'

describe('shared storage admission', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('admission')
    tripId = (await createTrip(tenant.scope, { title: 'Files' })).id
  })
  afterEach(() => {
    vi.useRealTimers()
    harness.close()
  })

  it.each(['files', 'storage_bytes'] as const)(
    'admits only one concurrent writer at the %s ceiling',
    async (metric) => {
      await upsertSubscription(tenant.scope, {
        quotaOverrides: metric === 'files' ? { files: 1 } : {},
        storageLimitBytes: metric === 'storage_bytes' ? 10 : 1000,
      })
      const results = await Promise.allSettled(
        ['first', 'second'].map((name) =>
          recordFile(tenant.scope, {
            tripId,
            storageKey: `trips/${tenant.organizationId}/${tripId}/${name}.pdf`,
            filename: `${name}.pdf`,
            contentType: 'application/pdf',
            sizeBytes: 10,
          }),
        ),
      )
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1)
      expect(await getStorageUsage(tenant.scope)).toMatchObject({
        bytes: 10,
        fileCount: 1,
      })
    },
  )
  function input(name = 'upload', sizeBytes = 10) {
    return {
      tripId,
      storageKey: `trips/${tenant.organizationId}/${tripId}/${name}.jpg`,
      sizeBytes,
      kind: 'image' as const,
    }
  }

  it('admits Crew writers with unlimited file count while enforcing its finite byte ceiling', async () => {
    await subscribeTenant(tenant.scope, 'crew')
    await upsertSubscription(tenant.scope, { storageLimitBytes: 20 })
    await recordFile(tenant.scope, {
      ...input('attachment'), filename: 'photo.jpg', contentType: 'image/jpeg',
    })
    const source = input('attachment')
    const store = fakeBucket({ [source.storageKey]: { body: '1234567890' } })
    const target = await startTripCopy(tenant.scope, tripId, { title: 'Copy' })
    await copyStoredCover(tenant.scope, store, target, source.storageKey,
      `trips/${tenant.organizationId}/${target}/cover.jpg`)
    expect(await getStorageUsage(tenant.scope)).toMatchObject({ bytes: 20, fileCount: 2 })
    await expect(reserveStorage(tenant.scope, input('over-limit', 1))).rejects.toMatchObject({ metric: 'storage_bytes' })
  })

  it('isolates reservations, settlement, cleanup and usage across tenants', async () => {
    const beta = await harness.seedTenant('other')
    const reserved = await reserveStorage(tenant.scope, input())
    expect(await getStorageUsage(beta.scope)).toMatchObject({
      fileCount: 0,
      bytes: 0,
    })
    expect(await getTripStorageBytes(beta.scope, tripId)).toBe(0)
    expect(await findStorageObject(beta.scope, reserved.storageKey)).toBeNull()
    expect(await listedStorageKeys(beta.scope, [reserved.storageKey])).toEqual(
      new Set(),
    )
    expect(await removedFileStorage(beta.scope, tripId, 'missing')).toBeNull()
    expect(await storageCleanupCandidates(beta.scope)).toEqual([])
    await expect(reserveStorage(beta.scope, input())).rejects.toBeInstanceOf(
      NotFoundError,
    )
    await expect(
      beginStorageWrite(beta.scope, reserved.id),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(settleStorage(beta.scope, reserved.id)).rejects.toBeInstanceOf(
      NotFoundError,
    )
    expect(await cancelStorage(beta.scope, reserved.id)).toBeNull()
    expect(await claimStorageCleanup(beta.scope, reserved.id)).toBeNull()
    await confirmStorageCleanup(beta.scope, reserved.id)
    await retainTripStorage(beta.scope, tripId)
    expect(await getStorageUsage(tenant.scope)).toMatchObject({
      fileCount: 1,
      bytes: 10,
    })
  })

  it('expires unused reservations without letting their writer start later', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const reserved = await reserveStorage(tenant.scope, input())
    vi.advanceTimersByTime(STORAGE_RESERVATION_MS + 1)
    const store = fakeBucket()
    await cleanupStorage(tenant.scope, store)
    await expect(
      writeStorageObject(
        tenant.scope,
        store,
        reserved,
        new Blob(['1234567890']).stream(),
      ),
    ).rejects.toThrow()
    expect(store.objects.size).toBe(0)
    expect(await getStorageUsage(tenant.scope)).toMatchObject({
      fileCount: 0,
      bytes: 0,
    })
  })

  it.each(['before', 'after'] as const)(
    'fences a delayed put %s cancellation without releasing retained bytes early',
    async (ordering) => {
      vi.useFakeTimers({ toFake: ['Date'] })
      const reserved = await reserveStorage(tenant.scope, input())
      const store = fakeBucket()
      const put = store.put
      let resume: (() => void) | undefined
      let entered: (() => void) | undefined
      const started = new Promise<void>((resolve) => {
        entered = resolve
      })
      const gate = new Promise<void>((resolve) => {
        resume = resolve
      })
      store.put = async (key, body, options) => {
        if (!options?.onlyIf) return put(key, body, options)
        if (ordering === 'before') await put(key, body, options)
        entered?.()
        await gate
        if (ordering === 'before') return undefined
        return put(key, body, options)
      }
      const writing = writeStorageObject(
        tenant.scope,
        store,
        reserved,
        new Blob(['1234567890']).stream(),
      ).catch(() => undefined)
      await started
      vi.advanceTimersByTime(STORAGE_RESERVATION_MS + 1)
      expect(await getStorageUsage(tenant.scope)).toMatchObject({
        bytes: 10,
        fileCount: 1,
      })
      await cleanupStorage(tenant.scope, store)
      resume?.()
      await writing
      await expect(settleStorage(tenant.scope, reserved.id)).rejects.toThrow()
      expect(store.objects.get(reserved.storageKey)?.body).toBe('')
      expect(await getStorageUsage(tenant.scope)).toMatchObject({
        bytes: 0,
        fileCount: 0,
      })
    },
  )

  it('keeps a partial write charged through failed cleanup and retries idempotently', async () => {
    const reserved = await reserveStorage(tenant.scope, input())
    const store = fakeBucket()
    const put = store.put
    store.put = async (key, body, options) => {
      if (options?.onlyIf) {
        await put(key, body, options)
        throw new Error('response lost')
      }
      throw new Error('cleanup unavailable')
    }
    await expect(
      writeStorageObject(
        tenant.scope,
        store,
        reserved,
        new Blob(['1234567890']).stream(),
      ),
    ).rejects.toThrow('response lost')
    await expect(
      abandonStorage(tenant.scope, store, reserved.id),
    ).rejects.toThrow('cleanup unavailable')
    expect(await getStorageUsage(tenant.scope)).toMatchObject({
      bytes: 10,
      fileCount: 1,
    })
    store.put = put
    await cleanupStorage(tenant.scope, store)
    await cleanupStorage(tenant.scope, store)
    expect(await getStorageUsage(tenant.scope)).toMatchObject({
      bytes: 0,
      fileCount: 0,
    })
    await purgeStorageKey(tenant.scope, store, reserved.storageKey)
    expect(store.objects.get(reserved.storageKey)?.body).toBe('')
  })

  it('settles exactly once and refuses compensation of a published attachment', async () => {
    const reserved = await reserveStorage(tenant.scope, input())
    const store = fakeBucket()
    await writeStorageObject(
      tenant.scope,
      store,
      reserved,
      new Blob(['1234567890']).stream(),
    )
    await recordFile(
      tenant.scope,
      { ...input(), filename: 'photo.jpg', contentType: 'image/jpeg' },
      reserved.id,
    )
    await settleStorage(tenant.scope, reserved.id)
    await abandonStorage(tenant.scope, store, reserved.id)
    await cleanupStorage(tenant.scope, store)
    expect(store.objects.get(reserved.storageKey)?.body).toBe('1234567890')
    expect(await getStorageUsage(tenant.scope)).toMatchObject({
      bytes: 10,
      fileCount: 1,
    })
  })

  it.each(['files', 'storage_bytes'] as const)(
    'races a cover copy against an attachment at the %s ceiling',
    async (metric) => {
      const source = input('source')
      await recordFile(tenant.scope, {
        ...source,
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      })
      const target = await startTripCopy(tenant.scope, tripId, {
        title: 'Copy',
      })
      const targetKey = `trips/${tenant.organizationId}/${target}/cover.jpg`
      const store = fakeBucket({ [source.storageKey]: { body: '1234567890' } })
      await upsertSubscription(tenant.scope, {
        quotaOverrides: metric === 'files' ? { files: 2 } : {},
        storageLimitBytes: metric === 'storage_bytes' ? 20 : 1000,
      })
      const results = await Promise.allSettled([
        copyStoredCover(
          tenant.scope,
          store,
          target,
          source.storageKey,
          targetKey,
        ),
        recordFile(tenant.scope, {
          ...input('racer'),
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
        }),
      ])
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1)
      expect(await getStorageUsage(tenant.scope)).toMatchObject({
        bytes: 20,
        fileCount: 2,
      })
    },
  )

  it('retries a duplicate cover copy that loses admission after both observe an unused key', async () => {
    const source = input('source')
    const target = await startTripCopy(tenant.scope, tripId, { title: 'Copy' })
    const targetKey = `trips/${tenant.organizationId}/${target}/cover.jpg`
    const store = fakeBucket({ [source.storageKey]: { body: '1234567890' } })
    const get = store.get
    const put = store.put
    let readers = 0
    let releaseReads = () => {}
    let releasePut = () => {}
    const reads = new Promise<void>((resolve) => { releaseReads = resolve })
    const writing = new Promise<void>((resolve) => { releasePut = resolve })
    store.get = async (key) => {
      readers += 1
      if (readers === 2) releaseReads()
      await reads
      return get(key)
    }
    store.put = async (...args) => {
      await writing
      return put(...args)
    }
    const attempts = [0, 1].map(() => copyStoredCover(tenant.scope, store, target, source.storageKey, targetKey)
      .then(() => ({ ok: true, cause: undefined }), (cause: unknown) => ({ ok: false, cause })))
    try {
      const loser = await Promise.race(attempts)
      expect(loser).toMatchObject({ ok: false, cause: { code: 'STORAGE_WRITE_IN_PROGRESS' } })
    } finally {
      releasePut()
      await Promise.all(attempts)
    }
    expect(store.objects.get(targetKey)?.body).toBe('1234567890')
    expect(await getStorageUsage(tenant.scope)).toMatchObject({ fileCount: 1, bytes: 10 })
  })

  it('counts a copied cover once on redelivery and retains it after the trip cascades', async () => {
    const source = input('source')
    await recordFile(tenant.scope, {
      ...source,
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })
    const target = await startTripCopy(tenant.scope, tripId, { title: 'Copy' })
    const targetKey = `trips/${tenant.organizationId}/${target}/cover.jpg`
    const store = fakeBucket({ [source.storageKey]: { body: '1234567890' } })
    await copyStoredCover(
      tenant.scope,
      store,
      target,
      source.storageKey,
      targetKey,
    )
    await copyStoredCover(
      tenant.scope,
      store,
      target,
      source.storageKey,
      targetKey,
    )
    await finishTripCopy(tenant.scope, target, { coverImageKey: targetKey })
    expect(await getStorageUsage(tenant.scope)).toMatchObject({
      bytes: 20,
      fileCount: 2,
    })
    await deleteTrip(tenant.scope, target)
    expect(await getStorageUsage(tenant.scope)).toMatchObject({
      bytes: 20,
      fileCount: 2,
    })
    await purgeStorageKey(tenant.scope, store, targetKey)
    await purgeStorageKey(tenant.scope, store, targetKey)
    expect(await getStorageUsage(tenant.scope)).toMatchObject({
      bytes: 10,
      fileCount: 1,
    })
  })

  it('retains pre-ledger attachments through cascading deletion and isolates cleanup', async () => {
    const row = await recordFile(tenant.scope, {
      ...input(),
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })
    const store = fakeBucket({ [row.storageKey]: { body: '1234567890' } })
    const beta = await harness.seedTenant('other')
    await deleteTrip(tenant.scope, tripId)
    expect(await getStorageUsage(tenant.scope)).toMatchObject({
      bytes: 10,
      fileCount: 1,
    })
    await cleanupStorage(beta.scope, store)
    expect(store.objects.get(row.storageKey)?.body).toBe('1234567890')
    await cleanupStorage(tenant.scope, store)
    expect(await getStorageUsage(tenant.scope)).toMatchObject({
      bytes: 0,
      fileCount: 0,
    })
  })

  it('observes legacy copied-cover sizes without crossing a tenant boundary', async () => {
    const key = input('legacy').storageKey
    await updateTrip(tenant.scope, tripId, { coverImageKey: key })
    const beta = await harness.seedTenant('observer')
    expect(await legacyStorageCovers(beta.scope)).toEqual([])
    await expect(
      observeLegacyCover(beta.scope, tripId, key, 10),
    ).rejects.toBeInstanceOf(NotFoundError)
    const store = fakeBucket({ [key]: { body: '1234567890' } })
    await cleanupStorage(tenant.scope, store)
    expect(await getStorageUsage(tenant.scope)).toMatchObject({
      bytes: 10,
      fileCount: 1,
    })
    await updateTrip(tenant.scope, tripId, { coverImageKey: null })
    await cleanupStorage(tenant.scope, store)
    expect(await getStorageUsage(tenant.scope)).toMatchObject({
      bytes: 0,
      fileCount: 0,
    })
  })

  it('refuses a foreign cover before reading or writing its bytes', async () => {
    const beta = await harness.seedTenant('foreign-cover')
    const foreignTrip = await createTrip(beta.scope, { title: 'Private' })
    const key = `trips/${beta.organizationId}/${foreignTrip.id}/cover.jpg`
    const store = fakeBucket({ [key]: { body: 'private' } })
    const get = vi.spyOn(store, 'get')
    await expect(
      copyStoredCover(tenant.scope, store, tripId, key, input().storageKey),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(get).not.toHaveBeenCalled()
    expect(store.objects.get(key)?.body).toBe('private')
  })
  it('does not reuse expired capacity before its writer is atomically fenced out', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    await upsertSubscription(tenant.scope, { storageLimitBytes: 10 })
    await reserveStorage(tenant.scope, input('old'))
    vi.advanceTimersByTime(STORAGE_RESERVATION_MS + 1)
    await expect(
      recordFile(tenant.scope, {
        ...input('new'),
        filename: 'new.jpg',
        contentType: 'image/jpeg',
      }),
    ).rejects.toThrow()
    await cleanupStorage(tenant.scope, fakeBucket())
    await expect(
      recordFile(tenant.scope, {
        ...input('new'),
        filename: 'new.jpg',
        contentType: 'image/jpeg',
      }),
    ).resolves.toBeDefined()
  })

  it('does not publish a copied cover after cleanup wins the finalization race', async () => {
    const source = input('source')
    const target = await startTripCopy(tenant.scope, tripId, { title: 'Copy' })
    const targetKey = `trips/${tenant.organizationId}/${target}/cover.jpg`
    const store = fakeBucket({ [source.storageKey]: { body: '1234567890' } })
    await copyStoredCover(
      tenant.scope,
      store,
      target,
      source.storageKey,
      targetKey,
    )
    await finishTripCopy(tenant.scope, target)
    await cleanupStorage(tenant.scope, store)
    const finished = await finishTripCopy(tenant.scope, target, {
      coverImageKey: targetKey,
      coverImageUrl: 'https://example.test/cover',
    })
    expect(finished.coverImageKey).toBeNull()
    expect(finished.coverImageUrl).toBeNull()
  })

  it('reflects a published attachment kind change in the shared usage breakdown', async () => {
    const reservation = await reserveStorage(tenant.scope, input())
    const store = fakeBucket()
    await writeStorageObject(
      tenant.scope,
      store,
      reservation,
      new Blob(['1234567890']).stream(),
    )
    const file = await recordFile(
      tenant.scope,
      { ...input(), filename: 'photo.jpg', contentType: 'image/jpeg' },
      reservation.id,
    )
    await updateFile(tenant.scope, tripId, file.id, { kind: 'receipt' })
    expect((await getStorageUsage(tenant.scope)).byKind).toEqual([
      { kind: 'receipt', bytes: 10, fileCount: 1 },
    ])
  })
  it('resolves a removed file retry only in its original workspace and trip', async () => {
    const file = await recordFile(tenant.scope, {
      ...input(),
      filename: 'file.jpg',
      contentType: 'image/jpeg',
    })
    const other = await createTrip(tenant.scope, { title: 'Other' })
    const beta = await harness.seedTenant('removed-file')
    await deleteFile(tenant.scope, tripId, file.id)
    expect(
      await removedFileStorage(tenant.scope, tripId, file.id),
    ).toMatchObject({ storageKey: file.storageKey })
    expect(await removedFileStorage(beta.scope, tripId, file.id)).toBeNull()
    expect(await removedFileStorage(tenant.scope, other.id, file.id)).toBeNull()
  })
  it('refuses a foreign legacy key at the cleanup interface before touching storage', async () => {
    const beta = await harness.seedTenant('foreign-cleanup')
    const key = `trips/${beta.organizationId}/trip/legacy.jpg`
    const store = fakeBucket({ [key]: { body: 'private' } })
    await expect(
      purgeStorageKey(tenant.scope, store, key),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(store.objects.get(key)?.body).toBe('private')
    expect(store.calls).toEqual([])
  })
  it('cannot publish using another tenant reservation or finalize its copy', async () => {
    const reserved = await reserveStorage(tenant.scope, input())
    await beginStorageWrite(tenant.scope, reserved.id)
    const beta = await harness.seedTenant('foreign-publish')
    const betaTrip = await createTrip(beta.scope, { title: 'Other' })
    await expect(
      recordFile(
        beta.scope,
        {
          ...input(),
          tripId: betaTrip.id,
          filename: 'file.jpg',
          contentType: 'image/jpeg',
        },
        reserved.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundError)
    await expect(
      finishTripCopy(beta.scope, tripId, {
        coverImageKey: reserved.storageKey,
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(await getStorageUsage(beta.scope)).toMatchObject({
      bytes: 0,
      fileCount: 0,
    })
    expect(
      await findStorageObject(tenant.scope, reserved.storageKey),
    ).toMatchObject({ state: 'writing', fileId: null })
  })
})
