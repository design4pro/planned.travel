import { describe, expect, it } from 'vitest'
import { hashFeedSecret, mintFeedSecret } from '../secret'

describe('calendar feed credential', () => {
  it('mints unique URL-safe secrets and deterministic SHA-256 digests', async () => {
    const secrets = Array.from({ length: 100 }, () => mintFeedSecret())
    expect(new Set(secrets).size).toBe(100)
    for (const secret of secrets) expect(secret).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(await hashFeedSecret('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
