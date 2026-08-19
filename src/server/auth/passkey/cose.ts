/**
 * COSE_Key (RFC 9052 §7) handling: turns the public key an authenticator
 * reports into a WebCrypto `CryptoKey`, and verifies an assertion signature
 * with it.
 */
import { asCborMap, decodeCborStrict, requireBytes, requireInt } from './cbor'
import { base64UrlEncode } from './bytes'

/** COSE key-type values we accept. */
const KTY_OKP = 1
const KTY_EC2 = 2
const KTY_RSA = 3

/** COSE algorithm identifiers, ordered by preference for registration. */
export const SUPPORTED_COSE_ALGORITHMS = [-8, -7, -35, -36, -257] as const

export type CoseAlgorithm = (typeof SUPPORTED_COSE_ALGORITHMS)[number]

export class CoseError extends Error {
  constructor(message: string) {
    super(`COSE: ${message}`)
    this.name = 'CoseError'
  }
}

export function isSupportedCoseAlgorithm(
  algorithm: number,
): algorithm is CoseAlgorithm {
  return (SUPPORTED_COSE_ALGORITHMS as ReadonlyArray<number>).includes(algorithm)
}

const EC_CURVES: Record<number, { crv: string; namedCurve: string } | undefined> = {
  1: { crv: 'P-256', namedCurve: 'P-256' },
  2: { crv: 'P-384', namedCurve: 'P-384' },
  3: { crv: 'P-521', namedCurve: 'P-521' },
}

const EC_HASH: Record<number, string | undefined> = {
  [-7]: 'SHA-256',
  [-35]: 'SHA-384',
  [-36]: 'SHA-512',
}

/** Reads the algorithm identifier out of a COSE_Key without importing it. */
export function coseAlgorithm(publicKey: Uint8Array): number {
  const map = asCborMap(decodeCborStrict(publicKey), 'COSE_Key')
  return requireInt(map, 3, 'COSE_Key alg')
}

async function importCoseKey(publicKey: Uint8Array): Promise<{
  key: CryptoKey
  /** True for ECDSA, whose WebAuthn signatures arrive DER-encoded. */
  isEcdsa: boolean
}> {
  const map = asCborMap(decodeCborStrict(publicKey), 'COSE_Key')
  const kty = requireInt(map, 1, 'COSE_Key kty')
  const algorithm = requireInt(map, 3, 'COSE_Key alg')

  if (!isSupportedCoseAlgorithm(algorithm)) {
    throw new CoseError(`unsupported algorithm ${algorithm}`)
  }

  if (kty === KTY_EC2) {
    const curveId = requireInt(map, -1, 'COSE_Key crv')
    const curve = EC_CURVES[curveId]
    const hash = EC_HASH[algorithm]
    if (!curve || !hash) {
      throw new CoseError(`unsupported EC2 curve ${curveId} for alg ${algorithm}`)
    }
    const key = await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'EC',
        crv: curve.crv,
        x: base64UrlEncode(requireBytes(map, -2, 'COSE_Key x')),
        y: base64UrlEncode(requireBytes(map, -3, 'COSE_Key y')),
        ext: true,
      },
      { name: 'ECDSA', namedCurve: curve.namedCurve },
      false,
      ['verify'],
    )
    return { key, isEcdsa: true }
  }

  if (kty === KTY_RSA) {
    if (algorithm !== -257) {
      throw new CoseError(`unsupported RSA algorithm ${algorithm}`)
    }
    const key = await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'RSA',
        n: base64UrlEncode(requireBytes(map, -1, 'COSE_Key n')),
        e: base64UrlEncode(requireBytes(map, -2, 'COSE_Key e')),
        ext: true,
      },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    return { key, isEcdsa: false }
  }

  if (kty === KTY_OKP) {
    if (algorithm !== -8 || requireInt(map, -1, 'COSE_Key crv') !== 6) {
      throw new CoseError('only Ed25519 is supported for OKP keys')
    }
    const key = await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'OKP',
        crv: 'Ed25519',
        x: base64UrlEncode(requireBytes(map, -2, 'COSE_Key x')),
        ext: true,
      } as JsonWebKey,
      { name: 'Ed25519' },
      false,
      ['verify'],
    )
    return { key, isEcdsa: false }
  }

  throw new CoseError(`unsupported key type ${kty}`)
}

/**
 * Converts a DER `SEQUENCE { INTEGER r, INTEGER s }` into the fixed-width
 * `r || s` form WebCrypto expects. WebAuthn ECDSA signatures are DER; WebCrypto
 * ECDSA is raw, so this bridge is mandatory rather than cosmetic.
 */
export function derToRawEcdsaSignature(
  der: Uint8Array,
  componentLength: number,
): Uint8Array {
  let offset = 0
  const expect = (tag: number, what: string): void => {
    if (der.at(offset) !== tag) throw new CoseError(`malformed signature: ${what}`)
    offset += 1
  }
  const readLength = (): number => {
    const first = der.at(offset)
    if (first === undefined) throw new CoseError('malformed signature: length')
    offset += 1
    if (first < 0x80) return first
    const count = first & 0x7f
    if (count === 0 || count > 2) {
      throw new CoseError('malformed signature: length too large')
    }
    let length = 0
    for (let i = 0; i < count; i += 1) {
      const byte = der.at(offset)
      if (byte === undefined) throw new CoseError('malformed signature: length')
      length = length * 256 + byte
      offset += 1
    }
    return length
  }
  const readInteger = (): Uint8Array => {
    expect(0x02, 'expected INTEGER')
    const length = readLength()
    const value = der.subarray(offset, offset + length)
    if (value.length !== length) throw new CoseError('malformed signature: truncated')
    offset += length
    // Strip DER's leading zero sign byte, then left-pad to the field width.
    let start = 0
    while (start < value.length - 1 && value[start] === 0) start += 1
    const trimmed = value.subarray(start)
    if (trimmed.length > componentLength) {
      throw new CoseError('malformed signature: component too long')
    }
    const padded = new Uint8Array(componentLength)
    padded.set(trimmed, componentLength - trimmed.length)
    return padded
  }

  expect(0x30, 'expected SEQUENCE')
  const sequenceLength = readLength()
  const sequenceEnd = offset + sequenceLength
  const r = readInteger()
  const s = readInteger()
  if (offset !== sequenceEnd) {
    throw new CoseError('malformed signature: trailing bytes')
  }

  const raw = new Uint8Array(componentLength * 2)
  raw.set(r, 0)
  raw.set(s, componentLength)
  return raw
}

const EC_COMPONENT_LENGTH: Record<number, number | undefined> = {
  [-7]: 32,
  [-35]: 48,
  [-36]: 66,
}

/** Verifies a WebAuthn assertion signature against a stored COSE_Key. */
export async function verifyCoseSignature(input: {
  publicKey: Uint8Array
  signature: Uint8Array
  signedData: Uint8Array
}): Promise<boolean> {
  const { key, isEcdsa } = await importCoseKey(input.publicKey)
  const algorithm = coseAlgorithm(input.publicKey)

  if (isEcdsa) {
    const componentLength = EC_COMPONENT_LENGTH[algorithm]
    const hash = EC_HASH[algorithm]
    if (componentLength === undefined || hash === undefined) {
      throw new CoseError(`unsupported EC algorithm ${algorithm}`)
    }
    const raw = derToRawEcdsaSignature(input.signature, componentLength)
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash },
      key,
      raw as unknown as ArrayBuffer,
      input.signedData as unknown as ArrayBuffer,
    )
  }

  const name = algorithm === -8 ? 'Ed25519' : 'RSASSA-PKCS1-v1_5'
  return await crypto.subtle.verify(
    { name },
    key,
    input.signature as unknown as ArrayBuffer,
    input.signedData as unknown as ArrayBuffer,
  )
}
