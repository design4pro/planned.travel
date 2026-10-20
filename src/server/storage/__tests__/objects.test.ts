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
  deletePrefix,
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

  it('carries the content disposition over with the content type', async () => {
    const disposition = "attachment; filename*=UTF-8''cover.jpg"
    const bucket = fakeBucket({
      source: {
        body: 'jpeg',
        contentType: 'image/jpeg',
        contentDisposition: disposition,
      },
    })

    await copyObject(bucket, 'source', 'target')

    expect(bucket.objects.get('target')).toEqual({
      body: 'jpeg',
      contentType: 'image/jpeg',
      contentDisposition: disposition,
    })
  })

  it('carries a disposition even when the source has no content type', async () => {
    const bucket = fakeBucket({
      source: { body: 'bytes', contentDisposition: 'attachment' },
    })

    await copyObject(bucket, 'source', 'target')

    expect(bucket.objects.get('target')).toEqual({
      body: 'bytes',
      contentDisposition: 'attachment',
    })
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

describe('deletePrefix', () => {
  it('deletes every key under the prefix and nothing else', async () => {
    const bucket = fakeBucket([
      'trips/org-a/t1/one',
      'trips/org-a/t2/two',
      'trips/org-ab/t1/other',
      'exports/org-a/t1/job.pdf',
    ])

    expect(await deletePrefix(bucket, 'trips/org-a/')).toBe(2)

    // The trailing slash is the point: `org-ab` shares the leading characters of `org-a`.
    expect([...bucket.remaining].sort()).toEqual([
      'exports/org-a/t1/job.pdf',
      'trips/org-ab/t1/other',
    ])
  })

  it('works through a prefix larger than one listing page, deleting at most 1 000 keys a call', async () => {
    const keys = Array.from(
      { length: 2_500 },
      (_, index) => `trips/o/t/${index}`,
    )
    const bucket = fakeBucket(keys, { pageSize: 1_000 })

    expect(await deletePrefix(bucket, 'trips/o/')).toBe(2_500)

    expect(bucket.remaining.size).toBe(0)
    expect(bucket.listCalls).toHaveLength(3)
    expect(Math.max(...bucket.calls.map((call) => call.length))).toBe(1_000)
    expect(bucket.calls.flat()).toHaveLength(2_500)
  })

  it('finishes the job when a repeat follows a run that stopped part-way', async () => {
    const keys = Array.from(
      { length: 2_500 },
      (_, index) => `trips/o/t/${index}`,
    )
    const bucket = fakeBucket(keys, { pageSize: 1_000 })
    const realDelete = bucket.delete
    let deleteCalls = 0
    const flaky: typeof bucket = {
      ...bucket,
      delete: async (batch) => {
        deleteCalls += 1
        if (deleteCalls === 2) throw new Error('R2 went away')
        return realDelete(batch)
      },
    }

    await expect(deletePrefix(flaky, 'trips/o/')).rejects.toThrow(
      'R2 went away',
    )
    expect(bucket.remaining.size).toBe(1_500)

    // The same call again: what is already gone is not listed, what is left is deleted.
    expect(await deletePrefix(bucket, 'trips/o/')).toBe(1_500)
    expect(bucket.remaining.size).toBe(0)
  })

  it('succeeds on a prefix with nothing under it', async () => {
    const bucket = fakeBucket(['trips/other/t/one'])

    expect(await deletePrefix(bucket, 'trips/org/')).toBe(0)
    expect(bucket.calls).toEqual([])
    expect(bucket.remaining.size).toBe(1)
  })

  it('refuses a prefix that is not a whole directory, so a bad id cannot sweep a key family', async () => {
    const bucket = fakeBucket(['trips/org/t/one'])

    await expect(deletePrefix(bucket, '')).rejects.toThrow(/prefix/)
    await expect(deletePrefix(bucket, 'trips/')).rejects.toThrow(/prefix/)
    await expect(deletePrefix(bucket, 'trips/org')).rejects.toThrow(/prefix/)
    expect(bucket.calls).toEqual([])
    expect(bucket.remaining.size).toBe(1)
  })
})
