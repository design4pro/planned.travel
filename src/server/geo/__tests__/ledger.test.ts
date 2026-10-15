/**
 * The geocoding proxy against the real provider ledger — success criterion 11.
 *
 * `geocode.test.ts` drives the order of operations with `db: null`, which is `callProvider`'s
 * documented "no handle" state: the gate stays open and the counter no-ops, because metering is
 * never a reason a call does not happen. That is the right runtime for asserting *when* the vendor
 * is called, and the wrong one for asserting that the call is counted.
 *
 * So these two cases drive the same proxy against a real SQLite database through the platform-table
 * fixture. Both would stay invisible if they regressed — a call that stops being recorded still
 * answers correctly, and a `block` policy that stops being honoured still bills quietly.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { createPlatformTables } from '#/server/catalog/__tests__/platform-tables'
import { providerRegistry, providerUsage } from '#/server/db/schema'
import { isProviderBlockedError } from '#/server/metering/errors'
import { resetProviderLimitMemo } from '#/server/metering/outbound'
import { rateMeterKey, rateWindowOf } from '#/server/metering/rate'
import { forwardGeocode, reverseGeocode } from '../geocode'

import type { PlatformTables } from '#/server/catalog/__tests__/platform-tables'
import type {
  GeoCache,
  GeocodeCandidate,
  GeocodeProvider,
  GeocodeRuntime,
  GeocodeVendor,
} from '../geocode'
import type { OutboundRuntime } from '#/server/metering/outbound'
import type { Logger } from '#/server/observability'

const AT = new Date('2026-09-01T10:00:00Z')

const VENDOR: GeocodeVendor = {
  slug: 'geoapify',
  retention: 'permanent',
  attribution: [
    { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright' },
  ],
}

const CANDIDATE: GeocodeCandidate = {
  id: 'osm:way:12345',
  name: 'Plaza Mayor',
  address: 'Plaza Mayor, 28012 Madrid',
  city: 'Madrid',
  countryCode: 'ES',
  lat: 40.4155,
  lng: -3.7074,
}

/** The slice of KV both the cache and the meter use, in memory. */
function memoryStore(): GeoCache {
  const entries = new Map<string, string>()
  return {
    get: (key) => Promise.resolve(entries.get(key) ?? null),
    put: (key, value) => {
      entries.set(key, value)
      return Promise.resolve()
    },
  }
}

function countingProvider(): GeocodeProvider & {
  readonly calls: Array<string>
} {
  const calls: Array<string> = []
  return {
    ...VENDOR,
    calls,
    forward: () => {
      calls.push('forward')
      return Promise.resolve([CANDIDATE])
    },
    reverse: () => {
      calls.push('reverse')
      return Promise.resolve([CANDIDATE])
    },
  }
}

let tables: PlatformTables
let deferred: Array<Promise<unknown>>

/** The ledger write is deliberately off the caller's path, so a test has to join it back on. */
async function settleDeferred(): Promise<void> {
  await Promise.all(deferred)
  deferred = []
}

function outboundRuntime(): OutboundRuntime {
  return {
    db: tables.db,
    waitUntil: (promise) => {
      deferred.push(promise)
    },
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    } as unknown as Logger,
    now: () => AT,
  }
}

function runtime(provider: GeocodeProvider): GeocodeRuntime {
  return {
    cache: memoryStore(),
    counters: memoryStore(),
    vendor: VENDOR,
    provider,
    outbound: outboundRuntime(),
    organizationId: 'org-alpha',
    ceiling: 200,
    now: () => AT,
  }
}

beforeEach(async () => {
  tables = await createPlatformTables()
  deferred = []
  resetProviderLimitMemo()
})

describe('the provider ledger around a lookup', () => {
  it('records a forward lookup under the geoapify slug', async () => {
    const provider = countingProvider()

    await forwardGeocode(runtime(provider), {
      query: 'Plaza Mayor',
      language: 'en',
    })
    await settleDeferred()

    const rows = await tables.db.select().from(providerUsage)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      provider: 'geoapify',
      // The two directions are separately interesting: a spike in reverse lookups is a map being
      // dragged, a spike in forward ones is a form being typed into.
      operation: 'geocode.forward',
      organizationId: 'org-alpha',
      calls: 1,
      errors: 0,
      blocked: 0,
    })
  })

  it('records a reverse lookup under its own operation', async () => {
    const provider = countingProvider()

    await reverseGeocode(runtime(provider), {
      lat: 40.4155,
      lng: -3.7074,
      language: 'en',
    })
    await settleDeferred()

    const rows = await tables.db.select().from(providerUsage)
    expect(rows.map((row) => row.operation)).toEqual(['geocode.reverse'])
  })

  it('does not spend a cached answer against the ledger', async () => {
    const provider = countingProvider()
    const warm = runtime(provider)

    await forwardGeocode(warm, { query: 'Plaza Mayor', language: 'en' })
    await settleDeferred()
    await forwardGeocode(warm, { query: 'plaza  MAYOR ', language: 'en' })
    await settleDeferred()

    // One vendor call, so one ledger call. The second question is the same question.
    expect(provider.calls).toEqual(['forward'])
    const rows = await tables.db.select().from(providerUsage)
    expect(rows[0]?.calls).toBe(1)
  })

  it('spends exactly once when the provider gate cannot be read', async () => {
    const provider = countingProvider()
    const caller = runtime(provider)
    const broken = new Proxy(tables.db, {
      get(target, key, receiver) {
        if (key === 'select')
          return () => {
            throw new Error('D1 unavailable')
          }
        return Reflect.get(target, key, receiver) as unknown
      },
    })
    const result = await forwardGeocode(
      { ...caller, outbound: { ...caller.outbound, db: broken } },
      { query: 'Plaza Mayor', language: 'en' },
    )
    expect(result.spent).toBe(1)
    expect(provider.calls).toEqual(['forward'])
    expect(
      await caller.counters.get(
        rateMeterKey(
          'geocode_lookups_per_month',
          'org-alpha',
          rateWindowOf(AT),
        ),
      ),
    ).toBe('1')
    await settleDeferred()
    expect(await tables.db.select().from(providerUsage)).toMatchObject([
      { calls: 1, errors: 0, blocked: 0 },
    ])
  })

  it.each(['forward', 'reverse'] as const)(
    'refuses a blocked %s lookup without spending allowance',
    async (direction) => {
      await tables.db.insert(providerRegistry).values({
        slug: 'geoapify',
        label: 'Geoapify',
        // The day window ADR 0013 agreed the vendor's own 3,000-credits term under, with the ceiling
        // set to nothing: a `block` policy alone never closes the gate — a policy is what to do when
        // the ceiling is spent, and this is the shortest way to write "spent".
        limitWindow: 'day',
        callLimit: 0,
        policy: 'block',
      })
      resetProviderLimitMemo()
      const provider = countingProvider()

      const caller = runtime(provider)
      const request =
        direction === 'forward'
          ? forwardGeocode(caller, { query: 'Plaza Mayor', language: 'en' })
          : reverseGeocode(caller, {
              lat: 40.4155,
              lng: -3.7074,
              language: 'en',
            })
      const error = await request.catch((thrown: unknown) => thrown)
      await settleDeferred()

      expect(isProviderBlockedError(error)).toBe(true)
      // Refused *before* the vendor, which is the whole point: a block that arrived afterwards would
      // bill for exactly the calls it exists to prevent.
      expect(provider.calls).toEqual([])
      const rows = await tables.db.select().from(providerUsage)
      expect(rows[0]).toMatchObject({ calls: 0, blocked: 1 })
      expect(
        await caller.counters.get(
          rateMeterKey(
            'geocode_lookups_per_month',
            'org-alpha',
            rateWindowOf(AT),
          ),
        ),
      ).toBeNull()
    },
  )
})
