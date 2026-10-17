import { describe, expect, it } from 'vitest'
import { spendPublicBudget } from '../rate-limit'
import type { RateCounterStore } from '#/server/metering/rate'

function memoryStore() {
  const entries = new Map<string, { value: string; ttl?: number }>()
  const store: RateCounterStore = {
    get: async (key) => entries.get(key)?.value ?? null,
    put: async (key, value, options) => {
      entries.set(key, { value, ttl: options?.expirationTtl })
    },
  }
  return { store, entries }
}

const NOON = new Date('2026-10-17T12:00:20.000Z')

describe('spendPublicBudget', () => {
  it('lets a request through until the ceiling it is handed is spent', async () => {
    const { store } = memoryStore()
    for (let spent = 0; spent < 3; spent += 1) {
      expect(await spendPublicBudget(store, 'ip', '203.0.113.9', 3, NOON)).toBe(
        null,
      )
    }
    expect(await spendPublicBudget(store, 'ip', '203.0.113.9', 3, NOON)).toBe(
      40,
    )
  })

  it('reads the ceiling from the caller, so one budget can be wider than another', async () => {
    const { store } = memoryStore()
    for (let spent = 0; spent < 3; spent += 1) {
      await spendPublicBudget(store, 'join-user', 'user-1', 10, NOON)
    }
    expect(
      await spendPublicBudget(store, 'join-user', 'user-1', 10, NOON),
    ).toBe(null)
    expect(await spendPublicBudget(store, 'join-user', 'user-1', 3, NOON)).toBe(
      40,
    )
  })

  it('counts each kind and each id separately', async () => {
    const { store } = memoryStore()
    await spendPublicBudget(store, 'invite-miss', 'ip-1', 1, NOON)
    expect(await spendPublicBudget(store, 'invite-miss', 'ip-1', 1, NOON)).toBe(
      40,
    )
    expect(await spendPublicBudget(store, 'invite-miss', 'ip-2', 1, NOON)).toBe(
      null,
    )
    expect(await spendPublicBudget(store, 'miss', 'ip-1', 1, NOON)).toBe(null)
    expect(await spendPublicBudget(store, 'invite', 'ip-1', 1, NOON)).toBe(null)
    expect(await spendPublicBudget(store, 'join-ip', 'ip-1', 1, NOON)).toBe(
      null,
    )
  })

  it('starts a fresh count in the next minute', async () => {
    const { store } = memoryStore()
    await spendPublicBudget(store, 'ip', 'ip-1', 1, NOON)
    expect(await spendPublicBudget(store, 'ip', 'ip-1', 1, NOON)).not.toBe(null)
    expect(
      await spendPublicBudget(
        store,
        'ip',
        'ip-1',
        1,
        new Date(NOON.getTime() + 60_000),
      ),
    ).toBe(null)
  })

  it('keeps the versioned key scheme and a two-minute expiry', async () => {
    const { store, entries } = memoryStore()
    await spendPublicBudget(store, 'join-ip', 'ip-1', 5, NOON)
    const minute = Math.floor(NOON.getTime() / 60000)
    expect([...entries.keys()]).toEqual([
      `public:rl:v1:join-ip:ip-1:${minute}`,
    ])
    expect([...entries.values()][0]).toEqual({ value: '1', ttl: 120 })
  })

  it('fails open when the counter store is down', async () => {
    const down: RateCounterStore = {
      get: async () => {
        throw new Error('KV unavailable')
      },
      put: async () => {
        throw new Error('KV unavailable')
      },
    }
    expect(await spendPublicBudget(down, 'ip', 'ip-1', 1, NOON)).toBe(null)
  })
})
