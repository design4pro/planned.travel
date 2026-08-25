/**
 * The platform-actor entry point: what every console server function starts at.
 *
 * `src/server/fns/context.ts` is the sibling this file deliberately is not. `appScope()` there
 * resolves a `TenantScope` — an organization id ANDed onto every predicate — and a console action
 * has no organization by construction: it acts *on* accounts and sessions, which belong to no
 * workspace, and SPEC §5 states that handing the tenant layer a fabricated or placeholder context to
 * reach global rows "destroys the single guarantee it was built to give". So nothing in this
 * directory imports it, nothing here builds a tenant context, and `__tests__/isolation.test.ts`
 * asserts both against the module graph rather than against this paragraph.
 *
 * The path docs/ACCESS.md §2.6 fixes for every admin action runs through exactly two functions here,
 * in this order:
 *
 * ```
 * console screen
 *   → server function in this directory
 *   → openConsoleCall()      // requirePermission (§2.5) + the §6.4 impersonation veto
 *   → auth.api.<endpoint>({ body, headers })          // in process, no HTTP: the fifteen
 *   →                                                 // /api/auth/admin/* paths answer 404
 *   → recordConsoleAction()  // one structured log line + one platform_audit_log row
 * ```
 *
 * {@link openConsoleCall} runs before the mutation and {@link recordConsoleAction} after it has
 * committed — same call, not the same transaction (docs/ACCESS.md §4.3). Drizzle's D1 driver has no
 * interactive transactions, so that ordering is the only shape available and never a preference:
 * nothing here may be written as though a rollback were possible around the audit append.
 *
 * The actor's `role` is read off the session **as a value** and carried into the row. `user.role` is
 * mutable, so a log that resolved the role by joining `user` at query time would report every past
 * action of a promoted account under the role it holds today, silently rewriting the record of what
 * a curator was allowed to do (docs/ACCESS.md §4.1).
 *
 * Bindings are reached through `./bindings` and never directly, which is what lets this file's
 * ordering be tested with the real guard and the real audit writer.
 */

import {
  getRequest,
  getRequestHeader,
  getRequestIP,
} from '@tanstack/react-start/server'

import { requirePermission } from '#/server/auth/guard'
import { AuthRequirementError } from '#/server/auth/tenant'
import { appendPlatformAudit } from '#/server/catalog/audit'
import {
  consoleLogger,
  currentSession,
  platformDb,
  readSessionRows,
  readUserRole,
} from './bindings'
import { ConsoleActionError } from './errors'
import { sessionTokensFrom } from './session-keys'

import type { PlatformPermissionRequest } from '#/server/auth/access'
import type { PlatformActor } from '#/server/auth/guard'
import type { AuthSession } from '#/server/auth/session'
import type { PlatformAuditEntryInput } from '#/server/catalog/audit'
import type { LogFields, Logger } from '#/server/observability'

/**
 * An authorised platform action, with everything the audit row and the plugin call both need.
 *
 * `headers` is the caller's own request headers and is not optional at any call site: every admin
 * endpoint runs behind `adminMiddleware`, which resolves the session from them and throws `401`
 * without one, and `stopImpersonating` additionally declares `requireHeaders: true` and reads a
 * *signed* cookie off them. A synthesised header bag fails in a way that reads as a plugin bug.
 */
export interface ConsoleCall {
  readonly session: AuthSession
  readonly actor: PlatformActor
  readonly headers: Headers
  /** The request IP, verbatim, as `platform_audit_log.ip` records it. */
  readonly ip: string | null
  /** The request's `User-Agent` header, verbatim and nothing else. */
  readonly userAgent: string | null
  readonly logger: Logger
}

/** An impersonated session on its way out, with the *operator* as the actor. */
export interface ImpersonationExit extends ConsoleCall {
  /** The account being worn, and the `entity_id` of `platform.user.impersonation_ended`. */
  readonly targetUserId: string
}

/**
 * Cloudflare terminates the connection, so `cf-connecting-ip` is the client address and every other
 * candidate is a header a client can write. `x-forwarded-for` is the fallback for a local `vite dev`
 * Worker, where the Cloudflare header is absent.
 */
function requestIp(): string | null {
  return (
    getRequestHeader('cf-connecting-ip') ??
    getRequestIP({ xForwardedFor: true }) ??
    null
  )
}

/**
 * Resolves the caller, refuses them unless they hold every statement in `permission`, and hands back
 * the actor the audit row is written from.
 *
 * Called **before** the mutation touches a row, always. `requirePermission` is synchronous and
 * decides nothing of its own — it is the only implementation of "may this actor do this"
 * (docs/ACCESS.md §2.5) and it carries the §6.4 veto, so an impersonated session reaching for a
 * platform capability is refused here whatever role the impersonated account holds.
 */
export async function openConsoleCall(
  permission: PlatformPermissionRequest,
): Promise<ConsoleCall> {
  const session = await currentSession()
  requirePermission(session, permission)

  // `requirePermission` throws on a null session, so this is a fact about control flow rather than
  // an assumption about a nullable value — and it is a narrowing the compiler cannot make itself.
  if (!session) {
    throw new AuthRequirementError(
      'unauthenticated',
      'You need to sign in to continue.',
    )
  }

  return {
    session,
    actor: {
      userId: session.user.id,
      actorKind: 'human',
      role: session.user.role,
      tokenId: null,
    },
    headers: getRequest().headers,
    ip: requestIp(),
    userAgent: getRequestHeader('user-agent') ?? null,
    logger: consoleLogger(),
  }
}

/**
 * The one entry point that is not {@link openConsoleCall}, and the one function in this directory
 * that passes no statement to `requirePermission`. Both facts are forced, and neither is a gap.
 *
 * `requirePermission`'s third refusal denies **every** statement in the dictionary when
 * `session.impersonatedBy` is set (docs/ACCESS.md §6.4). That veto is what stops an operator wearing
 * an account from changing a role or issuing a token — and it applies to the *whole* dictionary, so
 * a request for any statement here would deny the only action §6.1 leaves as a way out.
 * `/admin/stop-impersonating` answers `404` like the other fourteen, so this function is the exit,
 * and an exit the veto closes is not an exit. §6.4's own list of what an impersonated session may
 * not do is written out by name — nested impersonation, tokens, roles, bans, publishing, source
 * runs, share revocation — and ending the impersonation is deliberately not among them.
 *
 * What authorises this call instead is not a permission at all but a fact about the caller: the
 * session is an impersonated one. Nobody else can present it, and holding it is the whole claim.
 * There is no second answer to "may this actor do this" here, because no statement is being asked
 * for.
 *
 * The actor is the **operator**, read off `session.impersonatedBy` — docs/ACCESS.md §6.4 requires the
 * impersonator in `actor_user_id` and the target in `entity_id`. Their role is read from the `user`
 * row rather than from the session in hand, which carries the worn account's role and would
 * attribute the operator's action to whatever the target happens to be.
 */
export async function openImpersonationExit(): Promise<ImpersonationExit> {
  const session = await currentSession()
  if (!session) {
    throw new AuthRequirementError(
      'unauthenticated',
      'You need to sign in to continue.',
    )
  }

  const operatorId = session.session.impersonatedBy
  if (operatorId === null) {
    throw new ConsoleActionError(
      'not-impersonating',
      'This session is not an impersonated one.',
    )
  }

  return {
    session,
    actor: {
      userId: operatorId,
      actorKind: 'human',
      role: await readUserRole(operatorId),
      tokenId: null,
    },
    targetUserId: session.user.id,
    headers: getRequest().headers,
    ip: requestIp(),
    userAgent: getRequestHeader('user-agent') ?? null,
    logger: consoleLogger(),
  }
}

/**
 * The one place a console mutation is recorded: one structured log line, then one
 * `platform_audit_log` row.
 *
 * Both, together, because they answer different questions and neither substitutes for the other —
 * the line is operational and expires with the log retention, the row is the ledger and is kept for
 * 400 days. Emitting them from a single function is what makes "exactly one row per action" a
 * property of the code rather than of every call site's diligence.
 *
 * `appendPlatformAudit` never throws: it retries once for the four verbs docs/ACCESS.md §4.3 audits
 * without exception and reports a rejected append through `src/server/observability` at `error`,
 * naming the action, the actor and the entity. A completed ban is never reversed because a log write
 * failed.
 */
export async function recordConsoleAction(
  call: ConsoleCall,
  entry: Omit<PlatformAuditEntryInput, 'ip' | 'userAgent'>,
  fields: LogFields = {},
): Promise<void> {
  call.logger.info('console platform action', {
    ...fields,
    action: entry.action,
    entityId: entry.entityId,
    actorUserId: call.actor.userId,
    actorRole: call.actor.role,
    actorKind: call.actor.actorKind,
  })

  await appendPlatformAudit(
    platformDb(),
    call.actor,
    { ...entry, ip: call.ip, userAgent: call.userAgent },
    call.logger,
  )
}

/** The target's live session tokens — the KV keys their cached blobs are stored under. */
export async function readSessionTokens(
  userId: string,
): Promise<ReadonlyArray<string>> {
  return sessionTokensFrom(await readSessionRows(userId))
}
