/**
 * The browser-side half of the auth layer.
 *
 * `src/server/auth` owns the Better Auth instance; this module owns the client
 * that talks to it, plus the two things Better Auth 1.7 cannot do for us:
 *
 * - **Passkeys.** Our WebAuthn support is a first-party server plugin
 *   (`src/server/auth/passkey`), so there is no generated client for it. The
 *   ceremony below drives `navigator.credentials` against those endpoints.
 * - **Failure shapes.** Every screen needs the same three facts about a failed
 *   call — a code to branch on, a status to detect rate limiting, and a message
 *   safe to render — so they are normalised here once.
 *
 * Nothing here imports from `src/server`: this file ships to the browser.
 */
import { createAuthClient } from 'better-auth/react'
import { organizationClient, twoFactorClient } from 'better-auth/client/plugins'

/** Where the Better Auth REST handler is mounted; see `src/routes/api/auth`. */
export const AUTH_BASE_PATH = '/api/auth'

/**
 * Created at module scope, which is safe during SSR: the client falls back to a
 * relative base URL and its session store no-ops without a `window`.
 *
 * `twoFactorClient` is deliberately configured with no redirect target — the
 * screens read `twoFactorRedirect` off the sign-in response and navigate with
 * the router, so a hard `window.location` assignment never races hydration.
 */
export const authClient = createAuthClient({
  basePath: AUTH_BASE_PATH,
  plugins: [twoFactorClient(), organizationClient()],
})

/* ------------------------------------------------------------------ failures */

/** A failed auth call, reduced to what a screen actually branches on. */
export interface AuthFailure {
  /** Better Auth's error code, when it sent one (`INVALID_EMAIL_OR_PASSWORD`…). */
  readonly code: string | null
  /** HTTP status. `429` is how the rate-limit state is detected. */
  readonly status: number
  /** Server-supplied message, already safe to render. Empty when absent. */
  readonly message: string
}

/** The subset of Better Auth's client error object we rely on. */
interface ClientErrorLike {
  code?: string
  message?: string
  status?: number
  statusText?: string
}

export function toAuthFailure(
  error: ClientErrorLike | null | undefined,
): AuthFailure {
  return {
    code:
      typeof error?.code === 'string' && error.code.length > 0
        ? error.code
        : null,
    status: typeof error?.status === 'number' ? error.status : 0,
    message: typeof error?.message === 'string' ? error.message : '',
  }
}

/** A thrown value (network drop, aborted ceremony) reduced to the same shape. */
export function thrownToAuthFailure(cause: unknown): AuthFailure {
  if (cause instanceof Error) {
    return { code: cause.name, status: 0, message: cause.message }
  }
  return { code: null, status: 0, message: '' }
}

/**
 * Whether a sign-in response is asking for a second factor rather than
 * reporting success. Narrowed by hand because the two-factor client plugin
 * contributes its endpoints, not the shape of the sign-in payload.
 */
export function needsTwoFactor(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    'twoFactorRedirect' in data &&
    (data as { twoFactorRedirect?: unknown }).twoFactorRedirect === true
  )
}

/* ------------------------------------------------------------------ passkeys */

function base64UrlEncode(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let binary = ''
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Returns a real `ArrayBuffer` rather than a view, because that is what the
 * WebAuthn `BufferSource` fields want and it avoids a cast at every call site.
 */
function base64UrlToBuffer(value: string): ArrayBuffer {
  const normalised = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalised.padEnd(
    normalised.length + ((4 - (normalised.length % 4)) % 4),
    '=',
  )
  const binary = atob(padded)
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return buffer
}

/** The transports the platform actually understands; anything else is dropped. */
const KNOWN_TRANSPORTS: ReadonlyArray<AuthenticatorTransport> = [
  'ble',
  'hybrid',
  'internal',
  'nfc',
  'usb',
]

function toTransports(
  values: Array<string> | undefined,
): Array<AuthenticatorTransport> | undefined {
  if (!values || values.length === 0) return undefined
  const known = values.filter((value): value is AuthenticatorTransport =>
    KNOWN_TRANSPORTS.includes(value as AuthenticatorTransport),
  )
  return known.length > 0 ? known : undefined
}

/**
 * Whether this browser can complete a WebAuthn assertion at all. Called from an
 * effect rather than during render, so the button appears only on the client and
 * the server-rendered markup never promises an unavailable affordance.
 */
export function isPasskeySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential === 'function' &&
    'credentials' in navigator &&
    typeof navigator.credentials.get === 'function'
  )
}

/**
 * Whether this browser can create a passkey. The enrolment twin of
 * `isPasskeySupported`, and called from an effect for the same reason.
 */
export function isPasskeyEnrolmentSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential === 'function' &&
    'credentials' in navigator &&
    typeof navigator.credentials.create === 'function'
  )
}

interface AuthenticationOptionsResponse {
  challenge: string
  rpId: string
  timeout: number
  userVerification: AuthenticatorSelectionCriteria['userVerification']
  allowCredentials: Array<{
    id: string
    type: 'public-key'
    transports?: Array<string>
  }>
}

function isAuthenticationOptions(
  value: unknown,
): value is AuthenticationOptionsResponse {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.challenge === 'string' &&
    typeof candidate.rpId === 'string' &&
    Array.isArray(candidate.allowCredentials)
  )
}

async function requestAuth(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(`${AUTH_BASE_PATH}${path}`, {
    method,
    credentials: 'include',
    ...(method === 'POST'
      ? {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const record =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)
        : {}
    throw Object.assign(new Error('PasskeyRequestFailed'), {
      authFailure: {
        code: typeof record.code === 'string' ? record.code : null,
        status: response.status,
        message: typeof record.message === 'string' ? record.message : '',
      } satisfies AuthFailure,
    })
  }
  return payload
}

function postToAuth(path: string, body: unknown): Promise<unknown> {
  return requestAuth('POST', path, body)
}

/** Pulls the normalised failure back off a rejection raised by `postToAuth`. */
function passkeyFailure(cause: unknown): AuthFailure {
  if (
    typeof cause === 'object' &&
    cause !== null &&
    'authFailure' in cause &&
    typeof (cause as { authFailure?: unknown }).authFailure === 'object'
  ) {
    return (cause as { authFailure: AuthFailure }).authFailure
  }
  return thrownToAuthFailure(cause)
}

/**
 * `NotAllowedError` covers both "the reader cancelled" and "the ceremony timed
 * out"; neither deserves a red alert on the page.
 */
function isDismissedCeremony(cause: unknown): boolean {
  return (
    cause instanceof DOMException &&
    (cause.name === 'NotAllowedError' || cause.name === 'AbortError')
  )
}

export type PasskeyResult =
  | { readonly ok: true }
  /** The reader dismissed the platform sheet. Not an error worth shouting about. */
  | { readonly ok: false; readonly aborted: true }
  | {
      readonly ok: false
      readonly aborted: false
      readonly failure: AuthFailure
    }

/**
 * Runs a full passkey sign-in: request a challenge, let the authenticator sign
 * it, hand the assertion back for verification. On success the server has set
 * the session cookie, so the caller only has to navigate.
 *
 * `email` is a hint that narrows the allow-list. An unknown address yields an
 * empty list — identical to a discoverable-credential sign-in — so passing one
 * never reveals whether an account exists.
 */
export async function signInWithPasskey(
  email?: string,
): Promise<PasskeyResult> {
  try {
    const options = await postToAuth(
      '/passkey/authenticate/options',
      email && email.length > 0 ? { email } : {},
    )
    if (!isAuthenticationOptions(options)) {
      return {
        ok: false,
        aborted: false,
        failure: { code: null, status: 0, message: '' },
      }
    }

    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: base64UrlToBuffer(options.challenge),
        rpId: options.rpId,
        timeout: options.timeout,
        userVerification: options.userVerification,
        allowCredentials: options.allowCredentials.map((descriptor) => ({
          id: base64UrlToBuffer(descriptor.id),
          type: 'public-key' as const,
          transports: toTransports(descriptor.transports),
        })),
      },
    })

    if (!(credential instanceof PublicKeyCredential)) {
      return { ok: false, aborted: true }
    }
    const assertion = credential.response
    if (!(assertion instanceof AuthenticatorAssertionResponse)) {
      return { ok: false, aborted: true }
    }

    await postToAuth('/passkey/authenticate/verify', {
      credential: {
        id: credential.id,
        rawId: base64UrlEncode(credential.rawId),
        type: 'public-key',
        response: {
          clientDataJSON: base64UrlEncode(assertion.clientDataJSON),
          authenticatorData: base64UrlEncode(assertion.authenticatorData),
          signature: base64UrlEncode(assertion.signature),
          userHandle: assertion.userHandle
            ? base64UrlEncode(assertion.userHandle)
            : null,
        },
      },
    })

    return { ok: true }
  } catch (cause) {
    if (isDismissedCeremony(cause)) return { ok: false, aborted: true }
    return { ok: false, aborted: false, failure: passkeyFailure(cause) }
  }
}

/* ------------------------------------------------------------ passkey management */

/** A passkey as `/passkey/list` and `/passkey/register/verify` return it: never a public key. */
export interface PasskeySummary {
  readonly id: string
  /** `null` until the person names it; the screen shows a display-only fallback. */
  readonly name: string | null
  readonly deviceType: string
  readonly backedUp: boolean
  readonly aaguid: string | null
  /** ISO 8601, as serialised by the endpoint. */
  readonly createdAt: string
  readonly lastUsedAt: string | null
}

function isPasskeySummary(value: unknown): value is PasskeySummary {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    (candidate.name === null || typeof candidate.name === 'string') &&
    typeof candidate.deviceType === 'string' &&
    typeof candidate.backedUp === 'boolean' &&
    typeof candidate.createdAt === 'string' &&
    (candidate.lastUsedAt === null || typeof candidate.lastUsedAt === 'string')
  )
}

const UNKNOWN_FAILURE: AuthFailure = { code: null, status: 0, message: '' }

export type PasskeyListResult =
  | {
      readonly ok: true
      readonly passkeys: ReadonlyArray<PasskeySummary>
      /** A hint for the delete dialog only: `/passkey/delete` decides for itself. */
      readonly requiresPassword: boolean
    }
  | { readonly ok: false; readonly failure: AuthFailure }

/** The signed-in person's passkeys, newest first. */
export async function listPasskeys(): Promise<PasskeyListResult> {
  try {
    const payload = await requestAuth('GET', '/passkey/list')
    const record =
      typeof payload === 'object' && payload !== null
        ? (payload as { passkeys?: unknown; requiresPassword?: unknown })
        : {}
    const { passkeys } = record
    if (!Array.isArray(passkeys) || !passkeys.every(isPasskeySummary)) {
      return { ok: false, failure: UNKNOWN_FAILURE }
    }
    // Anything but an explicit `false` asks for the password: a dialog that asks too much is
    // refused by the server and corrected, one that asks too little is not a dialog at all.
    return {
      ok: true,
      passkeys,
      requiresPassword: record.requiresPassword !== false,
    }
  } catch (cause) {
    return { ok: false, failure: passkeyFailure(cause) }
  }
}

export type PasskeyRenameResult =
  | { readonly ok: true; readonly passkey: PasskeySummary }
  | { readonly ok: false; readonly failure: AuthFailure }

/** Names a passkey, or changes its name. The server trims; it never accepts an empty name. */
export async function renamePasskey(
  id: string,
  name: string,
): Promise<PasskeyRenameResult> {
  try {
    const payload = await postToAuth('/passkey/rename', { id, name })
    const passkey =
      typeof payload === 'object' && payload !== null
        ? (payload as { passkey?: unknown }).passkey
        : undefined
    if (!isPasskeySummary(passkey)) {
      return { ok: false, failure: UNKNOWN_FAILURE }
    }
    return { ok: true, passkey }
  } catch (cause) {
    return { ok: false, failure: passkeyFailure(cause) }
  }
}

export type PasskeyDeleteResult =
  { readonly ok: true } | { readonly ok: false; readonly failure: AuthFailure }

/**
 * Removes a passkey. `password` is sent only when the screen asked for one; the server decides
 * whether the account needs it and refuses with a code when it does and none came.
 */
export async function deletePasskey(
  id: string,
  password?: string,
): Promise<PasskeyDeleteResult> {
  try {
    const payload = await postToAuth(
      '/passkey/delete',
      password === undefined ? { id } : { id, password },
    )
    const deleted =
      typeof payload === 'object' && payload !== null
        ? (payload as { deleted?: unknown }).deleted
        : undefined
    if (deleted !== true) return { ok: false, failure: UNKNOWN_FAILURE }
    return { ok: true }
  } catch (cause) {
    return { ok: false, failure: passkeyFailure(cause) }
  }
}

interface RegistrationOptionsResponse {
  challenge: string
  rp: PublicKeyCredentialRpEntity
  user: { id: string; name: string; displayName: string }
  pubKeyCredParams: Array<PublicKeyCredentialParameters>
  timeout: number
  attestation: AttestationConveyancePreference
  excludeCredentials: Array<{
    id: string
    type: 'public-key'
    transports?: Array<string>
  }>
  authenticatorSelection: AuthenticatorSelectionCriteria
}

function isRegistrationOptions(
  value: unknown,
): value is RegistrationOptionsResponse {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  const user = candidate.user as Record<string, unknown> | undefined
  const rp = candidate.rp as Record<string, unknown> | undefined
  return (
    typeof candidate.challenge === 'string' &&
    typeof rp?.name === 'string' &&
    typeof user?.id === 'string' &&
    typeof user.name === 'string' &&
    typeof user.displayName === 'string' &&
    Array.isArray(candidate.pubKeyCredParams) &&
    Array.isArray(candidate.excludeCredentials)
  )
}

export type PasskeyRegistrationResult =
  | { readonly ok: true; readonly passkey: PasskeySummary }
  /** The reader dismissed the platform sheet, or it timed out. */
  | { readonly ok: false; readonly aborted: true }
  | {
      readonly ok: false
      readonly aborted: false
      /** The device already holds a passkey for this account (`excludeCredentials` matched). */
      readonly alreadyEnrolled: boolean
      readonly failure?: AuthFailure
    }

/**
 * Adds a passkey on this device: request a challenge, let the authenticator
 * create the credential, hand the attestation back for verification.
 *
 * The ceremony runs without a name. A passkey starts unnamed and the screen
 * shows a display-only fallback; nothing the screen invents is ever sent here.
 */
export async function registerPasskey(): Promise<PasskeyRegistrationResult> {
  try {
    const options = await postToAuth('/passkey/register/options', {})
    if (!isRegistrationOptions(options)) {
      return {
        ok: false,
        aborted: false,
        alreadyEnrolled: false,
        failure: UNKNOWN_FAILURE,
      }
    }

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: base64UrlToBuffer(options.challenge),
        rp: options.rp,
        user: {
          id: base64UrlToBuffer(options.user.id),
          name: options.user.name,
          displayName: options.user.displayName,
        },
        pubKeyCredParams: options.pubKeyCredParams,
        timeout: options.timeout,
        attestation: options.attestation,
        authenticatorSelection: options.authenticatorSelection,
        excludeCredentials: options.excludeCredentials.map((descriptor) => ({
          id: base64UrlToBuffer(descriptor.id),
          type: 'public-key' as const,
          transports: toTransports(descriptor.transports),
        })),
      },
    })

    if (!(credential instanceof PublicKeyCredential)) {
      return { ok: false, aborted: true }
    }
    const attestation = credential.response
    if (!(attestation instanceof AuthenticatorAttestationResponse)) {
      return { ok: false, aborted: true }
    }

    const transports = attestation.getTransports()
    const verified = await postToAuth('/passkey/register/verify', {
      credential: {
        id: credential.id,
        rawId: base64UrlEncode(credential.rawId),
        type: 'public-key',
        response: {
          clientDataJSON: base64UrlEncode(attestation.clientDataJSON),
          attestationObject: base64UrlEncode(attestation.attestationObject),
          ...(transports.length > 0 ? { transports } : {}),
        },
      },
    })

    const passkey =
      typeof verified === 'object' && verified !== null
        ? (verified as { passkey?: unknown }).passkey
        : undefined
    if (!isPasskeySummary(passkey)) {
      return {
        ok: false,
        aborted: false,
        alreadyEnrolled: false,
        failure: UNKNOWN_FAILURE,
      }
    }
    return { ok: true, passkey }
  } catch (cause) {
    if (isDismissedCeremony(cause)) return { ok: false, aborted: true }
    if (cause instanceof DOMException && cause.name === 'InvalidStateError') {
      return { ok: false, aborted: false, alreadyEnrolled: true }
    }
    return {
      ok: false,
      aborted: false,
      alreadyEnrolled: false,
      failure: passkeyFailure(cause),
    }
  }
}
