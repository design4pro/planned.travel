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

import type { ObjectStore } from '../objects'
import {
  ObjectCopyError,
  R2_DELETE_MAX_KEYS,
  copyObject,
  deleteObjects,
} from '../objects'
import type { FakeBucket, FakeObject } from './fake-bucket'
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

describe('copyObject', () => {
  it('writes a second object under the target key, leaving the source alone', async () => {
    const bucket = fakeBucket({
      'trips/org/source/cover.jpg': { body: 'jpeg', contentType: 'image/jpeg' },
    })

    await copyObject(
      bucket,
      'trips/org/source/cover.jpg',
      'trips/org/target/cover.jpg',
    )

    expect(bucket.objects.get('trips/org/target/cover.jpg')).toEqual({
      body: 'jpeg',
      contentType: 'image/jpeg',
    })
    // Two keys, two objects: the copy has to survive `trip-purge` deleting the source's.
    expect(bucket.objects.has('trips/org/source/cover.jpg')).toBe(true)
    expect(bucket.objects.size).toBe(2)
  })

  it('carries no content type when the source has none', async () => {
    const bucket = fakeBucket({ source: { body: 'bytes' } })

    await copyObject(bucket, 'source', 'target')

    expect(bucket.objects.get('target')).toEqual({ body: 'bytes' })
  })

  it('refuses a missing source rather than quietly copying nothing', async () => {
    const bucket = fakeBucket(['elsewhere'])

    await expect(copyObject(bucket, 'gone', 'target')).rejects.toMatchObject({
      name: 'ObjectCopyError',
      code: 'source-missing',
    })
    expect(bucket.objects.has('target')).toBe(false)
  })

  it('refuses a store that only deletes', async () => {
    // The port a purge is happy with: `get` and `put` are optional, so this compiles.
    const deleteOnly: ObjectStore = { delete: async () => {} }

    await expect(
      copyObject(deleteOnly, 'source', 'target'),
    ).rejects.toBeInstanceOf(ObjectCopyError)
    await expect(
      copyObject(deleteOnly, 'source', 'target'),
    ).rejects.toMatchObject({
      code: 'unsupported-store',
    })
  })

  it('calls the bucket’s methods on the bucket', async () => {
    // `fakeBucket` is an object literal of arrow functions, which are `this`-insensitive and so
    // cannot see the mistake this guards. The real binding can: `R2Bucket.get`/`.put` are workerd
    // prototype methods that validate their receiver, and `const { get } = store; get(key)` throws
    // `TypeError: Illegal invocation`. Because `copyCover` logs and continues past any error from
    // here, that mistake does not fail a copy — it silently drops every copied trip's cover.
    const receiverStrict = strictBucket({ source: { body: 'jpeg' } })

    await copyObject(receiverStrict, 'source', 'target')

    expect(receiverStrict.objects.get('target')).toEqual({ body: 'jpeg' })
  })
})

/**
 * A bucket whose `get`/`put` live on a prototype and refuse a foreign receiver — R2's own contract,
 * which the plain-object fake cannot express.
 */
function strictBucket(
  present: Readonly<Record<string, FakeObject>>,
): FakeBucket {
  const inner = fakeBucket(present)
  const strict: FakeBucket = {
    ...inner,
    get(...args) {
      if (this !== strict) throw new TypeError('Illegal invocation')
      return inner.get(...args)
    },
    put(...args) {
      if (this !== strict) throw new TypeError('Illegal invocation')
      return inner.put(...args)
    },
  }
  return strict
}
