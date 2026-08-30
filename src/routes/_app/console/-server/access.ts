/**
 * The console route tree's own guard, and the only thing `beforeLoad` waits on.
 *
 * `docs/ACCESS.md` §2.3 says it in one sentence: "The console route tree denies a `user` session at
 * its own guard **before a statement is ever consulted**." That wording is the whole design of this
 * file. Standing is decided from the resolved platform role, not from a probe of the twenty-five
 * statements, because a `user` holds none of them and asking about one would only pick an arbitrary
 * statement to be refused by. `requirePermission` still decides every *action*: it runs again inside
 * every console server function, and nothing rendered from what this returns is trusted by anything
 * on the server.
 *
 * The two capability flags below are for rendering only, and they are derived from
 * `requirePermission` rather than from a second `role === 'admin'` test — §2.5 allows a component to
 * hide a control it believes is unavailable and calls that a courtesy, so the courtesy is computed
 * from the boundary's own answer and can never drift from it. `permits()` is a wrapper around the
 * one implementation, not a second one: it asks the same function the same question and turns the
 * throw into a boolean.
 *
 * The three vetoes ahead of the role test mirror `requirePermission`'s own order, and each is here
 * for a reason the role alone cannot express. A banned operator is refused whatever role the column
 * says (§1.3). An impersonated session is refused whatever the worn account holds, because §6.4
 * denies it every statement in the dictionary — a console reachable in that state would offer a page
 * of controls whose server functions all answer 403. And an account with no session cannot reach
 * here at all: `_app`'s own `beforeLoad` has already redirected it to `/login`, so the branch exists
 * to make the answer total rather than to be hit.
 */

import { createServerFn } from '@tanstack/react-start'

import { resolvePlatformRole } from '#/server/auth/access'
import { requirePermission } from '#/server/auth/guard'
import { getSession } from '#/server/auth/session'

import type { ShellPlatformRole } from '#/components/layout/session'
import type { PlatformPermissionRequest } from '#/server/auth/access'
import type { AuthSession } from '#/server/auth/tenant'

/** Why the console refused to open. Rendered nowhere: every one of them redirects. */
export type ConsoleDenial =
  'unauthenticated' | 'banned' | 'impersonated' | 'no-platform-role'

/** What the console chrome may show, once standing has been decided. */
export interface ConsoleAccess {
  readonly role: ShellPlatformRole
  /** Users, sessions and impersonation — `admin` only (docs/ACCESS.md §2.1, §2.2). */
  readonly canManageUsers: boolean
  /** The catalogue, packs and sources — `admin` and `curator` alike (§2.3). */
  readonly canCurate: boolean
  /** The sandcastle run registry — `admin` only, and about no account at all (§2.3a). */
  readonly canSeeRuns: boolean
  /** Third-party call counters and their ceilings — `admin` only (§2.3b). */
  readonly canSeeProviders: boolean
  /**
   * Moving a ceiling or its policy — `admin` only, and separate from reading it on purpose.
   *
   * Reading a meter and being able to stop a vendor being called are different authorities: the
   * second can stop transactional email. They are one role apart today and the split still earns
   * its place, because the screen's read half and its edit half are then gated by the statement
   * each actually needs rather than by the stronger of the two.
   */
  readonly canConfigureProviders: boolean
}

export type ConsoleAccessResult =
  | { readonly permitted: true; readonly access: ConsoleAccess }
  | { readonly permitted: false; readonly denial: ConsoleDenial }

/**
 * The one implementation of "may this actor do this", asked as a question instead of an assertion.
 *
 * Never a second answer: it calls `requirePermission` and reports whether it threw. Used only to
 * decide what the console *renders*; every server function behind those controls calls the same
 * guard again and is the boundary.
 */
function permits(
  session: AuthSession,
  request: PlatformPermissionRequest,
): boolean {
  try {
    requirePermission(session, request)
    return true
  } catch {
    return false
  }
}

export const loadConsoleAccess = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ConsoleAccessResult> => {
    const session = await getSession()

    if (session === null) {
      return { permitted: false, denial: 'unauthenticated' }
    }
    if (session.user.banned) {
      return { permitted: false, denial: 'banned' }
    }
    if (session.session.impersonatedBy !== null) {
      return { permitted: false, denial: 'impersonated' }
    }

    // `user.role` is a comma-joined string for a multi-role account, so the strongest name it
    // carries is what decides. Never a `=== 'admin'` here (docs/ACCESS.md §1.3).
    const role = resolvePlatformRole(session.user.role)
    if (role === 'user') {
      return { permitted: false, denial: 'no-platform-role' }
    }

    return {
      permitted: true,
      access: {
        role,
        canManageUsers: permits(session, { user: ['list'] }),
        canCurate: permits(session, { catalog: ['read'] }),
        canSeeRuns: permits(session, { sandcastle: ['read'] }),
        canSeeProviders: permits(session, { provider: ['read'] }),
        canConfigureProviders: permits(session, { provider: ['configure'] }),
      },
    }
  },
)
