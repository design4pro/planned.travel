/**
 * Audit recording — the one way a request path appends to the workspace's trail.
 *
 * `recordAudit` in `src/server/repos/audit.ts` writes the row; this module is what makes calling it
 * from a server function safe. Three things sit between the two, and each of them is a property no
 * call site should have to remember:
 *
 * - **The request.** `audit_log.ip` and `audit_log.user_agent` are request facts, not arguments, so
 *   they are read here from `getRequest()` — the idiom `src/server/auth/session.ts` already uses —
 *   rather than passed in. A caller therefore cannot state them, which is the same reason
 *   `recordAudit` stamps the actor from the scope.
 * - **A missing request is not an error.** `getRequest()` resolves an `AsyncLocalStorage` store and
 *   *throws* when there is none, which is the case in a unit test, a queue handler, the cron trigger
 *   and a Durable Object alarm — see the comment block in `src/server/clock.ts`, which takes the
 *   same measurement. "No IP, no user agent" is the answer, not a failed audit.
 * - **It never fails the action it records.** An audit write is observability, not the transaction.
 *   Any throw from `recordAudit` — an unreachable D1, a value the input schema refuses — is caught,
 *   reported once with `serializeError`, and swallowed; the save the user just made still succeeds.
 *   This is the contract `mirrorToRoom` holds in `src/server/fns/context.ts` and the one
 *   `appendPlatformAudit` holds for the platform log.
 *
 * Swallowing is what makes {@link AuditAction} load-bearing rather than decorative, and the argument
 * is `src/server/catalog/audit.ts`'s verbatim: with the runtime failure path silent, the compiler is
 * the only layer left that can fail loudly. Spell `file.upoaded` and the regex in `recordAuditInput`
 * refuses it, the refusal goes to the logger, and the handler returns success with no row behind it.
 * Naming the actions in one frozen object means that mistake is a type error instead.
 */
import { getRequest } from '@tanstack/react-start/server'

import { createLogger, serializeError } from '#/server/observability'
import { recordAudit } from '#/server/repos'

import type { Logger } from '#/server/observability'
import type { RecordAuditInput, TenantScope } from '#/server/repos'

/* -------------------------------------------------------------------------------------------------
 * Vocabulary
 * ---------------------------------------------------------------------------------------------- */

/**
 * The tenant trail's action names: dotted, lowercase, entity-first.
 *
 * Deliberately not the whole product's vocabulary. Tenant-security events (a role change, an
 * invitation, a removal) gain their names in the stage that ships their write paths, and trip
 * lifecycle rides its own; platform-security events are not here at all, because they land in
 * `platform_audit_log` through `src/server/catalog/audit.ts`.
 */
export const AUDIT_ACTIONS = {
  FILE_UPLOADED: 'file.uploaded',
  FILE_DELETED: 'file.deleted',
  RESERVATION_CREATED: 'reservation.created',
  RESERVATION_UPDATED: 'reservation.updated',
  RESERVATION_DELETED: 'reservation.deleted',
  WORKSPACE_DEFAULTS_CHANGED: 'workspace.defaults_changed',
  TRIP_CURRENCY_CHANGED: 'trip.currency_changed',
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

/**
 * What a call site supplies.
 *
 * Derived from {@link RecordAuditInput} so the two cannot drift, minus the three fields a caller has
 * no business stating: `action` is narrowed to the frozen names, and `ip` and `userAgent` are read
 * off the request below. `metadata` keeps the repository's flat
 * `Record<string, string | number | boolean | null>`, so an entry can never smuggle a nested payload
 * into the JSON column.
 */
export type TrailInput = Omit<
  RecordAuditInput,
  'action' | 'ip' | 'userAgent'
> & {
  readonly action: AuditAction
}

/* -------------------------------------------------------------------------------------------------
 * The request
 * ---------------------------------------------------------------------------------------------- */

/** What the request contributes to a row. Both `null` when there is no request. */
interface RequestOrigin {
  readonly ip: string | null
  readonly userAgent: string | null
}

/**
 * `shortTextSchema`'s bound in `src/server/repos/validation.ts`, which `recordAuditInput` applies to
 * both fields.
 *
 * A header longer than this is bounded rather than allowed to reject the entry, for the reason
 * `src/server/catalog/audit.ts` states about its own bounds: a `max()` that refuses the whole row
 * loses the record over a field nobody reads, and the record is the point. The value is what the
 * client sent, and no client is owed an unbounded column.
 */
const REQUEST_FIELD_MAX = 200

/** One header, trimmed and bounded. `null` when absent or blank — an empty string records nothing. */
function boundedHeader(headers: Headers, name: string): string | null {
  const value = headers.get(name)?.trim() ?? ''
  return value.length === 0 ? null : value.slice(0, REQUEST_FIELD_MAX)
}

/**
 * The caller's address and user agent, or nulls.
 *
 * Cloudflare terminates the connection, so `cf-connecting-ip` is the client address and every other
 * candidate is a header the client itself can write — the same reading
 * `src/server/fns/console/context.ts` takes for the platform log.
 */
function requestOrigin(): RequestOrigin {
  let headers: Headers
  try {
    headers = getRequest().headers
  } catch {
    // No request in scope: a unit test, a queue handler, the cron trigger or a Durable Object
    // alarm. Not an error — those have no client to record.
    return { ip: null, userAgent: null }
  }
  return {
    ip: boundedHeader(headers, 'cf-connecting-ip'),
    userAgent: boundedHeader(headers, 'user-agent'),
  }
}

/* -------------------------------------------------------------------------------------------------
 * The append
 * ---------------------------------------------------------------------------------------------- */

/**
 * Memoised per isolate, and built without `env` on purpose: this module is imported by the `server`
 * Vitest project, where `cloudflare:workers` does not resolve. `loggerFromEnv` would buy one thing —
 * `LOG_LEVEL` — and the only line emitted here is a `warn`, which every level below `error` keeps.
 */
let logger: Logger | undefined

function log(): Logger {
  logger ??= createLogger({ context: { component: 'audit-trail' } })
  return logger
}

/**
 * Appends one entry to the workspace's audit trail. Resolves whatever happens.
 *
 * Call it *after* the work has committed: a row describing a save that was then refused is worse
 * than no row, and this function has no way to take one back.
 */
export async function trail(
  scope: TenantScope,
  input: TrailInput,
): Promise<void> {
  try {
    const origin = requestOrigin()
    await recordAudit(scope, {
      ...input,
      ip: origin.ip,
      userAgent: origin.userAgent,
    })
  } catch (cause) {
    log().warn('audit entry not recorded', {
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      orgId: scope.ctx.organizationId,
      userId: scope.ctx.userId,
      ...serializeError(cause),
    })
  }
}
