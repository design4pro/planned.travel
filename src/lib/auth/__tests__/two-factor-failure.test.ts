import { expect, it } from 'vitest'
import { toAuthFailure } from '../client'

it('surfaces the already-enabled refusal code from the auth client', () => {
  expect(
    toAuthFailure({
      code: 'TWO_FACTOR_ALREADY_ENABLED',
      status: 400,
      message: 'Already enabled',
    }),
  ).toEqual({
    code: 'TWO_FACTOR_ALREADY_ENABLED',
    status: 400,
    message: 'Already enabled',
  })
})

it('preserves the session password lock code and non-rate-limit status', () => {
  expect(
    toAuthFailure({ code: 'PASSWORD_ATTEMPTS_LOCKED', status: 403 }),
  ).toMatchObject({ code: 'PASSWORD_ATTEMPTS_LOCKED', status: 403 })
})
