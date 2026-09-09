/**
 * Producer side of the `TASKS` queue.
 *
 * Server functions and route handlers enqueue work through these helpers so
 * every message on the queue is a validated envelope with an idempotency key.
 * Nothing slow ever runs inline in a request: the request writes D1, enqueues,
 * and returns.
 */

import { taskEnvelopeSchema } from './types'
import type { TaskEnvelope, TaskKind, TaskPayloadMap, TaskQueue } from './types'

export interface EnqueueInput<TKind extends TaskKind> {
  kind: TKind
  orgId: string
  payload: TaskPayloadMap[TKind]
  /**
   * Idempotency key. Pass a deterministic value (for example
   * `reminder:${reservationId}:${dueAt}`) to make double-enqueues harmless.
   */
  id?: string
  traceId?: string
  delaySeconds?: number
}

/** Marker used by jobs that are not tenant-scoped (backups, retention sweeps). */
export const SYSTEM_ORG_ID = 'system'

/**
 * How many envelopes may go in one `sendBatch`.
 *
 * Cloudflare Queues accepts at most 100 messages per batch, and {@link enqueueTasks} maps every
 * input into one `sendBatch` without chunking — so the bound has to be held by each producer, and
 * it is declared here, beside the call it bounds, rather than once per producer.
 */
export const QUEUE_BATCH_MAX = 100

/** Completed job markers live this long; longer than any realistic redelivery. */
export const TASK_DONE_TTL_SECONDS = 24 * 60 * 60

/** Dead-letter diagnostics are kept for a fortnight for post-mortems. */
export const TASK_DEAD_TTL_SECONDS = 14 * 24 * 60 * 60

export const TASK_DONE_PREFIX = 'task:done:'
export const TASK_DEAD_PREFIX = 'task:dead:'
export const TASK_DEAD_OBJECT_PREFIX = 'dead-letter/'

export function taskDoneKey(id: string): string {
  return `${TASK_DONE_PREFIX}${id}`
}

export function taskDeadKey(id: string): string {
  return `${TASK_DEAD_PREFIX}${id}`
}

export function taskDeadObjectKey(id: string, at: Date): string {
  return `${TASK_DEAD_OBJECT_PREFIX}${at.toISOString().slice(0, 10)}/${id}.json`
}

/** Builds and validates an envelope without sending it. */
export function buildTaskEnvelope<TKind extends TaskKind>(
  input: EnqueueInput<TKind>,
  now: () => number = () => Date.now(),
): TaskEnvelope {
  return taskEnvelopeSchema.parse({
    id: input.id ?? crypto.randomUUID(),
    kind: input.kind,
    orgId: input.orgId,
    enqueuedAt: now(),
    ...(input.traceId === undefined ? {} : { traceId: input.traceId }),
    payload: input.payload,
  })
}

export async function enqueueTask<TKind extends TaskKind>(
  queue: TaskQueue,
  input: EnqueueInput<TKind>,
  now?: () => number,
): Promise<TaskEnvelope> {
  const envelope = buildTaskEnvelope(input, now)
  await queue.send(
    envelope,
    input.delaySeconds === undefined
      ? undefined
      : { delaySeconds: input.delaySeconds },
  )
  return envelope
}

/** Sends up to 100 messages in one round trip — the Queues batch limit. */
export async function enqueueTasks(
  queue: TaskQueue,
  inputs: Array<EnqueueInput<TaskKind>>,
  now?: () => number,
): Promise<Array<TaskEnvelope>> {
  const envelopes = inputs.map((input) => buildTaskEnvelope(input, now))
  if (envelopes.length === 0) return envelopes
  await queue.sendBatch(
    envelopes.map((body, index) => {
      const delaySeconds = inputs[index]?.delaySeconds
      return delaySeconds === undefined ? { body } : { body, delaySeconds }
    }),
  )
  return envelopes
}

export interface BackoffOptions {
  baseSeconds?: number
  factor?: number
  maxSeconds?: number
  /** Injectable for deterministic tests. Returns a value in `[0, 1)`. */
  random?: () => number
  /** Fraction of the delay applied as +/- jitter. */
  jitterRatio?: number
}

/**
 * Exponential backoff with symmetric jitter.
 *
 * Jitter matters here: a queue batch of ten messages that all fail against the
 * same upstream would otherwise retry in lockstep and hammer it again.
 */
export function retryDelaySeconds(
  attempt: number,
  options: BackoffOptions = {},
): number {
  const base = options.baseSeconds ?? 10
  const factor = options.factor ?? 2
  const max = options.maxSeconds ?? 900
  const jitterRatio = options.jitterRatio ?? 0.2
  const random = options.random ?? Math.random
  const safeAttempt = Math.max(1, Math.trunc(attempt))
  const raw = Math.min(base * Math.pow(factor, safeAttempt - 1), max)
  const jitter = raw * jitterRatio * (random() * 2 - 1)
  return Math.max(1, Math.min(max, Math.round(raw + jitter)))
}
