/**
 * The refusal codes the passkey endpoints answer with.
 *
 * One owner with two readers that cannot import each other: the passkey plugin
 * (`src/server/auth/passkey/plugin.ts`) sends them, and the Passkeys screen
 * (`src/routes/_app/-lib/passkey-errors.ts`) branches on them to pick catalogue copy. Static
 * identifiers only, so the browser can import it without reaching a server module. The values are
 * wire strings: renaming one breaks every tab loaded before the deploy.
 */
export const PASSKEY_ERROR_CODES = {
  limitReached: 'PASSKEY_LIMIT_REACHED',
  sessionNotFresh: 'PASSKEY_SESSION_NOT_FRESH',
  impersonated: 'PASSKEY_IMPERSONATED',
  notFound: 'PASSKEY_NOT_FOUND',
  passwordRequired: 'PASSKEY_PASSWORD_REQUIRED',
  invalidPassword: 'PASSKEY_INVALID_PASSWORD',
} as const

export type PasskeyErrorCode =
  (typeof PASSKEY_ERROR_CODES)[keyof typeof PASSKEY_ERROR_CODES]
