/**
 * Files — the metadata rows for objects stored in the `FILES` R2 bucket.
 *
 * R2 holds the bytes; this table holds everything the app needs to list, filter and authorise them,
 * including which trip they belong to. Both file-count and storage quotas are enforced here, before
 * an upload is recorded, so a tenant can never push another tenant off its plan (`docs/SPEC.md` §5).
 */

import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { FILE_KINDS, newId, tripFiles } from '#/server/db/schema'
import { createTenantRepository, prepareTenantInsert } from './base'
import { runAtomicBatch } from './batch'
import { prepareStorageSettlement, readStorageUsage, retainTripStorage, storageAdmissionPredicate, storageWritePredicate, throwStorageQuota } from './storage-admission'
import { NotFoundError } from './context'
import { requireExpenseOfTrip } from './expenses'
import { requirePlaceOfTrip } from './places'
import { requireReservationOfTrip } from './reservations'
import { requireTransportOfTrip } from './transports'
import { TRIP_WRITE_ROLES, assertTripRole, requireWritableTrip } from './trips'
import {
  definedOnly,
  idSchema,
  longTextSchema,
  nonNegativeIntSchema,
  shortTextSchema,
  titleSchema,
} from './validation'
import type { Trip, TripFile } from '#/server/db/types'
import type { TenantScope } from './base'

export const tripFilesRepository = createTenantRepository(tripFiles, 'file')

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const fileKindSchema = z.enum(FILE_KINDS)

export const recordFileInput = z.object({
  tripId: idSchema,
  placeId: idSchema.nullish(),
  reservationId: idSchema.nullish(),
  transportId: idSchema.nullish(),
  expenseId: idSchema.nullish(),
  /** Object key inside the `FILES` bucket; unique across the deployment. */
  storageKey: z.string().trim().min(1).max(512),
  filename: titleSchema,
  contentType: shortTextSchema.min(1),
  sizeBytes: nonNegativeIntSchema,
  checksum: shortTextSchema.nullish(),
  kind: fileKindSchema.optional(),
  description: longTextSchema.nullish(),
  width: nonNegativeIntSchema.max(100_000).nullish(),
  height: nonNegativeIntSchema.max(100_000).nullish(),
})
export type RecordFileInput = z.infer<typeof recordFileInput>

export const updateFileInput = z.object({
  filename: titleSchema.optional(),
  kind: fileKindSchema.optional(),
  description: longTextSchema.nullish(),
  placeId: idSchema.nullish(),
  reservationId: idSchema.nullish(),
  transportId: idSchema.nullish(),
  expenseId: idSchema.nullish(),
})
export type UpdateFileInput = z.infer<typeof updateFileInput>

/* -------------------------------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------------------------------- */

export async function listTripFiles(
  scope: TenantScope,
  tripId: string,
  options: { readonly kind?: (typeof FILE_KINDS)[number]; readonly limit?: number } = {},
): Promise<Array<TripFile>> {
  return tripFilesRepository.findMany(scope, {
    where: and(
      eq(tripFiles.tripId, tripId),
      options.kind ? eq(tripFiles.kind, options.kind) : undefined,
    ),
    orderBy: [desc(tripFiles.createdAt)],
    limit: options.limit,
  })
}

export async function getFile(scope: TenantScope, fileId: string): Promise<TripFile | null> {
  return tripFilesRepository.findById(scope, fileId)
}

/** Resolves a file by its R2 object key — the download route's lookup, still tenant-scoped. */
export async function getFileByStorageKey(
  scope: TenantScope,
  storageKey: string,
): Promise<TripFile | null> {
  return tripFilesRepository.findOne(scope, eq(tripFiles.storageKey, storageKey))
}

/** Files attached to one reservation, transport leg, place or expense. */
export async function listFilesForEntity(
  scope: TenantScope,
  entity:
    | { readonly placeId: string }
    | { readonly reservationId: string }
    | { readonly transportId: string }
    | { readonly expenseId: string },
): Promise<Array<TripFile>> {
  const where =
    'placeId' in entity
      ? eq(tripFiles.placeId, entity.placeId)
      : 'reservationId' in entity
        ? eq(tripFiles.reservationId, entity.reservationId)
        : 'transportId' in entity
          ? eq(tripFiles.transportId, entity.transportId)
          : eq(tripFiles.expenseId, entity.expenseId)
  return tripFilesRepository.findMany(scope, { where, orderBy: [asc(tripFiles.createdAt)] })
}

export interface StorageUsage {
  readonly fileCount: number
  readonly bytes: number
  readonly byKind: ReadonlyArray<{
    readonly kind: (typeof FILE_KINDS)[number]
    readonly fileCount: number
    readonly bytes: number
  }>
}

/** Storage the tenant is using, overall and per kind — the billing and files screens. */
export async function getStorageUsage(scope: TenantScope): Promise<StorageUsage> {
  return readStorageUsage(scope)
}

/** Bytes stored against one trip. */
export async function getTripStorageBytes(scope: TenantScope, tripId: string): Promise<number> {
  return (await readStorageUsage(scope, tripId)).bytes
}

/* -------------------------------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------------------------------- */

/**
 * Resolves a trip whose files the caller may change, or throws: {@link requireWritableTrip} first
 * (`NotFoundError` for a trip they cannot see, then `TripArchivedError`), then the role - the order
 * the day-notes writers document. Exported because the upload handler writes bytes to the bucket
 * before it reaches {@link recordFile}, and a refused caller must not have spent workspace storage.
 */
export async function requireTripForFileWrite(
  scope: TenantScope,
  tripId: string,
): Promise<Trip> {
  const trip = await requireWritableTrip(scope, tripId)
  await assertTripRole(scope, tripId, TRIP_WRITE_ROLES)
  return trip
}

/**
 * The file a writer is about to change, once the caller has been shown to be allowed to change it.
 *
 * A file id alone is not an authorisation: the tenant filter proves the row is the workspace's, not
 * that the caller may write on the trip it sits on. So the guards run on the trip the *stored row*
 * names, and a file that is not on `tripId` is `NotFoundError` - the same answer a file of another
 * workspace gets - so the trip a caller proved they may change is the trip whose file they change.
 */
export async function requireFileForWrite(
  scope: TenantScope,
  tripId: string,
  fileId: string,
): Promise<TripFile> {
  const file = await tripFilesRepository.requireById(scope, fileId)
  if (file.tripId !== tripId) {
    throw new NotFoundError('file', fileId)
  }
  await requireTripForFileWrite(scope, file.tripId)
  return file
}

/**
 * Refuses a place, booking, transport or expense that is not on `tripId`, with the `NotFoundError`
 * a missing id gets, so a file cannot be linked to another trip's or another workspace's row. A
 * link that is absent or being cleared (`null`) names nothing and is not checked.
 */
async function requireLinksOfTrip(
  scope: TenantScope,
  tripId: string,
  links: {
    readonly placeId?: string | null
    readonly reservationId?: string | null
    readonly transportId?: string | null
    readonly expenseId?: string | null
  },
): Promise<void> {
  if (links.placeId) {
    await requirePlaceOfTrip(scope, tripId, links.placeId)
  }
  if (links.reservationId) {
    await requireReservationOfTrip(scope, tripId, links.reservationId)
  }
  if (links.transportId) {
    await requireTransportOfTrip(scope, tripId, links.transportId)
  }
  if (links.expenseId) {
    await requireExpenseOfTrip(scope, tripId, links.expenseId)
  }
}

/**
 * Atomically publishes a reserved upload. Metadata-only seed callers use the same admission predicate.
 */
export async function recordFile(scope: TenantScope, input: RecordFileInput, reservationId?: string): Promise<TripFile> {
  const values = recordFileInput.parse(input)
  await requireTripForFileWrite(scope, values.tripId)
  await requireLinksOfTrip(scope, values.tripId, values)

  const condition = reservationId === undefined
    ? await storageAdmissionPredicate(scope, values.sizeBytes)
    : storageWritePredicate(scope, reservationId, values.storageKey, values.sizeBytes)
  const fileId = newId()
  const insert = prepareTenantInsert(scope, tripFiles, { ...values, id: fileId, uploadedBy: scope.ctx.userId }, condition).returning()
  const rows = reservationId === undefined
    ? await insert
    : (await runAtomicBatch(scope, [insert, prepareStorageSettlement(scope, reservationId, fileId)]))[0]
  if (!rows[0]) {
    if (reservationId !== undefined) throw new NotFoundError('storage reservation', reservationId)
    return throwStorageQuota(scope)
  }
  return rows[0]
}

export async function updateFile(
  scope: TenantScope,
  tripId: string,
  fileId: string,
  input: UpdateFileInput,
): Promise<TripFile> {
  const changes = definedOnly(updateFileInput.parse(input))
  await requireFileForWrite(scope, tripId, fileId)
  await requireLinksOfTrip(scope, tripId, changes)
  return tripFilesRepository.requireUpdate(scope, fileId, changes)
}

/**
 * Removes metadata while retaining its storage charge until object cleanup is confirmed.
 */
export async function deleteFile(
  scope: TenantScope,
  tripId: string,
  fileId: string,
): Promise<string> {
  const file = await requireFileForWrite(scope, tripId, fileId)
  await retainTripStorage(scope, tripId)
  await tripFilesRepository.requireRemove(scope, fileId)
  return file.storageKey
}

/** Storage keys of every file on a trip — used when a trip is deleted to sweep R2. */
export async function listTripStorageKeys(
  scope: TenantScope,
  tripId: string,
): Promise<Array<string>> {
  const rows = await tripFilesRepository.findMany(scope, { where: eq(tripFiles.tripId, tripId) })
  return rows.map((row) => row.storageKey)
}
