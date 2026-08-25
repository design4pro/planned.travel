/**
 * The KV half of a ban, against a store that behaves the way the failure did.
 *
 * The case these tests exist for is the one round 6 measured on a real dev Worker: an account whose
 * `active-sessions-<userId>` index key is missing. `auth.api.banUser` asks that index which blobs to
 * delete, gets nothing, and leaves every session resolvable — so the assertion below is not "the
 * function deletes some keys" but "every enumerated token key is deleted **although** the index key
 * is absent". A version of this code that walked the index would pass a happier test and fail this
 * one.
 */

import { describe, expect, it } from 'vitest'

import {
  ACTIVE_SESSIONS_INDEX_PREFIX,
  SESSION_TOKEN_LIMIT,
  activeSessionsIndexKey,
  invalidateSessionSnapshots,
  purgeSessionKeys,
  sessionTokensFrom,
} from '../session-keys'
import { createSessionKv } from './real-auth'

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

describe('purgeSessionKeys', () => {
  it('deletes every enumerated token key when the index key is missing', async () => {
    const kv = createSessionKv()
    kv.store.set('token_a', '{}')
    kv.store.set('token_b', '{}')
    kv.store.set('token_c', '{}')
    // Deliberately no `active-sessions-user_1`: this is the state in which better-auth's own
    // `deleteUserSessions` deletes nothing at all.
    expect(kv.store.has(activeSessionsIndexKey('user_1'))).toBe(false)

    const purge = await purgeSessionKeys(kv, 'user_1', [
      'token_a',
      'token_b',
      'token_c',
    ])

    expect(kv.deleted).toEqual([
      'token_a',
      'token_b',
      'token_c',
      'active-sessions-user_1',
    ])
    expect(kv.store.size).toBe(0)
    expect(purge).toEqual({
      enumerated: 3,
      deleted: 4,
      failed: 0,
      truncated: false,
    })
  })

  it('deletes the index key even when the account had no session rows left', async () => {
    const kv = createSessionKv()
    kv.store.set(activeSessionsIndexKey('user_2'), '["stale"]')

    await purgeSessionKeys(kv, 'user_2', [])

    expect(kv.deleted).toEqual(['active-sessions-user_2'])
    expect(kv.store.size).toBe(0)
  })

  it('attempts every remaining key after one delete is refused, and reports the failure', async () => {
    const kv = createSessionKv()
    kv.failing.add('token_b')

    const purge = await purgeSessionKeys(kv, 'user_3', [
      'token_a',
      'token_b',
      'token_c',
    ])

    // Stopping at the first rejection would leave the *rest* of the account's sessions live.
    expect(kv.deleted).toEqual([
      'token_a',
      'token_b',
      'token_c',
      'active-sessions-user_3',
    ])
    expect(purge.failed).toBe(1)
    expect(purge.deleted).toBe(3)
  })

  it('deletes a repeated token once', async () => {
    const kv = createSessionKv()
    const purge = await purgeSessionKeys(kv, 'user_4', ['t', 't', 't'])
    expect(kv.deleted).toEqual(['t', 'active-sessions-user_4'])
    expect(purge.enumerated).toBe(3)
  })

  it('flags a truncated enumeration so a partial ban cannot pass silently', async () => {
    const kv = createSessionKv()
    const tokens = Array.from(
      { length: SESSION_TOKEN_LIMIT },
      (_, i) => `t${i}`,
    )

    const purge = await purgeSessionKeys(kv, 'user_5', tokens)

    expect(purge.truncated).toBe(true)
    expect(purge.enumerated).toBe(SESSION_TOKEN_LIMIT)
  })
})

describe('invalidateSessionSnapshots', () => {
  it('drops the cached blobs and keeps the per-user index', async () => {
    const kv = createSessionKv()
    const index = activeSessionsIndexKey('user_6')
    kv.store.set('token_a', '{}')
    kv.store.set(index, '["token_a"]')

    await invalidateSessionSnapshots(kv, ['token_a'])

    // The sessions survive a role change; only what they *say* about their user is stale. Purging
    // the index here would leave live sessions unreferenced — the defect, not the fix.
    expect(kv.deleted).toEqual(['token_a'])
    expect(kv.store.has(index)).toBe(true)
  })
})
