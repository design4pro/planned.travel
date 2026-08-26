/**
 * Server-side session access.
 *
 * These are the only sanctioned ways for a server function, loader or server
 * route to learn who is calling. The decision logic lives in `./tenant` so it
 * can be tested without a request; this module supplies the request.
 */
import { getRequest } from '@tanstack/react-start/server'
import { authDb } from './db'
import { getAuth } from './index'
import {
  membershipRoleFor,
  resolveOrProvisionOrganization,
} from './provisioning'
import {
  AuthRequirementError,
  normaliseSession,
  requireOrgFrom,
  requireUserFrom,
} from './tenant'
import type {
  AuthSession,
  AuthUser,
  RequireOrgOptions,
  TenantContext,
} from './tenant'

export {
  AuthRequirementError,
  isAuthRequirementError,
  roleSatisfies,
} from './tenant'
export type {
  AuthSession,
  AuthUser,
  OrganizationRole,
  RequireOrgOptions,
  TenantContext,
} from './tenant'

/**
 * The current session, or `null` when the caller is anonymous.
 *
 * Costs one KV read: the session cookie carries a token, and Better Auth resolves it against the
 * `SESSIONS` namespace before it would consult D1.
 */
export async function getSession(): Promise<AuthSession | null> {
  const request = getRequest()
  const result = await getAuth().api.getSession({
    headers: request.headers,
    // `disableCookieCache` travels as a *query* parameter — `dist/api/routes/session.mjs:48`
    // gates the cached read on `!ctx.query?.disableCookieCache`. Passed as a sibling option it
    // type-checks, does nothing, and leaves the cache live. Nothing in this repository would
    // notice, either: the same line requires `session.cookieCache.enabled`, and that block is
    // gone, so today the two spellings behave identically and the wrong one only starts costing
    // something the day someone turns the cache back on. `__tests__/auth-handler-closure.test.ts`
    // is what makes the difference observable — it records this argument from a real call and
    // replays it against an instance whose cache is live.
    //
    // The honest bound on what this buys. Better Auth reads `user.banned` in exactly one place,
    // the `admin` plugin's `session.create.before`, so a ban is enforced when a *session* is
    // created and not on every request; and `internalAdapter.findSession` resolves a token from
    // KV before it looks at D1, so a session whose row is gone stays live for as long as its KV
    // blob does. Ban immediacy therefore rests on the console's ban path deleting the target's
    // KV session keys — enumerated from D1 before `banUser` removes the rows — and not on this
    // flag. What the flag removes is the separate 300-second window in which a signed cookie
    // snapshot answered for the row without anything re-reading it. KV's own cross-colo cache
    // still leaves up to 60 seconds, and Miniflare's local KV has no edge cache at all, so a
    // local manual test proves nothing whatever about production.
    query: { disableCookieCache: true },
  })
  return normaliseSession(result ?? null)
}

/**
 * The current user, or a thrown `AuthRequirementError` with status 401.
 * Use in any server function that must not run anonymously.
 */
export async function requireUser(): Promise<AuthUser> {
  return requireUserFrom(await getSession())
}

/**
 * The tenant context for the caller's active organization.
 *
 * The membership role is re-read from `member` rather than trusted from the
 * session, so a revoked or downgraded membership takes effect immediately
 * instead of lingering for the life of a cookie.
 */
export async function requireOrg(
  options: RequireOrgOptions = {},
): Promise<TenantContext> {
  const session = await getSession()
  const user = requireUserFrom(session)
  let organizationId = session?.session.activeOrganizationId ?? null

  if (!organizationId) {
    // Sessions issued before the active organization could be resolved (and any
    // whose cookie cache predates it) would otherwise be stranded on every
    // authenticated screen. Adopt the user's own oldest membership for this
    // request instead of failing; `session.create.before` is what makes new
    // sessions carry it durably.
    organizationId = await resolveOrProvisionOrganization(authDb(), user.id)
  }

  if (!organizationId) {
    throw new AuthRequirementError(
      'no-active-organization',
      'Choose a workspace before continuing.',
    )
  }

  const role = await membershipRoleFor(authDb(), {
    userId: user.id,
    organizationId,
  })

  // `requireOrgFrom` is deliberately pure and reads the active organization off
  // the session, so hand it the organization this request actually resolved.
  const effective: AuthSession | null = session
    ? { ...session, session: { ...session.session, activeOrganizationId: organizationId } }
    : session

  return requireOrgFrom(effective, role, options)
}
