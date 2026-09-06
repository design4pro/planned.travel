/**
 * The `TASKS` queue consumer.
 *
 * This is the trust boundary for background work: a message body is unknown
 * until `taskEnvelopeSchema` has vetted it, and the schema validates the kind
 * and its payload together, so a handler can never be handed the wrong shape.
 *
 * Three outcomes, and each maps onto exactly one Queues verb:
 *
 * - success, or a duplicate of something already done → `ack`
 * - permanent failure (bad payload, missing secret, absent source object) →
 *   dead-letter, then `ack`, because retrying cannot change the answer
 * - retryable failure (upstream 5xx, rate limit) → `retry` with jittered
 *   backoff until `TASK_MAX_ATTEMPTS`, then dead-letter and `ack`
 *
 * Idempotency is a KV marker keyed by envelope id. Queues guarantees
 * at-least-once delivery, so without the marker a redelivered `email` job would
 * send a second copy. Producers derive deterministic ids (see `sweepReminders`)
 * precisely so that marker can do its job.
 */

import {
  TASK_DEAD_TTL_SECONDS,
  TASK_DONE_TTL_SECONDS,
  retryDelaySeconds,
  taskDeadKey,
  taskDeadObjectKey,
  taskDoneKey,
} from './jobs'
import {
  TaskPermanentError,
  TaskRetryableError,
  isPermanentFailure,
  numberFromEnv,
  taskEnvelopeSchema,
} from './types'
import { handleBookingImport } from './handlers/booking-import'
import { handleEmail } from './handlers/email'
import { handlePdfExport } from './handlers/pdf-export'
import { handleTravelStats } from './handlers/travel-stats'
import { handleTripPurge } from './handlers/trip-purge'
import { callProvider } from '#/server/metering/outbound'
import { serializeError } from '../observability/logger'

import type { Database } from '#/server/db/types'
import type { Logger } from '../observability/logger'
import type {
  TaskBindings,
  TaskContext,
  TaskEnvelope,
  TaskHandlerTable,
  TaskKind,
  TaskMetrics,
} from './types'

/**
 * The subset of Cloudflare's `Message` the consumer touches. Declaring it
 * structurally rather than importing the runtime type keeps this module — and
 * therefore its tests — free of `cloudflare:workers`.
 */
export interface QueueMessageLike {
  readonly id: string
  readonly body: unknown
  readonly attempts: number
  ack: () => void
  retry: (options?: { delaySeconds?: number }) => void
}

export interface QueueBatchLike {
  readonly messages: ReadonlyArray<QueueMessageLike>
}

/**
 * Handlers that exist today. `thumbnail`, `backup` and the three `billing.*`
 * follow-ups are declared in `TASK_KINDS` — the webhook really does enqueue the
 * billing ones — but their handlers are not written yet, so they are absent here
 * rather than stubbed. An unhandled kind dead-letters with a precise message
 * instead of being quietly acked as if the work had happened.
 */
export type TaskHandlerRegistry = Partial<TaskHandlerTable>

export const taskHandlers: TaskHandlerRegistry = {
  email: handleEmail,
  'pdf-export': handlePdfExport,
  'booking-import': handleBookingImport,
  'travel-stats': handleTravelStats,
  'trip-purge': handleTripPurge,
}

function unhandled(kind: TaskKind): never {
  throw new TaskPermanentError(
    `No handler is registered for task kind "${kind}"`,
  )
}

/**
 * Routes an envelope to its handler through a `switch` on the discriminant.
 * The switch is what keeps `kind` and `payload` correlated without a cast —
 * inside each arm TypeScript has narrowed both.
 */
function runHandler(
  envelope: TaskEnvelope,
  registry: TaskHandlerRegistry,
  context: TaskContext,
): Promise<TaskMetrics> {
  switch (envelope.kind) {
    case 'email':
      return (registry.email ?? unhandled(envelope.kind))(
        envelope.payload,
        context,
      )
    case 'pdf-export':
      return (registry['pdf-export'] ?? unhandled(envelope.kind))(
        envelope.payload,
        context,
      )
    case 'booking-import':
      return (registry['booking-import'] ?? unhandled(envelope.kind))(
        envelope.payload,
        context,
      )
    case 'thumbnail':
      return (registry.thumbnail ?? unhandled(envelope.kind))(
        envelope.payload,
        context,
      )
    case 'backup':
      return (registry.backup ?? unhandled(envelope.kind))(
        envelope.payload,
        context,
      )
    case 'travel-stats':
      return (registry['travel-stats'] ?? unhandled(envelope.kind))(
        envelope.payload,
        context,
      )
    case 'trip-purge':
      return (registry['trip-purge'] ?? unhandled(envelope.kind))(
        envelope.payload,
        context,
      )
    case 'billing.subscription.changed':
      return (
        registry['billing.subscription.changed'] ?? unhandled(envelope.kind)
      )(envelope.payload, context)
    case 'billing.invoice.paid':
      return (registry['billing.invoice.paid'] ?? unhandled(envelope.kind))(
        envelope.payload,
        context,
      )
    case 'billing.invoice.payment_failed':
      return (
        registry['billing.invoice.payment_failed'] ?? unhandled(envelope.kind)
      )(envelope.payload, context)
  }
}

export interface ConsumeOptions {
  registry?: TaskHandlerRegistry
  now?: () => number
  /** Injectable so backoff jitter is deterministic under test. */
  random?: () => number
  /**
   * The batch's `ExecutionContext.waitUntil`, passed down from `src/server/worker.ts`.
   *
   * It matters that this is the *batch's* one rather than the ambient `waitUntil` of
   * `cloudflare:workers`: a queue invocation is not a request, and the context that keeps the
   * isolate alive long enough for a deferred counter write to land is the one the runtime handed
   * `queue()`. Absent — in a test, or in a caller that has none — the metering write runs detached
   * with its own terminal catch, which is what an unawaited promise does anyway.
   */
  waitUntil?: (promise: Promise<unknown>) => void
  /**
   * The D1 handle the provider meter records through, built by the caller.
   *
   * Built by the caller and not from `env.DB` here, because `createDb` reaches
   * `cloudflare:workers` and this module has to stay loadable in the `server` Vitest project —
   * the same constraint that gives `src/server/fns/console/bindings.ts` and
   * `src/server/metering/bindings.ts` their reason to exist. Absent, the meter no-ops and every
   * call still goes out: metering is never a reason a job does not run.
   */
  meterDb?: Database | null
}

export interface ConsumeResult {
  acked: number
  retried: number
  deadLettered: number
  duplicates: number
}

/**
 * Records a terminal failure in KV for quick lookup and in R2 for the full
 * payload, so a post-mortem can replay the job without it sitting in the queue.
 */
async function deadLetter(
  env: TaskBindings,
  logger: Logger,
  at: number,
  detail: {
    id: string
    kind: string
    orgId: string
    attempts: number
    error: unknown
    body: unknown
  },
): Promise<void> {
  const record = {
    id: detail.id,
    kind: detail.kind,
    orgId: detail.orgId,
    attempts: detail.attempts,
    failedAt: new Date(at).toISOString(),
    error: serializeError(detail.error),
  }
  await env.KV.put(taskDeadKey(detail.id), JSON.stringify(record), {
    expirationTtl: TASK_DEAD_TTL_SECONDS,
  })
  // R2 keeps the body too; KV holds only the summary an operator greps for.
  await env.FILES.put(
    taskDeadObjectKey(detail.id, new Date(at)),
    JSON.stringify({ ...record, body: detail.body }, null, 2),
    { httpMetadata: { contentType: 'application/json' } },
  )
  logger.error('task dead-lettered', detail.error, {
    taskId: detail.id,
    kind: detail.kind,
    attempts: detail.attempts,
  })
}

/**
 * Processes one batch. Every message is settled exactly once — an unsettled
 * message would be redelivered on the batch timeout and burn an attempt for no
 * reason — and one poisonous message never prevents its neighbours from running.
 */
export async function consumeTaskBatch(
  batch: QueueBatchLike,
  env: TaskBindings,
  logger: Logger,
  options: ConsumeOptions = {},
): Promise<ConsumeResult> {
  const registry = options.registry ?? taskHandlers
  const now = options.now ?? (() => Date.now())
  const maxAttempts = numberFromEnv(env.TASK_MAX_ATTEMPTS, 5)
  const result: ConsumeResult = {
    acked: 0,
    retried: 0,
    deadLettered: 0,
    duplicates: 0,
  }

  /**
   * `provider_usage.organization_id` is nullable and the envelope's is a string, so the queue's
   * `system` sentinel is translated once, here, rather than in three handlers. This is the only
   * place the two conventions meet.
   */
  const orgIdAttribution = (orgId: string): string | null =>
    orgId === 'system' || orgId === 'unknown' ? null : orgId

  const deferMetering =
    options.waitUntil ??
    ((promise: Promise<unknown>) => {
      void promise.catch(() => undefined)
    })

  for (const message of batch.messages) {
    const parsed = taskEnvelopeSchema.safeParse(message.body)
    if (!parsed.success) {
      // Unparseable bodies can never become parseable; dead-letter and move on.
      await deadLetter(env, logger, now(), {
        id: message.id,
        kind: 'unknown',
        orgId: 'unknown',
        attempts: message.attempts,
        error: parsed.error,
        body: message.body,
      })
      message.ack()
      result.deadLettered += 1
      result.acked += 1
      continue
    }

    const envelope = parsed.data
    const jobLogger = logger.child({
      component: 'queue',
      route: `queue:${envelope.kind}`,
      orgId: envelope.orgId,
      taskId: envelope.id,
      attempt: message.attempts,
      ...(envelope.traceId === undefined
        ? {}
        : { requestId: envelope.traceId }),
    })

    const done = await env.KV.get(taskDoneKey(envelope.id))
    if (done !== null) {
      jobLogger.debug('task already completed; acking redelivery')
      message.ack()
      result.duplicates += 1
      result.acked += 1
      continue
    }

    // Built here rather than in each handler so that the workspace a call is attributed to comes
    // from the envelope the queue already validated, not from whatever a handler remembers to pass.
    const meteringRuntime = {
      db: options.meterDb ?? null,
      waitUntil: deferMetering,
      logger: jobLogger,
      now: () => new Date(now()),
    }

    const context: TaskContext = {
      env,
      logger: jobLogger,
      now,
      attempt: message.attempts,
      taskId: envelope.id,
      orgId: envelope.orgId,
      ...(envelope.traceId === undefined ? {} : { traceId: envelope.traceId }),
      callProvider: (label, send) =>
        callProvider(
          meteringRuntime,
          { organizationId: orgIdAttribution(envelope.orgId), ...label },
          send,
        ),
    }

    try {
      const metrics = await jobLogger.track('task completed', () =>
        runHandler(envelope, registry, context),
      )
      await env.KV.put(
        taskDoneKey(envelope.id),
        JSON.stringify({ at: now(), ...metrics }),
        {
          expirationTtl: TASK_DONE_TTL_SECONDS,
        },
      )
      message.ack()
      result.acked += 1
    } catch (error) {
      const exhausted = message.attempts >= maxAttempts
      if (isPermanentFailure(error) || exhausted) {
        await deadLetter(env, logger, now(), {
          id: envelope.id,
          kind: envelope.kind,
          orgId: envelope.orgId,
          attempts: message.attempts,
          error,
          body: message.body,
        })
        message.ack()
        result.deadLettered += 1
        result.acked += 1
        continue
      }
      // An upstream that told us when to come back knows better than our curve.
      const retryAfter =
        error instanceof TaskRetryableError
          ? error.retryAfterSeconds
          : undefined
      const delaySeconds =
        retryAfter ??
        retryDelaySeconds(message.attempts, {
          ...(options.random === undefined ? {} : { random: options.random }),
        })
      jobLogger.warn('task failed; scheduling retry', {
        delaySeconds,
        ...serializeError(error),
      })
      message.retry({ delaySeconds })
      result.retried += 1
    }
  }

  return result
}
