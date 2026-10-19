/**
 * Files — the metadata rows for objects stored in the `FILES` R2 bucket.
 *
 * R2 holds the bytes; this table holds everything the app needs to list, filter and authorise them,
 * including which trip they belong to. Both file-count and storage quotas are enforced here, before
 * an upload is recorded, so a tenant can never push another tenant off its plan (`docs/SPEC.md` §5).
 */

import { and, asc, count, desc, eq, sum } from 'drizzle-orm'
import { z } from 'zod'
import { FILE_KINDS, tripFiles } from '#/server/db/schema'
import { assertQuota, createTenantRepository, tenantFilter } from './base'
import { NotFoundError } from './context'
import { requireExpenseOfTrip } from './expenses'
import { requirePlaceOfTrip } from './places'
import { requireReservationOfTrip } from './reservations'
import { requireTransportOfTrip } from './transports'
import { assertTripRole, requireWritableTrip } from './trips'
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
import type { TripRole } from './trips'

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
  const rows = await scope.db
    .select({ kind: tripFiles.kind, fileCount: count(), bytes: sum(tripFiles.sizeBytes) })
    .from(tripFiles)
    .where(tenantFilter(scope, tripFiles))
    .groupBy(tripFiles.kind)
    .orderBy(desc(count()))

  const byKind = rows.flatMap((row) =>
    (FILE_KINDS as ReadonlyArray<string>).includes(row.kind)
      ? [
          {
            kind: row.kind as (typeof FILE_KINDS)[number],
            fileCount: row.fileCount,
            bytes: Number(row.bytes ?? 0),
          },
        ]
      : [],
  )

  return {
    fileCount: byKind.reduce((total, row) => total + row.fileCount, 0),
    bytes: byKind.reduce((total, row) => total + row.bytes, 0),
    byKind,
  }
}

/** Bytes stored against one trip. */
export async function getTripStorageBytes(scope: TenantScope, tripId: string): Promise<number> {
  return tripFilesRepository.sumOf(scope, tripFiles.sizeBytes, eq(tripFiles.tripId, tripId))
}

/* -------------------------------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------------------------------- */

/**
 * Trip roles that may change a trip's files. A `viewer` reads and downloads them and writes none.
 * Declared once: whether a caller holds one of them is {@link assertTripRole}'s answer, so a refusal
 * here is the `TripRoleError` every other trip writer raises.
 */
export const FILE_WRITE_ROLES: ReadonlyArray<TripRole> = ['owner', 'editor']

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
  await assertTripRole(scope, tripId, FILE_WRITE_ROLES)
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
 * Records an uploaded object. Call it **after** the bytes are in R2 and **before** the response is
 * returned; if the quota check throws, the caller deletes the object it just wrote.
 */
export async function recordFile(scope: TenantScope, input: RecordFileInput): Promise<TripFile> {
  const values = recordFileInput.parse(input)
  await requireTripForFileWrite(scope, values.tripId)
  await requireLinksOfTrip(scope, values.tripId, values)

  const usage = await getStorageUsage(scope)
  await assertQuota(scope, 'files', usage.fileCount)
  await assertQuota(scope, 'storage_bytes', usage.bytes, values.sizeBytes)

  return tripFilesRepository.insert(scope, { ...values, uploadedBy: scope.ctx.userId })
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
 * Removes the metadata row and returns the storage key so the caller can delete the object. The row
 * goes first: a dangling object is a cleanup job, a dangling row is a broken download.
 */
export async function deleteFile(
  scope: TenantScope,
  tripId: string,
  fileId: string,
): Promise<string> {
  const file = await requireFileForWrite(scope, tripId, fileId)
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
