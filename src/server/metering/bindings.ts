/**
 * The single binding seam of `src/server/metering/**`.
 *
 * Everything in this directory that reaches the Worker environment does it here and nowhere else,
 * the same arrangement `src/server/fns/console/bindings.ts` has and for the same reason its header
 * gives: `cloudflare:workers` cannot be imported in the `server` Vitest project at all, so a module
 * that reaches for a binding itself cannot be driven with a fake one. Keeping the seam to one file
 * is what lets `./outbound` be tested as itself, with the gate and the recording posture running
 * for real.
 *
 * Nothing here decides anything. It hands back a runtime; every rule about when a call is refused
 * and what gets counted lives one module over.
 *
 * **The queue path does not use this file.** `src/server/worker.ts` is handed a real
 * `ExecutionContext` on every `queue()` invocation and passes it down, so a queue handler's
 * `waitUntil` is that context's — which is the one that actually keeps the batch alive. This
 * module is for the request path, where the ambient `waitUntil` of `cloudflare:workers` is the
 * only one available.
 */

import { env, waitUntil } from 'cloudflare:workers'
import { getDb } from '#/server/db/client'
import { loggerFromEnv } from '#/server/observability'
import type { OutboundRuntime } from './outbound'
import type { Logger } from '#/server/observability'

/** Memoised per isolate: the logger holds no request state. */
let logger: Logger | undefined

function meteringLogger(): Logger {
  logger ??= loggerFromEnv(env, { context: { component: 'metering' } })
  return logger
}

/**
 * The runtime for an outbound call made on the request path.
 *
 * `db` is never `null` here — the Worker always has its D1 binding — but the field stays nullable
 * on {@link OutboundRuntime} because the queue path builds its own runtime from
 * `TaskBindings.DB`, which is optional by design so a handler that touches no database needs no
 * database stub to be exercised.
 */
export function requestOutboundRuntime(): OutboundRuntime {
  return {
    db: getDb(),
    waitUntil,
    logger: meteringLogger(),
    now: () => new Date(),
  }
}
