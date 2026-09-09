/**
 * Typed job envelope for the `TASKS` queue.
 *
 * One discriminated union covers the envelope *and* the payload, so a producer
 * cannot enqueue a well-formed envelope with the wrong payload, and the consumer
 * validates both in a single `safeParse` at the trust boundary.
 */

import { z } from 'zod'
import { PLAN_IDS, SUBSCRIPTION_STATUSES } from '#/lib/plans'
import type { ProviderCallLabel } from '#/server/metering/outbound'
import type { LogValue, Logger } from '../observability/logger'

export const TASK_KINDS = [
  'email',
  'pdf-export',
  'booking-import',
  'thumbnail',
  'backup',
  // Derived-cache rebuild. Six aggregate queries per row, so it is queued
  // rather than run on the write path that invalidates it.
  'travel-stats',
  // The second half of a terminal trip delete: the R2 objects the trip owned.
  // D1 cascades, R2 does not, so the sweep is queued and the delete never waits
  // on it.
  'trip-purge',
  // The second half of a trip copy: everything that scales with the source's
  // inventory. `places` is unbounded on a paid tier, so duplicating one is an
  // unbounded write and belongs nowhere near a request path.
  'trip-copy',
  // Billing follow-ups. The provider webhook answers the provider immediately and
  // hands the slow part off here, so these travel the same queue as everything else.
  'billing.subscription.changed',
  'billing.invoice.paid',
  'billing.invoice.payment_failed',
] as const

export type TaskKind = (typeof TASK_KINDS)[number]

/* --------------------------------------------------------------- payloads -- */

export const emailPayloadSchema = z.object({
  to: z.array(z.string().email()).min(1).max(50),
  subject: z.string().min(1).max(200),
  html: z.string().min(1).max(200_000),
  text: z.string().max(200_000).optional(),
  replyTo: z.string().email().optional(),
  /** Grouping label for provider-side analytics, e.g. `trip-reminder`. */
  tag: z.string().min(1).max(40).optional(),
})

export type EmailPayload = z.infer<typeof emailPayloadSchema>

export const exportDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(200).optional(),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1).max(120),
        note: z.string().max(2000).optional(),
        rows: z
          .array(
            z.object({
              label: z.string().min(1).max(200),
              value: z.string().max(2000),
              meta: z.string().max(200).optional(),
            }),
          )
          .max(500),
      }),
    )
    .min(1)
    .max(60),
})

export type ExportDocument = z.infer<typeof exportDocumentSchema>

export const pdfExportPayloadSchema = z.object({
  tripId: z.string().min(1).max(64),
  requestedBy: z.string().min(1).max(64),
  document: exportDocumentSchema,
  /** Notify this address when the artifact is ready. */
  notify: z.string().email().optional(),
})

export type PdfExportPayload = z.infer<typeof pdfExportPayloadSchema>

export const bookingImportPayloadSchema = z.object({
  tripId: z.string().min(1).max(64),
  requestedBy: z.string().min(1).max(64),
  /** R2 key in `FILES` holding the uploaded calendar or JSON export. */
  sourceKey: z.string().min(1).max(1024),
  format: z.enum(['ics', 'json']),
})

export type BookingImportPayload = z.infer<typeof bookingImportPayloadSchema>

export const thumbnailPayloadSchema = z.object({
  sourceKey: z.string().min(1).max(1024),
  variants: z
    .array(
      z.object({
        name: z.string().min(1).max(32),
        width: z.number().int().min(16).max(4096),
        height: z.number().int().min(16).max(4096),
      }),
    )
    .min(1)
    .max(6),
})

export type ThumbnailPayload = z.infer<typeof thumbnailPayloadSchema>

export const backupPayloadSchema = z.object({
  reason: z.enum(['cron', 'manual']),
  requestedBy: z.string().min(1).max(64).optional(),
})

export type BackupPayload = z.infer<typeof backupPayloadSchema>

/**
 * How many object keys one `trip-purge` message may carry.
 *
 * A Queues message body is capped at 128 KB. A storage key is
 * `trips/<org>/<trip>/<file>-<filename>` (`storageKeyFor`), so ~200 bytes at its longest, and 500 of
 * them leaves the envelope comfortably inside that ceiling with room for the rest of it. The producer
 * chunks at this number; the handler chunks again at R2's own per-call ceiling, which is a different
 * limit for a different reason.
 */
export const MAX_PURGE_KEYS = 500

/** The `statYear` that means "every year the traveller has recorded". */
export const ALL_TIME_STAT_YEAR = 0

/**
 * The other value `statYear` may take: a four-digit calendar year.
 *
 * Exported so the producer can decide what to enqueue against the same rule the
 * consumer's schema enforces, rather than against a copy of it that can drift.
 */
export function isCalendarStatYear(value: number): boolean {
  return Number.isInteger(value) && value >= 1000 && value <= 9999
}

/**
 * One traveller's roll-up, for one year or for all time.
 *
 * `strictObject` because the envelope names the tenant and nothing else about
 * the recompute may be smuggled in beside these two fields: the organization is
 * read from the envelope and every query the handler then runs is
 * `tenantFilter()`-bound to it, so a forged message can only rebuild rows the
 * tenant already owns.
 */
export const travelStatsPayloadSchema = z.strictObject({
  userId: z.string().min(1).max(64),
  statYear: z
    .number()
    .int()
    .refine(
      (value) => value === ALL_TIME_STAT_YEAR || isCalendarStatYear(value),
      { error: 'statYear must be 0 (all time) or a four-digit year.' },
    ),
})

export type TravelStatsPayload = z.infer<typeof travelStatsPayloadSchema>

/**
 * The R2 keys a deleted trip owned (PRD #104 decision 3).
 *
 * `strictObject` for the same reason `travel-stats` is one: the envelope names the tenant and the
 * keys, and nothing else about the sweep may be smuggled in beside them. The organization comes from
 * the envelope, and the handler deletes only keys that lie inside that organization's own key
 * namespace, so a forged message can only remove objects its tenant already owned.
 *
 * The producer is what confirms these keys against `trip_files` — it reads them through the
 * tenant-scoped repository *before* the cascading delete. By the time this message is delivered the
 * rows are gone, which is why the handler's own guard is the key rather than a second read.
 *
 * Bounded at {@link MAX_PURGE_KEYS} per message: `files` is `UNLIMITED` on the business tier, and a
 * Queues message is capped at 128 KB, so a trip with more objects than one message can carry is
 * split across several by the producer rather than silently truncated.
 */
export const tripPurgePayloadSchema = z.strictObject({
  keys: z.array(z.string().min(1).max(1024)).min(1).max(MAX_PURGE_KEYS),
})

export type TripPurgePayload = z.infer<typeof tripPurgePayloadSchema>

/**
 * The two trips a copy runs between, and who asked for it (PRD #104 decision 4a).
 *
 * `strictObject` for the same reason the two above are: the envelope names the tenant, and the
 * handler rebuilds its scope from that rather than carrying one across the queue, so every statement
 * it then runs is `tenantFilter()`-bound to the organization on the envelope. A forged message can
 * only copy rows its own tenant already holds.
 *
 * `requestedBy` is who receives the completion notification, and whose membership the handler
 * re-reads — a requester who has left the workspace by the time the message lands is a permanent
 * failure, not a copy made on their behalf.
 *
 * The envelope's own id is deterministic on the **target** id, which the producer has just minted
 * and which cannot repeat: a redelivery is one job, and a second Copy on the same source is a
 * different trip and a different envelope.
 */
export const tripCopyPayloadSchema = z.strictObject({
  sourceTripId: z.string().min(1).max(64),
  targetTripId: z.string().min(1).max(64),
  requestedBy: z.string().min(1).max(64),
})

export type TripCopyPayload = z.infer<typeof tripCopyPayloadSchema>

/**
 * Billing payloads mirror the `BillingTask` union in `../billing/types`. They
 * repeat their own `kind` because the webhook adapter enqueues the whole task
 * object as the payload, and `providerEventId` is what makes the envelope id
 * deterministic across a provider redelivery.
 */
const billingTaskBase = {
  organizationId: z.string().min(1).max(64),
  providerEventId: z.string().min(1).max(128),
}

export const subscriptionChangedPayloadSchema = z.object({
  ...billingTaskBase,
  kind: z.literal('billing.subscription.changed'),
  planId: z.enum(PLAN_IDS),
  previousPlanId: z.enum(PLAN_IDS),
  status: z.enum(SUBSCRIPTION_STATUSES),
})

export type SubscriptionChangedPayload = z.infer<
  typeof subscriptionChangedPayloadSchema
>

export const invoicePaidPayloadSchema = z.object({
  ...billingTaskBase,
  kind: z.literal('billing.invoice.paid'),
  providerOrderId: z.string().min(1).max(128),
  /** Minor units, as the provider reports it. */
  amountPaid: z.number().int().nonnegative(),
  currency: z.string().min(3).max(8),
})

export type InvoicePaidPayload = z.infer<typeof invoicePaidPayloadSchema>

export const invoicePaymentFailedPayloadSchema = z.object({
  ...billingTaskBase,
  kind: z.literal('billing.invoice.payment_failed'),
  providerOrderId: z.string().min(1).max(128),
  attemptCount: z.number().int().nonnegative(),
  /** ISO timestamp of the provider's next retry, or null when it has given up. */
  nextAttemptAt: z.string().min(1).max(64).nullable(),
})

export type InvoicePaymentFailedPayload = z.infer<
  typeof invoicePaymentFailedPayloadSchema
>

export interface TaskPayloadMap {
  email: EmailPayload
  'pdf-export': PdfExportPayload
  'booking-import': BookingImportPayload
  thumbnail: ThumbnailPayload
  backup: BackupPayload
  'travel-stats': TravelStatsPayload
  'trip-purge': TripPurgePayload
  'trip-copy': TripCopyPayload
  'billing.subscription.changed': SubscriptionChangedPayload
  'billing.invoice.paid': InvoicePaidPayload
  'billing.invoice.payment_failed': InvoicePaymentFailedPayload
}

/* --------------------------------------------------------------- envelope -- */

const envelopeBase = {
  /**
   * Idempotency key. Re-delivering the same id is a no-op after success.
   *
   * Wide enough for the billing envelopes: their id is the provider event id — a
   * 36-character UUID — joined to the task kind, and the longest of those pairs is 67
   * characters.
   */
  id: z.string().min(1).max(128),
  /** Tenant the job belongs to. `system` for platform-wide jobs. */
  orgId: z.string().min(1).max(64),
  enqueuedAt: z.number().int().positive(),
  /** Correlates the job with the request that produced it. */
  traceId: z.string().min(1).max(64).optional(),
}

export const taskEnvelopeSchema = z.discriminatedUnion('kind', [
  z.object({
    ...envelopeBase,
    kind: z.literal('email'),
    payload: emailPayloadSchema,
  }),
  z.object({
    ...envelopeBase,
    kind: z.literal('pdf-export'),
    payload: pdfExportPayloadSchema,
  }),
  z.object({
    ...envelopeBase,
    kind: z.literal('booking-import'),
    payload: bookingImportPayloadSchema,
  }),
  z.object({
    ...envelopeBase,
    kind: z.literal('thumbnail'),
    payload: thumbnailPayloadSchema,
  }),
  z.object({
    ...envelopeBase,
    kind: z.literal('backup'),
    payload: backupPayloadSchema,
  }),
  z.object({
    ...envelopeBase,
    kind: z.literal('travel-stats'),
    payload: travelStatsPayloadSchema,
  }),
  z.object({
    ...envelopeBase,
    kind: z.literal('trip-purge'),
    payload: tripPurgePayloadSchema,
  }),
  z.object({
    ...envelopeBase,
    kind: z.literal('trip-copy'),
    payload: tripCopyPayloadSchema,
  }),
  z.object({
    ...envelopeBase,
    kind: z.literal('billing.subscription.changed'),
    payload: subscriptionChangedPayloadSchema,
  }),
  z.object({
    ...envelopeBase,
    kind: z.literal('billing.invoice.paid'),
    payload: invoicePaidPayloadSchema,
  }),
  z.object({
    ...envelopeBase,
    kind: z.literal('billing.invoice.payment_failed'),
    payload: invoicePaymentFailedPayloadSchema,
  }),
])

export type TaskEnvelope = z.infer<typeof taskEnvelopeSchema>

export type TaskEnvelopeOf<TKind extends TaskKind> = Extract<
  TaskEnvelope,
  { kind: TKind }
>

/* ------------------------------------------------------------------- ports -- */

/**
 * Secrets are set with `wrangler secret put` and therefore are not part of the
 * generated `Env`. They are optional here so every handler has to state what it
 * does when a secret is missing instead of assuming it is present.
 */
export interface TaskSecrets {
  /** Transactional email provider key (Resend-compatible REST API). */
  EMAIL_API_KEY?: string
  /** Account id used by the D1 export and Browser Rendering REST calls. */
  CLOUDFLARE_ACCOUNT_ID?: string
  /** Scoped API token: `D1:read` for backups. */
  CLOUDFLARE_API_TOKEN?: string
  /** Uuid of the D1 database to export. */
  D1_DATABASE_ID?: string
  /** Optional token enabling real PDF rendering for exports. */
  BROWSER_RENDERING_API_TOKEN?: string
}

/** The bindings and vars a queue handler may use. */
export interface TaskBindings extends TaskSecrets {
  KV: {
    get: (key: string) => Promise<string | null>
    put: (
      key: string,
      value: string,
      options?: { expirationTtl?: number },
    ) => Promise<void>
    delete: (key: string) => Promise<void>
    list: (options?: {
      prefix?: string
      limit?: number
      cursor?: string
    }) => Promise<{
      keys: Array<{ name: string; expiration?: number }>
      list_complete: boolean
      cursor?: string
    }>
  }
  FILES: {
    get: (
      key: string,
    ) => Promise<{ body: ReadableStream | null; size: number } | null>
    put: (
      key: string,
      value: ReadableStream | ArrayBuffer | string,
      options?: {
        httpMetadata?: { contentType?: string; cacheControl?: string }
      },
    ) => Promise<unknown>
    head: (key: string) => Promise<{ size: number; uploaded: Date } | null>
    delete: (keys: string | Array<string>) => Promise<void>
    list: (options?: {
      prefix?: string
      limit?: number
      cursor?: string
    }) => Promise<{
      objects: Array<{ key: string; size: number; uploaded: Date }>
      truncated: boolean
      cursor?: string
    }>
  }
  TASKS: TaskQueue
  /**
   * The D1 binding, for the handlers that rebuild a derived table.
   *
   * Optional for the same reason `TRIP_ROOM` is: `TaskBindings` is the
   * structural port every fake in a test satisfies, and a handler that never
   * touches D1 must not have to carry a database stub to be exercised. The
   * binding is declared on the Worker and the consumer runs inside it, so in
   * production it is always present — a handler that needs it says so by
   * raising {@link TaskConfigurationError} when it is not.
   */
  DB?: D1Database
  TRIP_ROOM?: {
    idFromName: (name: string) => DurableObjectId
    get: (id: DurableObjectId) => {
      fetch: (request: Request) => Promise<Response>
    }
  }
  ENVIRONMENT?: string
  LOG_LEVEL?: string
  APP_URL?: string
  APP_NAME?: string
  EMAIL_FROM?: string
  EMAIL_API_URL?: string
  FILES_PUBLIC_BASE?: string
  BACKUP_RETENTION_DAYS?: number | string
  TASK_MAX_ATTEMPTS?: number | string
}

export interface TaskQueue {
  /**
   * Resolves `unknown` rather than `void`: Cloudflare's `Queue` resolves a
   * `QueueSendResponse`, and no caller here reads it. Narrowing the port to
   * `void` would make the real binding fail to satisfy this interface.
   */
  send: (body: unknown, options?: { delaySeconds?: number }) => Promise<unknown>
  sendBatch: (
    messages: Array<{ body: unknown; delaySeconds?: number }>,
    options?: { delaySeconds?: number },
  ) => Promise<unknown>
}

/** Numbers a handler reports for the completion log line. */
export type TaskMetrics = Record<string, LogValue>

export interface TaskContext {
  env: TaskBindings
  logger: Logger
  now: () => number
  /** Attempt number reported by Queues, starting at 1. */
  attempt: number
  /** Envelope id — also the idempotency key and the name for any artifact. */
  taskId: string
  /** Tenant the job belongs to, or `system` for platform jobs. */
  orgId: string
  traceId?: string
  /**
   * Wraps an outbound third-party call: counts the attempt, and refuses it when the provider's
   * gate is shut (`src/server/metering/outbound.ts`).
   *
   * Required rather than optional, unlike the bindings above, and that asymmetry is the point. An
   * optional meter is a meter a new handler forgets, and the failure is silent — the calls still
   * go out and the console simply under-reports what the vendor will bill for. A test fake is one
   * line (`(_label, send) => send()`), which is a much smaller cost than a counter nobody can
   * trust.
   */
  callProvider: <T>(
    label: ProviderCallLabel,
    send: () => Promise<T>,
  ) => Promise<T>
}

export type TaskHandler<TKind extends TaskKind> = (
  payload: TaskPayloadMap[TKind],
  context: TaskContext,
) => Promise<TaskMetrics>

export type TaskHandlerTable = { [K in TaskKind]: TaskHandler<K> }

/* ------------------------------------------------------------------ errors -- */

/** A failure that will never succeed on retry: dead-letter it immediately. */
export class TaskPermanentError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'TaskPermanentError'
  }
}

/** A missing or malformed binding/secret. Permanent until an operator fixes it. */
export class TaskConfigurationError extends TaskPermanentError {
  constructor(message: string) {
    super(message)
    this.name = 'TaskConfigurationError'
  }
}

/** A transient failure: upstream 5xx, rate limit, or an artifact not ready yet. */
export class TaskRetryableError extends Error {
  readonly retryAfterSeconds?: number
  constructor(
    message: string,
    options?: { cause?: unknown; retryAfterSeconds?: number },
  ) {
    super(message, options)
    this.name = 'TaskRetryableError'
    this.retryAfterSeconds = options?.retryAfterSeconds
  }
}

export function isPermanentFailure(
  error: unknown,
): error is TaskPermanentError {
  return error instanceof TaskPermanentError
}

export function numberFromEnv(
  value: number | string | undefined,
  fallback: number,
): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}
