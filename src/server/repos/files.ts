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
import { requireTrip } from './trips'
import {
  definedOnly,
  idSchema,
  longTextSchema,
  nonNegativeIntSchema,
  shortTextSchema,
  titleSchema,
} from './validation'
import type { TripFile } from '#/server/db/types'
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
 * Records an uploaded object. Call it **after** the bytes are in R2 and **before** the response is
 * returned; if the quota check throws, the caller deletes the object it just wrote.
 */
export async function recordFile(scope: TenantScope, input: RecordFileInput): Promise<TripFile> {
  const values = recordFileInput.parse(input)
  await requireTrip(scope, values.tripId)

  const usage = await getStorageUsage(scope)
  await assertQuota(scope, 'files', usage.fileCount)
  await assertQuota(scope, 'storage_bytes', usage.bytes, values.sizeBytes)

  return tripFilesRepository.insert(scope, { ...values, uploadedBy: scope.ctx.userId })
}

export async function updateFile(
  scope: TenantScope,
  fileId: string,
  input: UpdateFileInput,
): Promise<TripFile> {
  return tripFilesRepository.requireUpdate(scope, fileId, definedOnly(updateFileInput.parse(input)))
}

/**
 * Removes the metadata row and returns the storage key so the caller can delete the object. The row
 * goes first: a dangling object is a cleanup job, a dangling row is a broken download.
 */
export async function deleteFile(scope: TenantScope, fileId: string): Promise<string> {
  const file = await tripFilesRepository.requireById(scope, fileId)
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
