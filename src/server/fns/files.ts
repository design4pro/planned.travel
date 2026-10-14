/**
 * Write and read paths for trip attachments.
 *
 * The bytes go to the `FILES` R2 bucket; the row that makes them listable,
 * authorisable and countable goes to D1 through `recordFile`, which is where the
 * plan's file-count and storage quotas are enforced. The order matters and is
 * deliberate: object first, row second, and if the row is refused the object we
 * just wrote is deleted again — a dangling object is a sweep job, a dangling row
 * is a broken download.
 *
 * Upload is a `FormData` handler that answers with a plain `Response` rather than
 * a serialised value, so the browser can drive it with `XMLHttpRequest` and get
 * real byte-by-byte progress instead of a spinner that lies.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { AUDIT_ACTIONS, trail } from '#/server/audit/trail'
import { newId } from '#/server/db/schema'
import {
  deleteFile,
  getFile,
  getStorageUsage,
  recordFile,
  requireTrip,
  resolveQuotas,
  updateFile,
} from '#/server/repos'
import { appScope, filesBucket, mirrorToRoom, orNull, patch } from './context'
import {
  FILE_KIND_VALUES,
  attachmentHeaders,
  checkUpload,
  contentDispositionFor,
  defaultKindFor,
  isFileKind,
  resolveContentType,
  sanitiseFilename,
  storageKeyFor,
} from './file-policy'

import type { FileKind } from './file-policy'

/* ------------------------------------------------------------------ shapes */

export interface UploadedFile {
  readonly id: string
  readonly filename: string
  readonly contentType: string
  readonly sizeBytes: number
  readonly kind: string
}

export interface UploadResult {
  readonly ok: true
  readonly file: UploadedFile
}

export interface UploadFailure {
  readonly ok: false
  readonly code: string
  readonly message: string
}

/* --------------------------------------------------------------- validation */

interface UploadRequest {
  readonly tripId: string
  readonly kind: FileKind | null
  readonly description: string | null
  readonly file: File
}

/**
 * `FormData` is the one input shape TanStack Start hands through untouched, and
 * the one shape a streaming upload can use — so it is validated by hand here
 * rather than by a schema that only understands JSON. Everything that *can* be a
 * scalar still goes through Zod.
 */
const scalars = z.object({
  tripId: z.string().trim().min(1).max(64),
  kind: z
    .string()
    .trim()
    .max(20)
    .transform((value) => (isFileKind(value) ? value : null)),
  description: z.string().trim().max(2000),
})

function readUpload(data: FormData): UploadRequest {
  const file = data.get('file')
  if (!(file instanceof File)) {
    throw new Error('No file was attached to the request.')
  }
  const parsed = scalars.parse({
    tripId: data.get('tripId') ?? '',
    kind: data.get('kind') ?? '',
    description: data.get('description') ?? '',
  })
  return {
    tripId: parsed.tripId,
    kind: parsed.kind,
    description: orNull(parsed.description),
    file,
  }
}

/** A failure the browser can render verbatim, as a 200 with `ok: false`. */
function refuse(code: string, message: string): Response {
  return Response.json({ ok: false, code, message } satisfies UploadFailure, {
    headers: { 'cache-control': 'no-store' },
  })
}

/* ------------------------------------------------------------------ upload */

export const uploadTripFileFn = createServerFn({ method: 'POST' })
  .validator((data: FormData) => data)
  .handler(async ({ data }): Promise<Response> => {
    const request = readUpload(data)
    const scope = await appScope()
    const trip = await requireTrip(scope, request.tripId)

    const filename = sanitiseFilename(request.file.name)
    const contentType = resolveContentType(filename, request.file.type)

    const [usage, quotas] = await Promise.all([
      getStorageUsage(scope),
      resolveQuotas(scope),
    ])

    const rejection = checkUpload(
      {
        filename,
        contentType: request.file.type,
        sizeBytes: request.file.size,
      },
      { usedBytes: usage.bytes, limitBytes: quotas.limits.storage_bytes },
    )
    if (rejection !== null) {
      return refuse(rejection.code, rejection.message)
    }
    if (contentType === null) {
      // `checkUpload` already covers this; kept so the type narrows without a
      // non-null assertion on a value the policy owns.
      return refuse(
        'unsupported-type',
        `“${filename}” is not a file type this workspace accepts.`,
      )
    }

    const fileId = newId()
    const storageKey = storageKeyFor({
      organizationId: scope.ctx.organizationId,
      tripId: trip.id,
      fileId,
      filename,
    })
    const bucket = filesBucket()

    await bucket.put(storageKey, request.file.stream(), {
      httpMetadata: {
        contentType,
        contentDisposition: contentDispositionFor(filename),
      },
      customMetadata: {
        organizationId: scope.ctx.organizationId,
        tripId: trip.id,
        uploadedBy: scope.ctx.userId,
      },
    })

    try {
      const row = await recordFile(scope, {
        tripId: trip.id,
        storageKey,
        filename,
        contentType,
        sizeBytes: request.file.size,
        kind: request.kind ?? defaultKindFor(filename, contentType),
        description: request.description,
      })

      await mirrorToRoom(scope, trip.id, [
        patch('trip', trip.id, { filesChangedAt: Date.now() }),
      ])

      // After the row, never before it: an entry describing an upload the quota then refused would
      // be a lie the trail has no way to retract. `trail` resolves whatever happens, so nothing
      // below this line can turn a stored file into a failed request.
      await trail(scope, {
        action: AUDIT_ACTIONS.FILE_UPLOADED,
        entityType: 'file',
        entityId: row.id,
        metadata: {
          tripId: trip.id,
          filename: row.filename,
          contentType: row.contentType,
          sizeBytes: row.sizeBytes,
          kind: row.kind,
        },
      })

      return Response.json(
        {
          ok: true,
          file: {
            id: row.id,
            filename: row.filename,
            contentType: row.contentType,
            sizeBytes: row.sizeBytes,
            kind: row.kind,
          },
        } satisfies UploadResult,
        { headers: { 'cache-control': 'no-store' } },
      )
    } catch (cause) {
      // The quota is checked again inside `recordFile`, against the same
      // transaction that inserts. Losing that race must not leave the bucket
      // holding bytes nothing points at.
      await bucket.delete(storageKey)
      return refuse(
        'rejected',
        cause instanceof Error && cause.message.length > 0
          ? cause.message
          : 'The upload could not be recorded. Try again in a moment.',
      )
    }
  })

/* ------------------------------------------------------------------ rename */

export const updateTripFileFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tripId: z.string().trim().min(1).max(64),
      fileId: z.string().trim().min(1).max(64),
      filename: z.string().trim().min(1).max(160),
      kind: z.enum(FILE_KIND_VALUES),
      description: z.string().trim().max(2000),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly filename: string }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)

    const filename = sanitiseFilename(data.filename)
    const row = await updateFile(scope, data.fileId, {
      filename,
      kind: data.kind,
      description: orNull(data.description),
    })

    await mirrorToRoom(scope, data.tripId, [
      patch('trip', data.tripId, { filesChangedAt: Date.now() }),
    ])
    return { filename: row.filename }
  })

/* ------------------------------------------------------------------ delete */

export const deleteTripFileFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tripId: z.string().trim().min(1).max(64),
      fileId: z.string().trim().min(1).max(64),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly deleted: true }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)

    const row = await getFile(scope, data.fileId)
    const storageKey = await deleteFile(scope, data.fileId)
    await filesBucket().delete(storageKey)

    await mirrorToRoom(scope, data.tripId, [
      patch('trip', data.tripId, { filesChangedAt: Date.now() }),
    ])

    // The row is read before `deleteFile` removes it, purely so the entry can name the attachment
    // rather than an id nobody can resolve once the row is gone. `deleteFile` is still what proves
    // the file belonged to this tenant — a foreign id never reaches the bucket.
    await trail(scope, {
      action: AUDIT_ACTIONS.FILE_DELETED,
      entityType: 'file',
      entityId: data.fileId,
      metadata: {
        tripId: data.tripId,
        filename: row?.filename ?? null,
        sizeBytes: row?.sizeBytes ?? null,
      },
    })
    return { deleted: true }
  })

/* ---------------------------------------------------------------- download */

/**
 * Streams one attachment back to its owner.
 *
 * Returns a `Response` rather than a value: the bytes never enter the
 * serialisation layer, the media type and filename travel in the headers the
 * browser already knows how to act on, and the row is resolved inside the
 * caller's tenant first, so a file id from another workspace is a 404.
 */
export const downloadTripFileFn = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      tripId: z.string().trim().min(1).max(64),
      fileId: z.string().trim().min(1).max(64),
    }),
  )
  .handler(async ({ data }): Promise<Response> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)

    const row = await getFile(scope, data.fileId)
    if (row === null || row.tripId !== data.tripId) {
      return Response.json(
        { error: 'That file is not on this trip.' },
        { status: 404, headers: { 'cache-control': 'no-store' } },
      )
    }

    const object = await filesBucket().get(row.storageKey)
    if (object === null) {
      return Response.json(
        { error: 'The stored copy of this file is missing.' },
        { status: 410, headers: { 'cache-control': 'no-store' } },
      )
    }

    return new Response(object.body, { headers: attachmentHeaders(row) })
  })
