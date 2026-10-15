/**
 * The read side of a trip export: what a trip has, and the bytes of one of it.
 *
 * The `pdf-export` job writes `exports/<org>/<trip>/<taskId>.pdf|html` into the `FILES` bucket
 * (`storage/export-artifacts.ts` owns that layout); these functions list what is there and stream
 * one object back. Nothing here renders anything or writes a byte.
 *
 * **The key is never the browser's.** It is built from the caller's own organization id and the trip
 * the access check resolved, and a task id is only ever matched against what the listing of that
 * very prefix holds. A task id from another workspace therefore resolves, at worst, to a key inside
 * the caller's prefix that does not exist: there is no id-shaped path into another tenant's artifact.
 * The order inside each function is the access check first, before the bucket is touched.
 *
 * Ports rather than ambient lookups, as `booking-import` does it: the client bundle imports this
 * module for its server-function stubs, and the tenant-isolation suite hands the scope and a fake
 * bucket in to prove the boundary without a Worker.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { serverNow } from '#/server/clock'
import { requireTrip, tripRoleFor } from '#/server/repos'
import {
  exportObjectKey,
  listExportArtifacts,
} from '#/server/storage/export-artifacts'
import { appScope, filesBucket } from './context'
import { attachmentHeaders, sanitiseFilename } from './file-policy'

import type { TenantScope } from '#/server/repos'
import type {
  ExportArtifact,
  ExportFormat,
  ExportStore,
} from '#/server/storage/export-artifacts'

/* ------------------------------------------------------------------ shapes */

export interface TripExportList {
  readonly artifacts: ReadonlyArray<ExportArtifact>
  /** Whether the caller may ask for an export: a trip owner or editor. Draws the affordance only. */
  readonly canRequest: boolean
}

/** What a download needs from the bucket: the listing verbs, and `get` for the one object. */
export interface ExportBucket extends ExportStore {
  get: (key: string) => Promise<{ body: ReadableStream | null } | null>
}

/* -------------------------------------------------------------- validation */

const tripId = z.string().trim().min(1).max(64)

export const listTripExportsInputSchema = z.strictObject({ tripId })

/**
 * Shape only. The id pattern is checked in {@link downloadTripExport} and answers the same 404 as
 * every other miss, so a malformed id and a foreign one cannot be told apart.
 */
export const downloadTripExportInputSchema = z.strictObject({
  tripId,
  taskId: z.string().trim().min(1).max(128),
})

export type ListTripExportsInput = z.infer<typeof listTripExportsInputSchema>
export type DownloadTripExportInput = z.infer<
  typeof downloadTripExportInputSchema
>

/** The ids the queue mints: no `/`, no `..`, nothing that could leave the trip's prefix. */
const TASK_ID = /^[A-Za-z0-9-]{1,128}$/

/* ------------------------------------------------------------------- list */

/**
 * The finished, unexpired exports of a trip the caller may read, newest first.
 *
 * R2 is the ground truth for what exists: no index is kept and the KV pointer is never consulted.
 */
export async function listTripExports(
  scope: TenantScope,
  bucket: ExportStore,
  input: ListTripExportsInput,
  now: number,
): Promise<TripExportList> {
  const trip = await requireTrip(scope, input.tripId)
  const role = await tripRoleFor(scope, trip.id, scope.ctx.userId)
  return {
    artifacts: await listExportArtifacts(
      bucket,
      scope.ctx.organizationId,
      trip.id,
      { now },
    ),
    canRequest: role === 'owner' || role === 'editor',
  }
}

/* --------------------------------------------------------------- download */

/** Fixed by the extension the server tried, never by the object's metadata or the browser. */
const CONTENT_TYPES: Readonly<Record<ExportFormat, string>> = {
  pdf: 'application/pdf',
  html: 'text/html; charset=utf-8',
}

/** The printable page is escaped text and a literal stylesheet; this makes that a rule, not a habit. */
const PRINTABLE_PAGE_POLICY =
  "sandbox; default-src 'none'; style-src 'unsafe-inline'"

/** Every miss is this one answer: "pruned" and "never existed" cannot be told apart, on purpose. */
function missing(): Response {
  return Response.json(
    { error: 'missing' },
    { status: 404, headers: { 'cache-control': 'private, no-store' } },
  )
}

function exportFilename(title: string, artifact: ExportArtifact): string {
  const day = new Date(artifact.createdAt).toISOString().slice(0, 10)
  return `${sanitiseFilename(`${title}-${day}`)}.${artifact.format}`
}

/**
 * Streams one export to a reader of the trip, as an attachment.
 *
 * The artifact is found by listing the caller's own prefix, so the completion marker (the page), the
 * PDF-over-page preference and the seven-day expiry are the same rules the list shows. The object is
 * then fetched under the key built from the caller's organization and the resolved trip.
 */
export async function downloadTripExport(
  scope: TenantScope,
  bucket: ExportBucket,
  input: DownloadTripExportInput,
  now: number,
): Promise<Response> {
  const trip = await requireTrip(scope, input.tripId)
  if (!TASK_ID.test(input.taskId)) {
    return missing()
  }

  const organizationId = scope.ctx.organizationId
  const artifact = (
    await listExportArtifacts(bucket, organizationId, trip.id, { now })
  ).find((candidate) => candidate.taskId === input.taskId)
  if (artifact === undefined) {
    return missing()
  }

  const object = await bucket.get(
    exportObjectKey(organizationId, trip.id, artifact.taskId, artifact.format),
  )
  if (object === null || object.body === null) {
    return missing()
  }

  const headers: Record<string, string> = {
    ...attachmentHeaders({
      filename: exportFilename(trip.title, artifact),
      contentType: CONTENT_TYPES[artifact.format],
      sizeBytes: artifact.sizeBytes,
    }),
  }
  if (artifact.format === 'html') {
    headers['content-security-policy'] = PRINTABLE_PAGE_POLICY
  }
  return new Response(object.body, { headers })
}

/* ---------------------------------------------------------------- functions */

export const listTripExportsFn = createServerFn({ method: 'GET' })
  .validator(listTripExportsInputSchema)
  .handler(async ({ data }): Promise<TripExportList> =>
    listTripExports(
      await appScope(),
      filesBucket(),
      data,
      serverNow().getTime(),
    ),
  )

export const downloadTripExportFn = createServerFn({ method: 'GET' })
  .validator(downloadTripExportInputSchema)
  .handler(async ({ data }): Promise<Response> =>
    downloadTripExport(
      await appScope(),
      filesBucket(),
      data,
      serverNow().getTime(),
    ),
  )
