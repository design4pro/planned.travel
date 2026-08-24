/**
 * The shape the application chrome needs from an authenticated session.
 *
 * Deliberately narrow and framework-free: `src/routes/_app/route.tsx` maps the
 * auth layer's session object onto this once, so a change in the auth payload
 * touches exactly one file instead of every navigation component.
 */

import type { MessageKey } from '#/lib/i18n'

export interface ShellUser {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly image: string | null
  /** Gates the admin entry in the user menu and the `/admin` route. */
  readonly isAdmin: boolean
}

export interface ShellOrganization {
  readonly id: string
  readonly name: string
  readonly slug: string
}

export interface ShellSession {
  readonly user: ShellUser
  /** The organization whose data the app is currently showing. */
  readonly organization: ShellOrganization | null
  readonly organizations: ReadonlyArray<ShellOrganization>
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
  const message = error instanceof Error ? error.message : error
  return SHELL_STATE_KEYS.find((key) => key === message) ?? null
}
