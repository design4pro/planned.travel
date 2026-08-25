/**
 * Every platform action that touches an account, and the only route any of them has.
 *
 * docs/ACCESS.md §2.6 closes the fifteen `/api/auth/admin/*` paths with `disabledPaths`, so the
 * plugin's own HTTP surface answers `404` to a browser and `auth.api.<endpoint>` stays fully usable
 * in process. Every function below therefore reads the same way and in the same order: validate the
 * input with Zod, `openConsoleCall` (which is `requirePermission` and the §6.4 impersonation veto),
 * read the target's before-state, call the plugin in process, invalidate the KV session snapshots
 * the write touched, then `recordConsoleAction` — one structured log line and exactly one
 * `platform_audit_log` row.
 *
 * Four things this file does that the plugin does not, each because leaving it to the plugin was
 * measured or read to be wrong rather than assumed to be:
 *
 * - **A ban deletes the target's KV session blobs, enumerated from D1.** `auth.api.banUser` calls
 *   `deleteUserSessions`, which walks the eventually-consistent `active-sessions-<userId>` index and
 *   deletes nothing when that key is missing — while `findSession` keeps resolving each surviving
 *   blob and answering with the `banned: false` user snapshot inside it. See `./session-keys` for
 *   the whole of that argument and the bound on "immediate".
 * - **No ban ever travels through `/admin/update-user`.** That endpoint accepts `banned` in its
 *   free-form `data` record, and a ban taken that way lands on `src/server/auth/index.ts`'s
 *   auto-unban tripwire, which records it as `actor_kind: 'system'` with a null actor: a deliberate
 *   human action with no operator on the row. The two `data` payloads this file builds are Zod
 *   objects with closed key sets — `{ name }` and `{ email, emailVerified }` — so the column is not
 *   reachable from the console at all, and the ban verbs are the only path to it.
 * - **A permanent ban clears a stale expiry first.** `banUser` builds `banExpires: undefined` when
 *   no `banExpiresIn` is given, and the adapter factory skips `undefined` on an update — so
 *   re-banning permanently over an expired temporary ban leaves the old `ban_expires` in place and
 *   the plugin auto-unbans on the next sign-in. `unbanUser` is the only endpoint that writes `null`
 *   there, so a permanent ban over an existing expiry runs it first. One audit row either way: the
 *   clearing write is machinery, not an event.
 * - **No account may aim one of these at itself.** A self-ban, a self-delete and a self-demotion all
 *   remove the operator's own way back in, and the last of them can leave a platform with no `admin`
 *   at all - there is no seat reservation in the model and no recovery path in the product. All
 *   three are refused before the target is read.
 *
 * Reads are not audited, here or over MCP (docs/ACCESS.md §4.2). `platform.user.get` does not exist.
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
import { platformApi, sessionKeyStore } from './bindings'
import {
  openConsoleCall,
  readSessionTokens,
  recordConsoleAction,
} from './context'
import {
  auditUserState,
  platformUserSchema,
  toConsoleUser,
} from './projections'
import { invalidateSessionSnapshots, purgeSessionKeys } from './session-keys'
import { readTargetUser, refuseSelfTarget } from './target'

import type { ConsoleCall } from './context'
import type { ConsoleUser } from './projections'

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

/**
 * Drops the cached session blobs of an account whose row has just changed
 * (docs/ARCHITECTURE.md §2.2: invalidate the KV keys the write touched, in the same request).
 *
 * The sessions stay live; what goes is the stale `{ session, user }` snapshot `findSession` would
 * otherwise answer with, so the change takes effect on the account's next request rather than on
 * its next sign-in.
 */
async function invalidateSnapshots(
  call: ConsoleCall,
  id: string,
  action: string,
): Promise<void> {
  const enumerated = await readSessionTokens(id)
  const purge = await invalidateSessionSnapshots(sessionKeyStore(), enumerated)
  if (purge.failed > 0 || purge.truncated) {
    call.logger.warn('console session snapshot invalidation incomplete', {
      action,
      entityId: id,
      ...purge,
    })
  }
}

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
      call.logger.info('console platform read', {
        action: 'platform.user.list',
        actorUserId: call.actor.userId,
        actorRole: call.actor.role,
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

    call.logger.info('console platform read', {
      action: 'platform.user.get',
      actorUserId: call.actor.userId,
      actorRole: call.actor.role,
      entityId: row.id,
    })

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

    await invalidateSnapshots(call, data.userId, PLATFORM_ACTIONS.USER_UPDATED)
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

    await invalidateSnapshots(
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

    await invalidateSnapshots(
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
 * Sets an account's password. `platform.user.password_set`.
 *
 * `changes` records that a password was set and never what it was set to: both sides carry
 * `auditUserState`, which has no password key, and the value never leaves the argument it arrived
 * in. A log that keeps rows for 400 days is the last place a credential belongs.
 */
export const setPlatformUserPasswordFn = createServerFn({ method: 'POST' })
  .validator(setPlatformUserPasswordInputSchema)
  .handler(async ({ data }): Promise<{ userId: string }> => {
    const call = await openConsoleCall({ user: ['set-password'] })
    const before = await readTargetUser(call, data.userId)

    await platformApi().setUserPassword({
      body: { userId: data.userId, newPassword: data.newPassword },
      headers: call.headers,
    })

    await invalidateSnapshots(
      call,
      data.userId,
      PLATFORM_ACTIONS.USER_PASSWORD_SET,
    )
    await recordConsoleAction(call, {
      action: PLATFORM_ACTIONS.USER_PASSWORD_SET,
      entityId: before.id,
      changes: {
        before: auditUserState(before),
        after: auditUserState(before),
      },
    })

    return { userId: before.id }
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

    const enumerated = await readSessionTokens(data.userId)
    await platformApi().removeUser({
      body: { userId: data.userId },
      headers: call.headers,
    })
    const purge = await purgeSessionKeys(
      sessionKeyStore(),
      data.userId,
      enumerated,
    )

    await recordConsoleAction(call, {
      action: PLATFORM_ACTIONS.USER_DELETED,
      entityId: before.id,
      changes: { before: auditUserState(before), after: null },
    })
    call.logger.info('console purged session keys', {
      action: PLATFORM_ACTIONS.USER_DELETED,
      entityId: before.id,
      ...purge,
    })

    return { userId: before.id }
  })

/**
 * Bans an account and takes its live sessions with it. `platform.user.banned`.
 *
 * The order is the mechanism and not a style: the tokens are enumerated from D1 **before**
 * `banUser` deletes those rows, and the KV blobs are deleted by name **after** it has, because
 * `updateUser` queues a `refreshUserSessions` that would otherwise rewrite the blobs this function
 * had just removed.
 */
export const banPlatformUserFn = createServerFn({ method: 'POST' })
  .validator(banPlatformUserInputSchema)
  .handler(async ({ data }): Promise<ConsoleUser> => {
    const call = await openConsoleCall({ user: ['ban'] })
    refuseSelfTarget(call, data.userId, 'You cannot ban your own account.')
    const before = await readTargetUser(call, data.userId)

    // Enumerated first: `banUser` deletes the D1 rows, and after that there is nothing left to read
    // the KV key names from.
    const enumerated = await readSessionTokens(data.userId)

    // A permanent ban over a leftover expiry: `banUser` cannot write `banExpires: null`, and a
    // stale one auto-unbans the account on its next sign-in. See this file's header.
    if (data.expiresInDays === undefined && before.banExpires) {
      await platformApi().unbanUser({
        body: { userId: data.userId },
        headers: call.headers,
      })
    }

    const result = await platformApi().banUser({
      body: {
        userId: data.userId,
        banReason: data.reason,
        ...(data.expiresInDays === undefined
          ? {}
          : { banExpiresIn: data.expiresInDays * SECONDS_PER_DAY }),
      },
      headers: call.headers,
    })
    const row = platformUserSchema.parse(result.user)

    const purge = await purgeSessionKeys(
      sessionKeyStore(),
      data.userId,
      enumerated,
    )

    await recordConsoleAction(call, {
      action: PLATFORM_ACTIONS.USER_BANNED,
      entityId: row.id,
      changes: { before: auditUserState(before), after: auditUserState(row) },
    })

    if (purge.failed > 0 || purge.truncated) {
      // The one case in which a ban is not immediate, raised rather than counted: a blob this call
      // could not delete keeps resolving through `findSession` with a `banned: false` snapshot
      // inside it until its own TTL expires.
      call.logger.error('console ban left session keys behind', undefined, {
        action: PLATFORM_ACTIONS.USER_BANNED,
        entityId: row.id,
        actorUserId: call.actor.userId,
        actorRole: call.actor.role,
        ...purge,
      })
    } else {
      call.logger.info('console purged session keys', {
        action: PLATFORM_ACTIONS.USER_BANNED,
        entityId: row.id,
        ...purge,
      })
    }

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
