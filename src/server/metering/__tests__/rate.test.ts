/**
 * The rate meter: the per-tenant tally that bounds a metered call.
 *
 * These cases arrived with the module. They were written against
 * `src/server/transit/__tests__/search.test.ts` when the meter lived inside the transit directory
 * and moved here unedited when it was lifted out, because a test belongs to the owner of the code
 * it tests and the meter is now shared by three callers rather than owned by one of them.
 *
 * What they hold down is the half of a ceiling that no screen can show:
 *
 * - **The key names a metric, a workspace and a calendar month, and nothing else.** Two metrics for
 *   one workspace are two tallies, and two workspaces on one metric are two tallies. A key that
 *   quietly lost one of those dimensions would meter the wrong thing while every screen still read
 *   plausibly.
 * - **The gate fails open.** Only a *successful* read saying the ceiling is spent closes it — the
 *   posture `./outbound.ts` states and this module inherits by name.
 * - **A ceiling of zero is refused before the store is touched**, because a plan that may make no
 *   call has no tally to keep.
 *
 * `rateMeterKey`'s literal string is asserted rather than round-tripped: transit's warm tallies and
 * the metric `03-S7` will pass are counted under it, so a change to its shape is a silent reset of
 * every workspace's allowance rather than a test failure somewhere obvious.
 */
import { describe, expect, it } from 'vitest'

import {
  RateCeilingError,
  rateMeterKey,
  rateWindowOf,
  spendRateUnit,
} from '../rate'

import type { RateCounterStore } from '../rate'

/** The slice of KV the meter uses, in memory. */
function memoryStore(): RateCounterStore & {
  readonly entries: Map<string, string>
  readonly reads: Array<string>
  readonly writes: Array<string>
} {
  const entries = new Map<string, string>()
  const reads: Array<string> = []
  const writes: Array<string> = []
  return {
    entries,
    reads,
    writes,
    get(key) {
      reads.push(key)
      return Promise.resolve(entries.get(key) ?? null)
    },
    put(key, value) {
      writes.push(key)
      entries.set(key, value)
      return Promise.resolve()
    },
  }
}

describe('the rate meter', () => {
  it('keys a tally by metric, workspace and calendar month', () => {
    expect(rateWindowOf(new Date('2026-09-01T00:00:00Z'))).toBe('2026-09')
    expect(rateWindowOf(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12')
    expect(
      rateMeterKey('transit_searches_per_month', 'org-alpha', '2026-09'),
    ).not.toBe(
      rateMeterKey('transit_searches_per_month', 'org-beta', '2026-09'),
    )
    expect(
      rateMeterKey('transit_searches_per_month', 'org-alpha', '2026-09'),
    ).not.toBe(
      rateMeterKey('extraction_calls_per_month', 'org-alpha', '2026-09'),
    )
  })

  it('counts up to the ceiling and then refuses', async () => {
    const store = memoryStore()
    const spend = (): Promise<number> =>
      spendRateUnit(store, {
        metric: 'transit_searches_per_month',
        organizationId: 'org-alpha',
        ceiling: 2,
        now: () => new Date('2026-09-01T10:00:00Z'),
      })

    expect(await spend()).toBe(1)
    expect(await spend()).toBe(2)
    await expect(spend()).rejects.toBeInstanceOf(RateCeilingError)
  })

  it('refuses a plan whose ceiling is zero without writing anything', async () => {
    const store = memoryStore()
    await expect(
      spendRateUnit(store, {
        metric: 'transit_searches_per_month',
        organizationId: 'org-free',
        ceiling: 0,
        now: () => new Date('2026-09-01T10:00:00Z'),
      }),
    ).rejects.toBeInstanceOf(RateCeilingError)
    expect(store.writes).toEqual([])
  })

  it('starts again in the next calendar month', async () => {
    const store = memoryStore()
    const spend = (at: string): Promise<number> =>
      spendRateUnit(store, {
        metric: 'transit_searches_per_month',
        organizationId: 'org-alpha',
        ceiling: 1,
        now: () => new Date(at),
      })

    expect(await spend('2026-09-30T23:00:00Z')).toBe(1)
    await expect(spend('2026-09-30T23:30:00Z')).rejects.toBeInstanceOf(
      RateCeilingError,
    )
    expect(await spend('2026-10-01T00:30:00Z')).toBe(1)
  })

  /**
   * The posture `src/server/metering/outbound.ts` states and this file inherits: a metering fault
   * must not be able to take a feature down. Only a *successful* read saying the ceiling is spent
   * closes the gate.
   */
  it('fails open when the counter cannot be read', async () => {
    const broken: RateCounterStore = {
      get: () => Promise.reject(new Error('KV unavailable')),
      put: () => Promise.resolve(),
    }
    await expect(
      spendRateUnit(broken, {
        metric: 'transit_searches_per_month',
        organizationId: 'org-alpha',
        ceiling: 1,
        now: () => new Date('2026-09-01T10:00:00Z'),
      }),
    ).resolves.toBe(1)
  })
})
