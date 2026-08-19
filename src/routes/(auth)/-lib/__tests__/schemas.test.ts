import { describe, expect, it } from 'vitest'

import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  backupCodeSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  totpSchema,
} from '../schemas'
import { DEFAULT_REDIRECT, loginHrefFor, safeRedirect } from '../redirect'

/** The first issue message for a field, or `undefined` when it validated. */
function issueFor(
  result:
    | { success: true }
    | {
        success: false
        error: { issues: Array<{ path: Array<PropertyKey>; message: string }> }
      },
  field: string,
): string | undefined {
  if (result.success) return undefined
  return result.error.issues.find((issue) => issue.path[0] === field)?.message
}

const STRONG_PASSWORD = 'ferry-to-vis-2027'

describe('loginSchema', () => {
  it('normalises the address so casing and stray spaces cannot split an account', () => {
    const result = loginSchema.safeParse({
      email: '  Alex.Moreau@Example.COM ',
      password: 'anything',
      rememberMe: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('alex.moreau@example.com')
    }
  })

  it('rejects an address that is not an address', () => {
    const result = loginSchema.safeParse({
      email: 'alex.moreau',
      password: 'anything',
      rememberMe: false,
    })
    expect(issueFor(result, 'email')).toBe(
      'That does not look like an email address.',
    )
  })

  it('asks for an address before it complains about its shape', () => {
    const result = loginSchema.safeParse({
      email: '   ',
      password: 'anything',
      rememberMe: false,
    })
    expect(issueFor(result, 'email')).toBe('Enter your email address.')
  })

  it('does not judge the length of an existing password — only the server does', () => {
    const result = loginSchema.safeParse({
      email: 'alex@example.com',
      password: 'a',
      rememberMe: false,
    })
    expect(result.success).toBe(true)
  })

  it('still requires that something was typed', () => {
    const result = loginSchema.safeParse({
      email: 'alex@example.com',
      password: '',
      rememberMe: false,
    })
    expect(issueFor(result, 'password')).toBe('Enter your password.')
  })
})

describe('registerSchema', () => {
  const valid = {
    name: 'Alex Moreau',
    email: 'alex@example.com',
    password: STRONG_PASSWORD,
    confirmPassword: STRONG_PASSWORD,
    acceptTerms: true,
  }

  it('accepts a complete registration', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true)
  })

  it('reports a mismatch against the confirmation field, not the password', () => {
    const result = registerSchema.safeParse({
      ...valid,
      confirmPassword: `${STRONG_PASSWORD}x`,
    })
    expect(issueFor(result, 'confirmPassword')).toBe(
      'Those passwords do not match.',
    )
    expect(issueFor(result, 'password')).toBeUndefined()
  })

  it(`rejects a password under ${MIN_PASSWORD_LENGTH} characters`, () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1)
    const result = registerSchema.safeParse({
      ...valid,
      password: short,
      confirmPassword: short,
    })
    expect(issueFor(result, 'password')).toContain(
      `at least ${MIN_PASSWORD_LENGTH} characters`,
    )
  })

  it(`rejects a password over ${MAX_PASSWORD_LENGTH} characters`, () => {
    const long = 'a'.repeat(MAX_PASSWORD_LENGTH + 1)
    const result = registerSchema.safeParse({
      ...valid,
      password: long,
      confirmPassword: long,
    })
    expect(issueFor(result, 'password')).toContain(
      `under ${MAX_PASSWORD_LENGTH} characters`,
    )
  })

  it('requires the terms checkbox', () => {
    const result = registerSchema.safeParse({ ...valid, acceptTerms: false })
    expect(issueFor(result, 'acceptTerms')).toBe(
      'Please accept the terms to continue.',
    )
  })

  it('requires a name long enough to identify a person', () => {
    const result = registerSchema.safeParse({ ...valid, name: 'A' })
    expect(issueFor(result, 'name')).toContain('Enter your name')
  })

  it('trims the name rather than storing the reader’s stray spaces', () => {
    const result = registerSchema.safeParse({ ...valid, name: '  Alex  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('Alex')
  })
})

describe('resetPasswordSchema', () => {
  it('accepts a matching pair', () => {
    expect(
      resetPasswordSchema.safeParse({
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
      }).success,
    ).toBe(true)
  })

  it('flags the confirmation when the two differ', () => {
    const result = resetPasswordSchema.safeParse({
      password: STRONG_PASSWORD,
      confirmPassword: 'something-else-entirely',
    })
    expect(issueFor(result, 'confirmPassword')).toBe(
      'Those passwords do not match.',
    )
  })

  it('applies the same length floor as registration', () => {
    const short = 'short'
    const result = resetPasswordSchema.safeParse({
      password: short,
      confirmPassword: short,
    })
    expect(issueFor(result, 'password')).toContain(
      `at least ${MIN_PASSWORD_LENGTH} characters`,
    )
  })
})

describe('forgotPasswordSchema and resendVerificationSchema', () => {
  it('both lowercase the address they are given', () => {
    expect(forgotPasswordSchema.parse({ email: 'A@B.COM' }).email).toBe(
      'a@b.com',
    )
    expect(resendVerificationSchema.parse({ email: 'A@B.COM' }).email).toBe(
      'a@b.com',
    )
  })

  it('reject an address over 320 characters', () => {
    const local = 'a'.repeat(320)
    const result = forgotPasswordSchema.safeParse({
      email: `${local}@example.com`,
    })
    expect(issueFor(result, 'email')).toBe('That email address is too long.')
  })
})

describe('totpSchema', () => {
  it('accepts the spaced form every authenticator app displays', () => {
    const result = totpSchema.safeParse({ code: '123 456', trustDevice: false })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.code).toBe('123456')
  })

  it('rejects a five-digit code', () => {
    const result = totpSchema.safeParse({ code: '12345', trustDevice: false })
    expect(issueFor(result, 'code')).toBe('Authenticator codes are six digits.')
  })

  it('rejects six characters that are not all digits', () => {
    const result = totpSchema.safeParse({ code: '12a456', trustDevice: false })
    expect(issueFor(result, 'code')).toBe(
      'Authenticator codes are digits only.',
    )
  })

  it('carries the trust-device choice through untouched', () => {
    const result = totpSchema.safeParse({ code: '000000', trustDevice: true })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.trustDevice).toBe(true)
  })
})

describe('backupCodeSchema', () => {
  it('forgives the dashes and spacing a printed code is read with', () => {
    const result = backupCodeSchema.safeParse({
      code: ' 4f2a-9c1b-7e ',
      trustDevice: false,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.code).toBe('4f2a9c1b7e')
  })

  it('rejects a code that is obviously too short to be one', () => {
    const result = backupCodeSchema.safeParse({
      code: 'abc',
      trustDevice: false,
    })
    expect(issueFor(result, 'code')).toBe('That backup code looks too short.')
  })

  it('rejects a paste that is far too long', () => {
    const result = backupCodeSchema.safeParse({
      code: 'x'.repeat(40),
      trustDevice: false,
    })
    expect(issueFor(result, 'code')).toBe('That backup code looks too long.')
  })
})

describe('safeRedirect', () => {
  it('keeps a same-origin path', () => {
    expect(safeRedirect('/trips/abc/plan')).toBe('/trips/abc/plan')
    expect(safeRedirect('/dashboard?tab=upcoming')).toBe(
      '/dashboard?tab=upcoming',
    )
  })

  it('falls back when there is nothing to honour', () => {
    expect(safeRedirect(undefined)).toBe(DEFAULT_REDIRECT)
    expect(safeRedirect(null)).toBe(DEFAULT_REDIRECT)
    expect(safeRedirect('')).toBe(DEFAULT_REDIRECT)
  })

  it('refuses anything that could leave the origin', () => {
    expect(safeRedirect('https://evil.example/steal')).toBe(DEFAULT_REDIRECT)
    expect(safeRedirect('//evil.example/steal')).toBe(DEFAULT_REDIRECT)
    expect(safeRedirect('/\\evil.example')).toBe(DEFAULT_REDIRECT)
    expect(safeRedirect('javascript:alert(1)')).toBe(DEFAULT_REDIRECT)
    expect(safeRedirect('dashboard')).toBe(DEFAULT_REDIRECT)
  })

  it('refuses a path carrying control characters', () => {
    expect(safeRedirect('/dash\nboard')).toBe(DEFAULT_REDIRECT)
    expect(safeRedirect('/dash board')).toBe(DEFAULT_REDIRECT)
  })

  it('never sends anyone back to sign-in', () => {
    expect(safeRedirect('/login')).toBe(DEFAULT_REDIRECT)
    expect(safeRedirect('/login?redirect=%2Flogin')).toBe(DEFAULT_REDIRECT)
  })
})

describe('loginHrefFor', () => {
  it('omits the parameter when the destination is the default', () => {
    expect(loginHrefFor(DEFAULT_REDIRECT)).toBe('/login')
    expect(loginHrefFor('https://evil.example')).toBe('/login')
  })

  it('encodes the destination it does carry', () => {
    expect(loginHrefFor('/accept-invitation/inv_123')).toBe(
      '/login?redirect=%2Faccept-invitation%2Finv_123',
    )
  })
})
