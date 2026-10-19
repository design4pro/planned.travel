/**
 * The erasure's stores outside D1 against fakes: the key-value purges and the stored-file metadata
 * rewrite. Both are idempotent, and a failure is reported for a retry rather than thrown.
 */
import { describe, expect, it } from 'vitest'
import { MAX_FILE_BYTES } from '#/server/fns/file-policy'
import {
  purgeUserKeys,
  rewriteUploaderMetadata,
  workspaceObjectPrefix,
} from '../stores'
import type {
  RewritableObjectStore,
  StoredHttpMetadata,
  StoredObjectHead,
} from '../stores'

const USER = 'user_alpha_1'
const FORMER = 'erased_abc'
const ORG_A = 'orgA'
const ORG_B = 'orgB'

/* ------------------------------------------------------------------ key-value -- */

function fakeKv(initial: ReadonlyArray<string>, failing = new Set<string>()) {
  const keys = new Set(initial)
  return {
    keys,
    async delete(key: string) {
      if (failing.has(key)) throw new Error('refused')
      keys.delete(key)
    },
  }
}

const sessionRows =
  (tokens: ReadonlyArray<string>) => async (offset: number) =>
    offset === 0 ? tokens.map((token) => ({ token })) : []

describe('purgeUserKeys', () => {
  it('purges the session blobs, the active-sessions index and the discount counter', async () => {
    const sessions = fakeKv([
      'tok1',
      'tok2',
      `active-sessions-${USER}`,
      'other',
    ])
    const kv = fakeKv([
      `billing:discount-attempts:u:${USER}`,
      'billing:discount-attempts:u:someone-else',
    ])

    const result = await purgeUserKeys(
      { sessions, kv },
      USER,
      sessionRows(['tok1', 'tok2']),
    )

    expect(result).toEqual({
      sessionBlobs: { enumerated: 2, deleted: 2, failed: 0 },
      indexDeleted: true,
      discountCounterDeleted: true,
      complete: true,
    })
    expect([...sessions.keys]).toEqual(['other'])
    expect([...kv.keys]).toEqual(['billing:discount-attempts:u:someone-else'])
  })

  it('succeeds again on a rerun', async () => {
    const sessions = fakeKv(['tok1', `active-sessions-${USER}`])
    const kv = fakeKv([`billing:discount-attempts:u:${USER}`])
    const rows = sessionRows(['tok1'])

    await purgeUserKeys({ sessions, kv }, USER, rows)
    const again = await purgeUserKeys({ sessions, kv }, USER, rows)

    expect(again.complete).toBe(true)
  })

  it('reports a key it could not delete, with counts and no token', async () => {
    const sessions = fakeKv(
      ['tok1', 'tok2'],
      new Set(['tok2', `active-sessions-${USER}`]),
    )
    const kv = fakeKv([], new Set([`billing:discount-attempts:u:${USER}`]))

    const result = await purgeUserKeys(
      { sessions, kv },
      USER,
      sessionRows(['tok1', 'tok2']),
    )

    expect(result.complete).toBe(false)
    expect(result.sessionBlobs).toEqual({
      enumerated: 2,
      deleted: 1,
      failed: 1,
    })
    expect(result.indexDeleted).toBe(false)
    expect(result.discountCounterDeleted).toBe(false)
    expect(JSON.stringify(result)).not.toContain('tok2')
  })
})

/* ----------------------------------------------------------------------- R2 -- */

interface StoredFake {
  bytes: string
  etag: string
  customMetadata: Record<string, string>
  httpMetadata: StoredHttpMetadata
  size?: number
}

function fakeBucket(objects: Record<string, StoredFake>) {
  const store = new Map(Object.entries(objects))
  const writes: Array<string> = []
  const bucket: RewritableObjectStore & {
    store: Map<string, StoredFake>
    writes: Array<string>
    failPut?: Set<string>
    changeBeforePut?: Set<string>
  } = {
    store,
    writes,
    async head(key): Promise<StoredObjectHead | null> {
      const object = store.get(key)
      if (object === undefined) return null
      return {
        etag: object.etag,
        size: object.size ?? object.bytes.length,
        customMetadata: object.customMetadata,
        httpMetadata: object.httpMetadata,
      }
    },
    async get(key) {
      const object = store.get(key)
      if (object === undefined) return null
      return { body: new Response(object.bytes).body as ReadableStream }
    },
    async put(key, value, options) {
      if (bucket.failPut?.has(key)) throw new Error('refused')
      const current = store.get(key)
      if (bucket.changeBeforePut?.has(key) && current) current.etag = 'moved'
      if (options.onlyIf && current?.etag !== options.onlyIf.etagMatches)
        return null
      writes.push(key)
      store.set(key, {
        bytes: await new Response(value).text(),
        etag: `${current?.etag ?? 'new'}+`,
        customMetadata: options.customMetadata ?? {},
        httpMetadata: options.httpMetadata ?? {},
      })
      return {}
    },
  }
  return bucket
}

const keyA = `${workspaceObjectPrefix(ORG_A)}trip1/file1-passport.pdf`

const uploadedBy = (who: string, org = ORG_A): StoredFake => ({
  bytes: 'bytes',
  etag: 'e1',
  customMetadata: { organizationId: org, tripId: 'trip1', uploadedBy: who },
  httpMetadata: {
    contentType: 'application/pdf',
    contentDisposition: 'attachment',
  },
})

const input = (keys: ReadonlyArray<string>, organizationId = ORG_A) => ({
  organizationId,
  userId: USER,
  formerMemberId: FORMER,
  keys,
})

describe('rewriteUploaderMetadata', () => {
  it('re-writes the object under the same key with the Former member id and nothing else changed', async () => {
    const bucket = fakeBucket({ [keyA]: uploadedBy(USER) })

    const result = await rewriteUploaderMetadata(bucket, input([keyA]))

    expect(result).toEqual({ rewritten: 1, unchanged: 0, failures: [] })
    const after = bucket.store.get(keyA)
    expect(after?.bytes).toBe('bytes')
    expect(after?.customMetadata).toEqual({
      organizationId: ORG_A,
      tripId: 'trip1',
      uploadedBy: FORMER,
    })
    expect(after?.httpMetadata).toEqual({
      contentType: 'application/pdf',
      contentDisposition: 'attachment',
    })
  })

  it('is idempotent: a rerun writes nothing', async () => {
    const bucket = fakeBucket({ [keyA]: uploadedBy(USER) })
    await rewriteUploaderMetadata(bucket, input([keyA, keyA]))
    bucket.writes.length = 0

    const again = await rewriteUploaderMetadata(bucket, input([keyA]))

    expect(again).toEqual({ rewritten: 0, unchanged: 1, failures: [] })
    expect(bucket.writes).toEqual([])
  })

  it("leaves another person's upload alone", async () => {
    const bucket = fakeBucket({ [keyA]: uploadedBy('someone-else') })

    const result = await rewriteUploaderMetadata(bucket, input([keyA]))

    expect(result).toEqual({ rewritten: 0, unchanged: 1, failures: [] })
    expect(bucket.writes).toEqual([])
  })

  it('reports a missing object and an oversized one, and keeps going', async () => {
    const big = `${workspaceObjectPrefix(ORG_A)}trip1/big`
    const ok = `${workspaceObjectPrefix(ORG_A)}trip1/ok`
    const bucket = fakeBucket({
      [big]: { ...uploadedBy(USER), size: MAX_FILE_BYTES + 1 },
      [ok]: uploadedBy(USER),
    })

    const result = await rewriteUploaderMetadata(bucket, input([keyA, big, ok]))

    expect(result.rewritten).toBe(1)
    expect(result.failures).toEqual([
      { key: keyA, reason: 'missing' },
      { key: big, reason: 'too-large' },
    ])
    expect(bucket.store.get(big)?.customMetadata.uploadedBy).toBe(USER)
  })

  it('reports a store error and a concurrent change for a retry instead of throwing', async () => {
    const failing = `${workspaceObjectPrefix(ORG_A)}trip1/failing`
    const moving = `${workspaceObjectPrefix(ORG_A)}trip1/moving`
    const bucket = fakeBucket({
      [failing]: uploadedBy(USER),
      [moving]: uploadedBy(USER),
    })
    bucket.failPut = new Set([failing])
    bucket.changeBeforePut = new Set([moving])

    const result = await rewriteUploaderMetadata(
      bucket,
      input([failing, moving]),
    )

    expect(result.failures).toEqual([
      { key: failing, reason: 'failed' },
      { key: moving, reason: 'changed' },
    ])
    expect(bucket.store.get(moving)?.customMetadata.uploadedBy).toBe(USER)
  })

  it("refuses another workspace's key, a prefix lookalike and an object tagged for another workspace", async () => {
    const keyB = `${workspaceObjectPrefix(ORG_B)}trip9/file`
    const lookalike = `trips/${ORG_A}x/trip9/file`
    const mistagged = `${workspaceObjectPrefix(ORG_A)}trip1/mistagged`
    const bucket = fakeBucket({
      [keyB]: uploadedBy(USER, ORG_B),
      [lookalike]: uploadedBy(USER, `${ORG_A}x`),
      [mistagged]: uploadedBy(USER, ORG_B),
    })

    const result = await rewriteUploaderMetadata(
      bucket,
      input([keyB, lookalike, mistagged]),
    )

    expect(result.rewritten).toBe(0)
    expect(result.failures.map((failure) => failure.reason)).toEqual([
      'refused',
      'refused',
      'refused',
    ])
    expect(bucket.writes).toEqual([])
    expect(bucket.store.get(keyB)?.customMetadata.uploadedBy).toBe(USER)
  })
})
