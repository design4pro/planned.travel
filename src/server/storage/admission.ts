/** Storage effects use the same tenant ledger for uploads, copied covers and cleanup retries. */
import { createLogger } from '#/server/observability/logger'
import {
  NotFoundError,
  RepositoryError,
  assertStorageKey,
  beginStorageWrite,
  requireTrip,
  requireTripForFileWrite,
  cancelStorage,
  claimStorageCleanup,
  confirmStorageCleanup,
  findStorageObject,
  legacyStorageCovers,
  observeLegacyCover,
  reserveStorage,
  settleStorage,
  storageCleanupCandidates,
} from '#/server/repos'
import type { StorageReservation, TenantScope } from '#/server/repos'
import type { ObjectStore } from './objects'

const cleanupLogger = createLogger({ context: { component: 'storage-cleanup' } })

/** A permanent empty object fences arbitrarily late create-only writes; never TTL-delete it. */
async function fenceStorage(
  scope: TenantScope,
  store: ObjectStore,
  row: StorageReservation,
): Promise<void> {
  assertStorageKey(scope, row.tripId, row.storageKey)
  if (!row.needsFence) {
    await store.delete(row.storageKey)
    await confirmStorageCleanup(scope, row.id)
    return
  }
  if (!store.put)
    throw new Error('Storage does not support cancellation fences.')
  await store.put(row.storageKey, new Blob([]).stream(), {
    customMetadata: { storageTombstone: row.id },
  })
  await confirmStorageCleanup(scope, row.id)
}

/** At most twenty attempts per request; failures stay charged and are retried on the next pass. */
export async function cleanupStorage(
  scope: TenantScope,
  store: ObjectStore,
): Promise<void> {
  if (store.head) {
    for (const cover of await legacyStorageCovers(scope)) {
      if (
        !cover.storageKey?.startsWith(
          `trips/${scope.ctx.organizationId}/${cover.tripId}/`,
        )
      )
        continue
      try {
        const object = await store.head(cover.storageKey)
        await observeLegacyCover(scope, cover.tripId, cover.storageKey, object?.size ?? null)
      } catch {
        cleanupLogger.warn('legacy cover observation failed; conservative usage retained', {
          orgId: scope.ctx.organizationId, tripId: cover.tripId,
        })
      }
    }
  }
  for (const candidate of await storageCleanupCandidates(scope)) {
    if (
      !candidate.storageKey.startsWith(
        `trips/${scope.ctx.organizationId}/${candidate.tripId}/`,
      )
    )
      continue
    try {
      const row = await claimStorageCleanup(scope, candidate.id)
      if (row) await fenceStorage(scope, store, row)
    } catch {
      cleanupLogger.warn('opportunistic storage cleanup failed; usage retained for retry', {
        orgId: scope.ctx.organizationId, reservationId: candidate.id,
      })
    }
  }
}

export async function abandonStorage(
  scope: TenantScope,
  store: ObjectStore,
  id: string,
): Promise<void> {
  const row = await cancelStorage(scope, id)
  if (row) await fenceStorage(scope, store, row)
}

export async function writeStorageObject(
  scope: TenantScope,
  store: ObjectStore,
  reservation: StorageReservation,
  body: ReadableStream,
  options?: Parameters<NonNullable<ObjectStore['put']>>[2],
): Promise<void> {
  if (!store.put) throw new Error('Storage does not support writes.')
  const row = await beginStorageWrite(scope, reservation.id)
  assertStorageKey(scope, row.tripId, row.storageKey)
  const written = await store.put(row.storageKey, body, {
    ...options,
    onlyIf: { etagDoesNotMatch: '*' },
  })
  if (written === null)
    throw new Error('Storage write was cancelled or already exists.')
}

/** Copy retries reuse retained bytes; they never overwrite a published object. */
export async function copyStoredCover(
  scope: TenantScope,
  store: ObjectStore,
  tripId: string,
  sourceKey: string,
  targetKey: string,
): Promise<void> {
  await requireTripForFileWrite(scope, tripId)
  assertStorageKey(scope, tripId, targetKey)
  const sourceTripId = sourceKey.split('/')[2] ?? ''
  assertStorageKey(scope, sourceTripId, sourceKey)
  await requireTrip(scope, sourceTripId)
  await cleanupStorage(scope, store)
  const existing = await findStorageObject(scope, targetKey)
  if (existing?.state === 'retained') return
  if (existing?.state === 'reserved' || existing?.state === 'writing')
    throw new RepositoryError('A cover copy is still writing.', 'STORAGE_WRITE_IN_PROGRESS')
  if (existing) throw new Error('A cover copy already owns this storage key.')
  if (!store.get) throw new Error('Storage does not support reads.')
  const source = await store.get(sourceKey)
  if (!source?.body || source.size === undefined)
    throw new Error('Cover size or content is unavailable.')
  let reservation: StorageReservation
  try {
    reservation = await reserveStorage(scope, {
      tripId,
      storageKey: targetKey,
      sizeBytes: source.size,
      kind: 'image',
    })
  } catch (cause) {
    // Another delivery can win the unique key after the initial lookup.
    const concurrent = await findStorageObject(scope, targetKey)
    if (concurrent?.state === 'retained') return
    if (concurrent?.state === 'reserved' || concurrent?.state === 'writing')
      throw new RepositoryError('A cover copy is still writing.', 'STORAGE_WRITE_IN_PROGRESS')
    throw cause
  }
  try {
    await writeStorageObject(scope, store, reservation, source.body, {
      httpMetadata: source.httpMetadata,
    })
    await settleStorage(scope, reservation.id)
  } catch (cause) {
    await abandonStorage(scope, store, reservation.id).catch(() => undefined)
    throw cause
  }
}

/** Purge may delete legacy keys, but must preserve fences and published ledger objects. */
export async function purgeStorageKey(
  scope: TenantScope,
  store: ObjectStore,
  key: string,
): Promise<void> {
  if (key.split('/')[1] !== scope.ctx.organizationId) {
    throw new NotFoundError('storage object', key)
  }
  const existing = await findStorageObject(scope, key)
  if (!existing) {
    await store.delete(key)
    return
  }
  const row = await claimStorageCleanup(scope, existing.id)
  if (row) await fenceStorage(scope, store, row)
}
