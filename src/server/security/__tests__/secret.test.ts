import { describe, expect, it } from 'vitest'
import {
  TRIP_INVITE_PURPOSE,
  deriveSecret,
  deriveSubkey,
  hashSecret,
  isSecretShape,
} from '../secret'

const KEY = 'a-test-key-that-is-long-enough-for-hkdf'
const PURPOSE = TRIP_INVITE_PURPOSE

describe('derived secrets', () => {
  it('is deterministic for one purpose, key, id and rotation', async () => {
    const first = await deriveSecret(PURPOSE, KEY, 'link-1', 0)
    expect(await deriveSecret(PURPOSE, KEY, 'link-1', 0)).toBe(first)
  })

  it('differs when the key, the id or the rotation differs', async () => {
    const base = await deriveSecret(PURPOSE, KEY, 'link-1', 0)
    expect(await deriveSecret(PURPOSE, `${KEY}!`, 'link-1', 0)).not.toBe(base)
    expect(await deriveSecret(PURPOSE, KEY, 'link-2', 0)).not.toBe(base)
    expect(await deriveSecret(PURPOSE, KEY, 'link-1', 1)).not.toBe(base)
  })

  it('does not confuse an id that ends in digits with a larger rotation', async () => {
    const first = await deriveSecret(PURPOSE, KEY, 'link-1', 12)
    const second = await deriveSecret(PURPOSE, KEY, 'link-11', 2)
    expect(first).not.toBe(second)
  })

  it('gives distinct sub-keys to distinct purposes', async () => {
    const own = await deriveSubkey(PURPOSE, KEY)
    // @ts-expect-error the purpose list is closed: a stranger purpose is refused by the type
    const other = await deriveSubkey('calendar-feed/v1', KEY)
    expect(Buffer.from(own).toString('hex')).not.toBe(
      Buffer.from(other).toString('hex'),
    )
    expect(own).toHaveLength(32)
  })

  it('is 43 URL-safe characters, the full 32 bytes', async () => {
    const secret = await deriveSecret(PURPOSE, KEY, 'link-1', 0)
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(isSecretShape('trip-invite', secret)).toBe(true)
  })

  it('refuses an empty key instead of deriving a predictable secret', async () => {
    await expect(deriveSecret(PURPOSE, '', 'link-1', 0)).rejects.toThrow(
      RangeError,
    )
  })

  it('refuses a negative or fractional rotation', async () => {
    await expect(deriveSecret(PURPOSE, KEY, 'link-1', -1)).rejects.toThrow(
      RangeError,
    )
    await expect(deriveSecret(PURPOSE, KEY, 'link-1', 1.5)).rejects.toThrow(
      RangeError,
    )
  })
})

describe('the digest', () => {
  it('is the lowercase hex SHA-256 of the secret', async () => {
    expect(await hashSecret('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})

describe('the shape guard', () => {
  const ok = 'A'.repeat(43)

  it('accepts exactly 43 URL-safe characters', () => {
    expect(isSecretShape('trip-invite', ok)).toBe(true)
    expect(isSecretShape('trip-invite', `${'a-_9'.repeat(10)}${'B'.repeat(3)}`)).toBe(
      true,
    )
  })

  it('rejects 42 and 44 characters', () => {
    expect(isSecretShape('trip-invite', ok.slice(1))).toBe(false)
    expect(isSecretShape('trip-invite', `${ok}A`)).toBe(false)
  })

  it('rejects characters outside the alphabet, a trailing newline and the empty string', () => {
    expect(isSecretShape('trip-invite', `${ok.slice(1)}=`)).toBe(false)
    expect(isSecretShape('trip-invite', `${ok.slice(1)}/`)).toBe(false)
    expect(isSecretShape('trip-invite', `${ok}\n`)).toBe(false)
    expect(isSecretShape('trip-invite', '')).toBe(false)
  })
})
