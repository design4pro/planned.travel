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
