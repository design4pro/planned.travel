import type { RateCounterStore } from '#/server/metering/rate'

/** Approximate minute budgets: KV has no atomic increment. Outages fail open. */
export async function spendPublicBudget(
  store: RateCounterStore,
  kind: 'feed' | 'miss',
  id: string,
  ceiling: number,
  now: Date,
): Promise<number | null> {
  const minute = Math.floor(now.getTime() / 60000)
  const key = `public:rl:v1:${kind}:${id}:${minute}`
  try {
    const count = Number((await store.get(key)) ?? '0')
    if (Number.isFinite(count) && count >= ceiling)
      return Math.max(1, 60 - (Math.floor(now.getTime() / 1000) % 60))
    await store.put(key, String((Number.isFinite(count) ? count : 0) + 1), {
      expirationTtl: 120,
    })
  } catch {
    // A counter outage cannot grant access: credential resolution runs before any live budget.
  }
  return null
}
