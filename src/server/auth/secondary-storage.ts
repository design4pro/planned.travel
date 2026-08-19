import type { BetterAuthOptions } from 'better-auth'

/**
 * `@better-auth/core` is not a direct dependency, so the storage contract is
 * derived from the option it is passed to instead of imported directly.
 */
type SecondaryStorage = NonNullable<BetterAuthOptions['secondaryStorage']>

/**
 * Workers KV has a hard floor of 60 seconds on `expirationTtl`. Clamping up is
 * the safe direction: a rate-limit window only ever gets longer, never shorter,
 * and a session record only ever outlives its logical expiry (which Better Auth
 * re-checks against `expiresAt` after reading).
 */
const KV_MIN_TTL_SECONDS = 60

type Counter = { n: number; resetAt: number }

function isCounter(value: unknown): value is Counter {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.n === 'number' && typeof candidate.resetAt === 'number'
}

function ttlOptions(ttlSeconds: number | undefined) {
  if (ttlSeconds === undefined) return undefined
  return { expirationTtl: Math.max(KV_MIN_TTL_SECONDS, Math.ceil(ttlSeconds)) }
}

/**
 * Better Auth secondary storage backed by the `SESSIONS` KV namespace.
 *
 * Sessions, OAuth state and rate-limit counters live here so the hot read path
 * never touches D1. `increment` is a read-modify-write rather than a true
 * atomic operation — KV offers no compare-and-swap — so a burst arriving in the
 * same eventual-consistency window can undercount. Better Auth's rate limiter
 * is a courtesy guard in front of Cloudflare's own edge protections, so a rare
 * undercount is acceptable; correctness-critical quotas belong in a Durable
 * Object, not here.
 */
export function createKvSecondaryStorage(kv: KVNamespace): SecondaryStorage {
  return {
    async get(key) {
      return await kv.get(key, 'text')
    },

    async getAndDelete(key) {
      const value = await kv.get(key, 'text')
      if (value !== null) await kv.delete(key)
      return value
    },

    async set(key, value, ttl) {
      await kv.put(key, value, ttlOptions(ttl))
    },

    async delete(key) {
      await kv.delete(key)
    },

    async increment(key, ttl) {
      const now = Date.now()
      const windowMs = Math.max(1, Math.ceil(ttl)) * 1000
      const raw = await kv.get(key, 'json')

      const current = isCounter(raw) && raw.resetAt > now ? raw : null
      const next: Counter = current
        ? { n: current.n + 1, resetAt: current.resetAt }
        : { n: 1, resetAt: now + windowMs }

      const remainingSeconds = Math.ceil((next.resetAt - now) / 1000)
      await kv.put(key, JSON.stringify(next), ttlOptions(remainingSeconds))
      return next.n
    },
  }
}
