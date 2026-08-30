/**
 * `callProvider`, driven against a real SQLite database through the platform-table fixture.
 *
 * The cases are chosen around the three claims the module's header makes, because each one is
 * invisible if it silently stops being true:
 *
 * - **A provider nobody has capped never reaches `provider_usage`.** The cheap path is the whole
 *   reason the gate is affordable, and nothing about a working system would look different if it
 *   regressed — so the test names the tables the call path actually reads rather than trusting the
 *   shape of the code.
 * - **Both fail-open postures hold.** A broken database must not stop an email, whether it breaks
 *   in the gate or in the counter.
 * - **A block is refused before the call.** If the order ever inverted, the vendor would be billed
 *   for exactly the calls the ceiling exists to prevent, and the counter would still look right.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { providerRegistry, providerUsage } from '#/server/db/schema'
import { createPlatformTables } from '#/server/catalog/__tests__/platform-tables'
import { ProviderBlockedError, isProviderBlockedError } from '../errors'
import { callProvider, resetProviderLimitMemo } from '../outbound'
import type { PlatformTables } from '#/server/catalog/__tests__/platform-tables'
import type { OutboundRuntime } from '../outbound'
import type { Database } from '#/server/db/types'
import type { Logger } from '#/server/observability'

const AT = new Date('2026-08-30T18:55:12.345Z')
const LABEL = {
  provider: 'resend',
  operation: 'email.send',
  organizationId: 'org_1',
} as const

function fakeLogger(): Logger {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
    track: vi.fn(async (_m: string, fn: () => Promise<unknown>) => fn()),
  }
  return logger as unknown as Logger
}

let tables: PlatformTables
let logger: Logger
let deferred: Array<Promise<unknown>>

function runtimeOver(db: Database | null): OutboundRuntime {
  return {
    db,
    waitUntil: (promise) => {
      deferred.push(promise)
    },
    logger,
    now: () => AT,
  }
}

/** The metering write is deliberately off the caller's path, so a test has to join it back on. */
async function settleDeferred(): Promise<void> {
  await Promise.all(deferred)
  deferred = []
}

/**
 * Reports every table a `select()` is pointed at, so a test can assert which reads a call path
 * actually performs rather than trusting the shape of the code it is reading.
 */
function tableWatcher(
  db: Database,
  onFrom: (table: unknown) => void,
): Database {
  return new Proxy(db, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver) as unknown
      if (key !== 'select') return value
      return (...args: Array<unknown>) => {
        const builder = (value as (...a: Array<unknown>) => unknown).apply(
          target,
          args,
        )
        return new Proxy(builder as object, {
          get(bt, bk, br) {
            if (bk !== 'from') return Reflect.get(bt, bk, br) as unknown
            return (table: unknown) => {
              onFrom(table)
              return (Reflect.get(bt, bk, br) as (t: unknown) => unknown).call(
                bt,
                table,
              )
            }
          },
        })
      }
    },
  })
}

async function setLimit(options: {
  policy: 'allow' | 'block'
  callLimit: number | null
}): Promise<void> {
  await tables.db.insert(providerRegistry).values({
    slug: 'resend',
    label: 'Resend',
    limitWindow: 'month',
    callLimit: options.callLimit,
    policy: options.policy,
  })
  resetProviderLimitMemo()
}

beforeEach(async () => {
  tables = await createPlatformTables()
  logger = fakeLogger()
  deferred = []
  resetProviderLimitMemo()
})

describe('counting', () => {
  it('records a successful call and returns what the thunk returned', async () => {
    const result = await callProvider(
      runtimeOver(tables.db),
      LABEL,
      async () => 'sent',
    )
    await settleDeferred()

    expect(result).toBe('sent')
    const rows = await tables.db.select().from(providerUsage)
    expect(rows[0]).toMatchObject({
      provider: 'resend',
      operation: 'email.send',
      organizationId: 'org_1',
      calls: 1,
      errors: 0,
    })
  })

  it('counts a throw as a call and an error, and rethrows it unchanged', async () => {
    const boom = new Error('upstream timeout')

    await expect(
      callProvider(runtimeOver(tables.db), LABEL, async () => {
        throw boom
      }),
    ).rejects.toBe(boom)
    await settleDeferred()

    const rows = await tables.db.select().from(providerUsage)
    expect(rows[0]).toMatchObject({ calls: 1, errors: 1, blocked: 0 })
  })

  it('counts a non-2xx response as a failed call, not a successful one', async () => {
    // `fetch` resolves a 401 rather than throwing, so without the returned-result check a provider
    // answering 401 all day would read as a day of healthy traffic.
    await callProvider(
      runtimeOver(tables.db),
      LABEL,
      async () => new Response('nope', { status: 401 }),
    )
    await settleDeferred()

    const rows = await tables.db.select().from(providerUsage)
    expect(rows[0]).toMatchObject({ calls: 1, errors: 1, blocked: 0 })
  })

  it('still counts a 2xx response as a clean call', async () => {
    await callProvider(
      runtimeOver(tables.db),
      LABEL,
      async () => new Response('{}', { status: 200 }),
    )
    await settleDeferred()

    const rows = await tables.db.select().from(providerUsage)
    expect(rows[0]).toMatchObject({ calls: 1, errors: 0 })
  })

  it('lets a caller classify a result that is not a Response', async () => {
    await callProvider(
      runtimeOver(tables.db),
      LABEL,
      async () => ({ verdict: 'rejected' }),
      (result) => result.verdict === 'rejected',
    )
    await settleDeferred()

    const rows = await tables.db.select().from(providerUsage)
    expect(rows[0]).toMatchObject({ calls: 1, errors: 1 })
  })

  it('treats a result with no notion of failure as clean', async () => {
    await callProvider(runtimeOver(tables.db), LABEL, async () => 'sent')
    await settleDeferred()

    const rows = await tables.db.select().from(providerUsage)
    expect(rows[0]).toMatchObject({ calls: 1, errors: 0 })
  })

  it('hands exactly one promise to waitUntil per call', async () => {
    await callProvider(runtimeOver(tables.db), LABEL, async () => 'ok')
    expect(deferred).toHaveLength(1)
    await settleDeferred()
  })

  it('counts an attempt each time, so a client that retries is counted as the vendor bills it', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await callProvider(runtimeOver(tables.db), LABEL, async () => 'ok')
    }
    await settleDeferred()

    const rows = await tables.db.select().from(providerUsage)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.calls).toBe(3)
  })

  it('does nothing at all without a database, and still makes the call', async () => {
    const result = await callProvider(
      runtimeOver(null),
      LABEL,
      async () => 'ok',
    )
    expect(result).toBe('ok')
    expect(deferred).toHaveLength(0)
  })
})

describe('the gate', () => {
  it('never queries provider_usage when nothing is configured', async () => {
    const scanned: Array<unknown> = []
    const watched = tableWatcher(tables.db, (table) => scanned.push(table))

    await callProvider(runtimeOver(watched), LABEL, async () => 'ok')
    await settleDeferred()

    // One small indexed read of the registry — the read that discovers there is no row — and not a
    // single read of the usage table, which is the query that would actually cost something. The
    // registry result is then memoised, so the steady state is one row read per provider a minute.
    expect(scanned).toEqual([providerRegistry])
  })

  it('reads no usage when a ceiling exists but the policy is allow', async () => {
    await setLimit({ policy: 'allow', callLimit: 0 })

    const result = await callProvider(
      runtimeOver(tables.db),
      LABEL,
      async () => 'ok',
    )
    await settleDeferred()

    // A spent ceiling under `allow` bills through rather than refusing.
    expect(result).toBe('ok')
    const rows = await tables.db.select().from(providerUsage)
    expect(rows[0]).toMatchObject({ calls: 1, blocked: 0 })
  })

  it('lets a blocking ceiling through while it has headroom', async () => {
    await setLimit({ policy: 'block', callLimit: 2 })

    await expect(
      callProvider(runtimeOver(tables.db), LABEL, async () => 'ok'),
    ).resolves.toBe('ok')
    await settleDeferred()
  })

  it('refuses before the call runs once a blocking ceiling is spent', async () => {
    await setLimit({ policy: 'block', callLimit: 1 })

    await callProvider(runtimeOver(tables.db), LABEL, async () => 'ok')
    await settleDeferred()

    const send = vi.fn(async () => 'ok')
    const rejection = await callProvider(
      runtimeOver(tables.db),
      LABEL,
      send,
    ).catch((cause: unknown) => cause)
    await settleDeferred()

    expect(send).not.toHaveBeenCalled()
    expect(isProviderBlockedError(rejection)).toBe(true)
    expect(rejection).toBeInstanceOf(ProviderBlockedError)
    expect(rejection).toMatchObject({
      provider: 'resend',
      callLimit: 1,
      used: 1,
    })
  })

  it('records a refusal as demand rather than usage', async () => {
    await setLimit({ policy: 'block', callLimit: 0 })

    await callProvider(runtimeOver(tables.db), LABEL, async () => 'ok').catch(
      () => undefined,
    )
    await settleDeferred()

    const rows = await tables.db.select().from(providerUsage)
    expect(rows[0]).toMatchObject({ calls: 0, blocked: 1 })
  })

  it('fails open, and says so, when the gate read throws', async () => {
    await setLimit({ policy: 'block', callLimit: 0 })
    const broken = new Proxy(tables.db, {
      get(target, key, receiver) {
        if (key === 'select') {
          return () => {
            throw new Error('D1_ERROR: connection lost')
          }
        }
        return Reflect.get(target, key, receiver) as unknown
      },
    })

    await expect(
      callProvider(runtimeOver(broken), LABEL, async () => 'ok'),
    ).resolves.toBe('ok')

    expect(logger.warn).toHaveBeenCalledWith(
      'provider gate unavailable; allowing the call',
      expect.objectContaining({ provider: 'resend' }),
    )
  })

  it('fails open when the counter write throws, and never rejects the caller', async () => {
    const broken = new Proxy(tables.db, {
      get(target, key, receiver) {
        if (key === 'insert') {
          return () => {
            throw new Error('D1_ERROR: no such table')
          }
        }
        return Reflect.get(target, key, receiver) as unknown
      },
    })

    await expect(
      callProvider(runtimeOver(broken), LABEL, async () => 'ok'),
    ).resolves.toBe('ok')
    await expect(settleDeferred()).resolves.toBeUndefined()
  })
})

describe('the limit memo', () => {
  it('re-reads the registry no more than once per provider inside the window', async () => {
    await setLimit({ policy: 'block', callLimit: 10 })
    const scanned: Array<unknown> = []
    const watched = tableWatcher(tables.db, (table) => scanned.push(table))

    await callProvider(runtimeOver(watched), LABEL, async () => 'ok')
    await callProvider(runtimeOver(watched), LABEL, async () => 'ok')
    await settleDeferred()

    expect(scanned.filter((table) => table === providerRegistry)).toHaveLength(
      1,
    )
  })

  /**
   * The counter must never be memoised alongside the row it is checked against — that is
   * `docs/ARCHITECTURE.md` §4 rule 1, and it is the difference between a ceiling and a suggestion.
   */
  it('does not memoise the count, so the ceiling bites on the call that reaches it', async () => {
    await setLimit({ policy: 'block', callLimit: 2 })

    await callProvider(runtimeOver(tables.db), LABEL, async () => 'ok')
    await settleDeferred()
    await callProvider(runtimeOver(tables.db), LABEL, async () => 'ok')
    await settleDeferred()

    const send = vi.fn(async () => 'ok')
    await expect(
      callProvider(runtimeOver(tables.db), LABEL, send),
    ).rejects.toBeInstanceOf(ProviderBlockedError)
    expect(send).not.toHaveBeenCalled()
  })
})
