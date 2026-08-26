/**
 * The console screens' own server surface for accounts, and the reason it exists rather than the
 * screens calling `src/server/fns/console/users.ts` directly.
 *
 * **It is a bundling boundary before it is anything else.** TanStack Start rewrites a module that
 * declares server functions into a client twin: the handler bodies become RPC stubs, every import
 * used only inside them is dropped, and everything still referenced at module scope — a validator in
 * particular — travels to the browser. `src/server/fns/console/users.ts` builds its password
 * validator from `MIN_PASSWORD_LENGTH` and `MAX_PASSWORD_LENGTH`, imported from `#/server/auth`,
 * which imports `#/server/auth/env.ts`, which opens with `import { env } from 'cloudflare:workers'`.
 * That import is unresolvable in the client environment, so the first screen to import that module
 * from the browser takes the whole client bundle down — measured here as a Vite transform failure on
 * every page in the app, not only on the console. Every function below therefore reaches it from
 * *inside* a handler, where the import is stripped: the client twin of this file imports the RPC
 * helper and nothing else.
 *
 * The defect is in that file, and the repair belongs to it — the two constants want a leaf module
 * with no Worker binding behind it, the way `src/server/db/audit-action.ts` already exists so two
 * audit writers can share a regex without dragging the tenant repository into a global table's
 * module graph. It is reported with this item rather than edited from here.
 *
 * **The indirection earns its keep twice over.** Each function takes the *screen's* shape rather
 * than the endpoint's, so the mapping from a URL's search parameters onto `list-users`' one filter
 * clause is decided on the server instead of in a loader; and the read below is where an empty page
 * is told apart from a failed query, which is a decision no screen should be making from a count.
 *
 * Authorisation is untouched by any of this. Every function here immediately calls the console
 * function behind it, which calls `requirePermission` before it reads a row and appends to
 * `platform_audit_log` after it writes one (`docs/ACCESS.md` §2.5, §4.3). Nothing here decides
 * anything, and the Zod schemas below are the wire boundary for this surface — each one is at most
 * as permissive as the schema on the function it forwards to, which validates again.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { readAccountContext } from '#/server/fns/console/account'
import { ConsoleActionError } from '#/server/fns/console/errors'
import { listPlatformSessionsFn } from '#/server/fns/console/sessions'
import { readAccountBilling } from './account-billing'
import {
  banPlatformUserFn,
  createPlatformUserFn,
  deletePlatformUserFn,
  getPlatformUserFn,
  listPlatformUsersFn,
  setPlatformUserPasswordFn,
  setPlatformUserRoleFn,
  unbanPlatformUserFn,
} from '#/server/fns/console/users'

import type { ConsoleAuditEntry } from '#/server/fns/console/account'
import type {
  ConsoleSession,
  ConsoleUser,
} from '#/server/fns/console/projections'
import type { ConsoleSubscription, ConsoleWorkspace } from './account-billing'

/** One page of the accounts table. Twenty-five rows fill a laptop without a scroll to the pager. */
export const CONSOLE_USERS_PAGE_SIZE = 25

const userId = z.string().trim().min(1).max(64)

/**
 * The three platform roles, spelled here for the same reason `ShellPlatformRole` spells them in
 * `src/components/layout/session.ts`: this module is reachable from the browser, and importing the
 * dictionary would put Better Auth's access-control package in the client bundle to name three
 * strings. It is not a second source of truth — the function this forwards to validates against
 * `PLATFORM_ROLES_BY_PRECEDENCE`, so a fourth role appearing there is refused here rather than
 * accepted and mistranslated.
 */
const platformRole = z.enum(['admin', 'curator', 'user'])

/**
 * The accounts screen's addressable state, as the server reads it.
 *
 * `role` and `status` are refused together because `list-users` builds at most one filter clause
 * beside the search clause and would silently drop the second — the same refusal
 * `listPlatformUsersInputSchema` makes, restated here so the pair never reaches the wire.
 */
export const consoleUsersQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    field: z.enum(['email', 'name']).default('email'),
    role: z.enum(['admin', 'curator']).optional(),
    status: z.enum(['active', 'suspended']).optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'email']).default('createdAt'),
    sortDirection: z.enum(['asc', 'desc']).default('desc'),
    page: z.number().int().min(1).max(4_000).default(1),
  })
  .refine(
    (input) => input.role === undefined || input.status === undefined,
    'narrow by role or by status, not both',
  )

export interface ConsoleUsersPage {
  readonly users: ReadonlyArray<ConsoleUser>
  readonly total: number
  readonly page: number
  readonly pageSize: number
}

export const loadConsoleUsers = createServerFn({ method: 'GET' })
  .validator(consoleUsersQuerySchema)
  .handler(async ({ data }): Promise<ConsoleUsersPage> => {
    const result = await listPlatformUsersFn({
      data: {
        ...(data.q === undefined || data.q.length === 0 ? {} : { search: data.q }),
        searchField: data.field,
        ...(data.role === undefined ? {} : { role: data.role }),
        ...(data.status === undefined
          ? {}
          : { banned: data.status === 'suspended' }),
        sortBy: data.sortBy,
        sortDirection: data.sortDirection,
        limit: CONSOLE_USERS_PAGE_SIZE,
        offset: (data.page - 1) * CONSOLE_USERS_PAGE_SIZE,
      },
    })

    /**
     * An unfiltered page that contains nobody is a failed query, not an empty platform.
     *
     * `auth.api.listUsers` wraps its whole body in
     * `try { … } catch { return { users: [], total: 0 } }`, so an adapter that could not answer is
     * byte-identical to a table with no rows in it, at HTTP 200. The two are separated here on a
     * fact rather than on a guess: the operator who reached this call holds a session, therefore
     * holds a `user` row, therefore appears in every unfiltered page it can return. Zero of zero,
     * unfiltered, has not happened — so it is raised as the failure it is, and the accounts screen
     * shows its error state instead of telling an admin the product has no users.
     */
    const filtered =
      (data.q !== undefined && data.q.length > 0) ||
      data.role !== undefined ||
      data.status !== undefined
    if (!filtered && result.total === 0 && result.users.length === 0) {
      throw new Error(
        'The accounts query came back empty, and it cannot be — your own account is in it. ' +
          'The database did not answer this read.',
      )
    }

    return {
      users: result.users,
      total: result.total,
      page: data.page,
      pageSize: CONSOLE_USERS_PAGE_SIZE,
    }
  })

/**
 * Everything the account screen renders beside the identity card.
 *
 * Three layers meet here and none of them leaks into another: the workspaces and the ledger come
 * from `#/server/fns/console/account`, whose statement against `platform_audit_log` lives in
 * `src/server/catalog` and whose `member`/`organization` reads go through Better Auth's own adapter;
 * the plan beside each workspace comes from `./account-billing`, which calls the billing repository
 * and writes no SQL of its own.
 */
export interface ConsoleAccountDetail {
  readonly account: ConsoleUser
  readonly sessions: ReadonlyArray<ConsoleSession>
  /** The account holds more sessions than one call enumerates. */
  readonly truncated: boolean
  readonly context: ConsoleAccountRelations
}

export interface ConsoleAccountRelations {
  readonly memberships: ReadonlyArray<ConsoleWorkspace>
  /** True when the account belongs to more workspaces than the panel lists. */
  readonly membershipsTruncated: boolean
  readonly subscriptions: ReadonlyArray<ConsoleSubscription>
  readonly audit: ReadonlyArray<ConsoleAuditEntry>
  /** True when the ledger holds more rows than the timeline shows. */
  readonly auditTruncated: boolean
}

/**
 * What one account screen resolved to: the account, or the fact that there is no such account.
 *
 * A union rather than a rejection, because the two are different HTTP answers and the difference was
 * measured on this screen. An id that names nobody used to reach `readTargetUser`, which raises a
 * `409` refusal written for a *dialog* — "That account no longer exists" — and a loader that lets it
 * through answers `500` with that sentence in an error panel. Meanwhile `console/route.tsx` carries
 * a `notFoundComponent` that nothing could ever reach. Reporting the absence instead lets the loader
 * throw `notFound()`, which is what that component is for.
 */
export type ConsoleAccountResult =
  | { readonly found: false }
  | { readonly found: true; readonly detail: ConsoleAccountDetail }

/**
 * One account: who it is, what it holds, where it belongs and what has been done to it.
 *
 * Every panel behind one loader call rather than one call per panel. The screen is a single page and
 * a page that resolved four sessions to draw itself would be four times `docs/ARCHITECTURE.md`
 * §2.1's budget for one; the reads run together, so the wall-clock cost is the slowest of them.
 *
 * Only `target-not-found` is caught. Every other refusal — a `curator` who reached this, an account
 * whose sessions could not be enumerated — is a real failure and reaches the error boundary as one.
 */
export const loadConsoleAccount = createServerFn({ method: 'GET' })
  .validator(z.object({ userId }))
  .handler(async ({ data }): Promise<ConsoleAccountResult> => {
    let account
    let sessions
    let context
    try {
      ;[account, sessions, context] = await Promise.all([
        getPlatformUserFn({ data: { userId: data.userId } }),
        listPlatformSessionsFn({ data: { userId: data.userId } }),
        readAccountContext(data.userId),
      ])
    } catch (cause) {
      if (
        cause instanceof ConsoleActionError &&
        cause.code === 'target-not-found'
      ) {
        return { found: false }
      }
      throw cause
    }

    // The billing lookup needs the organization ids, so it cannot join the three above. It is one
    // statement whatever the ids are, and it is the only read on this page that waits for another.
    const billing = await readAccountBilling(context.memberships)

    return {
      found: true,
      detail: {
        account,
        sessions: sessions.sessions,
        truncated: sessions.truncated,
        context: {
          memberships: billing.workspaces,
          membershipsTruncated: context.membershipsTruncated,
          subscriptions: billing.subscriptions,
          audit: context.audit,
          auditTruncated: context.auditTruncated,
        },
      },
    }
  })

export const createConsoleAccount = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      name: z.string().trim().min(1).max(120),
      email: z.string().trim().min(3).max(320),
      /**
       * Length is deliberately not restated. The product's policy is two constants in
       * `src/server/auth/index.ts`, `createPlatformUserInputSchema` enforces them, and a third copy
       * of the numbers here would be a third place for them to drift. This asks only that something
       * was typed, so the empty-field case is refused before a round trip.
       */
      password: z.string().min(1),
      role: platformRole,
    }),
  )
  .handler(
    async ({ data }): Promise<ConsoleUser> =>
      await createPlatformUserFn({ data }),
  )

export const setConsoleAccountRole = createServerFn({ method: 'POST' })
  .validator(z.object({ userId, role: platformRole }))
  .handler(
    async ({ data }): Promise<ConsoleUser> =>
      await setPlatformUserRoleFn({ data }),
  )

export const setConsoleAccountPassword = createServerFn({ method: 'POST' })
  .validator(z.object({ userId, newPassword: z.string().min(1) }))
  .handler(
    async ({ data }): Promise<{ userId: string; revoked: number }> =>
      await setPlatformUserPasswordFn({ data }),
  )

export const suspendConsoleAccount = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      userId,
      reason: z.string().trim().min(1).max(280),
      /** Absent means permanent. Ninety days is the ceiling the console function enforces. */
      expiresInDays: z.number().int().min(1).max(90).optional(),
    }),
  )
  .handler(
    async ({ data }): Promise<ConsoleUser> => await banPlatformUserFn({ data }),
  )

export const restoreConsoleAccount = createServerFn({ method: 'POST' })
  .validator(z.object({ userId }))
  .handler(
    async ({ data }): Promise<ConsoleUser> =>
      await unbanPlatformUserFn({ data }),
  )

export const deleteConsoleAccount = createServerFn({ method: 'POST' })
  .validator(z.object({ userId }))
  .handler(
    async ({ data }): Promise<{ userId: string }> =>
      await deletePlatformUserFn({ data }),
  )
