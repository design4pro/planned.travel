/**
 * Every form schema on the authentication screens.
 *
 * They live together, and apart from the components, for three reasons: the
 * password rules have to agree between sign-up and password reset, the copy in
 * a validation message is product writing that deserves review, and a pure
 * schema module is cheap to test exhaustively (see `__tests__/schemas.test.ts`).
 *
 * Bounds mirror `emailAndPassword` in `src/server/auth/index.ts` on purpose
 * rather than by import: that module reaches for `cloudflare:workers`, which
 * cannot be pulled into a browser bundle.
 */
import { z } from 'zod'

/** Keep in step with `MIN_PASSWORD_LENGTH` in `src/server/auth/index.ts`. */
export const MIN_PASSWORD_LENGTH = 10
/** Keep in step with `MAX_PASSWORD_LENGTH` in `src/server/auth/index.ts`. */
export const MAX_PASSWORD_LENGTH = 128

/** Better Auth stores addresses lowercased; normalise before it has to. */
const email = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .max(320, 'That email address is too long.')
  .toLowerCase()
  .pipe(z.email('That does not look like an email address.'))

const password = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `Use at least ${MIN_PASSWORD_LENGTH} characters — a short phrase beats a clever word.`,
  )
  .max(MAX_PASSWORD_LENGTH, `Keep it under ${MAX_PASSWORD_LENGTH} characters.`)

/** Sign-in only checks that something was typed; the server judges the rest. */
const givenPassword = z.string().min(1, 'Enter your password.')

const name = z
  .string()
  .trim()
  .min(2, 'Enter your name, so trip-mates know who you are.')
  .max(80, 'That name is too long.')

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
      .length(6, 'Authenticator codes are six digits.')
      .regex(/^\d{6}$/, 'Authenticator codes are digits only.'),
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
      .min(8, 'That backup code looks too short.')
      .max(24, 'That backup code looks too long.'),
  )

export const loginSchema = z.object({
  email,
  password: givenPassword,
  rememberMe: z.boolean(),
})
export type LoginValues = z.input<typeof loginSchema>

export const registerSchema = z
  .object({
    name,
    email,
    password,
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((accepted) => accepted, {
      error: 'Please accept the terms to continue.',
    }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    error: 'Those passwords do not match.',
  })
export type RegisterValues = z.input<typeof registerSchema>

export const forgotPasswordSchema = z.object({ email })
export type ForgotPasswordValues = z.input<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    error: 'Those passwords do not match.',
  })
export type ResetPasswordValues = z.input<typeof resetPasswordSchema>

export const resendVerificationSchema = z.object({ email })
export type ResendVerificationValues = z.input<typeof resendVerificationSchema>

export const totpSchema = z.object({
  code: totpCode,
  trustDevice: z.boolean(),
})
export type TotpValues = z.input<typeof totpSchema>

export const backupCodeSchema = z.object({
  code: backupCode,
  trustDevice: z.boolean(),
})
export type BackupCodeValues = z.input<typeof backupCodeSchema>
