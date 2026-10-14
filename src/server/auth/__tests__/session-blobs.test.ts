/**
 * The session-blob purge on its own (#1176): the paging rule and the delete-by-name rule, against a
 * key store that has no `active-sessions-<userId>` index at all, which is the shape of the failure.
 * That the hooks and the console use it as intended is `room-eviction.test.ts` and the console tests.
 */

import { describe, expect, it } from 'vitest'

import {
  SESSION_PAGE_SIZE,
  SessionWalkLimitError,
  collectSessionTokens,
  deleteSessionBlobs,
  purgeSessionBlobs,
} from '../session-blobs'

import type { SessionKeyStore, SessionRowPage } from '../session-blobs'

function pagerOver(total: number): {
  page: SessionRowPage
  tokens: Array<string>
  calls: Array<{ offset: number; limit: number }>
} {
  const tokens = Array.from({ length: total }, (_, index) => `t${index}`)
  const rows = tokens.map((token) => ({ token }))
  const calls: Array<{ offset: number; limit: number }> = []
  return {
    tokens,
    calls,
    async page(offset, limit) {
      calls.push({ offset, limit })
      return rows.slice(offset, offset + limit)
    },
  }
}

function recordingStore(failing: ReadonlySet<string> = new Set()): {
  store: SessionKeyStore
  attempts: Array<string>
  removed: Set<string>
} {
  const attempts: Array<string> = []
  const removed = new Set<string>()
  return {
    attempts,
    removed,
    store: {
      async delete(key) {
        attempts.push(key)
        if (failing.has(key)) throw new Error(`refused: ${key}`)
        removed.add(key)
      },
    },
  }
}

describe('collectSessionTokens', () => {
  it('reads every page to exhaustion rather than stopping at a ceiling', async () => {
    const reader = pagerOver(SESSION_PAGE_SIZE * 2 + 5)

    const tokens = await collectSessionTokens(reader.page)

    expect(tokens).toEqual(reader.tokens)
    expect(reader.calls.map((call) => call.offset)).toEqual([
      0,
      SESSION_PAGE_SIZE,
      SESSION_PAGE_SIZE * 2,
    ])
  })

  it('names a token once however often the rows repeat it', async () => {
    const tokens = await collectSessionTokens(async (offset) =>
      offset === 0 ? [{ token: 'a' }, { token: 'a' }, { token: 'b' }] : [],
    )

    expect(tokens).toEqual(['a', 'b'])
  })

  it('throws rather than truncating when every page comes back full', async () => {
    const endless: SessionRowPage = async (_offset, limit) =>
      Array.from({ length: limit }, (_, index) => ({ token: `t${index}` }))

    await expect(collectSessionTokens(endless)).rejects.toBeInstanceOf(
      SessionWalkLimitError,
    )
  })

  it('lets a failing page read reach the caller', async () => {
    await expect(
      collectSessionTokens(async () => {
        throw new Error('D1 is down')
      }),
    ).rejects.toThrow('D1 is down')
  })
})

describe('deleteSessionBlobs', () => {
  it('deletes exactly the keys it is given', async () => {
    const kv = recordingStore()

    const purge = await deleteSessionBlobs(kv.store, ['a', 'b'])

    expect(kv.attempts).toEqual(['a', 'b'])
    expect(purge).toEqual({
      enumerated: 2,
      deleted: 2,
      failed: 0,
      failedKeys: [],
    })
  })

  it('attempts every key, retries the rejected ones once and reports what survived', async () => {
    const kv = recordingStore(new Set(['b']))

    const purge = await deleteSessionBlobs(kv.store, ['a', 'b', 'c'])

    expect(kv.attempts).toEqual(['a', 'b', 'c', 'b'])
    expect([...kv.removed]).toEqual(['a', 'c'])
    expect(purge).toEqual({
      enumerated: 3,
      deleted: 2,
      failed: 1,
      failedKeys: ['b'],
    })
  })

  it('counts a delete that succeeds on the retry as deleted', async () => {
    let calls = 0
    const purge = await deleteSessionBlobs(
      {
        async delete() {
          calls += 1
          if (calls === 1) throw new Error('transient')
        },
      },
      ['a'],
    )

    expect(purge).toMatchObject({ enumerated: 1, deleted: 1, failed: 0 })
  })

  it('does nothing for an empty list', async () => {
    const kv = recordingStore()

    await expect(deleteSessionBlobs(kv.store, [])).resolves.toMatchObject({
      enumerated: 0,
      deleted: 0,
      failed: 0,
    })
    expect(kv.attempts).toEqual([])
  })
})

describe('purgeSessionBlobs', () => {
  it('deletes the blob of every row page by page, although no index names them', async () => {
    const reader = pagerOver(SESSION_PAGE_SIZE + 3)
    const kv = recordingStore()

    const purge = await purgeSessionBlobs(kv.store, reader.page)

    expect(kv.attempts).toEqual(reader.tokens)
    expect(purge).toMatchObject({
      enumerated: SESSION_PAGE_SIZE + 3,
      deleted: SESSION_PAGE_SIZE + 3,
      failed: 0,
    })
  })
})
