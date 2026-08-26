/**
 * The KV half of a ban, against a store that behaves the way the failure did.
 *
 * The case these tests exist for is the one round 6 measured on a real dev Worker: an account whose
 * `active-sessions-<userId>` index key is missing. `auth.api.banUser` asks that index which blobs to
 * delete, gets nothing, and leaves every session resolvable — so the assertion below is not "the
 * function deletes some keys" but "every enumerated token key is deleted **although** the index key
 * is absent". A version of this code that walked the index would pass a happier test and fail this
 * one.
 *
 * The second thing measured here is the property that replaced a truncated purge: the walk goes to
 * exhaustion. A ceiling on a *purge* is not a bound, it is permanent damage — `banUser` deletes the
 * D1 rows and the index key after it, so a token the purge never named cannot be named again by
 * anything, ever. The list has a ceiling and the purge does not, and the tests say which is which.
 */

import { describe, expect, it } from 'vitest'

import { ConsoleActionError } from '../errors'
import {
  ACTIVE_SESSIONS_INDEX_PREFIX,
  SESSION_LIST_CEILING,
  SESSION_PAGE_SIZE,
  SESSION_PURGE_PAGE_LIMIT,
  activeSessionsIndexKey,
  deleteSessionIndexKey,
  enumerateSessionRows,
  purgeSessionBlobs,
  sessionTokensFrom,
} from '../session-keys'
import { createSessionKv } from './real-auth'

import type { SessionRowPage } from '../session-keys'

/** A page function over a fixed list of tokens, recording exactly what each call asked for. */
function pagerOver(total: number): {
  page: SessionRowPage
  calls: Array<{ offset: number; limit: number }>
  tokens: Array<string>
} {
  const tokens = Array.from({ length: total }, (_, index) => `t${index}`)
  const rows = tokens.map((token) => ({ token }))
  const calls: Array<{ offset: number; limit: number }> = []
  return {
    calls,
    tokens,
    async page(offset, limit) {
      calls.push({ offset, limit })
      return rows.slice(offset, offset + limit)
    },
  }
}

describe('sessionTokensFrom', () => {
  it('reads the token out of each row', () => {
    expect(
      sessionTokensFrom([{ token: 'a', userId: 'u' }, { token: 'b' }]),
    ).toEqual(['a', 'b'])
  })

  it('drops a row with no usable token rather than inventing one', () => {
    // A `select` that stopped returning `token` must not read as "this account has no sessions",
    // which is indistinguishable from a correct ban and wrong in the one direction that matters.
    expect(
      sessionTokensFrom([
        { token: 'a' },
        { userId: 'u' },
        { token: '' },
        null,
        7,
      ]),
    ).toEqual(['a'])
  })
})

describe('activeSessionsIndexKey', () => {
  it('spells the key Better Auth writes', () => {
    // `internalAdapter` builds it as `active-sessions-${userId}`. A different spelling deletes
    // nothing and reports success.
    expect(activeSessionsIndexKey('user_7')).toBe('active-sessions-user_7')
    expect(ACTIVE_SESSIONS_INDEX_PREFIX).toBe('active-sessions-')
  })
})

describe('purgeSessionBlobs', () => {
  it('deletes every enumerated token key when the index key is missing', async () => {
    const kv = createSessionKv()
    kv.store.set('t0', '{}')
    kv.store.set('t1', '{}')
    kv.store.set('t2', '{}')
    // Deliberately no `active-sessions-user_1`: this is the state in which better-auth's own
    // `deleteUserSessions` deletes nothing at all.
    expect(kv.store.has(activeSessionsIndexKey('user_1'))).toBe(false)

    const purge = await purgeSessionBlobs(kv, pagerOver(3).page)

    expect(kv.deleted).toEqual(['t0', 't1', 't2'])
    expect(kv.store.size).toBe(0)
    expect(purge).toEqual({
      enumerated: 3,
      deleted: 3,
      failed: 0,
      failedKeys: [],
    })
  })

  it('leaves the per-user index alone, because ending the sessions is somebody else’s call', async () => {
    const kv = createSessionKv()
    const index = activeSessionsIndexKey('user_6')
    kv.store.set('t0', '{}')
    kv.store.set(index, '["t0"]')

    await purgeSessionBlobs(kv, pagerOver(1).page)

    // A role change drops the snapshot and keeps the session; purging the index there would leave
    // live sessions unreferenced, which is the defect rather than the fix. The paths that *do* end
    // the sessions call `deleteSessionIndexKey` afterwards, by name.
    expect(kv.deleted).toEqual(['t0'])
    expect(kv.store.has(index)).toBe(true)
  })

  it('walks past a single page rather than stopping at it', async () => {
    const pager = pagerOver(SESSION_PAGE_SIZE + 5)
    const kv = createSessionKv()

    const purge = await purgeSessionBlobs(kv, pager.page)

    expect(purge.enumerated).toBe(SESSION_PAGE_SIZE + 5)
    expect(kv.deleted).toEqual(pager.tokens)
    expect(pager.calls).toEqual([
      { offset: 0, limit: SESSION_PAGE_SIZE },
      { offset: SESSION_PAGE_SIZE, limit: SESSION_PAGE_SIZE },
    ])
  })

  it('walks past the list ceiling, because a purge that truncates loses the tokens for good', async () => {
    // The defect this replaced, and the reason it could not be fixed by raising a number: `banUser`
    // deletes every D1 `session` row and the index key goes with them, so a token the purge stopped
    // short of is one nothing anywhere records afterwards — no retry, no later ban and no revoke-all
    // can reach it, while `findSession` keeps resolving it from a `banned: false` snapshot.
    const pager = pagerOver(SESSION_LIST_CEILING + 250)
    const kv = createSessionKv()

    const purge = await purgeSessionBlobs(kv, pager.page)

    expect(purge.enumerated).toBe(SESSION_LIST_CEILING + 250)
    expect(purge.failed).toBe(0)
    expect(kv.deleted).toEqual(pager.tokens)
  })

  it('refuses rather than truncating when the walk will not terminate', async () => {
    // A page function that always answers with a full page — the shape a runaway loop takes. It
    // throws, and it throws *before* any caller has mutated anything, which is what keeps the
    // account recoverable. Truncating here is the one thing this module may never do.
    const kv = createSessionKv()
    let pages = 0
    const endless: SessionRowPage = async (offset, limit) => {
      pages += 1
      return Array.from({ length: limit }, (_, index) => ({
        token: `endless_${offset + index}`,
      }))
    }

    await expect(purgeSessionBlobs(kv, endless)).rejects.toBeInstanceOf(
      ConsoleActionError,
    )
    expect(pages).toBe(SESSION_PURGE_PAGE_LIMIT)
  })

  it('attempts every remaining key after one delete is refused, then retries it once', async () => {
    const kv = createSessionKv()
    kv.failing.add('t1')

    const purge = await purgeSessionBlobs(kv, pagerOver(3).page)

    // Stopping at the first rejection would leave the *rest* of the account's sessions live, and a
    // KV delete rejects for transient reasons far more often than for permanent ones — so the
    // rejected key is attempted a second time before it is reported.
    expect(kv.deleted).toEqual(['t0', 't1', 't2', 't1'])
    expect(purge.failed).toBe(1)
    expect(purge.failedKeys).toEqual(['t1'])
    expect(purge.deleted).toBe(2)
  })

  it('reports a retry that succeeded as a clean purge', async () => {
    // The reason the retry exists: a KV delete rejects for transient reasons far more often than
    // for permanent ones, and a caller that refused a ban on the first blip would be refusing bans
    // for no reason. One flaky key, one retry, nothing reported.
    const attempts = new Map<string, number>()
    const store = {
      async delete(key: string): Promise<void> {
        const seen = (attempts.get(key) ?? 0) + 1
        attempts.set(key, seen)
        if (key === 't1' && seen === 1) throw new Error('KV delete refused')
      },
    }

    const purge = await purgeSessionBlobs(store, pagerOver(3).page)

    expect(attempts.get('t1')).toBe(2)
    expect(purge).toEqual({
      enumerated: 3,
      deleted: 3,
      failed: 0,
      failedKeys: [],
    })
  })

  it('deletes a token that appears on two pages once', async () => {
    const kv = createSessionKv()
    const repeated: SessionRowPage = async (offset) =>
      offset === 0
        ? Array.from({ length: SESSION_PAGE_SIZE }, () => ({ token: 't' }))
        : [{ token: 't' }]

    const purge = await purgeSessionBlobs(kv, repeated)

    expect(kv.deleted).toEqual(['t'])
    expect(purge.enumerated).toBe(1)
  })

  it('reports nothing to do for an account with no live sessions', async () => {
    const kv = createSessionKv()

    const purge = await purgeSessionBlobs(kv, pagerOver(0).page)

    expect(kv.deleted).toEqual([])
    expect(purge).toEqual({
      enumerated: 0,
      deleted: 0,
      failed: 0,
      failedKeys: [],
    })
  })
})

describe('deleteSessionIndexKey', () => {
  it('deletes the index key even when the account had no session rows left', async () => {
    const kv = createSessionKv()
    kv.store.set(activeSessionsIndexKey('user_2'), '["stale"]')

    expect(await deleteSessionIndexKey(kv, 'user_2')).toBe(true)

    expect(kv.deleted).toEqual(['active-sessions-user_2'])
    expect(kv.store.size).toBe(0)
  })

  it('reports a rejection rather than throwing it at a committed mutation', async () => {
    const kv = createSessionKv()
    kv.failing.add(activeSessionsIndexKey('user_3'))

    expect(await deleteSessionIndexKey(kv, 'user_3')).toBe(false)
  })
})

describe('enumerateSessionRows', () => {
  it('takes one page when the account holds less than a page of sessions', async () => {
    const pager = pagerOver(3)

    const enumeration = await enumerateSessionRows(pager.page)

    expect(enumeration.rows).toHaveLength(3)
    expect(enumeration.truncated).toBe(false)
    expect(pager.calls).toEqual([{ offset: 0, limit: SESSION_PAGE_SIZE }])
  })

  it('walks past the page size rather than stopping at it', async () => {
    // The defect this replaced: a single `limit: 200` read reported session 201 as non-existent,
    // so a revoke-by-id called a live session already ended.
    const pager = pagerOver(SESSION_PAGE_SIZE + 5)

    const enumeration = await enumerateSessionRows(pager.page)

    expect(enumeration.rows).toHaveLength(SESSION_PAGE_SIZE + 5)
    expect(enumeration.truncated).toBe(false)
    expect(pager.calls).toEqual([
      { offset: 0, limit: SESSION_PAGE_SIZE },
      { offset: SESSION_PAGE_SIZE, limit: SESSION_PAGE_SIZE },
    ])
  })

  it('stops at the list ceiling and says so', async () => {
    const pager = pagerOver(SESSION_LIST_CEILING + 1)

    const enumeration = await enumerateSessionRows(pager.page)

    expect(enumeration.rows).toHaveLength(SESSION_LIST_CEILING)
    expect(enumeration.truncated).toBe(true)
    // The last call is the overflow probe: one row past the ceiling, which is what turns
    // "truncated" from a suspicion into a measurement.
    expect(pager.calls.at(-1)).toEqual({
      offset: SESSION_LIST_CEILING,
      limit: 1,
    })
  })

  it('does not call an account holding exactly the ceiling truncated', async () => {
    const pager = pagerOver(SESSION_LIST_CEILING)

    const enumeration = await enumerateSessionRows(pager.page)

    expect(enumeration.rows).toHaveLength(SESSION_LIST_CEILING)
    expect(enumeration.truncated).toBe(false)
  })

  it('never asks for more rows than the ceiling leaves room for', async () => {
    const pager = pagerOver(SESSION_LIST_CEILING + 100)

    await enumerateSessionRows(pager.page)

    const asked = pager.calls
      .filter((call) => call.limit > 1)
      .reduce((sum, call) => sum + call.limit, 0)
    expect(asked).toBe(SESSION_LIST_CEILING)
  })
})
