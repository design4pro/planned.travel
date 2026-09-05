/**
 * The one R2 surface, exercised against a fake bucket.
 *
 * Two properties are worth a test and both are properties of the *calls*, not of the outcome: the
 * chunk bound is asserted as a call count, because a helper that handed R2 2 500 keys in one array
 * would delete every one of them here and be refused by the real binding; and a key that is already
 * gone is not a failure, because a purge is redelivered and the second delivery must finish rather
 * than dead-letter.
 */
import { describe, expect, it } from 'vitest'

import { R2_DELETE_MAX_KEYS, deleteObjects } from '../objects'
import { fakeBucket } from './fake-bucket'

describe('deleteObjects', () => {
  it('chunks at R2’s per-call ceiling', async () => {
    const bucket = fakeBucket()
    const keys = Array.from(
      { length: 2_500 },
      (_, index) => `trips/o/t/${index}`,
    )

    expect(await deleteObjects(bucket, keys)).toBe(2_500)

    expect(R2_DELETE_MAX_KEYS).toBe(1_000)
    expect(bucket.calls.map((call) => call.length)).toEqual([1_000, 1_000, 500])
    expect(bucket.calls.flat()).toEqual(keys)
  })

  it('sends one call when the whole list fits', async () => {
    const bucket = fakeBucket(['a', 'b'])

    expect(await deleteObjects(bucket, ['a', 'b'])).toBe(2)
    expect(bucket.calls).toEqual([['a', 'b']])
    expect(bucket.remaining.size).toBe(0)
  })

  it('touches the bucket not at all for an empty list', async () => {
    const bucket = fakeBucket()

    expect(await deleteObjects(bucket, [])).toBe(0)
    expect(bucket.calls).toEqual([])
  })

  it('treats a key that is already gone as done, not as a failure', async () => {
    const bucket = fakeBucket(['a'])

    await expect(deleteObjects(bucket, ['a', 'never-existed'])).resolves.toBe(2)
    // The same list again: the second delivery of a purge has to finish, not dead-letter.
    await expect(deleteObjects(bucket, ['a', 'never-existed'])).resolves.toBe(2)
    expect(bucket.remaining.size).toBe(0)
  })

  it('sends one copy of a key the caller listed twice', async () => {
    const bucket = fakeBucket(['a'])

    expect(await deleteObjects(bucket, ['a', 'a', 'b'])).toBe(2)
    expect(bucket.calls).toEqual([['a', 'b']])
  })
})
