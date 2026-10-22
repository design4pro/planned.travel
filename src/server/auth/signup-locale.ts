import { DEFAULT_LOCALE } from '#/lib/i18n/locales'
import { negotiate } from '#/lib/i18n/negotiate'
import { parseVisitorLocaleCookie } from '#/lib/i18n/visitor-locale'
import { createScope } from '#/server/repos/base'
import { seedUserLocale } from '#/server/repos/user-locale-seed'
import { logAuth } from './log'
import type { Locale } from '#/lib/i18n/locales'
import type { Database } from '#/server/db/types'

/** The email sign-up route, as Better Auth reports it in `context.path`. */
const EMAIL_SIGN_UP_PATH = '/sign-up/email'

/**
 * The social callback is matched by prefix: over HTTP Better Call sets `context.path` to the
 * concrete pathname (`/callback/google`), so the router's `/callback/:id` pattern never equals it.
 */
const SOCIAL_CALLBACK_PREFIX = '/callback/'

/**
 * Whether a request on this path is a person registering for themselves.
 *
 * An allowlist, not a denylist: `/admin/create-user` forwards the admin's own headers and cookie
 * into `createUser`, so a session check could not tell it from a sign-up, and a path nobody has
 * reviewed seeds nothing. The id-token route (`/sign-in/social` with an `idToken`) is left off: no
 * client of this product sends one, and adding it later is one line.
 */
export function isSeedingPath(path: string): boolean {
  return (
    path === EMAIL_SIGN_UP_PATH ||
    (path.startsWith(SOCIAL_CALLBACK_PREFIX) &&
      path.length > SOCIAL_CALLBACK_PREFIX.length)
  )
}

/** The part of Better Auth's endpoint context this module reads. */
export interface SignupRequestContext {
  readonly path: string
  readonly request?: Request
}

/**
 * The language to seed for this request, or `null` when it seeds nothing.
 *
 * Only a request that came in over HTTP is read (`context.request`): an in-process `auth.api.*`
 * call carries `headers` but no `request`, so a server-side caller that forwards somebody else's
 * headers can never seed. The language is the one the sign-up request resolved anonymously, the
 * way the register screen was drawn: the visitor cookie, else `Accept-Language`. `en` is what an
 * account without a row already opens in, so it is not written.
 */
function localeToSeed(context: SignupRequestContext | null): Locale | null {
  if (context === null || context.request === undefined) return null
  if (!isSeedingPath(context.path)) return null

  const locale = negotiate({
    user: null,
    workspace: null,
    visitor: parseVisitorLocaleCookie(context.request.headers.get('cookie')),
    acceptLanguage: context.request.headers.get('accept-language'),
  })
  return locale === DEFAULT_LOCALE ? null : locale
}

/**
 * Gives a newly created account the language its sign-up request was read in, as the person's own
 * setting in the personal workspace just provisioned.
 *
 * The database handle is a thunk so the common case, a sign-up with nothing to seed, never builds
 * one. Best-effort by contract: it swallows every error it can raise, because `user.create.after` runs
 * inline and a rejection here would fail the sign-up it only decorates. A failed seed leaves the
 * account on the workspace default (`en`), which is where it started, and a warning names it.
 * Signing in never gets here: the hook fires only for a user that was just created, and the
 * session-creation fallback does not call this.
 */
export async function seedSignupLocale(
  database: () => Database,
  context: SignupRequestContext | null,
  created: { readonly userId: string; readonly organizationId: string },
): Promise<void> {
  try {
    const locale = localeToSeed(context)
    if (locale === null) return

    await seedUserLocale(
      createScope(database(), {
        userId: created.userId,
        organizationId: created.organizationId,
        role: 'member',
        impersonatedBy: null,
      }),
      locale,
    )
  } catch (cause) {
    logAuth('warn', 'signup.locale-seed.failed', {
      userId: created.userId,
      organizationId: created.organizationId,
      reason: cause instanceof Error ? cause.message : 'unknown',
    })
  }
}
