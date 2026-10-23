/**
 * The shell shared by the producers that enqueue as a follow-up to a write D1 already holds.
 *
 * Lives beside {@link enqueueTasks} rather than inside it, and that placement is the point: it reaches
 * the queue binding through `#/server/auth/env`, which imports `cloudflare:workers`, so `jobs` stays
 * pure and takes the queue as an argument while this owns the one lazy import. A producer under
 * `src/routes` is in the client graph and may call this, because the specifier is only resolved when
 * the function runs.
 *
 * Producers that rethrow after compensating (`trip-copy`) have a different contract and do not use it.
 */

import { serializeError } from '#/server/observability'
import { enqueueTasks } from '#/server/queue/jobs'

import type { LogFields } from '#/server/observability'
import type { EnqueueInput } from '#/server/queue/jobs'
import type { TaskKind } from '#/server/queue/types'

export interface DetachedLogger {
  warn: (message: string, fields?: LogFields) => void
}

export interface DetachedLog {
  logger: DetachedLogger
  /** The producer's own log line. */
  message: string
  /** What the caller's write is identified by; `serializeError` fields are merged over it. */
  context: LogFields
}

/**
 * Sends the envelopes `buildEnvelopes` returns, and never fails the surrounding write.
 *
 * D1 is the durable record and has already been written by the time a detached producer runs; a
 * queue that refuses leaves a stale derived view, which is a much smaller harm than a save that
 * appears to have failed. So a refusal is caught, logged once as a `warn` with the error merged over
 * `context`, and returned from.
 *
 * - **The builder is a thunk** so envelope construction (payload validation, id derivation) stays
 *   inside the guarded region: a builder that throws is logged exactly as a refused send is.
 * - **An empty result never reaches the binding.** Nothing to send is not a reason to import the
 *   Worker environment, and it keeps the plain-Node suites that never mock it working.
 * - **It sends everything in one call.** `enqueueTasks` cuts the envelopes at the Queues batch bound.
 */
export async function enqueueDetached(
  buildEnvelopes: () => Array<EnqueueInput<TaskKind>>,
  { logger, message, context }: DetachedLog,
): Promise<void> {
  try {
    const envelopes = buildEnvelopes()
    if (envelopes.length === 0) {
      return
    }

    const { taskQueue } = await import('#/server/auth/env')
    await enqueueTasks(taskQueue(), envelopes)
  } catch (cause) {
    logger.warn(message, { ...context, ...serializeError(cause) })
  }
}
