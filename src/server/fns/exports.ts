/**
 * The read side of a trip export: what a trip has, and the bytes of one of it.
 *
 * The `pdf-export` job writes `exports/<org>/<trip>/<taskId>.pdf|html` into the `FILES` bucket
 * (`storage/export-artifacts.ts` owns that layout); these functions list what is there and stream
 * one object back. Requests enqueue a snapshot; downloads stream the finished artifact.
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

import { serverNow, serverToday } from '#/server/clock'
import {
  exportObjectKey,
  listExportArtifacts,
} from '#/server/storage/export-artifacts'
import {
  exportAllowance,
  reserveExport,
  releaseExport,
} from '#/server/repos/exports'
import {
  requireTrip,
  tripRoleFor,
  getEffectiveSettings,
  getTripItinerary,
  listTripDayNotes,
  listTripReservations,
  listTripTransports,
  QuotaExceededError,
} from '#/server/repos'
import { enqueueTask } from '#/server/queue/jobs'
import { pdfExportPayloadSchema } from '#/server/queue/types'
import { createTranslator, loadCatalogue } from '#/lib/i18n/catalogue'
import { negotiate } from '#/lib/i18n/negotiate'
import { buildExportDocument } from './export-document'
import type { TaskQueue } from '#/server/queue/types'
import { appScope, filesBucket, log } from './context'
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
  readonly allowance: {
    used: number
    limit: number | null
    month: string
    resetsOn: string
  }
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
  const month = new Date(now).toISOString().slice(0, 7)
  return {
    artifacts: await listExportArtifacts(
      bucket,
      scope.ctx.organizationId,
      trip.id,
      { now },
    ),
    canRequest: role === 'owner' || role === 'editor',
    allowance: {
      ...(await exportAllowance(scope, { month })),
      month,
      resetsOn: exportResetsOn(month),
    },
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

/** Room for the title in a name: `sanitiseFilename` keeps 160 UTF-16 units, the day takes 11. */
const TITLE_BUDGET = 140

function exportFilename(title: string, artifact: ExportArtifact): string {
  const day = new Date(artifact.createdAt).toISOString().slice(0, 10)
  // A slash in a trip title ("Lisbon 1/2") must not read as a path and drop the part before it.
  // The title is cut by code point and stripped of lone surrogates first: a half surrogate would make the
  // header encoder throw, and a long title must not push the day and the extension out of the name.
  let name = ''
  for (const char of title
    .replaceAll(/\p{Surrogate}/gu, '')
    .replaceAll(/[\\/]+/gu, '-')) {
    if (name.length + char.length > TITLE_BUDGET) {
      break
    }
    name += char
  }
  return `${sanitiseFilename(`${name}-${day}`)}.${artifact.format}`
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

/** The restart date is derived from the reserved month, including at a year boundary. */
export function exportResetsOn(month: string): string {
  const date = new Date(month + '-01T00:00:00.000Z')
  date.setUTCMonth(date.getUTCMonth() + 1)
  return date.toISOString().slice(0, 10)
}

export const requestTripExportInputSchema = z.strictObject({
  tripId,
  notify: z.boolean(),
  includeReferences: z.boolean(),
})
export type RequestTripExportInput = z.infer<
  typeof requestTripExportInputSchema
>
export type RequestTripExportResult =
  | { ok: true; taskId: string; queuedAt: number }
  | {
      ok: false
      reason: 'quota'
      used: number
      limit: number
      resetsOn: string
    }

/** Ports keep the request boundary testable against real repositories without Worker bindings. */
export async function requestTripExport(
  scope: TenantScope,
  queue: TaskQueue,
  input: RequestTripExportInput,
  options: {
    month: string
    email: () => Promise<string>
    warn: (cause: unknown) => void
    now: () => number
  },
): Promise<RequestTripExportResult> {
  const trip = await requireTrip(scope, input.tripId)
  let reserved: { used: number; month: string }
  try {
    reserved = await reserveExport(scope, trip.id, { month: options.month })
  } catch (cause) {
    if (cause instanceof QuotaExceededError) {
      return {
        ok: false,
        reason: 'quota',
        used: cause.current,
        limit: cause.limit,
        resetsOn: exportResetsOn(options.month),
      }
    }
    throw cause
  }
  try {
    const [days, notes, reservations, transports, settings] = await Promise.all(
      [
        getTripItinerary(scope, trip.id),
        listTripDayNotes(scope, trip.id),
        listTripReservations(scope, { tripId: trip.id }),
        listTripTransports(scope, trip.id),
        getEffectiveSettings(scope),
      ],
    )
    const locale = negotiate({ user: settings.locale })
    const t = createTranslator(locale, await loadCatalogue(locale))
    const payload = pdfExportPayloadSchema.parse({
      tripId: trip.id,
      requestedBy: scope.ctx.userId,
      locale,
      document: buildExportDocument(
        { trip, days, notes, reservations, transports },
        t,
        locale,
        input,
      ),
      ...(input.notify ? { notify: await options.email() } : {}),
    })
    const task = await enqueueTask(
      queue,
      { kind: 'pdf-export', orgId: scope.ctx.organizationId, payload },
      options.now,
    )
    return { ok: true, taskId: task.id, queuedAt: options.now() }
  } catch (cause) {
    await releaseExport(scope, reserved).catch(options.warn)
    throw cause
  }
}

export const requestTripExportFn = createServerFn({ method: 'POST' })
  .validator(requestTripExportInputSchema)
  .handler(async ({ data }): Promise<RequestTripExportResult> => {
    const scope = await appScope()
    const { taskQueue } = await import('#/server/auth/env')
    return requestTripExport(scope, taskQueue(), data, {
      month: serverToday().slice(0, 7),
      now: () => serverNow().getTime(),
      email: async () => {
        const { requireUser } = await import('#/server/auth/session')
        return (await requireUser()).email
      },
      warn: () =>
        log().warn('export allowance release failed', {
          organizationId: scope.ctx.organizationId,
          tripId: data.tripId,
        }),
    })
  })
