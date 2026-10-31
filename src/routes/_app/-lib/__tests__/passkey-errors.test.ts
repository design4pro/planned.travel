import { expect, it } from 'vitest'
import {
  PASSKEY_NOT_FOUND,
  deleteFailure,
  registrationOutcome,
  renameFailureNotice,
} from '../passkey-errors'

it('offers sign-in recovery for a locked password-confirmation session', () => {
  expect(
    deleteFailure({
      code: 'PASSWORD_ATTEMPTS_LOCKED',
      status: 403,
      message: '',
    }),
  ).toEqual({
    target: 'alert',
    notice: {
      key: 'auth.error.passwordAttemptsLocked.detail',
      tone: 'danger',
      signInAgain: true,
    },
  })
})

it('offers sign-in recovery when passkey removal may already have completed', () => {
  expect(
    deleteFailure({
      code: 'PASSWORD_ATTEMPTS_RESULT_UNKNOWN',
      status: 403,
      message: '',
    }),
  ).toMatchObject({
    target: 'alert',
    notice: {
      key: 'auth.error.passwordResultUnknown.detail',
      signInAgain: true,
    },
  })
})

// The strings below are what `/passkey/*` puts on the wire (asserted against the real endpoints in
// `src/server/auth/passkey/__tests__/plugin-endpoints.test.ts`). They are literals on purpose: a
// rename that touches the producer and this screen together must still fail here.
const failure = (code: string, status = 400) => ({ code, status, message: '' })

it('branches on the wire code of each registration refusal', () => {
  expect(
    registrationOutcome({
      ok: false,
      failure: failure('PASSKEY_LIMIT_REACHED'),
    } as Parameters<typeof registrationOutcome>[0]),
  ).toEqual({ kind: 'limit' })
  expect(
    registrationOutcome({
      ok: false,
      failure: failure('PASSKEY_SESSION_NOT_FRESH'),
    } as Parameters<typeof registrationOutcome>[0]),
  ).toMatchObject({
    kind: 'notice',
    notice: { key: 'settings.passkeys.add.stale', signInAgain: true },
  })
  // An impersonated session is deliberately the generic sentence.
  expect(
    registrationOutcome({
      ok: false,
      failure: failure('PASSKEY_IMPERSONATED', 403),
    } as Parameters<typeof registrationOutcome>[0]),
  ).toMatchObject({
    kind: 'notice',
    notice: { key: 'settings.passkeys.add.failed' },
  })
})

it.each([
  [
    'PASSKEY_PASSWORD_REQUIRED',
    'password',
    'settings.passkeys.delete.passwordRequired',
  ],
  [
    'PASSKEY_INVALID_PASSWORD',
    'password',
    'settings.passkeys.delete.wrongPassword',
  ],
  ['PASSKEY_SESSION_NOT_FRESH', 'alert', 'settings.passkeys.delete.stale'],
  ['PASSKEY_IMPERSONATED', 'alert', 'settings.passkeys.delete.failed'],
  ['PASSKEY_NOT_FOUND', 'alert', 'settings.passkeys.delete.failed'],
] as const)(
  'routes the wire code %s to the %s with %s',
  (code, target, key) => {
    expect(deleteFailure(failure(code))).toMatchObject({
      target,
      notice: { key },
    })
  },
)

it('keeps the already-absent removal code stable for the dialog', () => {
  expect(PASSKEY_NOT_FOUND).toBe('PASSKEY_NOT_FOUND')
})

it('names a failed rename generically for refusals other than 401 and 429', () => {
  expect(renameFailureNotice(failure('PASSKEY_IMPERSONATED', 403)).key).toBe(
    'settings.passkeys.rename.failed',
  )
  expect(renameFailureNotice(failure('PASSKEY_NOT_FOUND', 404)).key).toBe(
    'settings.passkeys.rename.failed',
  )
})
