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
import { CURRENCY_REFUSAL_KEYS } from '#/lib/currency-refusals'

import type { PublicFailure, PublicFailureCode } from '#/lib/errors'

/**
 * Errors whose `message` is written for the person reading the screen.
 *
 * - `AuthRequirementError` (`src/server/auth/tenant.ts`) - "you may not", a 401 or 403.
 * - `ConsoleActionError` (`src/server/fns/console/errors.ts`) - a 409 about the target's state,
 *   from a closed vocabulary of refusal codes.
 * - `ConsoleUnattributableError` (same file) - a 500 whose message is deliberately the only honest
 *   instruction available, because there is nothing for a screen to branch on.
 * - `TripArchivedError` (`src/server/repos/trips.ts`) - a refusal to rewrite history, whose message
 *   names the one action that lifts it.
 * - `TripRoleError` (same file) - "a viewer may not change this trip", from the trip's own closed
 *   role vocabulary.
 *
 * The last two are `RepositoryError` subclasses, and they are listed one by one on purpose.
 * Listing the base name instead would make every repository error authored by default, which is the
 * opposite of what redaction is for: `NotFoundError` carries the row id it was asked for, and
 * `MissingTenantContextError` describes the shape of a tenant context. Those stay diagnostics. What
 * earns a place here is a sentence written for the reader with nothing interpolated into it that a
 * reader may not see - which is why every entry is a class with a static or vocabulary-only message,
 * and why the test file constructs each one and asserts its text.
 *
 * The set is also closed. Each entry's message is an English sentence that reaches a reader in any
 * of the 23 locales, which `docs/SPEC.md` §9 rule 10 records as a bounded exception to "no
 * untranslated string reaches a screen" - bounded to exactly these names, which the test file pins,
 * whatever sentences they carry. A new refusal class does not join this list: it travels as a
 * message key the client resolves, the shape `SHELL_STATE_KEYS` already has, or it stays a
 * diagnostic and the caller's localised fallback is what the reader sees. `ForbiddenError` is the
 * standing example of the second. A quota refusal is the third shape, below: still a diagnostic,
 * with a constant code beside its reference - and so is a billing failure the reader is owed a
 * sentence for (forbidden, not connected, rate-limited, refused by Polar, order not invoiceable).
 */
export const AUTHORED_ERROR_NAMES: ReadonlySet<string> = new Set([
  'AuthRequirementError',
  'ConsoleActionError',
  'ConsoleUnattributableError',
  'TripArchivedError',
  'TripRoleError',
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

/**
 * Both classes called `QuotaExceededError` - the repository's (`src/server/repos/context.ts`),
 * which a write past a countable limit throws, and billing's (`src/server/billing/types.ts`) -
 * are told apart from nothing else by their name, for the reason this module gives above.
 * `__tests__/public.test.ts` constructs both.
 */
const QUOTA_ERROR_NAME = 'QuotaExceededError'

/**
 * Billing diagnostics the reader is owed a sentence for, by class name. The message of every one of
 * these is for an operator - `PolarApiError` quotes a request path and a slice of Polar's body,
 * `BillingConfigError` the `wrangler secret put` command to run - so only the code crosses and the
 * billing screen resolves it to localised copy. `PolarApiError` is read further down, by status.
 */
const BILLING_CODES_BY_NAME: ReadonlyMap<string, PublicFailureCode> = new Map([
  ['BillingForbiddenError', 'BILLING_FORBIDDEN'],
  ['BillingConfigError', 'BILLING_NOT_CONNECTED'],
  ['OrderNotInvoiceableError', 'BILLING_ORDER_NOT_INVOICEABLE'],
])

/** The code for a Polar failure the reader can act on: a rate limit, or a refusal of the change. */
function polarFailureCode(cause: unknown): PublicFailureCode | null {
  const status =
    typeof cause === 'object' && cause !== null && 'status' in cause
      ? cause.status
      : null
  if (status === 429) return 'BILLING_RATE_LIMITED'
  if (status === 402 || status === 422) return 'BILLING_PROVIDER_REFUSED'
  return null
}

function billingCodeOf(
  name: string | null,
  cause: unknown,
): PublicFailureCode | null {
  if (name === null) return null
  if (name === 'PolarApiError') return polarFailureCode(cause)
  return BILLING_CODES_BY_NAME.get(name) ?? null
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
  //
  // A currency refusal (`src/lib/currency-refusals.ts`) is the same shape and is let through the
  // same way: an exact match against a closed list of keys, never a prefix or a pattern, so any
  // other repository message - a database diagnostic included - is still redacted below.
  const thrown = cause instanceof Error ? cause.message : cause
  if (
    typeof thrown === 'string' &&
    (SHELL_STATE_KEYS.some((key) => key === thrown) ||
      CURRENCY_REFUSAL_KEYS.some((key) => key === thrown))
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

  // Not authored copy: the message names the metric and the ceiling, which are for a maintainer.
  // What the reader is owed is the fact, so the one constant code crosses and nothing the error
  // carries does - never `RepositoryError.code` in general, which would send `NOT_FOUND` and
  // `TENANT_ISOLATION` to the browser. The caller attaches the reference, as for any diagnostic.
  if (name === QUOTA_ERROR_NAME) {
    return { kind: 'unexpected', code: 'QUOTA_EXCEEDED' }
  }

  const billingCode = billingCodeOf(name, cause)
  if (billingCode !== null) {
    return { kind: 'unexpected', code: billingCode }
  }

  return { kind: 'unexpected' }
}
