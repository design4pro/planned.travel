import { z } from 'zod'
import { callProvider } from '#/server/metering/outbound'
import { isProviderBlockedError } from '#/server/metering/errors'
import {
  fetchPublicSnapshot,
  PublicProviderError,
  validSnapshot,
} from './frankfurter'
import type { PublicSnapshot } from './frankfurter'
import type { OutboundRuntime } from '#/server/metering/outbound'

const LATEST = 'fx:public:frankfurter-ecb:v1:latest'
const ATTEMPT = 'fx:public:frankfurter-ecb:v1:attempt'
const COOLDOWN = 300_000
const DAY = 86_400_000
const markerSchema = z.strictObject({
  attemptedAt: z.number().int().nonnegative().safe(),
  retryAt: z.number().int().nonnegative().safe(),
})
type Reason =
  | 'provider-failed'
  | 'provider-blocked'
  | 'throttled'
  | 'cache-unavailable'
  | 'old-observation'
  | 'expired'
export type PublicRatesResult =
  | {
      status: 'available'
      snapshot: PublicSnapshot
      freshness: 'fresh' | 'stale'
      reason: Reason | null
      checkedAt: number
      retryAt?: number
    }
  | { status: 'unavailable'; reason: Reason; retryAt?: number }
export interface PublicRatesRuntime {
  cache: {
    get: (key: string) => Promise<string | null>
    put: (
      key: string,
      value: string,
      options: { expirationTtl: number },
    ) => Promise<void>
  }
  fetch: typeof fetch
  now: () => number
  sleep: (ms: number) => Promise<void>
  outbound: OutboundRuntime
}

/** One bounded snapshot, deadline and single flight per isolate; KV is advisory, never a lock. */
export function createPublicRates() {
  let held: PublicSnapshot | undefined
  let retryAt = 0
  let flight: Promise<PublicRatesResult> | undefined
  function result(
    now: number,
    reason: Reason | null = null,
  ): PublicRatesResult {
    const age = held
      ? Math.floor(now / DAY) - Math.floor(Date.parse(held.effectiveOn) / DAY)
      : Infinity
    const deadline = retryAt > now ? { retryAt } : {}
    if (!held || age > 7)
      return { status: 'unavailable', reason: reason ?? 'expired', ...deadline }
    return {
      status: 'available',
      snapshot: held,
      freshness: reason || age > 4 ? 'stale' : 'fresh',
      reason: reason ?? (age > 4 ? 'old-observation' : null),
      checkedAt: held.fetchedAt,
      ...deadline,
    }
  }
  function retain(snapshot: PublicSnapshot) {
    if (
      !held ||
      snapshot.effectiveOn > held.effectiveOn ||
      (snapshot.effectiveOn === held.effectiveOn &&
        snapshot.fetchedAt > held.fetchedAt)
    )
      held = snapshot
  }
  async function read(
    runtime: PublicRatesRuntime,
    organizationId: string,
    refresh: boolean,
  ): Promise<PublicRatesResult> {
    const now = runtime.now()
    try {
      const raw = await runtime.cache.get(LATEST)
      if (raw !== null && raw.length <= 65536) {
        try {
          retain(validSnapshot(JSON.parse(raw), now))
        } catch {
          /* An invalid cache entry cannot replace the validated fallback. */
        }
      }
      const marker = await runtime.cache.get(ATTEMPT)
      if (marker !== null) {
        if (marker.length > 256) throw new Error('Oversized marker')
        const parsed = markerSchema.parse(JSON.parse(marker))
        if (
          parsed.attemptedAt > now ||
          parsed.retryAt < parsed.attemptedAt ||
          parsed.retryAt > parsed.attemptedAt + DAY
        )
          throw new Error('Invalid marker')
        retryAt = Math.max(retryAt, parsed.retryAt)
      }
    } catch {
      return result(now, 'cache-unavailable')
    }
    if (
      !refresh &&
      held &&
      now - held.fetchedAt < 3_600_000 &&
      result(now).status === 'available'
    )
      return result(now)
    if (retryAt > now) return result(now, 'throttled')
    retryAt = now + COOLDOWN
    try {
      await runtime.cache.put(
        ATTEMPT,
        JSON.stringify({ attemptedAt: now, retryAt }),
        { expirationTtl: 300 },
      )
    } catch {
      return result(now, 'cache-unavailable')
    }
    const markerWrittenAt = runtime.now()
    try {
      const snapshot = await callProvider(
        runtime.outbound,
        { provider: 'frankfurter', operation: 'rates.latest', organizationId },
        () => fetchPublicSnapshot(runtime.fetch, runtime.now),
      )
      const older = held && snapshot.effectiveOn < held.effectiveOn
      retain(snapshot)
      if (!older) {
        try {
          await runtime.cache.put(LATEST, JSON.stringify(snapshot), {
            expirationTtl: 604800,
          })
        } catch {
          return result(runtime.now(), 'cache-unavailable')
        }
      }
      return result(runtime.now(), older ? 'old-observation' : null)
    } catch (cause) {
      if (cause instanceof PublicProviderError && cause.retryAfter) {
        let seconds = NaN
        if (/^\d+$/.test(cause.retryAfter))
          seconds = Math.min(Number(cause.retryAfter), 86400) * 1000
        else if (
          /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(
            cause.retryAfter,
          )
        )
          if (
            new Date(Date.parse(cause.retryAfter)).toUTCString() ===
            cause.retryAfter
          )
            seconds = Date.parse(cause.retryAfter) - runtime.now()
        if (Number.isFinite(seconds) && seconds > 0) {
          const extended = Math.max(
            retryAt,
            Math.min(runtime.now() + seconds, now + DAY),
          )
          retryAt = extended
          runtime.outbound.waitUntil(
            (async () => {
              await runtime.sleep(
                Math.max(0, markerWrittenAt + 1000 - runtime.now()),
              )
              await runtime.cache.put(
                ATTEMPT,
                JSON.stringify({ attemptedAt: now, retryAt: extended }),
                {
                  expirationTtl: Math.max(
                    60,
                    Math.ceil((extended - runtime.now()) / 1000),
                  ),
                },
              )
            })().catch(() => {}),
          )
        }
      }
      return result(
        runtime.now(),
        isProviderBlockedError(cause) ? 'provider-blocked' : 'provider-failed',
      )
    }
  }
  return (
    runtime: PublicRatesRuntime,
    organizationId: string,
    refresh = false,
  ): Promise<PublicRatesResult> => {
    if (flight) return flight
    flight = read(runtime, organizationId, refresh).finally(() => {
      flight = undefined
    })
    return flight
  }
}

export const getPublicRates = createPublicRates()
