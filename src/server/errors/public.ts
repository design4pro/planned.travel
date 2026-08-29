/**
 * The single decision about what a user may be told when a server function fails.
 *
 * It answers one question - is this thrown value authored copy, or a diagnostic? - and it answers it
 * in one place so the answer cannot differ between the console, a form and the error boundary. It
 * has no imports on purpose: it is reached from the global function middleware, which every server
 * function runs through, and pulling the auth and console module graphs in behind it would put the
 * database handle and the session layer in the import graph of a module registered at startup.
 *
 * Errors are therefore recognised by `name` rather than by `instanceof`. That is the same trade
 * `authErrorCode()` in `src/server/fns/console/errors.ts` already makes, for the same reason it
 * gives. The cost of a stringly-typed check is that renaming a class would silently stop it being
 * recognised - so `__tests__/public.test.ts` constructs each real class and asserts the answer,
 * which turns that rename back into a failing test.
 *
 * Message text is never matched, only the name. Messages are copy, they are localisable, and they
 * change.
 */

import { SHELL_STATE_KEYS } from '#/components/layout/session'

import type { PublicFailure } from '#/lib/errors'

/**
 * Errors whose `message` is written for the person reading the screen.
 *
 * - `AuthRequirementError` (`src/server/auth/tenant.ts`) - "you may not", a 401 or 403.
 * - `ConsoleActionError` (`src/server/fns/console/errors.ts`) - a 409 about the target's state,
 *   from a closed vocabulary of refusal codes.
 * - `ConsoleUnattributableError` (same file) - a 500 whose message is deliberately the only honest
 *   instruction available, because there is nothing for a screen to branch on.
 */
const AUTHORED_ERROR_NAMES = new Set([
  'AuthRequirementError',
  'ConsoleActionError',
  'ConsoleUnattributableError',
])

interface IssueLike {
  message: string
}

/**
 * A Zod failure, read structurally.
 *
 * Zod lives behind a dependency boundary and `instanceof` across one is the check that starts
 * failing silently after a version bump duplicates a module - the hazard the console's own error
 * reader calls out. What is stable is the shape: an `issues` array of objects carrying a string
 * `message`.
 */
function validationIssues(cause: unknown): ReadonlyArray<IssueLike> | null {
  if (typeof cause !== 'object' || cause === null || !('issues' in cause)) {
    return null
  }
  const issues: unknown = cause.issues
  if (!Array.isArray(issues) || issues.length === 0) {
    return null
  }
  const readable: Array<IssueLike> = []
  for (const issue of issues) {
    if (typeof issue !== 'object' || issue === null || !('message' in issue)) {
      return null
    }
    const { message } = issue as { message: unknown }
    if (typeof message !== 'string' || message.trim().length === 0) {
      return null
    }
    readable.push({ message: message.trim() })
  }
  return readable
}

function nameOf(cause: unknown): string | null {
  if (typeof cause !== 'object' || cause === null || !('name' in cause)) {
    return null
  }
  const { name } = cause
  return typeof name === 'string' ? name : null
}

/**
 * Classify a thrown value. Pure: it neither logs nor reports, so the caller decides both.
 *
 * `reference` is attached by the caller for `unexpected`, because only the caller knows whether the
 * diagnostic was actually recorded anywhere for that reference to point at.
 */
export function classifyFailure(cause: unknown): PublicFailure {
  // A named shell state. `loadShell` throws one of exactly two message keys when a session has no
  // workspace or a membership has just been revoked, and `src/components/layout/session.ts`
  // resolves it in the reader's own locale. It is authored copy wearing an `Error`, and the
  // blocked traveller it is written for is not an incident - redacting it would replace the one
  // screen that explains their situation with a generic failure, and file a Sentry issue for each
  // of them.
  const thrown = cause instanceof Error ? cause.message : cause
  if (
    typeof thrown === 'string' &&
    SHELL_STATE_KEYS.some((key) => key === thrown)
  ) {
    return { kind: 'refusal', message: thrown }
  }

  const issues = validationIssues(cause)
  if (issues !== null) {
    // Deduplicated: one field failing two rules should not say the same sentence twice.
    const messages = [...new Set(issues.map((issue) => issue.message))]
    return { kind: 'validation', message: messages.join(' ') }
  }

  const name = nameOf(cause)
  if (name !== null && AUTHORED_ERROR_NAMES.has(name)) {
    const message = cause instanceof Error ? cause.message.trim() : ''
    if (message.length > 0) {
      return { kind: 'refusal', message }
    }
  }

  return { kind: 'unexpected' }
}
