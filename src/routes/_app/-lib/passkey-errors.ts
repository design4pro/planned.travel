/**
 * Turns a failed passkey call into copy a person can act on, in their language.
 *
 * The passkey endpoints answer with a stable `code` next to an English `message`, and the screen
 * branches on the code: the message is for the network log and is never rendered, because an
 * English sentence on a Polish screen is placeholder copy (`docs/SPEC.md` §9). Modelled on
 * `src/routes/(auth)/-lib/errors.ts`, and written out as literals for the same reason: a composed
 * key needs a cast to reach `MessageKey`, and the cast is what hides a renamed catalogue entry.
 */
import type { AuthFailure, PasskeyRegistrationResult } from '#/lib/auth/client'
import type { MessageKey } from '#/lib/i18n'

/** Codes `src/server/auth/passkey/plugin.ts` answers with. */
const LIMIT_REACHED = 'PASSKEY_LIMIT_REACHED'
const SESSION_NOT_FRESH = 'PASSKEY_SESSION_NOT_FRESH'

/** A sentence for the status region, and whether it comes with the Sign in again action. */
export interface PasskeyNotice {
  readonly key: MessageKey
  readonly tone: 'neutral' | 'danger'
  readonly signInAgain: boolean
}

function notice(
  key: MessageKey,
  tone: PasskeyNotice['tone'],
  signInAgain = false,
): PasskeyNotice {
  return { key, tone, signInAgain }
}

/** What went wrong with a request that is not the ceremony itself, by status. */
function sharedNotice(failure: AuthFailure): PasskeyNotice | null {
  // The session is gone: nothing here can succeed until the person signs in again.
  if (failure.status === 401) {
    return notice('settings.passkeys.error.sessionEnded', 'danger', true)
  }
  if (failure.status === 429) {
    return notice('settings.passkeys.error.rateLimited', 'danger')
  }
  return null
}

/**
 * The reason a passkey list did not load. Always a sentence of advice: the Alert's title already
 * says what failed. A `401` swaps the Try again action for Sign in again.
 */
export function loadFailureNotice(failure: AuthFailure): PasskeyNotice {
  return (
    sharedNotice(failure) ?? notice('settings.passkeys.error.generic', 'danger')
  )
}

/**
 * Why a name was not saved. A `401` and a `429` say so by name, as everywhere on this screen;
 * anything else (a refused or impersonated session, a passkey that is gone, a dropped connection)
 * is the one sentence "The name was not saved".
 */
export function renameFailureNotice(failure: AuthFailure): PasskeyNotice {
  return (
    sharedNotice(failure) ?? notice('settings.passkeys.rename.failed', 'danger')
  )
}

/** The outcome of a registration that did not add a passkey. */
export type RegistrationOutcome =
  /** The account is at the ceiling: a standing line beside the button, not a passing message. */
  | { readonly kind: 'limit' }
  | { readonly kind: 'notice'; readonly notice: PasskeyNotice }

export function registrationOutcome(
  result: Exclude<PasskeyRegistrationResult, { ok: true }>,
): RegistrationOutcome {
  if (result.aborted) {
    return {
      kind: 'notice',
      notice: notice('settings.passkeys.add.dismissed', 'neutral'),
    }
  }
  if (result.alreadyEnrolled) {
    return {
      kind: 'notice',
      notice: notice('settings.passkeys.add.exists', 'danger'),
    }
  }

  const { failure } = result
  if (failure?.code === LIMIT_REACHED) return { kind: 'limit' }
  if (failure?.code === SESSION_NOT_FRESH) {
    // The session is valid but too old; a different sentence from "your session has ended".
    return {
      kind: 'notice',
      notice: notice('settings.passkeys.add.stale', 'danger', true),
    }
  }
  return {
    kind: 'notice',
    notice:
      (failure ? sharedNotice(failure) : null) ??
      notice('settings.passkeys.add.failed', 'danger'),
  }
}
