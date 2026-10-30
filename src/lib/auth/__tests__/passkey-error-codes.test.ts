import { expect, it } from 'vitest'
import { PASSKEY_ERROR_CODES } from '../passkey-error-codes'

// Wire strings, written out: the plugin sends them and the Passkeys screen branches on them, and a
// tab loaded before a deploy still holds the old ones.
it('keeps the wire value of every passkey refusal code', () => {
  expect(PASSKEY_ERROR_CODES).toEqual({
    limitReached: 'PASSKEY_LIMIT_REACHED',
    sessionNotFresh: 'PASSKEY_SESSION_NOT_FRESH',
    impersonated: 'PASSKEY_IMPERSONATED',
    notFound: 'PASSKEY_NOT_FOUND',
    passwordRequired: 'PASSKEY_PASSWORD_REQUIRED',
    invalidPassword: 'PASSKEY_INVALID_PASSWORD',
  })
})
