/**
 * WebAuthn (Level 3) relying-party verification, implemented against WebCrypto
 * so it runs unchanged on Workers.
 *
 * Scope: passkeys, i.e. `attestation: "none"`. The attestation *statement* is
 * therefore not verified — there is nothing to verify — but every other
 * relying-party check from §7.1 and §7.2 of the specification is enforced:
 * ceremony type, challenge, origin, RP ID hash, user-presence and
 * user-verification flags, algorithm allow-list and signature-counter
 * regression.
 */
import { asCborMap, decodeCbor, decodeCborStrict, requireBytes } from './cbor'
import {
  base64UrlDecode,
  base64UrlEncode,
  bytesEqual,
  concatBytes,
  sha256,
  utf8Decode,
  utf8Encode,
} from './bytes'
import { coseAlgorithm, isSupportedCoseAlgorithm, verifyCoseSignature } from './cose'

export class WebAuthnError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebAuthnError'
  }
}

export type AuthenticatorFlags = {
  userPresent: boolean
  userVerified: boolean
  backupEligible: boolean
  backupState: boolean
  attestedCredentialData: boolean
  extensionData: boolean
}

export type ParsedAuthenticatorData = {
  rpIdHash: Uint8Array
  flags: AuthenticatorFlags
  signCount: number
  aaguid: Uint8Array | null
  credentialId: Uint8Array | null
  credentialPublicKey: Uint8Array | null
}

export type ParsedClientData = {
  type: string
  challenge: string
  origin: string
  crossOrigin: boolean
}

/** Parses the fixed-layout authenticator data structure (spec §6.1). */
export function parseAuthenticatorData(
  bytes: Uint8Array,
): ParsedAuthenticatorData {
  if (bytes.length < 37) {
    throw new WebAuthnError('Authenticator data is too short.')
  }

  const rpIdHash = bytes.subarray(0, 32)
  const flagByte = bytes[32]
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const signCount = view.getUint32(33, false)

  const flags: AuthenticatorFlags = {
    userPresent: (flagByte & 0x01) !== 0,
    userVerified: (flagByte & 0x04) !== 0,
    backupEligible: (flagByte & 0x08) !== 0,
    backupState: (flagByte & 0x10) !== 0,
    attestedCredentialData: (flagByte & 0x40) !== 0,
    extensionData: (flagByte & 0x80) !== 0,
  }

  if (!flags.attestedCredentialData) {
    return {
      rpIdHash,
      flags,
      signCount,
      aaguid: null,
      credentialId: null,
      credentialPublicKey: null,
    }
  }

  if (bytes.length < 55) {
    throw new WebAuthnError('Attested credential data is truncated.')
  }
  const aaguid = bytes.subarray(37, 53)
  const credentialIdLength = view.getUint16(53, false)
  const credentialIdEnd = 55 + credentialIdLength
  if (bytes.length < credentialIdEnd) {
    throw new WebAuthnError('Credential id is truncated.')
  }
  const credentialId = bytes.subarray(55, credentialIdEnd)

  // The COSE key may be followed by extension data, so decode one item and let
  // its own length tell us where the key ends.
  const remaining = bytes.subarray(credentialIdEnd)
  const { bytesRead } = decodeCbor(remaining)
  const credentialPublicKey = remaining.subarray(0, bytesRead)

  return {
    rpIdHash,
    flags,
    signCount,
    aaguid,
    credentialId,
    credentialPublicKey,
  }
}

/** Parses and shape-checks `clientDataJSON`. */
export function parseClientData(bytes: Uint8Array): ParsedClientData {
  let parsed: unknown
  try {
    parsed = JSON.parse(utf8Decode(bytes))
  } catch {
    throw new WebAuthnError('Client data is not valid JSON.')
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new WebAuthnError('Client data is not an object.')
  }
  const record = parsed as Record<string, unknown>
  const { type, challenge, origin, crossOrigin } = record
  if (
    typeof type !== 'string' ||
    typeof challenge !== 'string' ||
    typeof origin !== 'string'
  ) {
    throw new WebAuthnError('Client data is missing required fields.')
  }
  return {
    type,
    challenge,
    origin,
    crossOrigin: crossOrigin === true,
  }
}

/**
 * Whether `origin` is one of `trusted`. An entry is an exact origin, or `scheme://host:*`, which
 * `trustedOrigins()` writes in development because `vite dev` moves to the next free port. The
 * wildcard covers the port only: scheme and hostname are compared as parsed URL parts, never as
 * a prefix, so `http://localhost.evil.com:3000` does not match `http://localhost:*`.
 */
function isTrustedOrigin(
  origin: string,
  trusted: ReadonlyArray<string>,
): boolean {
  if (trusted.includes(origin)) return true
  const wildcards = trusted.filter((entry) =>
    /^[a-z]+:\/\/[a-z0-9.-]+:\*$/.test(entry),
  )
  if (wildcards.length === 0) return false

  let candidate: URL
  try {
    candidate = new URL(origin)
  } catch {
    return false
  }
  // `URL` keeps userinfo out of the origin; an origin that carries any is not one.
  if (candidate.origin === 'null' || candidate.username || candidate.password) {
    return false
  }
  // A browser always sends the serialised origin, so anything that parses to something else
  // (a path, an upper-case host, an alternative host spelling) is not one.
  if (candidate.origin !== origin) return false
  return wildcards.some((entry) => {
    const pattern = new URL(entry.replace(/:\*$/, ''))
    return (
      pattern.protocol === candidate.protocol &&
      pattern.hostname === candidate.hostname
    )
  })
}

/** Enforces the ceremony type, challenge and origin checks. */
export function assertClientData(
  clientData: ParsedClientData,
  expected: {
    type: 'webauthn.create' | 'webauthn.get'
    challenge: string
    origins: ReadonlyArray<string>
  },
): void {
  if (clientData.type !== expected.type) {
    throw new WebAuthnError('Unexpected WebAuthn ceremony type.')
  }
  if (
    !bytesEqual(
      utf8Encode(clientData.challenge),
      utf8Encode(expected.challenge),
    )
  ) {
    throw new WebAuthnError('WebAuthn challenge did not match.')
  }
  if (!isTrustedOrigin(clientData.origin, expected.origins)) {
    throw new WebAuthnError('WebAuthn origin is not trusted.')
  }
  if (clientData.crossOrigin) {
    throw new WebAuthnError('Cross-origin WebAuthn ceremonies are not allowed.')
  }
}

async function assertRelyingParty(
  authenticatorData: ParsedAuthenticatorData,
  relyingPartyId: string,
): Promise<void> {
  const expected = await sha256(utf8Encode(relyingPartyId))
  if (!bytesEqual(authenticatorData.rpIdHash, expected)) {
    throw new WebAuthnError('WebAuthn relying-party id did not match.')
  }
  if (!authenticatorData.flags.userPresent) {
    throw new WebAuthnError('Authenticator did not confirm user presence.')
  }
}

export type RegistrationCredential = {
  id: string
  rawId: string
  type: string
  response: {
    clientDataJSON: string
    attestationObject: string
    transports?: Array<string>
  }
}

export type VerifiedRegistration = {
  credentialId: string
  publicKey: string
  algorithm: number
  signCount: number
  aaguid: string | null
  backedUp: boolean
  deviceType: 'singleDevice' | 'multiDevice'
  transports: Array<string>
  userVerified: boolean
}

/** Verifies a registration ceremony and returns the credential to persist. */
export async function verifyRegistration(input: {
  credential: RegistrationCredential
  expectedChallenge: string
  expectedOrigins: ReadonlyArray<string>
  relyingPartyId: string
  requireUserVerification: boolean
}): Promise<VerifiedRegistration> {
  const { credential } = input
  if (credential.type !== 'public-key') {
    throw new WebAuthnError('Unexpected credential type.')
  }

  const clientData = parseClientData(
    base64UrlDecode(credential.response.clientDataJSON),
  )
  assertClientData(clientData, {
    type: 'webauthn.create',
    challenge: input.expectedChallenge,
    origins: input.expectedOrigins,
  })

  const attestation = asCborMap(
    decodeCborStrict(base64UrlDecode(credential.response.attestationObject)),
    'attestation object',
  )
  const authenticatorData = parseAuthenticatorData(
    requireBytes(attestation, 'authData', 'attestation authData'),
  )
  await assertRelyingParty(authenticatorData, input.relyingPartyId)

  if (input.requireUserVerification && !authenticatorData.flags.userVerified) {
    throw new WebAuthnError('Authenticator did not verify the user.')
  }
  if (!authenticatorData.credentialId || !authenticatorData.credentialPublicKey) {
    throw new WebAuthnError('Authenticator returned no credential data.')
  }

  const algorithm = coseAlgorithm(authenticatorData.credentialPublicKey)
  if (!isSupportedCoseAlgorithm(algorithm)) {
    throw new WebAuthnError('Authenticator used an unsupported algorithm.')
  }

  // rawId is what the browser will send back on assertion; it must agree with
  // the credential id the authenticator signed over.
  if (
    !bytesEqual(base64UrlDecode(credential.rawId), authenticatorData.credentialId)
  ) {
    throw new WebAuthnError('Credential id did not match attested data.')
  }

  return {
    credentialId: base64UrlEncode(authenticatorData.credentialId),
    publicKey: base64UrlEncode(authenticatorData.credentialPublicKey),
    algorithm,
    signCount: authenticatorData.signCount,
    aaguid: authenticatorData.aaguid
      ? formatAaguid(authenticatorData.aaguid)
      : null,
    backedUp: authenticatorData.flags.backupState,
    deviceType: authenticatorData.flags.backupEligible
      ? 'multiDevice'
      : 'singleDevice',
    transports: (credential.response.transports ?? []).filter(
      (transport) => typeof transport === 'string',
    ),
    userVerified: authenticatorData.flags.userVerified,
  }
}

export type AuthenticationCredential = {
  id: string
  rawId: string
  type: string
  response: {
    clientDataJSON: string
    authenticatorData: string
    signature: string
    userHandle?: string | null
  }
}

export type VerifiedAuthentication = {
  signCount: number
  userVerified: boolean
  backedUp: boolean
}

/** Verifies an authentication ceremony against a stored credential. */
export async function verifyAuthentication(input: {
  credential: AuthenticationCredential
  storedPublicKey: string
  storedSignCount: number
  expectedChallenge: string
  expectedOrigins: ReadonlyArray<string>
  relyingPartyId: string
  requireUserVerification: boolean
}): Promise<VerifiedAuthentication> {
  const { credential } = input
  if (credential.type !== 'public-key') {
    throw new WebAuthnError('Unexpected credential type.')
  }

  const clientDataBytes = base64UrlDecode(credential.response.clientDataJSON)
  assertClientData(parseClientData(clientDataBytes), {
    type: 'webauthn.get',
    challenge: input.expectedChallenge,
    origins: input.expectedOrigins,
  })

  const authenticatorDataBytes = base64UrlDecode(
    credential.response.authenticatorData,
  )
  const authenticatorData = parseAuthenticatorData(authenticatorDataBytes)
  await assertRelyingParty(authenticatorData, input.relyingPartyId)

  if (input.requireUserVerification && !authenticatorData.flags.userVerified) {
    throw new WebAuthnError('Authenticator did not verify the user.')
  }

  const signedData = concatBytes(
    authenticatorDataBytes,
    await sha256(clientDataBytes),
  )
  const verified = await verifyCoseSignature({
    publicKey: base64UrlDecode(input.storedPublicKey),
    signature: base64UrlDecode(credential.response.signature),
    signedData,
  })
  if (!verified) throw new WebAuthnError('WebAuthn signature was invalid.')

  // A counter that fails to advance means the credential was cloned. Some
  // authenticators legitimately keep the counter at zero and are exempt.
  if (
    authenticatorData.signCount !== 0 &&
    authenticatorData.signCount <= input.storedSignCount
  ) {
    throw new WebAuthnError('Authenticator signature counter did not advance.')
  }

  return {
    signCount: authenticatorData.signCount,
    userVerified: authenticatorData.flags.userVerified,
    backedUp: authenticatorData.flags.backupState,
  }
}

/** Renders the 16-byte AAGUID in canonical dashed hexadecimal form. */
export function formatAaguid(aaguid: Uint8Array): string {
  const hex = Array.from(aaguid, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

/** Generates a fresh 32-byte challenge, base64url encoded. */
export function createChallenge(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)))
}
