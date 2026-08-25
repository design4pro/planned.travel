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
 *   → clearSessionCache()    // on the paths that end or invalidate sessions, and BEFORE the
 *   →                        // mutation, because afterwards the token names are gone for good
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
 * **One invariant follows from that ordering and is the reason two functions below are wrapped in a
 * `try` they can never leave.** Once the plugin call has committed there is nothing left to undo, so
 * anything that throws between it and {@link recordConsoleAction} does not cancel the action — it
 * only deletes the row that records it, which is §4.3's "an unaudited mutation" arriving by the back
 * door. The *operational* work on that stretch is exactly {@link endSessionIndex} and
 * {@link dropSessionSnapshots} — one KV delete and one paged D1 read, each of which rejects for the
 * ordinary transient reasons — and neither may reject outwards: a cache key that outlived its purge
 * is an incident to raise, never a reason to lose the ledger entry for a role change that really
 * happened. Everything that is allowed to refuse a call — the guard, the target read,
 * {@link clearSessionCache} — runs *before* the mutation, which is what makes that refusal free.
 *
 * The one thing on that stretch which is still allowed to throw is the boundary parse of what the
 * plugin answered with (`./projections`), and it is a different kind of failure on purpose: it
 * rejects only if `better-auth` returned something that is not the row its own endpoint is
 * documented to return, which is the dependency not being the dependency rather than a transient.
 * Inventing an `after` payload for a response nobody can read would put a guess in a ledger kept for
 * 400 days, and a guess there is worse than a gap that comes with a stack trace.
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
import { serializeError } from '#/server/observability'
import {
  consoleLogger,
  currentSession,
  platformDb,
  readUserRole,
  sessionKeyStore,
  sessionPageReader,
} from './bindings'
import { ConsoleActionError } from './errors'
import { deleteSessionIndexKey, purgeSessionBlobs } from './session-keys'

import type { PlatformPermissionRequest } from '#/server/auth/access'
import type { PlatformActor } from '#/server/auth/guard'
import type { AuthSession } from '#/server/auth/session'
import type { PlatformAuditEntryInput } from '#/server/catalog/audit'
import type { LogFields, Logger } from '#/server/observability'
import type { SessionBlobPurge } from './session-keys'

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

/**
 * Which read a console log line is about.
 *
 * **These are not action names, and they are deliberately not spelled like one.** docs/ACCESS.md
 * §4.2 closes the audit vocabulary at thirty-one names and states in as many words that reads are
 * not audited - "there is deliberately no `catalog_place.read`" - so `platform.user.list` and
 * `platform.session.list` are not members of it and never can be. An earlier version of this
 * directory emitted exactly those strings as the `action` field of a log line, which put a name that
 * is not in the closed list into the one field an operational view reads as an action, beside the
 * lines of the mutations that are. The ruling, taken here rather than by amending §4.2: **they are
 * log fields.** A read has no action because it is not audited, so it carries `read` and a bare noun,
 * and `action` stays what §4.2 says it is.
 */
export type ConsoleRead = 'users' | 'user' | 'sessions'

/**
 * The one structured line a console read emits, and the only place a read is logged from.
 *
 * One function rather than three call sites, so the ruling above is a property of the code: nothing
 * can reintroduce an action-shaped field on a read without deleting this.
 */
export function recordConsoleRead(
  call: ConsoleCall,
  read: ConsoleRead,
  fields: LogFields = {},
): void {
  call.logger.info('console platform read', {
    ...fields,
    read,
    actorUserId: call.actor.userId,
    actorRole: call.actor.role,
  })
}

/**
 * Deletes the cached session blobs of an account a console mutation is about to change, and refuses
 * the mutation outright if it cannot delete them all.
 *
 * **Always called before the mutation, never after.** `findSession` answers from the KV blob in
 * preference to D1 and hands back the user snapshot inside it - a snapshot that still says
 * `banned: false` - so a surviving blob is a live session for a banned, session-revoked or
 * password-reset account. Once the mutation has run, the D1 rows naming those tokens are gone
 * (`banUser` and `revokeUserSessions` both delete by predicate) and nothing anywhere records them
 * again: no retry, no later ban, no revoke-all can reach them, and `updateAge` keeps re-caching
 * each one. Purging first is what makes that state unreachable rather than merely unlikely.
 *
 * So the refusal is deliberate, and the alternative was considered and lost. Carrying on with the
 * mutation would ship a ban that is real in D1 and not real in KV, undetectable afterwards and
 * unbounded in time. Refusing leaves the account exactly as it was found - still live, but no more
 * live than a second ago - with every token still named in D1 and the operator holding an error
 * they can act on by pressing the button again.
 *
 * The index key is not touched here. It is deleted after the mutation by the paths that end an
 * account's sessions, because deleting it first would unreference blobs that are still live.
 */
export async function clearSessionCache(
  call: ConsoleCall,
  userId: string,
  action: string,
): Promise<SessionBlobPurge> {
  const purge = await purgeSessionBlobs(
    sessionKeyStore(),
    sessionPageReader(userId),
  )
  if (purge.failed === 0) {
    return purge
  }

  call.logger.error(
    'console could not clear the target session cache',
    undefined,
    {
      action,
      entityId: userId,
      actorUserId: call.actor.userId,
      actorRole: call.actor.role,
      enumerated: purge.enumerated,
      deleted: purge.deleted,
      failed: purge.failed,
    },
  )
  throw new ConsoleActionError(
    'sessions-still-cached',
    'The account’s cached sessions could not all be cleared, so this change would not have taken effect immediately. Nothing was changed - try again.',
  )
}

/**
 * The fields every post-mutation incident line carries, so the action, the actor and the entity are
 * always named — docs/ACCESS.md §4.3's requirement for the audit-append failure path, applied to the
 * two cache-keeping calls that sit on the same stretch of code.
 */
function incidentFields(
  call: ConsoleCall,
  userId: string,
  action: string,
): LogFields {
  return {
    action,
    entityId: userId,
    actorUserId: call.actor.userId,
    actorRole: call.actor.role,
  }
}

/**
 * Removes the per-user session index after a mutation has ended the account's sessions, and reports
 * a rejection instead of throwing it at work that has already committed.
 *
 * The counterpart to {@link clearSessionCache}, and the reason it is a second call rather than part
 * of the first: the blobs go before the mutation and the index goes after it. Deleting the index
 * first would leave live sessions unreferenced, and leaving it behind is what makes
 * `internalAdapter.listSessions` answer with sessions that are gone and `deleteUserSessions`
 * enumerate blobs that are not.
 *
 * **It cannot throw, and that is a correctness property rather than defensiveness** — see
 * {@link dropSessionSnapshots} for the whole of the argument. It runs after the plugin call has
 * committed and before `recordConsoleAction`, so a rejection escaping it would delete the audit row
 * of a mutation that really happened.
 *
 * A failure here cannot authenticate anybody — every blob the key names was deleted a moment ago —
 * so it is a `warn` and never a reason to fail the ban that has already landed.
 */
export async function endSessionIndex(
  call: ConsoleCall,
  userId: string,
  action: string,
): Promise<void> {
  try {
    if (await deleteSessionIndexKey(sessionKeyStore(), userId)) {
      return
    }
    call.logger.warn(
      'console left the session index key behind',
      incidentFields(call, userId, action),
    )
  } catch (cause) {
    call.logger.warn('console could not reach the session index key', {
      ...incidentFields(call, userId, action),
      ...serializeError(cause),
    })
  }
}

/**
 * Drops the cached `{ session, user }` snapshots of an account whose row has just changed, on the
 * paths where the sessions themselves survive: a role change, an address change, a profile edit.
 *
 * docs/ARCHITECTURE.md §2.2 makes this the mandatory shape of a mutation rather than a nicety:
 * "write D1 in the smallest possible transaction → invalidate the KV cache keys the write touched".
 * A blob is `{ session, user }` and `findSession` reads it in preference to D1, so an account whose
 * platform role has just been lowered keeps the old role - and `requirePermission` reads exactly
 * that field - until the blob expires. Dropping it costs the account's next request one D1 read
 * (`storeSessionInDatabase` is on, so `findSession` falls through and re-caches) and makes the
 * change take effect on that request instead of on the next sign-in.
 *
 * **After the mutation, not before, and that is the opposite of {@link clearSessionCache} on
 * purpose.** These endpoints route through `internalAdapter.updateUser`, which queues a
 * `refreshUserSessions` that rewrites every *indexed* blob with the new user object; purging first
 * would race that rewrite and purging afterwards composes with it, dropping whatever the stale index
 * caused it to miss. And unlike a ban, nothing here deletes the `session` rows, so the token names
 * stay readable in D1 for ever: a delete that fails is recoverable by any later call, which is why
 * this reports rather than refuses. Reversing a role change because a cache key survived would be
 * the worse of the two failures.
 *
 * **It never throws, and every failure mode is inside the `try` for that reason.** It sits between a
 * plugin call that has already committed and `recordConsoleAction`, so an escaping rejection would
 * not roll the role change back — it would only delete the row that records it, and
 * `platform.user.role_changed` is a deliberate human action docs/ACCESS.md §4.3 does not allow to go
 * unattributed. Reporting rather than refusing was already this function's stated contract; the
 * enumeration is the half that could still break it, because {@link purgeSessionBlobs} rejects when
 * a `session` page read fails and refuses outright past its runaway-loop guard. Both of those are
 * pre-mutation refusals on the paths that end sessions — {@link clearSessionCache} is where they are
 * allowed to stop a call — and post-mutation incidents here.
 */
export async function dropSessionSnapshots(
  call: ConsoleCall,
  userId: string,
  action: string,
): Promise<void> {
  const fields = incidentFields(call, userId, action)

  try {
    const purge = await purgeSessionBlobs(
      sessionKeyStore(),
      sessionPageReader(userId),
    )
    if (purge.failed === 0) {
      return
    }

    // `error` rather than `warn`: a surviving blob keeps answering with the account's *previous*
    // role and ban state, which is the same staleness a ban is measured on, for as long as the blob
    // lives.
    call.logger.error(
      'console left a stale session snapshot behind',
      undefined,
      {
        ...fields,
        enumerated: purge.enumerated,
        deleted: purge.deleted,
        failed: purge.failed,
      },
    )
  } catch (cause) {
    call.logger.error(
      'console could not clear the stale session snapshots',
      cause,
      fields,
    )
  }
}
