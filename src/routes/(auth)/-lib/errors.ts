/**
 * Turns a failed auth call into copy a person can act on.
 *
 * Better Auth's own messages are accurate but written for developers ("Invalid
 * token"). Every code we can actually hit gets a sentence here instead, and
 * anything unmapped falls back to a calm, non-alarming default rather than
 * leaking an internal string onto the page.
 */
import type { AuthFailure } from '#/lib/auth/client'

/** A rendered failure: the headline, and the quiet line under it. */
export interface AuthMessage {
  readonly title: string
  readonly detail: string
  readonly tone: 'danger' | 'warning'
}

const RATE_LIMITED: AuthMessage = {
  title: 'Too many attempts',
  detail:
    'For your security we have paused sign-in from this device for a few minutes. Try again shortly.',
  tone: 'warning',
}

const OFFLINE: AuthMessage = {
  title: 'No connection',
  detail:
    'We could not reach planned.travel. Check your connection and try again.',
  tone: 'warning',
}

/**
 * The one sentence a suspended account is ever shown, and the only copy of it.
 *
 * Exported because Better Auth's `admin` plugin throws its own `BANNED_USER` error out of
 * `session.create.before` with `bannedUserMessage` as the message, and that option is configured
 * from this constant in `src/server/auth/admin-options.ts` so the two cannot drift. The default it
 * replaces — "You have been banned from this application. Please contact support if you believe
 * this is an error." — is developer copy: it names an "application" nobody calls us, and it points
 * at a support desk we do not have.
 *
 * The string is declared here rather than in the server module on purpose. Copy belongs to the
 * screen that renders it, and this module has no runtime imports at all, so the server can read it
 * without the auth bundle ever having to import anything out of `src/server`.
 */
export const BANNED_USER_MESSAGE =
  'This account is suspended and cannot sign in. If you believe that is a mistake, reply to any email from planned.travel and a person will look into it.'

const UNEXPECTED: AuthMessage = {
  title: 'Something went wrong',
  detail: 'That did not work. Please try again in a moment.',
  tone: 'danger',
}

const BY_CODE: Record<string, AuthMessage | undefined> = {
  INVALID_EMAIL_OR_PASSWORD: {
    title: 'Those details do not match',
    detail:
      'Check the email address and password and try again. If you signed up with Google or Apple, use that button instead.',
    tone: 'danger',
  },
  INVALID_PASSWORD: {
    title: 'Those details do not match',
    detail: 'Check the email address and password and try again.',
    tone: 'danger',
  },
  /**
   * Thrown by the `admin` plugin's session hook, so it arrives on sign-in rather than on any
   * screen the account is already inside (docs/ACCESS.md §4.3).
   */
  BANNED_USER: {
    title: 'This account is suspended',
    detail: BANNED_USER_MESSAGE,
    tone: 'danger',
  },
  CREDENTIAL_ACCOUNT_NOT_FOUND: {
    title: 'No password on this account',
    detail:
      'This account signs in with a social provider or a passkey. Use one of the options above.',
    tone: 'warning',
  },
  EMAIL_NOT_VERIFIED: {
    title: 'Confirm your email first',
    detail:
      'We sent you a confirmation link when you signed up. Open it, then come back here.',
    tone: 'warning',
  },
  USER_ALREADY_EXISTS: {
    title: 'That email is already registered',
    detail: 'Sign in instead, or reset your password if you have forgotten it.',
    tone: 'warning',
  },
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: {
    title: 'That email is already registered',
    detail: 'Sign in instead, or reset your password if you have forgotten it.',
    tone: 'warning',
  },
  USER_NOT_FOUND: {
    title: 'We could not find that account',
    detail: 'Check the address, or create a new account.',
    tone: 'danger',
  },
  PASSWORD_TOO_SHORT: {
    title: 'Password too short',
    detail: 'Choose a longer passphrase and try again.',
    tone: 'danger',
  },
  PASSWORD_TOO_LONG: {
    title: 'Password too long',
    detail: 'Choose a shorter passphrase and try again.',
    tone: 'danger',
  },
  INVALID_TOKEN: {
    title: 'This link is no longer valid',
    detail:
      'Password links can only be used once. Request a fresh one and we will email it straight away.',
    tone: 'warning',
  },
  TOKEN_EXPIRED: {
    title: 'This link has expired',
    detail: 'Request a new one and we will email it straight away.',
    tone: 'warning',
  },
  SESSION_EXPIRED: {
    title: 'Your session expired',
    detail: 'Sign in again to pick up where you left off.',
    tone: 'warning',
  },
  EMAIL_ALREADY_VERIFIED: {
    title: 'Already confirmed',
    detail: 'This email address is verified. You can sign in as normal.',
    tone: 'warning',
  },
  INVALID_CODE: {
    title: 'That code did not work',
    detail:
      'Authenticator codes last 30 seconds. Wait for the next one and enter all six digits.',
    tone: 'danger',
  },
  INVALID_BACKUP_CODE: {
    title: 'That backup code did not work',
    detail:
      'Each backup code works once. Try the next unused code from your list.',
    tone: 'danger',
  },
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: RATE_LIMITED,
  ACCOUNT_TEMPORARILY_LOCKED: {
    title: 'Account temporarily locked',
    detail:
      'Too many failed verification attempts. For your security this account is locked for a few minutes.',
    tone: 'warning',
  },
  TWO_FACTOR_NOT_ENABLED: {
    title: 'Two-factor is not set up',
    detail: 'Sign in with your email and password to continue.',
    tone: 'warning',
  },
  INVALID_TWO_FACTOR_COOKIE: {
    title: 'Start again from sign-in',
    detail:
      'This verification step expired. Enter your email and password once more.',
    tone: 'warning',
  },
  INVITATION_NOT_FOUND: {
    title: 'This invitation is no longer available',
    detail:
      'It may have expired, been withdrawn, or already been used. Ask for a fresh invitation.',
    tone: 'warning',
  },
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: {
    title: 'This invitation is for someone else',
    detail:
      'It was sent to a different email address. Sign in with that address to accept it.',
    tone: 'warning',
  },
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: {
    title: 'You are already in this workspace',
    detail: 'Nothing to accept — open it from the workspace switcher.',
    tone: 'warning',
  },
  ORGANIZATION_MEMBERSHIP_LIMIT_REACHED: {
    title: 'This workspace is full',
    detail:
      'It has reached its member limit. Ask an owner to free up a seat or upgrade the plan.',
    tone: 'warning',
  },
  EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION: {
    title: 'Confirm your email first',
    detail:
      'Open the confirmation link we emailed you, then return to this invitation.',
    tone: 'warning',
  },
}

/**
 * The one place a failure becomes copy. Rate limiting is checked before the code
 * table because a 429 matters more than whatever the endpoint would have said.
 */
export function describeFailure(failure: AuthFailure): AuthMessage {
  if (failure.status === 429) return RATE_LIMITED
  if (failure.status === 0 && failure.code !== null) return OFFLINE
  if (failure.code !== null) {
    const known = BY_CODE[failure.code]
    if (known) return known
  }
  if (failure.status >= 500) return UNEXPECTED
  if (failure.message.length > 0) {
    return { title: failure.message, detail: '', tone: 'danger' }
  }
  return UNEXPECTED
}

/** Codes that arrive as a `?error=` query param on a callback redirect. */
export function describeCallbackError(code: string): AuthMessage {
  return describeFailure({ code: code.toUpperCase(), status: 400, message: '' })
}
