/**
 * The shape the application chrome needs from an authenticated session.
 *
 * Deliberately narrow and framework-free: `src/routes/_app/route.tsx` maps the
 * auth layer's session object onto this once, so a change in the auth payload
 * touches exactly one file instead of every navigation component.
 */

import { readPublicFailure } from '#/lib/errors'

import type { MessageKey } from '#/lib/i18n'

/**
 * Standing on the product itself, as `docs/SPEC.md` §5 defines it.
 *
 * Declared here rather than imported from `#/server/auth/access` so this module
 * keeps its one useful property — it imports nothing and can therefore be read
 * by a component, a test or a server file alike. It is not a second source of
 * truth: `src/routes/_app/-server/shell.ts` assigns the resolved server role
 * into this type, so a fourth platform role appearing over there stops
 * compiling here rather than arriving as a string nobody checked.
 */
export type ShellPlatformRole = 'admin' | 'curator' | 'user'

/** What the chrome may do on the platform, given a resolved platform role. */
export interface ShellPlatformCapabilities {
  /** Full platform authority: users, roles, bans, sessions, impersonation. */
  readonly isPlatformAdmin: boolean
  /** May reach the catalogue surfaces. True for `admin` too, which is a superset. */
  readonly isCurator: boolean
}

/**
 * The two platform flags, from the one role.
 *
 * A predicate rather than an equality test, matching how the organization role
 * is read a few lines below: `owner` satisfies `admin` inside a workspace, and
 * `admin` satisfies `curator` on the platform, because `docs/SPEC.md` §5 gives
 * the platform admin "everything a `curator` may do". Gating a catalogue screen
 * on `platformRole === 'curator'` would lock out the only role that can fix it.
 */
export function platformCapabilities(
  platformRole: ShellPlatformRole,
): ShellPlatformCapabilities {
  return {
    isPlatformAdmin: platformRole === 'admin',
    isCurator: platformRole === 'admin' || platformRole === 'curator',
  }
}
export interface ShellUser {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly image: string | null
  /** Gates the admin entry in the user menu and the `/admin` route. */
  readonly isAdmin: boolean
  /**
   * Standing on the *platform*, which is a different vocabulary from `isAdmin`
   * above and must never be conflated with it (`docs/SPEC.md` §5). `isAdmin`
   * comes from this person's membership row in the active workspace; this comes
   * from `user.role`. An owner of their own workspace is `isAdmin` and almost
   * certainly `platformRole: 'user'`; a platform admin visiting a workspace
   * they merely belong to is the same disagreement the other way round.
   */
  readonly platformRole: ShellPlatformRole
  readonly isPlatformAdmin: boolean
  readonly isCurator: boolean
}

export interface ShellOrganization {
  readonly id: string
  readonly name: string
  readonly slug: string
}

/**
 * The operator behind an impersonated session — `session.impersonatedBy`,
 * resolved to something a person can read.
 *
 * `name` and `email` are nullable because the id is the only part the session
 * carries: the row is read separately, and a bar that could not name the
 * operator must still say that there is one.
 */
export interface ShellImpersonator {
  readonly id: string
  readonly name: string | null
  readonly email: string | null
}

export interface ShellSession {
  readonly user: ShellUser
  /** The organization whose data the app is currently showing. */
  readonly organization: ShellOrganization | null
  readonly organizations: ReadonlyArray<ShellOrganization>
  /**
   * Set only while this session was minted by an operator acting as somebody
   * else. Its presence is the whole condition for the warning bar
   * (`docs/ACCESS.md` §6.1), so it is `null` on every ordinary session rather
   * than an object with empty fields.
   */
  readonly impersonatedBy: ShellImpersonator | null
  /**
   * When this session expires, ISO-8601.
   *
   * A string rather than a `Date` because it crosses a serialization boundary:
   * typed as a `Date` and delivered as a string, every reader would be one
   * `.getTime()` away from `NaN`, and the countdown in the warning bar is the
   * reader that would show it. `docs/ACCESS.md` §6.2 pins an impersonated
   * session's life at 900 seconds, and this is the value the session actually
   * carries rather than a second opinion about that constant.
   */
  readonly expiresAt: string
}

/** Where Better Auth's REST handler is mounted; see `src/routes/api`. */
export const SIGN_OUT_ENDPOINT = '/api/auth/sign-out'

/**
 * The two states the shell cannot render around, as the message keys
 * `src/routes/_app/-server/shell.ts` throws.
 *
 * The key travels rather than a sentence, deliberately. The failing request has
 * no workspace, so it cannot reach the stored language preference and would have
 * only `Accept-Language` to negotiate with; the boundary that catches the throw
 * is inside the document's own `I18nProvider` and knows the locale the page was
 * actually rendered in. An `Error.message` is also the one field that survives
 * the server-function boundary intact, where a subclass or an extra property
 * does not.
 *
 * It lives here because both halves need it and this module is the narrow,
 * framework-free contract between them — it imports no React, no router and
 * nothing from `src/server`.
 */
export const SHELL_STATE_KEYS = [
  'shell.session.noWorkspace',
  'shell.session.membershipRemoved',
] as const satisfies ReadonlyArray<MessageKey>

/** One of the two, so the thrower cannot invent a third. */
export type ShellStateKey = (typeof SHELL_STATE_KEYS)[number]

/** The key a thrown shell state carries, or `null` for anything else. */
export function shellStateOf(error: unknown): MessageKey | null {
  // Two shapes reach here and both have to work. A shell state thrown on the client arrives as
  // itself. One thrown inside `loadShell` crosses the server-function boundary through the
  // redaction middleware, which re-encodes authored copy into an envelope - so the key is read back
  // out of that first, and the raw message is the fallback rather than the only case.
  const message =
    readPublicFailure(error).message ??
    (error instanceof Error ? error.message : error)
  return SHELL_STATE_KEYS.find((key) => key === message) ?? null
}
