import type { RateCounterStore } from '#/server/metering/rate'

/**
 * One counter per kind and id. `feed` and `miss` belong to the calendar feed; the invite link
 * keeps its refusal count in `invite-miss` so a prober of one surface cannot spend the other's.
 */
export type PublicBudgetKind =
  'feed' | 'miss' | 'ip' | 'invite' | 'invite-miss' | 'join-user' | 'join-ip'

/** Approximate minute budgets: KV has no atomic increment. Outages fail open. */
export async function spendPublicBudget(
  store: RateCounterStore,
  kind: PublicBudgetKind,
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
