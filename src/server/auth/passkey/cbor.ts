/**
 * Minimal CBOR (RFC 8949) decoder covering the profile WebAuthn uses:
 * definite-length maps, arrays, byte strings, text strings, integers and the
 * three simple values. Anything outside that profile is rejected rather than
 * guessed at — an authenticator response is attacker-influenced input.
 */

export type CborValue =
  | number
  | string
  | Uint8Array
  | boolean
  | null
  | Array<CborValue>
  | Map<CborValue, CborValue>

export class CborError extends Error {
  constructor(message: string) {
    super(`CBOR: ${message}`)
    this.name = 'CborError'
  }
}

type Cursor = { bytes: Uint8Array; offset: number }

function need(cursor: Cursor, count: number): void {
  if (cursor.offset + count > cursor.bytes.length) {
    throw new CborError('unexpected end of input')
  }
}

function readUint(cursor: Cursor, byteLength: number): number {
  need(cursor, byteLength)
  let value = 0
  for (let i = 0; i < byteLength; i += 1) {
    value = value * 256 + cursor.bytes[cursor.offset + i]
  }
  cursor.offset += byteLength
  if (!Number.isSafeInteger(value)) {
    throw new CborError('integer exceeds safe range')
  }
  return value
}

/** Resolves the "additional information" nibble into a concrete argument. */
function readArgument(cursor: Cursor, additional: number): number {
  if (additional < 24) return additional
  if (additional === 24) return readUint(cursor, 1)
  if (additional === 25) return readUint(cursor, 2)
  if (additional === 26) return readUint(cursor, 4)
  if (additional === 27) return readUint(cursor, 8)
  throw new CborError(`unsupported length encoding ${additional}`)
}

function readBytes(cursor: Cursor, length: number): Uint8Array {
  need(cursor, length)
  const slice = cursor.bytes.subarray(cursor.offset, cursor.offset + length)
  cursor.offset += length
  return slice
}

const utf8 = new TextDecoder('utf-8', { fatal: true })

function readValue(cursor: Cursor, depth: number): CborValue {
  if (depth > 16) throw new CborError('nesting too deep')
  need(cursor, 1)
  const initial = cursor.bytes[cursor.offset]
  cursor.offset += 1

  const majorType = initial >> 5
  const additional = initial & 0b000_11111

  switch (majorType) {
    case 0:
      return readArgument(cursor, additional)
    case 1:
      return -1 - readArgument(cursor, additional)
    case 2:
      return readBytes(cursor, readArgument(cursor, additional))
    case 3:
      return utf8.decode(readBytes(cursor, readArgument(cursor, additional)))
    case 4: {
      const length = readArgument(cursor, additional)
      const items: Array<CborValue> = []
      for (let i = 0; i < length; i += 1) items.push(readValue(cursor, depth + 1))
      return items
    }
    case 5: {
      const length = readArgument(cursor, additional)
      const entries = new Map<CborValue, CborValue>()
      for (let i = 0; i < length; i += 1) {
        const key = readValue(cursor, depth + 1)
        const value = readValue(cursor, depth + 1)
        if (typeof key !== 'number' && typeof key !== 'string') {
          throw new CborError('only integer and text map keys are supported')
        }
        if (entries.has(key)) throw new CborError('duplicate map key')
        entries.set(key, value)
      }
      return entries
    }
    case 6:
      // Tagged item: the tag itself carries no meaning in the WebAuthn profile.
      readArgument(cursor, additional)
      return readValue(cursor, depth + 1)
    case 7: {
      if (additional === 20) return false
      if (additional === 21) return true
      if (additional === 22) return null
      throw new CborError(`unsupported simple value ${additional}`)
    }
    default:
      throw new CborError(`unsupported major type ${majorType}`)
  }
}

/** Decodes one CBOR item and reports how many bytes it consumed. */
export function decodeCbor(bytes: Uint8Array): {
  value: CborValue
  bytesRead: number
} {
  const cursor: Cursor = { bytes, offset: 0 }
  const value = readValue(cursor, 0)
  return { value, bytesRead: cursor.offset }
}

/** Decodes exactly one CBOR item, rejecting trailing bytes. */
export function decodeCborStrict(bytes: Uint8Array): CborValue {
  const { value, bytesRead } = decodeCbor(bytes)
  if (bytesRead !== bytes.length) {
    throw new CborError('unexpected trailing bytes')
  }
  return value
}

/** Narrows a decoded item to a CBOR map, with a caller-friendly message. */
export function asCborMap(
  value: CborValue,
  what: string,
): Map<CborValue, CborValue> {
  if (!(value instanceof Map)) throw new CborError(`${what} is not a map`)
  return value
}

/** Narrows a map entry to a byte string. */
export function requireBytes(
  map: Map<CborValue, CborValue>,
  key: CborValue,
  what: string,
): Uint8Array {
  const value = map.get(key)
  if (!(value instanceof Uint8Array)) {
    throw new CborError(`${what} is missing or not a byte string`)
  }
  return value
}

/** Narrows a map entry to an integer. */
export function requireInt(
  map: Map<CborValue, CborValue>,
  key: CborValue,
  what: string,
): number {
  const value = map.get(key)
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new CborError(`${what} is missing or not an integer`)
  }
  return value
}
