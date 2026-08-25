/**
 * Turns a failed auth call into copy a person can act on, in their language.
 *
 * Better Auth's own messages are accurate but written for developers ("Invalid
 * token") and written in English by a server that has no idea who is reading.
 * Every code we can actually hit is mapped here onto a pair of catalogue keys
 * instead, and the screen renders them through `t()` - so an Arabic reader who
 * mistypes a password is told so in Arabic (`docs/SPEC.md` §8.6).
 *
 * That is also why the unmapped case no longer forwards `failure.message`. An
 * API string is English by construction, and §8.6 counts an English sentence on
 * a non-English screen as placeholder copy, so an unrecognised code lands on
 * `error.unexpected` and the raw message stays where it is useful: in the
 * network log, not on the page.
 *
 * The pairs are written out as literals rather than composed from a name. A
 * composed key would need a cast to reach `MessageKey`, and the cast is the only
 * thing standing between a renamed catalogue entry and an alert that renders its
 * own key - so the extra column buys a compile error instead.
 */
import type { MessageKey } from '#/lib/i18n'
import type { AuthFailure } from '#/lib/auth/client'

/** A rendered failure: the headline, the quiet line under it, and its weight. */
export interface AuthMessage {
  readonly titleKey: MessageKey
  readonly detailKey: MessageKey
  readonly tone: 'danger' | 'warning'
}

function alert(
  titleKey: MessageKey,
  detailKey: MessageKey,
  tone: AuthMessage['tone'],
): AuthMessage {
  return { titleKey, detailKey, tone }
}

const RATE_LIMITED = alert(
  'auth.error.rateLimited.title',
  'auth.error.rateLimited.detail',
  'warning',
)

const OFFLINE = alert(
  'auth.error.offline.title',
  'auth.error.offline.detail',
  'warning',
)

const UNEXPECTED = alert(
  'auth.error.unexpected.title',
  'auth.error.unexpected.detail',
  'danger',
)

const EMAIL_TAKEN = alert(
  'auth.error.emailTaken.title',
  'auth.error.emailTaken.detail',
  'warning',
)

/** A reset link that arrived with no token at all - a missing code, not a code. */
export const LINK_INCOMPLETE = alert(
  'auth.error.linkIncomplete.title',
  'auth.error.linkIncomplete.detail',
  'warning',
)

const BY_CODE: Record<string, AuthMessage | undefined> = {
  INVALID_EMAIL_OR_PASSWORD: alert(
    'auth.error.credentials.title',
    'auth.error.credentials.detail',
    'danger',
  ),
  INVALID_PASSWORD: alert(
    'auth.error.password.title',
    'auth.error.password.detail',
    'danger',
  ),
  CREDENTIAL_ACCOUNT_NOT_FOUND: alert(
    'auth.error.noPassword.title',
    'auth.error.noPassword.detail',
    'warning',
  ),
  EMAIL_NOT_VERIFIED: alert(
    'auth.error.unverified.title',
    'auth.error.unverified.detail',
    'warning',
  ),
  USER_ALREADY_EXISTS: EMAIL_TAKEN,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: EMAIL_TAKEN,
  USER_NOT_FOUND: alert(
    'auth.error.noAccount.title',
    'auth.error.noAccount.detail',
    'danger',
  ),
  PASSWORD_TOO_SHORT: alert(
    'auth.error.passwordTooShort.title',
    'auth.error.passwordTooShort.detail',
    'danger',
  ),
  PASSWORD_TOO_LONG: alert(
    'auth.error.passwordTooLong.title',
    'auth.error.passwordTooLong.detail',
    'danger',
  ),
  INVALID_TOKEN: alert(
    'auth.error.linkSpent.title',
    'auth.error.linkSpent.detail',
    'warning',
  ),
  TOKEN_EXPIRED: alert(
    'auth.error.linkExpired.title',
    'auth.error.linkExpired.detail',
    'warning',
  ),
  SESSION_EXPIRED: alert(
    'auth.error.sessionExpired.title',
    'auth.error.sessionExpired.detail',
    'warning',
  ),
  EMAIL_ALREADY_VERIFIED: alert(
    'auth.error.alreadyVerified.title',
    'auth.error.alreadyVerified.detail',
    'warning',
  ),
  INVALID_CODE: alert(
    'auth.error.badCode.title',
    'auth.error.badCode.detail',
    'danger',
  ),
  INVALID_BACKUP_CODE: alert(
    'auth.error.badBackupCode.title',
    'auth.error.badBackupCode.detail',
    'danger',
  ),
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: RATE_LIMITED,
  ACCOUNT_TEMPORARILY_LOCKED: alert(
    'auth.error.locked.title',
    'auth.error.locked.detail',
    'warning',
  ),
  TWO_FACTOR_NOT_ENABLED: alert(
    'auth.error.noTwoFactor.title',
    'auth.error.noTwoFactor.detail',
    'warning',
  ),
  INVALID_TWO_FACTOR_COOKIE: alert(
    'auth.error.twoFactorExpired.title',
    'auth.error.twoFactorExpired.detail',
    'warning',
  ),
  INVITATION_NOT_FOUND: alert(
    'auth.error.invitationGone.title',
    'auth.error.invitationGone.detail',
    'warning',
  ),
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: alert(
    'auth.error.invitationOther.title',
    'auth.error.invitationOther.detail',
    'warning',
  ),
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: alert(
    'auth.error.alreadyMember.title',
    'auth.error.alreadyMember.detail',
    'warning',
  ),
  ORGANIZATION_MEMBERSHIP_LIMIT_REACHED: alert(
    'auth.error.workspaceFull.title',
    'auth.error.workspaceFull.detail',
    'warning',
  ),
  EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION: alert(
    'auth.error.verifyBeforeJoin.title',
    'auth.error.verifyBeforeJoin.detail',
    'warning',
  ),
}

/**
 * The one place a failure becomes copy. Rate limiting is checked before the code
 * table because a 429 matters more than whatever the endpoint would have said.
 */
export function describeFailure(failure: AuthFailure): AuthMessage {
  if (failure.status === 429) return RATE_LIMITED
  if (failure.status === 0 && failure.code !== null) return OFFLINE
  if (failure.code !== null) {
    // `Object.hasOwn` rather than indexing: the code arrives off the wire, so
    // `BY_CODE['constructor']` would otherwise answer with a function.
    const known = Object.hasOwn(BY_CODE, failure.code)
      ? BY_CODE[failure.code]
      : undefined
    if (known) return known
  }
  return UNEXPECTED
}

/** Codes that arrive as a `?error=` query param on a callback redirect. */
export function describeCallbackError(code: string): AuthMessage {
  return describeFailure({ code: code.toUpperCase(), status: 400, message: '' })
}
