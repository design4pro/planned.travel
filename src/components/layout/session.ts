/**
 * The shape the application chrome needs from an authenticated session.
 *
 * Deliberately narrow and framework-free: `src/routes/_app/route.tsx` maps the
 * auth layer's session object onto this once, so a change in the auth payload
 * touches exactly one file instead of every navigation component.
 */

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
