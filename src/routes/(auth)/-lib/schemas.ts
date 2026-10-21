/**
 * Every form schema on the authentication screens, built in the reader's
 * language.
 *
 * They live together, and apart from the components, for three reasons: the
 * password rules have to agree between sign-up and password reset, the copy in
 * a validation message is product writing that deserves review, and a pure
 * module is cheap to test exhaustively (see `__tests__/schemas.test.ts`).
 *
 * **Why a factory rather than seven module-level constants.** A Zod message is
 * baked into the schema when the schema is constructed, so a module-level schema
 * can only ever carry one language - and these are the screens where the reader
 * uses the visitor cookie or `Accept-Language` without a stored account preference.
 * Taking the bound translator as an argument moves the decision to render time,
 * where the
 * negotiated locale is known, and keeps the module free of React so the tests
 * can drive it with the source catalogue. `docs/SPEC.md` §9 rule 6 covers a
 * validation message exactly as it covers a heading.
 *
 * Bounds mirror `emailAndPassword` in `src/server/auth/index.ts` on purpose
 * rather than by import: that module reaches for `cloudflare:workers`, which
 * cannot be pulled into a browser bundle.
 */
import { z } from 'zod'

import { formatNumber } from '#/lib/format'

import type { Locale, Translate } from '#/lib/i18n'

/** Keep in step with `MIN_PASSWORD_LENGTH` in `src/server/auth/index.ts`. */
export const MIN_PASSWORD_LENGTH = 10
/** Keep in step with `MAX_PASSWORD_LENGTH` in `src/server/auth/index.ts`. */
export const MAX_PASSWORD_LENGTH = 128

/** What a schema needs in order to speak: the translator and its locale. */
export interface SchemaCopy {
  readonly t: Translate
  /** Only used to group the two length figures the messages quote. */
  readonly locale: Locale
}

/**
 * The seven schemas, all sharing one set of field rules so that sign-up and
 * password reset cannot drift apart.
 *
 * The two length messages are plural: `count` picks the CLDR branch and
 * `{value}` carries the figure a reader sees, already grouped by
 * `src/lib/format.ts` - §8's rule on numbers inside messages, which a raw
 * substitution would break in every locale that groups thousands.
 */
export function createAuthSchemas({ t, locale }: SchemaCopy) {
  const minimum = formatNumber(MIN_PASSWORD_LENGTH, locale)
  const maximum = formatNumber(MAX_PASSWORD_LENGTH, locale)

  /** Better Auth stores addresses lowercased; normalise before it has to. */
  const email = z
    .string()
    .trim()
    .min(1, t('auth.validation.emailRequired'))
    .max(320, t('auth.validation.emailTooLong'))
    .toLowerCase()
    .pipe(z.email(t('auth.validation.emailInvalid')))

  const password = z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      t('auth.validation.passwordShort', {
        count: MIN_PASSWORD_LENGTH,
        value: minimum,
      }),
    )
    .max(
      MAX_PASSWORD_LENGTH,
      t('auth.validation.passwordLong', {
        count: MAX_PASSWORD_LENGTH,
        value: maximum,
      }),
    )

  /** Sign-in only checks that something was typed; the server judges the rest. */
  const givenPassword = z.string().min(1, t('auth.validation.passwordRequired'))

  const name = z
    .string()
    .trim()
    .min(2, t('auth.validation.nameShort'))
    .max(80, t('auth.validation.nameTooLong'))

  /**
   * A six-digit authenticator code. Digits are stripped of spaces first, because
   * every authenticator app on earth renders them as `123 456`.
   */
  const totpCode = z
    .string()
    .transform((value) => value.replace(/\s+/g, ''))
    .pipe(
      z
        .string()
        .length(6, t('auth.validation.codeLength'))
        .regex(/^\d{6}$/, t('auth.validation.codeDigits')),
    )

  /**
   * A backup code. Ten characters as issued, but readers paste them with the
   * dashes and spacing they were printed with, so separators are forgiven.
   */
  const backupCode = z
    .string()
    .transform((value) => value.replace(/[\s-]+/g, ''))
    .pipe(
      z
        .string()
        .min(8, t('auth.validation.backupShort'))
        .max(24, t('auth.validation.backupLong')),
    )

  const mismatch = {
    path: ['confirmPassword'],
    error: t('auth.validation.passwordMismatch'),
  }

  return {
    login: z.object({
      email,
      password: givenPassword,
      rememberMe: z.boolean(),
    }),

    register: z
      .object({
        name,
        email,
        password,
        confirmPassword: z.string(),
        acceptTerms: z.boolean().refine((accepted) => accepted, {
          error: t('auth.validation.termsRequired'),
        }),
      })
      .refine((values) => values.password === values.confirmPassword, mismatch),

    forgotPassword: z.object({ email }),

    resetPassword: z
      .object({ password, confirmPassword: z.string() })
      .refine((values) => values.password === values.confirmPassword, mismatch),

    resendVerification: z.object({ email }),

    totp: z.object({ code: totpCode, trustDevice: z.boolean() }),

    backupCode: z.object({ code: backupCode, trustDevice: z.boolean() }),
  } as const
}

/** The seven schemas, as one bag. */
export type AuthSchemas = ReturnType<typeof createAuthSchemas>

export type LoginValues = z.input<AuthSchemas['login']>
export type RegisterValues = z.input<AuthSchemas['register']>
export type ForgotPasswordValues = z.input<AuthSchemas['forgotPassword']>
export type ResetPasswordValues = z.input<AuthSchemas['resetPassword']>
export type ResendVerificationValues = z.input<
  AuthSchemas['resendVerification']
>
export type TotpValues = z.input<AuthSchemas['totp']>
export type BackupCodeValues = z.input<AuthSchemas['backupCode']>
