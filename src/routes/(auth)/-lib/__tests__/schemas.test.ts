import { describe, expect, it } from 'vitest'

import { DEFAULT_LOCALE, plural } from '#/lib/i18n'
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  createAuthSchemas,
} from '../schemas'
import { DEFAULT_REDIRECT, loginHrefFor, safeRedirect } from '../redirect'
import { authTranslator } from './translator'

/**
 * The schemas are a factory over a translator now, so this file exercises them
 * the way a screen does: with the shipped `en` catalogue bound to a locale.
 *
 * The English assertions are still the point - this is the source locale, and
 * every message below is what a reader actually sees - but two of them are worth
 * more than they look. A key the catalogue does not carry would render as the key
 * itself rather than as a sentence, so asserting the sentence is what proves the
 * key exists; and the two length messages are plural, so the locale is what
 * selects the branch. The Polish case at the bottom proves that branch selection
 * is real rather than incidental to English having only two forms.
 */

const schemas = createAuthSchemas({
  t: authTranslator(DEFAULT_LOCALE),
  locale: DEFAULT_LOCALE,
})

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

describe('login', () => {
  it('normalises the address so casing and stray spaces cannot split an account', () => {
    const result = schemas.login.safeParse({
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
    const result = schemas.login.safeParse({
      email: 'alex.moreau',
      password: 'anything',
      rememberMe: false,
    })
    expect(issueFor(result, 'email')).toBe(
      'That does not look like an email address.',
    )
  })

  it('asks for an address before it complains about its shape', () => {
    const result = schemas.login.safeParse({
      email: '   ',
      password: 'anything',
      rememberMe: false,
    })
    expect(issueFor(result, 'email')).toBe('Enter your email address.')
  })

  it('does not judge the length of an existing password — only the server does', () => {
    const result = schemas.login.safeParse({
      email: 'alex@example.com',
      password: 'a',
      rememberMe: false,
    })
    expect(result.success).toBe(true)
  })

  it('still requires that something was typed', () => {
    const result = schemas.login.safeParse({
      email: 'alex@example.com',
      password: '',
      rememberMe: false,
    })
    expect(issueFor(result, 'password')).toBe('Enter your password.')
  })
})

describe('register', () => {
  const valid = {
    name: 'Alex Moreau',
    email: 'alex@example.com',
    password: STRONG_PASSWORD,
    confirmPassword: STRONG_PASSWORD,
    acceptTerms: true,
  }

  it('accepts a complete registration', () => {
    expect(schemas.register.safeParse(valid).success).toBe(true)
  })

  it('reports a mismatch against the confirmation field, not the password', () => {
    const result = schemas.register.safeParse({
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
    const result = schemas.register.safeParse({
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
    const result = schemas.register.safeParse({
      ...valid,
      password: long,
      confirmPassword: long,
    })
    expect(issueFor(result, 'password')).toContain(
      `under ${MAX_PASSWORD_LENGTH} characters`,
    )
  })

  it('requires the terms checkbox', () => {
    const result = schemas.register.safeParse({ ...valid, acceptTerms: false })
    expect(issueFor(result, 'acceptTerms')).toBe(
      'Please accept the terms to continue.',
    )
  })

  it('requires a name long enough to identify a person', () => {
    const result = schemas.register.safeParse({ ...valid, name: 'A' })
    expect(issueFor(result, 'name')).toContain('Enter your name')
  })

  it('trims the name rather than storing the reader’s stray spaces', () => {
    const result = schemas.register.safeParse({ ...valid, name: '  Alex  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('Alex')
  })
})

describe('resetPassword', () => {
  it('accepts a matching pair', () => {
    expect(
      schemas.resetPassword.safeParse({
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
      }).success,
    ).toBe(true)
  })

  it('flags the confirmation when the two differ', () => {
    const result = schemas.resetPassword.safeParse({
      password: STRONG_PASSWORD,
      confirmPassword: 'something-else-entirely',
    })
    expect(issueFor(result, 'confirmPassword')).toBe(
      'Those passwords do not match.',
    )
  })

  it('applies the same length floor as registration', () => {
    const short = 'short'
    const result = schemas.resetPassword.safeParse({
      password: short,
      confirmPassword: short,
    })
    expect(issueFor(result, 'password')).toContain(
      `at least ${MIN_PASSWORD_LENGTH} characters`,
    )
  })
})

describe('forgotPassword and resendVerification', () => {
  it('both lowercase the address they are given', () => {
    expect(schemas.forgotPassword.parse({ email: 'A@B.COM' }).email).toBe(
      'a@b.com',
    )
    expect(schemas.resendVerification.parse({ email: 'A@B.COM' }).email).toBe(
      'a@b.com',
    )
  })

  it('reject an address over 320 characters', () => {
    const local = 'a'.repeat(320)
    const result = schemas.forgotPassword.safeParse({
      email: `${local}@example.com`,
    })
    expect(issueFor(result, 'email')).toBe('That email address is too long.')
  })
})

describe('totp', () => {
  it('accepts the spaced form every authenticator app displays', () => {
    const result = schemas.totp.safeParse({
      code: '123 456',
      trustDevice: false,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.code).toBe('123456')
  })

  it('rejects a five-digit code', () => {
    const result = schemas.totp.safeParse({ code: '12345', trustDevice: false })
    expect(issueFor(result, 'code')).toBe('Authenticator codes are six digits.')
  })

  it('rejects six characters that are not all digits', () => {
    const result = schemas.totp.safeParse({ code: '12a456', trustDevice: false })
    expect(issueFor(result, 'code')).toBe(
      'Authenticator codes are digits only.',
    )
  })

  it('carries the trust-device choice through untouched', () => {
    const result = schemas.totp.safeParse({ code: '000000', trustDevice: true })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.trustDevice).toBe(true)
  })
})

describe('backupCode', () => {
  it('forgives the dashes and spacing a printed code is read with', () => {
    const result = schemas.backupCode.safeParse({
      code: ' 4f2a-9c1b-7e ',
      trustDevice: false,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.code).toBe('4f2a9c1b7e')
  })

  it('rejects a code that is obviously too short to be one', () => {
    const result = schemas.backupCode.safeParse({
      code: 'abc',
      trustDevice: false,
    })
    expect(issueFor(result, 'code')).toBe('That backup code looks too short.')
  })

  it('rejects a paste that is far too long', () => {
    const result = schemas.backupCode.safeParse({
      code: 'x'.repeat(40),
      trustDevice: false,
    })
    expect(issueFor(result, 'code')).toBe('That backup code looks too long.')
  })
})

describe('the messages follow the reader, not the module', () => {
  /**
   * A stand-in Polish catalogue - four keys, not a translation, which
   * `messages/pl/` will own. What it proves is the seam: the same schema factory
   * produces a different sentence for a different reader, which a module-level
   * schema could not do, and it picks the CLDR branch that locale asks for
   * rather than English's.
   */
  const pl = {
    'validation.emailRequired': 'Podaj swój adres e-mail.',
    'validation.emailTooLong': 'Ten adres jest za długi.',
    'validation.emailInvalid': 'To nie wygląda na adres e-mail.',
    'validation.passwordShort': {
      one: 'Użyj co najmniej {value} znaku.',
      few: 'Użyj co najmniej {value} znaków.',
      many: 'Użyj co najmniej {value} znaków — krótka fraza bije sprytne słowo.',
      other: 'Użyj co najmniej {value} znaku.',
    },
  }

  const polish = createAuthSchemas({
    t: authTranslator('pl', pl),
    locale: 'pl',
  })

  it('reports a missing address in the reader’s language', () => {
    const result = polish.forgotPassword.safeParse({ email: '' })
    expect(issueFor(result, 'email')).toBe('Podaj swój adres e-mail.')
  })

  it('selects the plural branch the locale asks for', () => {
    // Ten is `many` in Polish and `other` in English: the same message, two
    // branches, chosen by the locale rather than by the author.
    expect(plural('pl', MIN_PASSWORD_LENGTH)).toBe('many')
    const result = polish.resetPassword.safeParse({
      password: 'krótkie',
      confirmPassword: 'krótkie',
    })
    expect(issueFor(result, 'password')).toBe(
      `Użyj co najmniej ${MIN_PASSWORD_LENGTH} znaków — krótka fraza bije sprytne słowo.`,
    )
  })

  it('renders no raw key, in either locale', () => {
    const keyish = /^auth\./
    const english = schemas.forgotPassword.safeParse({ email: 'nope' })
    expect(issueFor(english, 'email')).not.toMatch(keyish)
    const missing = createAuthSchemas({
      t: authTranslator('en', { 'validation.emailInvalid': 'Not an address.' }),
      locale: 'en',
    })
    // A key the catalogue lacks renders as the key, never as English - which is
    // exactly why the assertions above are written against whole sentences.
    expect(
      issueFor(missing.forgotPassword.safeParse({ email: '' }), 'email'),
    ).toBe('auth.validation.emailRequired')
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
    expect(safeRedirect('/dash board')).toBe(DEFAULT_REDIRECT)
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
