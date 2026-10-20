import { describe, expect, it } from 'vitest'
import { backupCodesFile, groupSetupKey, extractSetupKey } from '../two-factor'

describe('two-factor display helpers', () => {
  it('extracts only a valid authenticator secret, rejecting unsafe links', () => {
    expect(
      extractSetupKey('otpauth://totp/planned.travel?secret=ABCDEFGH2345'),
    ).toBe('ABCDEFGH2345')
    expect(() =>
      extractSetupKey('https://example.com/?secret=ABCDEFGH'),
    ).toThrow()
    expect(() =>
      extractSetupKey('otpauth://totp/test?secret=bad%20key'),
    ).toThrow()
    expect(() => extractSetupKey('otpauth://totp/test')).toThrow()
  })
  it('groups the typed key without losing its last characters', () => {
    expect(groupSetupKey('ABCDEFGH23')).toBe('ABCD EFGH 23')
  })
  it('downloads one code per line without prose', () => {
    expect(backupCodesFile(['abcde-fghij', 'klmno-pqrst'])).toBe(
      'abcde-fghij\nklmno-pqrst\n',
    )
  })
})
