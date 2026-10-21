import { expect, it } from 'vitest'
import { deleteFailure } from '../passkey-errors'

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
