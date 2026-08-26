/**
 * Every platform action that touches an account, and the only route any of them has.
 *
 * docs/ACCESS.md §2.6 closes the fifteen `/api/auth/admin/*` paths with `disabledPaths`, so the
 * plugin's own HTTP surface answers `404` to a browser and `auth.api.<endpoint>` stays fully usable
 * in process. Every function below therefore reads the same way and in the same order: validate the
 * input with Zod, `openConsoleCall` (which is `requirePermission` and the §6.4 impersonation veto),
 * read the target's before-state, deal with the KV session cache, call the plugin in process, then
 * `recordConsoleAction` — one structured log line and one `platform_audit_log` row per action.
 *
 * Five things this file does that the plugin does not, each because leaving it to the plugin was
 * measured or read to be wrong rather than assumed to be:
 *
 * - **The paths that end an account's sessions delete its KV blobs first, walking D1 to
 *   exhaustion.** `auth.api.banUser` calls `deleteUserSessions`, which walks the eventually-
 *   consistent `active-sessions-<userId>` index and deletes nothing when that key is missing — while
 *   `findSession` keeps resolving each surviving blob and answering with the `banned: false` user
 *   snapshot inside it. It also deletes every D1 `session` row by predicate, which is why the purge
 *   goes first and why it is refused rather than truncated: after the plugin has run, a blob this
 *   call did not delete is one nothing anywhere can name again. See `./session-keys` and
 *   `clearSessionCache` for the whole of that argument and the bound on "immediate".
 * - **No ban ever travels through `/admin/update-user`.** That endpoint accepts `banned` in its
 *   free-form `data` record, and a ban taken that way lands on `src/server/auth/index.ts`'s
 *   auto-unban tripwire, which records it as `actor_kind: 'system'` with a null actor: a deliberate
 *   human action with no operator on the row. The two `data` payloads this file builds are Zod
 *   objects with closed key sets — `{ name }` and `{ email, emailVerified }` — so the column is not
 *   reachable from the console at all, and the ban verbs are the only path to it.
 * - **A permanent ban clears a stale expiry, and restores the ban the account actually held if the
 *   second step fails.** `banUser` cannot write `banExpires: null` and `unbanUser` is the only
 *   endpoint that can, so the transition is two calls; {@link applyBan} carries the compensation
 *   that keeps a failure from leaving the account *un*banned - and keys it on `banned` and on
 *   remaining time, so a leftover expiry over an unbanned or already-lapsed account is never put
 *   back as a ban that was never imposed. One audit row on the way through: the clearing write is
 *   machinery, not an event.
 * - **Setting a password ends the account's sessions, and each step carries its own row before the
 *   next one runs.** `/admin/set-user-password` touches no session, and the operator use case for
 *   the verb is a compromised account - so the revocation belongs to the verb rather than beside it.
 *   On another account the revocation goes first; on the operator's own it cannot, because
 *   `adminMiddleware` re-resolves the caller and the credential write behind a self-revocation
 *   answers `UNAUTHORIZED`. Either way nothing that can reject stands between a committed credential
 *   change and its ledger row. See {@link setPlatformUserPasswordFn}.
 * - **Three of these may not be aimed at the operator's own account.** A self-ban, a self-delete and
 *   a self-demotion all remove the operator's own way back in, and the last of them can leave a
 *   platform with no `admin` at all - there is no seat reservation in the model and no recovery path
 *   in the product. All three are refused before the target is read. Setting a password and revoking
 *   every session are deliberately *not* among them: both are legitimate aimed at oneself - an
 *   operator who has left a session on a machine they no longer control wants exactly this - and
 *   neither removes a way back in.
 *
 * Reads are not audited, here or over MCP (docs/ACCESS.md §4.2). `platform.user.get` does not exist,
 * and neither does a log field shaped like one — see `ConsoleRead` in `./context`.
 *
 * **What is deliberately not here: the MCP credential half of a role change.** docs/ACCESS.md §5
 * requires a role change to revoke the account's `staff_api_tokens` rows in the same call, audited
 * as `platform.token.revoked`. That statement cannot be written from `src/server/fns` - SPEC §6 puts
 * all SQL in `server/repos` and names `server/catalog` as its single exception, and a second
 * exception is a change to that contract rather than a file placement. It also has nothing to revoke
 * in this phase: Faza B ships the `staff_api_tokens` *table* and no issuance surface at all, so the
 * table is empty by construction and the revocation is unreachable code guarding a state that cannot
 * exist yet. Issuance, its console surface and the revocation that belongs with them are one concept
 * (SPEC §8) and land together in Faza E, against `src/server/catalog/repo.ts`. Reported with this
 * item rather than half-built here.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '#/server/auth'
import { PLATFORM_ROLES_BY_PRECEDENCE } from '#/server/auth/access'
import { PLATFORM_ACTIONS } from '#/server/catalog/audit'
import { platformApi } from './bindings'
import {
  clearSessionCache,
  dropSessionSnapshots,
  endSessionIndex,
  openConsoleCall,
  recordConsoleAction,
  recordConsoleRead,
} from './context'
import {
  auditUserState,
  platformUserSchema,
  toConsoleUser,
} from './projections'
import { readTargetUser, refuseSelfTarget } from './target'

import type { ConsoleCall } from './context'
import type { ConsoleUser, PlatformUserRow } from './projections'

/* ------------------------------------------------------------------ inputs */

const userId = z.string().trim().min(1).max(64)
const platformRole = z.enum(PLATFORM_ROLES_BY_PRECEDENCE)

/**
 * The product's password policy, read from where it is declared rather than restated.
 *
 * `MIN_PASSWORD_LENGTH` and `MAX_PASSWORD_LENGTH` are the two constants `src/server/auth/index.ts`
 * hands Better Auth as `emailAndPassword.minPasswordLength` and `maxPasswordLength`. They are
 * imported rather than repeated, so this is a second *call site* and never a second policy: change
 * the numbers there and this boundary moves with them. (`src/routes/(auth)/-lib/schemas.ts` holds a
 * hand-kept copy of the same pair for the register and reset screens, marked "keep in step with"
 * — a duplication that predates this directory and is reported with this item rather than edited
 * from here.)
 *
 * It has to be enforced here because the plugin does not enforce it uniformly.
 * `/admin/set-user-password` re-reads `ctx.context.password.config` and refuses a short password
 * itself; `/admin/create-user` does **not** — it calls `password.hash(ctx.body.password)` and never
 * looks at the configuration at all (`better-auth@1.7.1`,
 * `dist/plugins/admin/routes.mjs`). So an operator minting an account is the one path in the product
 * on which nothing below this line would stop a one-character credential, and
 * `__tests__/console.test.ts` measures that against the real endpoint rather than asserting it.
 * Both fields carry it, because a boundary that is right for one reason and absent for another is a
 * boundary somebody removes on the next refactor.
 */
const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(MAX_PASSWORD_LENGTH, `Keep it under ${MAX_PASSWORD_LENGTH} characters.`)

/**
 * The columns `list-users` may sort by, as a closed list.
 *
 * `auth.api.listUsers` wraps its whole body in `try { … } catch { return { users: [], total: 0 } }`,
 * so a field name the adapter cannot resolve renders as an empty table rather than as an error —
 * indistinguishable from a product with no users. The wire never names a column; it names one of
 * these four.
 */
const USER_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'email'] as const

export const listPlatformUsersInputSchema = z
  .object({
    search: z.string().trim().max(120).optional(),
    searchField: z.enum(['email', 'name']).default('email'),
    /** Filter to accounts holding a staff role. `user` is not offered — see the note below. */
    role: z.enum(['admin', 'curator']).optional(),
    banned: z.boolean().optional(),
    sortBy: z.enum(USER_SORT_FIELDS).default('createdAt'),
    sortDirection: z.enum(['asc', 'desc']).default('desc'),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).max(100_000).default(0),
  })
  /**
   * `list-users` builds at most one filter clause beside the search clause, so asking for both a
   * role and a ban state would silently drop one of them. Refused at the boundary instead.
   *
   * `role: 'user'` is absent for a related reason: a plain account's column is `NULL`, and "null or
   * a value that is not one of these two" is not expressible as the single `eq`-shaped filter the
   * endpoint accepts. A console that needs that view filters the page it already has.
   */
  .refine(
    (input) => input.role === undefined || input.banned === undefined,
    'filter by role or by ban state, not both',
  )

export const getPlatformUserInputSchema = z.object({ userId })

export const createPlatformUserInputSchema = z.object({
  email: z.email().trim().max(320),
  name: z.string().trim().min(1).max(120),
  password,
  role: platformRole.default('user'),
})

export const updatePlatformUserInputSchema = z.object({
  userId,
  name: z.string().trim().min(1).max(120),
})

export const setPlatformUserEmailInputSchema = z.object({
  userId,
  email: z.email().trim().max(320),
})

export const setPlatformUserRoleInputSchema = z.object({
  userId,
  role: platformRole,
})

export const setPlatformUserPasswordInputSchema = z.object({
  userId,
  newPassword: password,
})

export const deletePlatformUserInputSchema = z.object({ userId })

/** Ninety days is the longest temporary ban the console offers; beyond that, ban permanently. */
const MAX_BAN_DAYS = 90

export const banPlatformUserInputSchema = z.object({
  userId,
  reason: z.string().trim().min(1).max(280),
  /** Absent means permanent. */
  expiresInDays: z.number().int().min(1).max(MAX_BAN_DAYS).optional(),
})

export const unbanPlatformUserInputSchema = z.object({ userId })

/* ------------------------------------------------------------------ shared */

const SECONDS_PER_DAY = 86_400

/* ------------------------------------------------------------------- reads */

/**
 * One page of accounts. `total` is the count under the same filters, for the pagination control.
 *
 * Not audited: reads never are (docs/ACCESS.md §4.2).
 */
export const listPlatformUsersFn = createServerFn({ method: 'GET' })
  .validator(listPlatformUsersInputSchema)
  .handler(
    async ({
      data,
    }): Promise<{
      users: ReadonlyArray<ConsoleUser>
      total: number
      limit: number
      offset: number
    }> => {
      const call = await openConsoleCall({ user: ['list'] })

      const filter =
        data.role !== undefined
          ? // `contains`, not `eq`: `user.role` is a comma-joined string for a multi-role account
            // and Better Auth splits it the same way, so an exact match would miss `curator,user`.
            {
              filterField: 'role',
              filterOperator: 'contains' as const,
              filterValue: data.role,
            }
          : data.banned !== undefined
            ? {
                filterField: 'banned',
                filterOperator: 'eq' as const,
                filterValue: data.banned,
              }
            : {}

      const result = await platformApi().listUsers({
        query: {
          ...(data.search
            ? {
                searchValue: data.search,
                searchField: data.searchField,
                searchOperator: 'contains' as const,
              }
            : {}),
          ...filter,
          sortBy: data.sortBy,
          sortDirection: data.sortDirection,
          limit: data.limit,
          offset: data.offset,
        },
        headers: call.headers,
      })

      const rows = z.array(platformUserSchema).parse(result.users)
      recordConsoleRead(call, 'users', {
        returned: rows.length,
        total: result.total,
      })

      return {
        users: rows.map(toConsoleUser),
        total: result.total,
        limit: data.limit,
        offset: data.offset,
      }
    },
  )

/** One account. Not audited, and logged like every other function here. */
export const getPlatformUserFn = createServerFn({ method: 'GET' })
  .validator(getPlatformUserInputSchema)
  .handler(async ({ data }): Promise<ConsoleUser> => {
    const call = await openConsoleCall({ user: ['get'] })
    const row = await readTargetUser(call, data.userId)

    recordConsoleRead(call, 'user', { entityId: row.id })

    return toConsoleUser(row)
  })

/* --------------------------------------------------------------- mutations */

/** Creates an account with a platform role. `platform.user.created`. */
export const createPlatformUserFn = createServerFn({ method: 'POST' })
  .validator(createPlatformUserInputSchema)
  .handler(async ({ data }): Promise<ConsoleUser> => {
    const call = await openConsoleCall({ user: ['create', 'set-role'] })

    const created = await platformApi().createUser({
      body: {
        email: data.email,
        name: data.name,
        password: data.password,
        role: data.role,
      },
      headers: call.headers,
    })
    const row = platformUserSchema.parse(created.user)

    await recordConsoleAction(call, {
      action: PLATFORM_ACTIONS.USER_CREATED,
      entityId: row.id,
      // `before` is null because the account did not exist. The password is not in `after` and
      // never can be: `auditUserState` has no key for it.
      changes: { before: null, after: auditUserState(row) },
    })

    return toConsoleUser(row)
  })

/** Changes an account's display name. `platform.user.updated`. */
export const updatePlatformUserFn = createServerFn({ method: 'POST' })
  .validator(updatePlatformUserInputSchema)
  .handler(async ({ data }): Promise<ConsoleUser> => {
    const call = await openConsoleCall({ user: ['update'] })
    const before = await readTargetUser(call, data.userId)

    const updated = await platformApi().adminUpdateUser({
      body: { userId: data.userId, data: { name: data.name } },
      headers: call.headers,
    })
    const row = platformUserSchema.parse(updated)

    await dropSessionSnapshots(call, data.userId, PLATFORM_ACTIONS.USER_UPDATED)
    await recordConsoleAction(call, {
      action: PLATFORM_ACTIONS.USER_UPDATED,
      entityId: row.id,
      changes: { before: auditUserState(before), after: auditUserState(row) },
    })

    return toConsoleUser(row)
  })

/**
 * Changes an account's address. `platform.user.email_set`.
 *
 * The new address lands unverified. An operator typing an address has not proved the account can
 * receive mail there, and `emailVerified` is what the product's own recovery and notification paths
 * read; carrying the old flag across would assert something nobody checked.
 */
export const setPlatformUserEmailFn = createServerFn({ method: 'POST' })
  .validator(setPlatformUserEmailInputSchema)
  .handler(async ({ data }): Promise<ConsoleUser> => {
    const call = await openConsoleCall({ user: ['set-email'] })
    const before = await readTargetUser(call, data.userId)

    const updated = await platformApi().adminUpdateUser({
      body: {
        userId: data.userId,
        data: { email: data.email, emailVerified: false },
      },
      headers: call.headers,
    })
    const row = platformUserSchema.parse(updated)

    await dropSessionSnapshots(
      call,
      data.userId,
      PLATFORM_ACTIONS.USER_EMAIL_SET,
    )
    await recordConsoleAction(call, {
      action: PLATFORM_ACTIONS.USER_EMAIL_SET,
      entityId: row.id,
      changes: { before: auditUserState(before), after: auditUserState(row) },
    })

    return toConsoleUser(row)
  })

/**
 * Sets an account's platform role, and takes the MCP credentials that role justified with it.
 * `platform.user.role_changed`, plus one `platform.token.revoked` per credential revoked.
 *
 * **The operator's own account is refused.** An `admin` demoting itself is one call away from a
 * platform whose console nobody can open: the model reserves no seat, the product ships no recovery
 * path, and the row this function is about to write would be the last one anybody could write.
 * Better Auth permits it, which is precisely why the refusal is here.
 *
 * `user:set-role` is the whole of what this call needs. docs/ACCESS.md §5 also has a role change
 * revoke the account's MCP credentials, which would add `session:revoke` - see this file's header
 * for why that half is Faza E's rather than absent by oversight.
 */
export const setPlatformUserRoleFn = createServerFn({ method: 'POST' })
  .validator(setPlatformUserRoleInputSchema)
  .handler(async ({ data }): Promise<ConsoleUser> => {
    const call = await openConsoleCall({ user: ['set-role'] })
    refuseSelfTarget(
      call,
      data.userId,
      'You cannot change your own platform role. Ask another admin to do it.',
    )
    const before = await readTargetUser(call, data.userId)

    const result = await platformApi().setRole({
      body: { userId: data.userId, role: data.role },
      headers: call.headers,
    })
    const row = platformUserSchema.parse(result.user)

    await dropSessionSnapshots(
      call,
      data.userId,
      PLATFORM_ACTIONS.USER_ROLE_CHANGED,
    )
    await recordConsoleAction(call, {
      action: PLATFORM_ACTIONS.USER_ROLE_CHANGED,
      entityId: row.id,
      changes: { before: auditUserState(before), after: auditUserState(row) },
    })

    return toConsoleUser(row)
  })

/**
 * Ends every session an account holds **and then** sets its password.
 * `platform.session.revoked_all`, then `platform.user.password_set`.
 *
 * **The revocation is the point of the verb, not a courtesy beside it.** The operator use case is a
 * compromised account, and `/admin/set-user-password` touches no session at all: it routes to
 * `internalAdapter.updatePassword` and returns (`better-auth@1.7.1`, `dist/plugins/admin/routes.mjs`).
 * `revokeSessionsOnPasswordReset`, which this product does set, is read in exactly three places -
 * the self-service reset route and the phone-number and email-OTP plugins - and none of them is this
 * endpoint. So a version of this function that only changed the credential left the attacker signed
 * in on the old one, which is the opposite of what an operator pressing it believes they are doing.
 *
 * **Nothing that can reject ever stands between the credential write and its ledger row, and that
 * invariant - not a fixed order of the two steps - is the design of this handler.** An earlier
 * version set the password and then revoked, which put an unguarded `revokeUserSessions` between a
 * committed credential change and its row: one ordinary D1 transient there and the password *had*
 * changed, no `platform.user.password_set` row existed for it, the target's sessions were still live
 * on the old credential, and the operator was told the call had failed - the single state in this
 * directory that is both irreversible and invisible afterwards. Each step now carries its own audit
 * append as its last statement, and neither `recordConsoleAction` nor `appendPlatformAudit` beneath
 * it throws: an append that cannot be written is reported as an `error` line naming the action, the
 * actor and the entity, never as a rejected promise. So whichever step runs first, the one that
 * commits is recorded before anything that can fail runs again.
 *
 * **On another account the revocation goes first**, because then every step that can reject happens
 * while the account still holds the credential it arrived with: a failure anywhere leaves a
 * retryable state and an honest error, and at worst the account has been signed out of everything -
 * the direction remediation was going anyway, carrying its own row.
 *
 * **On the operator's own account the order is reversed, and it has to be.**
 * `/admin/set-user-password` runs behind the plugin's `adminMiddleware`, which re-resolves the
 * caller from `headers` on entry (`getAuthoritativeSessionFromCtx`) - so once the revocation has
 * deleted the caller's own D1 `session` row, the credential write behind it answers `UNAUTHORIZED`:
 * signed out of every device, told the call failed, password unchanged. Revoke-first is not a
 * stricter version of this verb aimed at oneself, it is a version that cannot work. Writing the
 * credential first costs nothing the invariant above protects - the row is appended before the
 * revocation begins - and it is what makes the affordance real: an operator who has left a session
 * on a machine they no longer control presses this to change the credential *and* end that session,
 * and `src/routes/_app/console/-ui/user-actions.tsx` offers it on their own row deliberately, in
 * copy written in the first person. A failed revocation there leaves the new password in force,
 * audited, with the sessions still live and an error the operator can act on by pressing *Revoke
 * every session*. Unlike a self-ban or a self-demotion, this verb removes no way back in.
 *
 * What neither order covers, stated rather than left to be discovered: a sign-in *with the old
 * credential* landing in the few milliseconds between the two steps creates a session this call has
 * already passed. That is a race an attacker must already hold the password to run, it is bounded by
 * one request, and the account's next remediation reaches it - against a failure mode that was
 * unbounded in time and undetectable in the ledger. Re-sweeping afterwards would only put an
 * unguarded plugin call back in front of an append.
 *
 * Two statements and two rows, because two things happened. §4.2 gives "every session of one account
 * is revoked" its own action under `session:revoke`, and folding it into the password row would hide
 * a session revocation from the timeline query in §4.4 that reads by `entity_type = 'session'`.
 *
 * `changes` records that a password was set and never what it was set to: both sides carry
 * `auditUserState`, which has no password key, and the value never leaves the argument it arrived
 * in. A log that keeps rows for 400 days is the last place a credential belongs.
 */
export const setPlatformUserPasswordFn = createServerFn({ method: 'POST' })
  .validator(setPlatformUserPasswordInputSchema)
  .handler(async ({ data }): Promise<{ userId: string; revoked: number }> => {
    const call = await openConsoleCall({
      user: ['set-password'],
      session: ['revoke'],
    })
    const before = await readTargetUser(call, data.userId)

    /** Ends every session the account holds, and writes the row that says so. */
    const revokeEverySession = async (): Promise<number> => {
      // Before the plugin call, so a purge that cannot finish leaves the account exactly as it was
      // found rather than half-remediated. See `clearSessionCache`.
      const purge = await clearSessionCache(
        call,
        before.id,
        PLATFORM_ACTIONS.USER_PASSWORD_SET,
      )

      await platformApi().revokeUserSessions({
        body: { userId: before.id },
        headers: call.headers,
      })
      await endSessionIndex(call, before.id, PLATFORM_ACTIONS.USER_PASSWORD_SET)
      await recordConsoleAction(call, {
        action: PLATFORM_ACTIONS.SESSION_REVOKED_ALL,
        // `entity_type` is `session` under this prefix and no single session was touched, so no
        // session id is claimed. The account and the count live in `changes`.
        entityId: null,
        changes: {
          before: { userId: before.id, sessions: purge.enumerated },
          after: { userId: before.id, sessions: 0 },
        },
      })

      return purge.enumerated
    }

    /** Writes the credential, and the row that records it as its next statement. */
    const setCredential = async (): Promise<void> => {
      await platformApi().setUserPassword({
        body: { userId: before.id, newPassword: data.newPassword },
        headers: call.headers,
      })
      await recordConsoleAction(call, {
        action: PLATFORM_ACTIONS.USER_PASSWORD_SET,
        entityId: before.id,
        changes: {
          before: auditUserState(before),
          after: auditUserState(before),
        },
      })
    }

    // Aimed at the operator's own account the credential goes first, because the revocation deletes
    // the caller's own session and `adminMiddleware` re-resolves it: revoke-first answers
    // `UNAUTHORIZED` and changes nothing. Aimed at anyone else the revocation goes first, so every
    // step that can reject runs while the account still holds the credential it arrived with.
    if (call.actor.userId === before.id) {
      await setCredential()
      return { userId: before.id, revoked: await revokeEverySession() }
    }

    const revoked = await revokeEverySession()
    await setCredential()

    return { userId: before.id, revoked }
  })

/**
 * Deletes an account and everything Better Auth hangs off it. `platform.user.deleted`.
 *
 * The before-state is read first because after the delete there is nothing left to describe, and a
 * `platform.user.deleted` row whose `changes` says nothing about who was deleted is a row that
 * answers no question thirteen months later.
 */
export const deletePlatformUserFn = createServerFn({ method: 'POST' })
  .validator(deletePlatformUserInputSchema)
  .handler(async ({ data }): Promise<{ userId: string }> => {
    const call = await openConsoleCall({ user: ['delete'] })
    refuseSelfTarget(
      call,
      data.userId,
      'You cannot delete your own account from the console.',
    )
    const before = await readTargetUser(call, data.userId)

    // Before `removeUser`, which deletes the `session` rows the token names live in. Afterwards
    // there is nothing left to read them from, and a blob nobody can name keeps resolving through
    // `findSession` for a deleted account.
    const purge = await clearSessionCache(
      call,
      data.userId,
      PLATFORM_ACTIONS.USER_DELETED,
    )

    await platformApi().removeUser({
      body: { userId: data.userId },
      headers: call.headers,
    })
    await endSessionIndex(call, data.userId, PLATFORM_ACTIONS.USER_DELETED)

    await recordConsoleAction(call, {
      action: PLATFORM_ACTIONS.USER_DELETED,
      entityId: before.id,
      changes: { before: auditUserState(before), after: null },
    })
    call.logger.info('console purged session keys', {
      action: PLATFORM_ACTIONS.USER_DELETED,
      entityId: before.id,
      enumerated: purge.enumerated,
      deleted: purge.deleted,
    })

    return { userId: before.id }
  })

/**
 * Applies the ban itself, in whichever of the two shapes the target's current state needs.
 *
 * Permanent is the awkward one, and it is awkward because of the dependency rather than by choice.
 * `banUser` builds `banExpires: ctx.body.banExpiresIn ? getDate(…) : opts?.defaultBanExpiresIn ?
 * getDate(…) : void 0` and the adapter factory drops `undefined` on an update, so a permanent ban
 * over a leftover expiry leaves the old `ban_expires` in place and the plugin auto-unbans the
 * account at its next sign-in. `unbanUser` is the only endpoint in the plugin that writes `null`
 * there. There is no single-step form: `banExpiresIn: 0` is falsy and takes the same branch, and a
 * hundred-year expiry would put a date in a column the console and the ledger both read as "this
 * ban ends".
 *
 * So the transition is two steps, and the failure path restores what it found. If the clearing
 * `unbanUser` succeeds and the `banUser` behind it rejects — a D1 transient, or `NOT_FOUND` if the
 * row moved — the account would otherwise be left silently *un*banned while the operator reads an
 * error: the weaker state, arrived at by a call that was asking for a stronger one. The compensation
 * re-applies the ban the target held a moment ago, reason and remaining time and all, before the
 * original failure is re-thrown. A compensation that itself fails is raised at `error` naming the
 * account, because at that point only a human can put it right.
 *
 * **What the compensation restores is the ban the account *held*, which is not the same question as
 * whether the column held a date.** Two states reach the clearing write with a `ban_expires` that
 * describes no live ban, and restoring from the column alone would invent one in both:
 *
 * - `banned: false` with a leftover expiry. The plugin's own verbs cannot produce it — `unbanUser`
 *   nulls all three columns together — but `/admin/update-user` writes the record free-form, an
 *   operator can reach the column through a `wrangler d1 execute`, and a partial write leaves it. An
 *   account that was not banned would come out of a *failed* ban banned, which is the one outcome
 *   worse than the state this compensation exists to prevent.
 * - An expiry already in the past. `banExpires < now` is a ban the plugin lifts at the account's
 *   next sign-in (`databaseHooks.session.create.before`), so the account's effective state is
 *   already "not banned" and the remaining time is negative. Clamping that to a second, as an
 *   earlier version did, restored a one-second ban nobody ever imposed.
 *
 * In both the clearing write has left exactly the state the account was effectively in, so there is
 * nothing to put back and the compensation does not run.
 *
 * **The unban is audited on every branch that leaves it standing**, which is what `banned` decides
 * and the expiry does not. A compensation that succeeds leaves the account banned as it was found
 * and writes nothing, because nothing moved. Every other path out of the clearing write leaves the
 * ban columns cleared by a deliberate human call — a compensation that failed, or one that was
 * never owed — and docs/ACCESS.md §4.3 audits an unban without exception. The two
 * `/admin/ban-user` and `/admin/unban-user` paths sit in `SELF_AUDITING_BAN_PATHS`
 * (`src/server/auth/index.ts`) precisely because this directory promises to append the human row, so
 * the tripwire writes nothing here and this is the only place that row can come from. `unbanUser`
 * writes exactly `{ banned: false, banReason: null, banExpires: null }`
 * (`better-auth@1.7.1`, `dist/plugins/admin/routes.mjs`), so the `after` payload states what landed
 * rather than guessing at it — and where `before` already said `banned: false`, the row is honest
 * about that too: the pair of payloads is what tells the reader a stale expiry was cleared rather
 * than a ban lifted.
 */
async function applyBan(
  call: ConsoleCall,
  targetId: string,
  reason: string,
  expiresInDays: number | undefined,
  before: PlatformUserRow,
): Promise<PlatformUserRow> {
  const ban = async (
    banReason: string,
    seconds: number | undefined,
  ): Promise<PlatformUserRow> => {
    const result = await platformApi().banUser({
      body: {
        userId: targetId,
        banReason,
        ...(seconds === undefined ? {} : { banExpiresIn: seconds }),
      },
      headers: call.headers,
    })
    return platformUserSchema.parse(result.user)
  }

  /** Puts the cleared ban back, or reports that only a human can now. */
  const restore = async (seconds: number): Promise<boolean> => {
    try {
      await ban(before.banReason ?? reason, seconds)
      return true
    } catch (restoreFailure) {
      call.logger.error(
        'console could not restore the ban it cleared',
        restoreFailure,
        {
          action: PLATFORM_ACTIONS.USER_BANNED,
          entityId: targetId,
          actorUserId: call.actor.userId,
          actorRole: call.actor.role,
        },
      )
      return false
    }
  }

  const seconds =
    expiresInDays === undefined ? undefined : expiresInDays * SECONDS_PER_DAY
  const staleExpiry = before.banExpires

  if (seconds !== undefined || !staleExpiry) {
    return ban(reason, seconds)
  }

  await platformApi().unbanUser({
    body: { userId: targetId },
    headers: call.headers,
  })

  try {
    return await ban(reason, undefined)
  } catch (cause) {
    // What the account actually held, rather than what the column said. `banned: false` means the
    // clearing write took nothing away, and an expiry already past means the plugin would have
    // lifted the ban at the next sign-in anyway — in both, the state now standing *is* the state
    // this call found, and there is nothing to compensate for.
    const remainingMs = before.banned ? staleExpiry.getTime() - Date.now() : 0
    if (remainingMs > 0 && (await restore(Math.ceil(remainingMs / 1000)))) {
      throw cause
    }

    await recordConsoleAction(call, {
      action: PLATFORM_ACTIONS.USER_UNBANNED,
      entityId: targetId,
      changes: {
        before: auditUserState(before),
        after: {
          ...auditUserState(before),
          banned: false,
          banReason: null,
          banExpiresAt: null,
        },
      },
    })
    throw cause
  }
}

/**
 * Bans an account and takes its live sessions with it. `platform.user.banned`.
 *
 * **The order is the mechanism.** Every cached session blob is deleted *before* `banUser` runs,
 * because `banUser` deletes the `session` rows by predicate and the per-user KV index goes with
 * them — so a blob this function has not deleted by then is a blob nothing anywhere can name again,
 * resolving through `findSession` with a `banned: false` snapshot inside it and re-cached by
 * `updateAge` on every request. That is not a bounded leak, it is a permanent one, and it cannot be
 * noticed afterwards except by a session that should not exist continuing to work. The purge
 * therefore walks D1 to exhaustion and the ban is refused outright if it could not finish, which
 * leaves the account exactly as it was found with every token still named in D1.
 *
 * Purging first is safe against the plugin's own writes, which was the objection an earlier version
 * of this comment raised: `updateUser` queues `refreshUserSessions`, and that function does
 * `const cached = await secondaryStorage.get(token); if (!cached) return;` — it skips a token whose
 * blob is already gone and never recreates one (`better-auth@1.7.1`, `dist/db/internal-adapter.mjs`).
 * The one thing it can rewrite is a blob created *between* the purge and the ban by a sign-in that
 * beat the ban by milliseconds, and that session is necessarily in the index it just wrote, so
 * `deleteUserSessions` reaches it. The two halves cover each other's case.
 */
export const banPlatformUserFn = createServerFn({ method: 'POST' })
  .validator(banPlatformUserInputSchema)
  .handler(async ({ data }): Promise<ConsoleUser> => {
    const call = await openConsoleCall({ user: ['ban'] })
    refuseSelfTarget(call, data.userId, 'You cannot ban your own account.')
    const before = await readTargetUser(call, data.userId)

    const purge = await clearSessionCache(
      call,
      data.userId,
      PLATFORM_ACTIONS.USER_BANNED,
    )

    const row = await applyBan(
      call,
      data.userId,
      data.reason,
      data.expiresInDays,
      before,
    )

    await endSessionIndex(call, data.userId, PLATFORM_ACTIONS.USER_BANNED)

    await recordConsoleAction(call, {
      action: PLATFORM_ACTIONS.USER_BANNED,
      entityId: row.id,
      changes: { before: auditUserState(before), after: auditUserState(row) },
    })

    call.logger.info('console purged session keys', {
      action: PLATFORM_ACTIONS.USER_BANNED,
      entityId: row.id,
      enumerated: purge.enumerated,
      deleted: purge.deleted,
    })

    return toConsoleUser(row)
  })

/** Lifts a ban. `platform.user.unbanned`. The account signs in again; no session is restored. */
export const unbanPlatformUserFn = createServerFn({ method: 'POST' })
  .validator(unbanPlatformUserInputSchema)
  .handler(async ({ data }): Promise<ConsoleUser> => {
    const call = await openConsoleCall({ user: ['ban'] })
    const before = await readTargetUser(call, data.userId)

    const result = await platformApi().unbanUser({
      body: { userId: data.userId },
      headers: call.headers,
    })
    const row = platformUserSchema.parse(result.user)

    await recordConsoleAction(call, {
      action: PLATFORM_ACTIONS.USER_UNBANNED,
      entityId: row.id,
      changes: { before: auditUserState(before), after: auditUserState(row) },
    })

    return toConsoleUser(row)
  })
