/**
 * Bearer secrets that are derived rather than stored, and the one digest every credential table
 * keeps.
 *
 * A pure leaf: no SQL, no binding, no environment read. The key is an **argument**, because the
 * auth env module imports `cloudflare:workers`, which the plain-Node `server` test project cannot
 * load; the server functions pass the value `src/server/auth/env.ts` reads and a test passes a
 * literal. Repositories may import this module (docs/SPEC.md §6) - that is why it sits in a
 * neutral directory and not under `src/server/public/**`, which a repository never imports.
 *
 * ## The derivation
 *
 * `subkey = HKDF-SHA256(key, salt = empty, info = purpose)` and
 * `secret = base64url(HMAC-SHA256(subkey, "<id>:<rotation>"))`, the full 32 bytes. Only
 * {@link hashSecret} of the secret is stored, so a D1 dump alone yields nothing usable, and the
 * owner can still copy the same link again because the secret is recomputed. Replacing a link bumps
 * the rotation, which is what makes the old secret stop hashing to the stored digest.
 *
 * `purpose` comes from the closed {@link SECRET_PURPOSES} list, so no later token kind can share a
 * sub-key with an invite. Rotating the key invalidates every derived secret and fails closed.
 */

/** The HKDF `info` of a trip invite link's secret. */
export const TRIP_INVITE_PURPOSE = 'trip-invite-link/v1'

/** The closed list of reasons a secret is derived; the value is the HKDF `info`. */
export const SECRET_PURPOSES = [TRIP_INVITE_PURPOSE] as const

export type SecretPurpose = (typeof SECRET_PURPOSES)[number]

/** The credential kinds the shape guard knows. Shapes differ per kind. */
const SECRET_SHAPES = {
  'trip-invite': /^[A-Za-z0-9_-]{43}$/,
} as const

export type SecretKind = keyof typeof SECRET_SHAPES

const encoder = new TextEncoder()

/** The 32-byte HKDF output for one purpose. Exported so the closed list can be tested. */
export async function deriveSubkey(
  purpose: SecretPurpose,
  key: string,
): Promise<Uint8Array<ArrayBuffer>> {
  if (key.length === 0) {
    throw new RangeError('A secret cannot be derived from an empty key.')
  }
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    'HKDF',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: encoder.encode(purpose),
    },
    material,
    256,
  )
  return new Uint8Array(bits)
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The secret for one record at one rotation: 43 URL-safe characters. */
export async function deriveSecret(
  purpose: SecretPurpose,
  key: string,
  id: string,
  rotation: number,
): Promise<string> {
  if (!Number.isSafeInteger(rotation) || rotation < 0) {
    throw new RangeError('A rotation is a non-negative integer.')
  }
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    await deriveSubkey(purpose, key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign(
    'HMAC',
    hmacKey,
    encoder.encode(`${id}:${rotation}`),
  )
  return base64url(new Uint8Array(mac))
}

/** The only representation of a bearer secret stored in D1: lowercase hex SHA-256. */
export async function hashSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret))
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

/** Whether a value has the shape of a secret of this kind. Runs before any query. */
export function isSecretShape(kind: SecretKind, value: string): boolean {
  return SECRET_SHAPES[kind].test(value)
}
