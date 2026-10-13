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
const PASSWORD_REQUIRED = 'PASSKEY_PASSWORD_REQUIRED'
const INVALID_PASSWORD = 'PASSKEY_INVALID_PASSWORD'

/** A sentence for the status region, and whether it comes with the Sign in again action. */
export interface PasskeyNotice {
  readonly key: MessageKey
  readonly tone: 'neutral' | 'danger'
  readonly signInAgain: boolean
  /** Heard in the status region but not drawn there: the screen already shows the sentence. */
  readonly quiet?: boolean
}

function notice(
  key: MessageKey,
  tone: PasskeyNotice['tone'],
  signInAgain = false,
): PasskeyNotice {
  return { key, tone, signInAgain }
}

// Keeps the Sign in again action mounted, so a failed sign-out can be tried again and the focused
// button never unmounts under the person.
export const SIGN_OUT_FAILED: PasskeyNotice = {
  key: 'settings.passkeys.error.generic',
  tone: 'danger',
  signInAgain: true,
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

/**
 * A refused removal, and where it is shown. A password refusal belongs to the password field, which
 * takes focus; every other refusal (session not fresh or ended, rate limit, a passkey that is gone,
 * an impersonated session, a dropped connection) is the one alert inside the dialog.
 */
export interface DeleteFailure {
  readonly target: 'password' | 'alert'
  readonly notice: PasskeyNotice
}

export function deleteFailure(failure: AuthFailure): DeleteFailure {
  if (failure.code === PASSWORD_REQUIRED) {
    return {
      target: 'password',
      notice: notice('settings.passkeys.delete.passwordRequired', 'danger'),
    }
  }
  if (failure.code === INVALID_PASSWORD) {
    return {
      target: 'password',
      notice: notice('settings.passkeys.delete.wrongPassword', 'danger'),
    }
  }
  if (failure.code === SESSION_NOT_FRESH) {
    // The session is valid but too old; a different sentence from "your session has ended".
    return {
      target: 'alert',
      notice: notice('settings.passkeys.delete.stale', 'danger', true),
    }
  }
  return {
    target: 'alert',
    notice:
      sharedNotice(failure) ??
      notice('settings.passkeys.delete.failed', 'danger'),
  }
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
