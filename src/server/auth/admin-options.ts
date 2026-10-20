/**
 * The `admin` plugin's options and the fifteen HTTP paths its registration closes
 * (docs/ACCESS.md §1.4, §2.6, §6.2).
 *
 * Two literals in one small module, because they are two halves of a single decision: registering
 * the plugin without closing its HTTP surface does not weaken §2.5, §4.3 and §6.4 — it falsifies
 * them. `src/server/auth/index.ts` imports both and passes them verbatim, `adminOptions` to
 * `admin()` and {@link DISABLED_ADMIN_PATHS} to the **top-level** `disabledPaths` option beside
 * `plugins`. Written inside `admin({ … })` instead, `disabledPaths` type-checks as an ignored extra
 * property and silently leaves all fifteen doors open.
 *
 * **Why this is a module and not an object literal inside `index.ts`.** Both mandatory drift tests
 * (docs/ACCESS.md §1.4 and §2.6) have to read the exact values the production `betterAuth()` call
 * receives — a locally constructed `admin({})` would report `adminUserIds` "absent" vacuously — and
 * they run in the `server` Vitest project, which is plain Node. `./env` imports `cloudflare:workers`
 * at module scope, so anything that reaches it cannot be imported there at all. This file is
 * therefore binding-free by construction: its only runtime import is `./access`, which is itself an
 * import leaf over two `better-auth` access subpaths, and `#/routes/(auth)/-lib/errors`, which has
 * no runtime imports of its own. `__tests__/admin-options.test.ts` walks that graph and fails when
 * a third specifier appears.
 *
 * Three values here are silent-failure traps rather than preferences, all three verified against
 * `better-auth@1.7.1` on disk rather than recalled:
 *
 * - `roles` must be the **complete** three-role set. `has-permission.mjs` reads
 *   `input.options?.roles || defaultRoles`, and `defaultRoles` has no `curator`; `ac` is never read
 *   server-side at all (its only consumer is `plugins/admin/client.mjs`). Passing `ac` without
 *   `roles` therefore denies every curator statement with no error and no warning.
 * - `adminRoles` is validated against `Object.keys(roles)` **synchronously inside `admin()`**
 *   (`admin.mjs:18-20`) and throws `BetterAuthError`. That call sits inside the memoised
 *   `buildAuth()`, so a name that is not a declared role is a dead Worker on every page including
 *   anonymous marketing — not an HTTP 500 on one route.
 * - `impersonationSessionDuration` falls back to `getDate(3600, 'sec')` when omitted
 *   (`routes.mjs:598`). docs/ACCESS.md §6.2 requires 900, and silence buys the wrong number.
 *
 * And one key is absent rather than empty: `adminUserIds` (docs/ACCESS.md §1.4). An id in that list
 * short-circuits the plugin's own permission check to `true` before `permissions` is so much as
 * examined, holding every statement in §1.1 — including `user:impersonate-admins`, which §2.4
 * grants to no role — while reading as a plain `user` everywhere a person could look. An empty
 * array in source is a slot, and a slot gets filled at 2 a.m., so there is no slot.
 */

import { ac, roles } from './access'
import type { AdminOptions } from 'better-auth/plugins/admin'

/**
 * Fifteen minutes (docs/ACCESS.md §6.2): long enough to reproduce a support report, short enough
 * that an unattended laptop expires before its owner is back with coffee.
 */
export const IMPERSONATION_SESSION_SECONDS = 900

/**
 * Exactly the options the production `betterAuth()` call passes to `admin()`.
 *
 * `plugin.options` on the constructed plugin is this same object by reference — the plugin stores
 * the raw argument, not its defaulted copy — which is what lets the drift test assert on the shape
 * the running Worker actually has. Read defaults from behaviour, never from here.
 */
/**
 * The message Better Auth attaches to its own `BANNED_USER` error.
 *
 * Declared here rather than imported from the auth screens, because the plugin throws this out of
 * `session.create.before` before any request has negotiated a language: there is no locale to key
 * a translation against at that moment. It is a transport default, not screen copy. What the
 * suspended account actually reads is chosen by `src/routes/(auth)/-lib/errors.ts`, which maps the
 * `BANNED_USER` code onto message keys - never onto this sentence - so `docs/SPEC.md` §8.6 holds.
 *
 * KNOWN GAP, named rather than papered over: that mapping does not exist yet. `BANNED_USER` has no
 * entry in `BY_CODE`, so a suspended account currently falls through to `error.unexpected` and
 * reads "Something went wrong" in its own language. Closing it needs `error.banned.title` and
 * `error.banned.detail` in the English namespace **and** in all twenty-two translations, which the
 * §8.2 parity gate requires and which a merge is the wrong place to invent.
 */
export const BANNED_USER_MESSAGE =
  'This account is suspended and cannot sign in. If you believe that is a mistake, reply to any email from planned.travel and a person will look into it.'

export const adminOptions = {
  /**
   * Server-inert, and carried anyway. Nothing in the plugin's server path reads it; it exists so
   * that the object handed to `admin()` is the whole access decision in one place rather than half
   * of it, and so a later client-side consumer cannot be given a different controller by accident.
   */
  ac,
  roles,
  adminRoles: ['admin'],
  defaultRole: 'user',
  impersonationSessionDuration: IMPERSONATION_SESSION_SECONDS,
  bannedUserMessage: BANNED_USER_MESSAGE,
} satisfies AdminOptions

/**
 * The fifteen paths `admin()` publishes, every one of them closed.
 *
 * Matching happens in the router's `onRequest` against the request path with `basePath` already
 * stripped (`dist/api/index.mjs:164-166`), so the entries are written `/admin/set-role` and not
 * `/api/auth/admin/set-role` — the second spelling matches nothing and closes nothing. A match
 * returns a bare `404` before rate limiting, before every plugin `onRequest` and before the
 * endpoint function is entered: the surface is removed rather than guarded.
 *
 * `auth.api` is built by `getEndpoints()` and never passes through `router()`, so this shuts the
 * browser door while leaving `auth.api.banUser({ body, headers })` fully usable in process behind
 * `requirePermission`. That asymmetry is why `disabledPaths` is the instrument and a `hooks.before`
 * guard is not: `hooks.before` wraps `auth.api` too, and would leave no way to perform the action
 * at all.
 *
 * The declared type is mutable because `BetterAuthOptions['disabledPaths']` is `string[]`, and this
 * array is passed by reference rather than copied so that the drift test and the running Worker
 * cannot be looking at two different lists. Nothing mutates it.
 */
export const DISABLED_ADMIN_PATHS: string[] = [
  '/admin/ban-user',
  '/admin/create-user',
  '/admin/get-user',
  '/admin/has-permission',
  '/admin/impersonate-user',
  '/admin/list-user-sessions',
  '/admin/list-users',
  '/admin/remove-user',
  '/admin/revoke-user-session',
  '/admin/revoke-user-sessions',
  '/admin/set-role',
  '/admin/set-user-password',
  '/admin/stop-impersonating',
  '/admin/unban-user',
  '/admin/update-user',
]

/**
 * The organization plugin's HTTP paths closed besides `organization/create` and
 * `organization/delete` (docs/ACCESS.md §2.6), kept out of {@link DISABLED_ADMIN_PATHS}, whose
 * drift test requires it to equal the `/admin/*` set exactly.
 *
 * `organization/update-member-role` writes `member.role` with no audit entry and accepts a
 * comma-joined role string. A role change is audited, ceilinged and refused during impersonation in
 * `changeRole` (`src/server/fns/member-role-writes.ts`); a veto in one function with the same action
 * on a public URL is not a veto. Nothing in `src/` calls the endpoint, and `auth.api.updateMemberRole`
 * stays usable in process, which the last-owner plugin tests drive.
 *
 * `organization/remove-member` deletes the `member` row for an owner or an admin with the same gaps:
 * no audit entry and no refusal during impersonation (#1010). The product-owned removal is #1008,
 * which calls `auth.api.removeMember` in process so the after-hook that queues the removed person's
 * room eviction still runs. `organization/leave` is closed too: the guarded product action calls the in-process
 * API, so HTTP cannot bypass impersonation, audit or atomic owner protection (#1008).
 */
/** Invitation mutations use the tenant repository lifecycle; recipient reads/accept/reject stay open. */
export const DISABLED_ORGANIZATION_PATHS: string[] = [
  '/organization/update-member-role',
  '/organization/remove-member',
  '/organization/leave',
  '/organization/invite-member',
  '/organization/cancel-invitation',
]

/**
 * What `disabledPaths` receives: both lists, merged once here so the drift tests and the running
 * Worker read the same array.
 */
export const DISABLED_PATHS: string[] = [
  ...DISABLED_ADMIN_PATHS,
  ...DISABLED_ORGANIZATION_PATHS,
]
