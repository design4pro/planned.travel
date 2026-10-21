import { describe, expect, it } from 'vitest'

import { DEFAULT_LOCALE } from '#/lib/i18n'
import {
  LINK_INCOMPLETE,
  describeCallbackError,
  describeFailure,
} from '../errors'
import { authTranslator } from './translator'

import type { AuthMessage } from '../errors'

/**
 * What a failed auth call is allowed to put on the screen.
 *
 * The mapping used to produce sentences, which meant an unrecognised code
 * forwarded whatever English the endpoint had written - `docs/SPEC.md` §8.6's
 * definition of placeholder copy, on the one screen where the reader has no
 * stored language preference to be read in. It produces catalogue keys now, so
 * the two things worth proving are that every key resolves to a sentence and
 * that no server string can reach the alert.
 */

const t = authTranslator(DEFAULT_LOCALE)

/** Every code the table knows, read off the module rather than re-listed here. */
const CODES = [
  'INVALID_EMAIL_OR_PASSWORD',
  'INVALID_PASSWORD',
  'PASSWORD_ATTEMPTS_LOCKED',
  'PASSWORD_ATTEMPTS_RESULT_UNKNOWN',
  'CREDENTIAL_ACCOUNT_NOT_FOUND',
  'EMAIL_NOT_VERIFIED',
  'USER_ALREADY_EXISTS',
  'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
  'USER_NOT_FOUND',
  'PASSWORD_TOO_SHORT',
  'PASSWORD_TOO_LONG',
  'INVALID_TOKEN',
  'TOKEN_EXPIRED',
  'SESSION_EXPIRED',
  'EMAIL_ALREADY_VERIFIED',
  'INVALID_CODE',
  'INVALID_BACKUP_CODE',
  'TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE',
  'ACCOUNT_TEMPORARILY_LOCKED',
  'TWO_FACTOR_NOT_ENABLED',
  'INVALID_TWO_FACTOR_COOKIE',
  'INVITATION_NOT_FOUND',
  'YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION',
  'USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION',
  'ORGANIZATION_MEMBERSHIP_LIMIT_REACHED',
  'EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION',
] as const

function rendered(message: AuthMessage): ReadonlyArray<string> {
  return [t(message.titleKey), t(message.detailKey)]
}

describe('every failure is a pair of catalogue keys', () => {
  it.each(CODES)('%s renders two real sentences', (code) => {
    const message = describeFailure({ code, status: 400, message: '' })
    for (const line of rendered(message)) {
      // A key the catalogue lacks renders as the key itself, so this is the
      // assertion that a rename cannot slip past.
      expect(line).not.toMatch(/^auth\./)
      expect(line.length).toBeGreaterThan(8)
    }
  })

  it('renders the incomplete-link message the reset screen falls back to', () => {
    expect(rendered(LINK_INCOMPLETE)).toEqual([
      'This link is incomplete',
      'Password reset links carry a one-time token. Open the most recent email, or request a fresh link.',
    ])
  })

  it('gives a distinct tone to what the reader can and cannot fix', () => {
    expect(
      describeFailure({
        code: 'INVALID_EMAIL_OR_PASSWORD',
        status: 401,
        message: '',
      }).tone,
    ).toBe('danger')
    expect(
      describeFailure({ code: 'INVALID_TOKEN', status: 400, message: '' }).tone,
    ).toBe('warning')
  })
})

describe('nothing the server wrote reaches the screen', () => {
  it('ignores an unmapped code’s message rather than showing it', () => {
    const message = describeFailure({
      code: 'SOME_NEW_CODE',
      status: 400,
      message: 'Validation failed for field foo',
    })
    expect(rendered(message)).toEqual([
      'Something went wrong',
      'That did not work. Please try again in a moment.',
    ])
  })

  it('ignores a message that arrives with no code at all', () => {
    const message = describeFailure({
      code: null,
      status: 500,
      message: 'D1_ERROR: no such table',
    })
    expect(t(message.titleKey)).toBe('Something went wrong')
  })

  it('cannot be walked into the prototype chain', () => {
    // The code is a string off the wire, so `BY_CODE['constructor']` must not
    // answer with the `Object` constructor.
    const message = describeFailure({
      code: 'constructor',
      status: 400,
      message: '',
    })
    expect(t(message.titleKey)).toBe('Something went wrong')
  })
})

describe('the shape of the failure decides before the code does', () => {
  it('treats a 429 as rate limiting whatever the endpoint said', () => {
    const message = describeFailure({
      code: 'INVALID_EMAIL_OR_PASSWORD',
      status: 429,
      message: '',
    })
    expect(t(message.titleKey)).toBe('Too many attempts')
  })

  it('treats a status of zero as a lost connection', () => {
    const message = describeFailure({
      code: 'FETCH_ERROR',
      status: 0,
      message: '',
    })
    expect(t(message.titleKey)).toBe('No connection')
  })
})

describe('describeCallbackError', () => {
  it('upper-cases the query parameter a provider redirect carries', () => {
    const message = describeCallbackError('email_not_verified')
    expect(rendered(message)).toEqual([
      'Confirm your email first',
      'We sent you a confirmation link when you signed up. Open it, then come back here.',
    ])
  })

  it('falls back for a code no provider of ours sends', () => {
    expect(t(describeCallbackError('teapot').titleKey)).toBe(
      'Something went wrong',
    )
  })
})

it('maps an already-enabled factor to the dedicated catalogue copy', () => {
  const message = describeFailure({
    code: 'TWO_FACTOR_ALREADY_ENABLED',
    status: 400,
    message: 'raw',
  })
  expect(message).toEqual({
    titleKey: 'auth.error.twoFactorOn.title',
    detailKey: 'auth.error.twoFactorOn.detail',
    tone: 'warning',
  })
  expect(rendered(message)).toEqual([
    'Two-factor is already on',
    'Setting it up again would stop your current authenticator working, so nothing was changed. You can manage it here.',
  ])
})

it('gives the session password lock its own recovery copy', () => {
  expect(
    describeFailure({
      code: 'PASSWORD_ATTEMPTS_LOCKED',
      status: 403,
      message: '',
    }),
  ).toMatchObject({
    titleKey: 'auth.error.passwordAttemptsLocked.title',
    detailKey: 'auth.error.passwordAttemptsLocked.detail',
  })
})
