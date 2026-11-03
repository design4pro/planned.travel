/** One tenant ledger for reservations and retained objects, including row-less copied covers. */
import { eq, gt, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  FILE_KINDS,
  newId,
  storageObjects,
  tripFiles,
  trips,
} from '#/server/db/schema'
import { UNLIMITED } from '#/server/db/types'
import { MAX_FILE_BYTES } from '#/server/fns/file-policy'
import {
  allOf,
  createTenantRepository,
  prepareTenantInsert,
  resolveQuotas,
  tenantFilter,
} from './base'
import { NotFoundError, QuotaExceededError, RepositoryError } from './context'
import { requireTripForFileWrite } from './files'
import type { TenantScope } from './base'
import type { SQL } from 'drizzle-orm'

const objects = createTenantRepository(storageObjects, 'storage reservation')
export const STORAGE_RESERVATION_MS = 15 * 60 * 1000
export type StorageReservation = typeof storageObjects.$inferSelect

/** Distinct ledger objects plus pre-ledger attachments/covers, never counted twice. */
function usageRows(scope: TenantScope, tripId?: string): SQL {
  const ledger = tenantFilter(
    scope,
    storageObjects,
    tripId ? eq(storageObjects.tripId, tripId) : undefined,
  )
  const files = tenantFilter(
    scope,
    tripFiles,
    tripId ? eq(tripFiles.tripId, tripId) : undefined,
  )
  const covers = tenantFilter(
    scope,
    trips,
    tripId ? eq(trips.id, tripId) : undefined,
  )
  return sql`
    select ${storageObjects.sizeBytes} as bytes, coalesce((select ${tripFiles.kind} from ${tripFiles} where ${tenantFilter(scope, tripFiles)} and ${tripFiles.storageKey} = ${storageObjects.storageKey}), ${storageObjects.kind}) as kind, ${storageObjects.storageKey} as storage_key from ${storageObjects}
    where ${ledger} and ${storageObjects.state} != 'deleted'

    union all
    select ${tripFiles.sizeBytes}, ${tripFiles.kind}, ${tripFiles.storageKey} from ${tripFiles} where ${files}
      and not exists (select 1 from ${storageObjects} where ${tenantFilter(scope, storageObjects)}
        and ${storageObjects.storageKey} = ${tripFiles.storageKey})
    union all
    select distinct ${MAX_FILE_BYTES}, 'image', ${trips.coverImageKey} from ${trips} where ${covers}
      and substr(${trips.coverImageKey}, 1, length(${`trips/${scope.ctx.organizationId}/`})) = ${`trips/${scope.ctx.organizationId}/`}
      and not exists (select 1 from ${tripFiles} where ${tenantFilter(scope, tripFiles)}
        and ${tripFiles.storageKey} = ${trips.coverImageKey})
      and not exists (select 1 from ${storageObjects} where ${tenantFilter(scope, storageObjects)}
        and ${storageObjects.storageKey} = ${trips.coverImageKey})`
}

export async function readStorageUsage(scope: TenantScope, tripId?: string) {
  const byKind = await scope.db
    .select({
      kind: sql<string>`kind`,
      fileCount: sql<number>`count(*)`,
      bytes: sql<number>`coalesce(sum(bytes), 0)`,
    })
    .from(sql`(${usageRows(scope, tripId)})`)
    .groupBy(sql`kind`)
    .orderBy(sql`count(*) desc`)
  return {
    fileCount: byKind.reduce((sum, row) => sum + row.fileCount, 0),
    bytes: byKind.reduce((sum, row) => sum + row.bytes, 0),
    byKind: byKind.map((row) => ({
      ...row,
      kind: z.enum(FILE_KINDS).parse(row.kind),
    })),
  }
}

export async function storageAdmissionPredicate(
  scope: TenantScope,
  bytes: number,
) {
  const { limits } = await resolveQuotas(scope)
  const usage = usageRows(scope)
  return sql`(${limits.files} = ${UNLIMITED} or (select count(*) from (${usage})) + 1 <= ${limits.files})
    and (${limits.storage_bytes} = ${UNLIMITED} or (select coalesce(sum(bytes), 0) from (${usage})) + ${bytes} <= ${limits.storage_bytes})`
}

export async function throwStorageQuota(scope: TenantScope): Promise<never> {
  const [usage, { limits }] = await Promise.all([
    readStorageUsage(scope),
    resolveQuotas(scope),
  ])
  const metric =
    limits.files !== UNLIMITED && usage.fileCount + 1 > limits.files
      ? 'files'
      : 'storage_bytes'
  throw new QuotaExceededError(
    metric,
    limits[metric],
    metric === 'files' ? usage.fileCount : usage.bytes,
  )
}

export function assertStorageKey(
  scope: TenantScope,
  tripId: string,
  key: string,
): void {
  if (
    !key.startsWith(`trips/${scope.ctx.organizationId}/${tripId}/`) ||
    key.includes('..')
  ) {
    throw new NotFoundError('storage object', key)
  }
}

export async function reserveStorage(
  scope: TenantScope,
  input: {
    tripId: string
    storageKey: string
    sizeBytes: number
    kind?: (typeof FILE_KINDS)[number]
  },
): Promise<StorageReservation> {
  const values = z
    .object({
      tripId: z.string().min(1).max(64),
      storageKey: z.string().min(1).max(512),
      sizeBytes: z.number().int().min(0).max(MAX_FILE_BYTES),
      kind: z.enum(FILE_KINDS).default('document'),
    })
    .parse(input)
  await requireTripForFileWrite(scope, values.tripId)
  assertStorageKey(scope, values.tripId, values.storageKey)
  const rows = await prepareTenantInsert(
    scope,
    storageObjects,
    {
      ...values,
      id: newId(),
      state: 'reserved',
      expiresAt: new Date(Date.now() + STORAGE_RESERVATION_MS),
    },
    await storageAdmissionPredicate(scope, values.sizeBytes),
  ).returning()
  if (!rows[0]) return throwStorageQuota(scope)
  return rows[0]
}

export async function beginStorageWrite(
  scope: TenantScope,
  id: string,
): Promise<StorageReservation> {
  const row = await objects.requireById(scope, id)
  await requireTripForFileWrite(scope, row.tripId)
  const changed = await objects.updateWhere(
    scope,
    allOf(
      eq(storageObjects.id, id),
      eq(storageObjects.state, 'reserved'),
      gt(storageObjects.expiresAt, new Date()),
    ),
    { state: 'writing' },
  )
  if (!changed[0])
    throw new RepositoryError(
      'Storage reservation is no longer writable.',
      'STORAGE_RESERVATION_EXPIRED',
    )
  return changed[0]
}

export function storageWritePredicate(
  scope: TenantScope,
  id: string,
  key: string,
  bytes: number,
): SQL {
  return sql`exists (select 1 from ${storageObjects} where ${tenantFilter(scope, storageObjects)}
    and ${storageObjects.id} = ${id} and ${storageObjects.storageKey} = ${key}
    and ${storageObjects.sizeBytes} = ${bytes} and ${storageObjects.state} = 'writing')`
}

export function prepareStorageSettlement(
  scope: TenantScope,
  id: string,
  fileId?: string,
) {
  return scope.db
    .update(storageObjects)
    .set({
      state: 'retained',
      needsFence: false,
      ...(fileId === undefined ? {} : { fileId }),
      updatedAt: new Date(),
    })
    .where(
      tenantFilter(
        scope,
        storageObjects,
        eq(storageObjects.id, id),
        eq(storageObjects.state, 'writing'),
      ),
    )
}

export async function settleStorage(
  scope: TenantScope,
  id: string,
): Promise<void> {
  const current = await objects.requireById(scope, id)
  await requireTripForFileWrite(scope, current.tripId)
  await prepareStorageSettlement(scope, id)
  const row = await objects.requireById(scope, id)
  if (row.state !== 'retained')
    throw new RepositoryError(
      'Storage reservation was cancelled.',
      'STORAGE_RESERVATION_EXPIRED',
    )
}

function unreferenced(scope: TenantScope): SQL {
  return sql`not exists (select 1 from ${tripFiles} where ${tenantFilter(scope, tripFiles)} and ${tripFiles.storageKey} = ${storageObjects.storageKey})
    and not exists (select 1 from ${trips} where ${tenantFilter(scope, trips)}
      and (${trips.coverImageKey} = ${storageObjects.storageKey} or (${trips.id} = ${storageObjects.tripId} and ${trips.copyPendingAt} is not null)))`
}

/** A cancellation wins against settlement before storage is touched. */
export async function cancelStorage(
  scope: TenantScope,
  id: string,
): Promise<StorageReservation | null> {
  const rows = await objects.updateWhere(
    scope,
    allOf(
      eq(storageObjects.id, id),
      sql`${storageObjects.state} in ('reserved', 'writing', 'garbage')`,
    ),
    { state: 'garbage' },
  )
  return rows[0] ?? null
}

export async function storageCleanupCandidates(
  scope: TenantScope,
): Promise<Array<StorageReservation>> {
  return objects.findMany(scope, {
    where: sql`${storageObjects.state} = 'garbage'
    or (${storageObjects.state} in ('reserved', 'writing') and ${storageObjects.expiresAt} <= ${Date.now()})
    or (${storageObjects.state} = 'retained' and ${unreferenced(scope)})`,
    limit: 20,
  })
}

export async function claimStorageCleanup(
  scope: TenantScope,
  id: string,
): Promise<StorageReservation | null> {
  await objects.updateWhere(
    scope,
    allOf(
      eq(storageObjects.id, id),
      eq(storageObjects.state, 'reserved'),
      sql`${storageObjects.expiresAt} <= ${Date.now()}`,
    ),
    { state: 'deleted' },
  )
  const rows = await objects.updateWhere(
    scope,
    allOf(
      eq(storageObjects.id, id),
      sql`(${storageObjects.state} = 'garbage'
    or (${storageObjects.state} in ('reserved', 'writing') and ${storageObjects.expiresAt} <= ${Date.now()})
    or (${storageObjects.state} = 'retained' and ${unreferenced(scope)}))`,
    ),
    { state: 'garbage' },
  )
  return rows[0] ?? null
}

/** Only called after the storage fence has succeeded; repeated acknowledgements are harmless. */
export async function confirmStorageCleanup(
  scope: TenantScope,
  id: string,
): Promise<void> {
  await objects.updateWhere(
    scope,
    allOf(eq(storageObjects.id, id), eq(storageObjects.state, 'garbage')),
    { state: 'deleted' },
  )
}

export async function findStorageObject(
  scope: TenantScope,
  key: string,
): Promise<StorageReservation | null> {
  return objects.findOne(scope, eq(storageObjects.storageKey, key))
}

/** Preserve legacy accounting before metadata disappears; new writers already have ledger rows. */
export async function retainTripStorage(
  scope: TenantScope,
  tripId: string,
): Promise<void> {
  await scope.db
    .insert(storageObjects)
    .select(
      scope.db
        .select({
          id: tripFiles.id,
          organizationId: tripFiles.organizationId,
          tripId: tripFiles.tripId,
          storageKey: tripFiles.storageKey,
          fileId: tripFiles.id,
          sizeBytes: tripFiles.sizeBytes,
          kind: tripFiles.kind,
          state: sql`'retained'`.as('state'),
          needsFence: sql`0`.as('needs_fence'),
          expiresAt: tripFiles.createdAt,
          createdAt: tripFiles.createdAt,
          updatedAt: tripFiles.updatedAt,
        })
        .from(tripFiles)
        .where(
          tenantFilter(
            scope,
            tripFiles,
            eq(tripFiles.tripId, tripId),
            sql`not exists (select 1 from ${storageObjects} where ${tenantFilter(scope, storageObjects)} and ${storageObjects.storageKey} = ${tripFiles.storageKey})`,
          ),
        ),
    )
    .onConflictDoNothing()
  const [trip] = await scope.db
    .select({ key: trips.coverImageKey })
    .from(trips)
    .where(tenantFilter(scope, trips, eq(trips.id, tripId)))
  if (trip?.key?.startsWith(`trips/${scope.ctx.organizationId}/${tripId}/`)) {
    await prepareTenantInsert(scope, storageObjects, {
      tripId,
      storageKey: trip.key,
      sizeBytes: MAX_FILE_BYTES,
      kind: 'image',
      state: 'retained',
      needsFence: false,
      expiresAt: new Date(),
    }).onConflictDoNothing()
  }
}

/** Legacy covers have no byte column; admission observes their size before applying an estimate. */
export async function legacyStorageCovers(scope: TenantScope) {
  return scope.db
    .select({ tripId: trips.id, storageKey: trips.coverImageKey })
    .from(trips)
    .where(
      tenantFilter(
        scope,
        trips,
        sql`${trips.coverImageKey} is not null
      and not exists (select 1 from ${tripFiles} where ${tenantFilter(scope, tripFiles)} and ${tripFiles.storageKey} = ${trips.coverImageKey})
      and not exists (select 1 from ${storageObjects} where ${tenantFilter(scope, storageObjects)} and ${storageObjects.storageKey} = ${trips.coverImageKey})`,
      ),
    )
    .limit(20)
}

export async function observeLegacyCover(
  scope: TenantScope,
  tripId: string,
  key: string,
  size: number | null,
): Promise<void> {
  assertStorageKey(scope, tripId, key)
  if (size !== null) z.number().int().min(0).max(MAX_FILE_BYTES).parse(size)
  await prepareTenantInsert(
    scope,
    storageObjects,
    {
      tripId,
      storageKey: key,
      sizeBytes: size ?? 0,
      kind: 'image',
      state: size === null ? 'deleted' : 'retained',
      needsFence: false,
      expiresAt: new Date(),
    },
    sql`exists (select 1 from ${trips} where ${tenantFilter(scope, trips, eq(trips.id, tripId), eq(trips.coverImageKey, key))})`,
  ).onConflictDoNothing()
}

/** A retry can resolve removed metadata only within the same tenant and trip. */
export async function removedFileStorage(
  scope: TenantScope,
  tripId: string,
  fileId: string,
) {
  return objects.findOne(
    scope,
    allOf(
      eq(storageObjects.tripId, tripId),
      eq(storageObjects.fileId, fileId),
      unreferenced(scope),
    ),
  )
}

/** A cover's pointer may be published only while its immutable object is still retained. */
export function retainedCoverPredicate(scope: TenantScope, key: string): SQL {
  return sql`not exists (select 1 from ${storageObjects} where ${tenantFilter(scope, storageObjects)} and ${storageObjects.storageKey} = ${key})
    or exists (select 1 from ${storageObjects} where ${tenantFilter(scope, storageObjects)} and ${storageObjects.storageKey} = ${key} and ${storageObjects.state} = 'retained')`
}

/** Bound every IN list below D1's parameter ceiling. */
export async function listedStorageKeys(
  scope: TenantScope,
  keys: ReadonlyArray<string>,
): Promise<Set<string>> {
  const found = new Set<string>()
  for (let offset = 0; offset < keys.length; offset += 90) {
    const rows = await objects.findMany(scope, {
      where: inArray(
        storageObjects.storageKey,
        keys.slice(offset, offset + 90),
      ),
    })
    for (const row of rows) found.add(row.storageKey)
  }
  return found
}
