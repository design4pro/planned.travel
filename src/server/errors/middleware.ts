/**
 * The one place a server function's failure becomes something a browser is allowed to see.
 *
 * It is registered globally in `src/start.ts`, which is what makes it a boundary rather than a
 * convention: there are 73 `createServerFn` call sites in this project and none of them has to
 * remember anything. `getStartOptions().functionMiddleware` is flattened ahead of a function's own
 * middleware, and the input validator runs inside the `next()` below - so a Zod rejection, which
 * fires before the handler is ever entered, is caught here too.
 *
 * What it changes: before this existed, a thrown value crossed to the browser with its `message`
 * intact and the error panel rendered that message verbatim. When D1 failed, the reader was shown
 * the query. The diagnostic now stops here - it is logged and reported, and what crosses is an
 * envelope carrying a reference to it.
 *
 * The reference is not decoration. Withholding the diagnostic without offering one would leave
 * somebody reporting a problem with nothing to quote, which is the job the raw message was
 * accidentally doing.
 */

import * as Sentry from '@sentry/cloudflare'
import { createMiddleware } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'

import { encodePublicFailure } from '#/lib/errors'
import { newRequestId } from '#/server/observability'
import { sentryDsn, workerLogger } from '#/server/observability/sentry'

import { classifyFailure } from './public'

import type { Logger } from '#/server/observability'

/** Memoised per isolate, like the one in `src/server/fns/context.ts`: it holds no request state. */
let logger: Logger | undefined

function log(): Logger {
  logger ??= workerLogger(env, { context: { component: 'server-fn' } })
  return logger
}

/**
 * A reference the reader can quote and we can find again.
 *
 * Sentry's event id when there is one, because it leads straight to the event rather than to a log
 * search. A fresh request id otherwise, so the reference is never absent - an unconfigured
 * environment still has to give somebody something to report.
 */
function recordDiagnostic(cause: unknown): string {
  const reference =
    sentryDsn(env) === undefined
      ? newRequestId()
      : Sentry.captureException(cause)
  log().error('server function failed', cause, { reference })
  return reference
}

/**
 * Redact a thrown diagnostic, keep authored copy.
 *
 * Rethrowing rather than returning: a server function that failed has to keep failing, or every
 * caller's error handling stops running.
 */
export const failureRedactionMiddleware = createMiddleware({
  type: 'function',
}).server(async ({ next }) => {
  try {
    return await next()
  } catch (cause) {
    const failure = classifyFailure(cause)

    // One counter at the one place every server-function failure passes through. It answers the
    // question a stack trace cannot - how often this happens, and how much of it is the product
    // refusing on purpose rather than breaking.
    Sentry.metrics.count('server_fn.failure', 1, {
      attributes: { kind: failure.kind },
    })

    if (failure.kind !== 'unexpected') {
      // Authored copy: it was written for this moment, so it travels intact and is not an
      // incident. A refused action is the product working.
      throw new Error(encodePublicFailure(failure))
    }

    throw new Error(
      encodePublicFailure({
        kind: 'unexpected',
        reference: recordDiagnostic(cause),
      }),
    )
  }
})
