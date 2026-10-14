/**
 * The rate lookup (#835): which frozen rate a reader would use for a currency pair, and where the
 * answer comes from when this workspace has never frozen one.
 *
 * Runs on the real harness, so the readable-trip restriction is the production predicate, not a
 * stand-in. The cross-workspace cases live in the tenant-isolation suite; this file covers the
 * lookup's own rules: the order of the sources, the ordered pair, what counts as an observation, and
 * that no per-row writer can reach any of it.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NotFoundError } from '../context'
import { createExpense, createSettlement } from '../expenses'
import { findLatestFrozenRate, resolveRate } from '../rates'
import { addTripMember, createTrip, updateTrip } from '../trips'
import { captureError, createHarness, subscribeTenant } from './harness'
import type { RateSource } from '../rates'
import type { Harness, SeededTenant } from './harness'

const HERE = dirname(fileURLToPath(import.meta.url))

describe('the rate lookup', () => {
  let harness: Harness
  let tenant: SeededTenant
  let ownerId: string
  let friendId: string
  let tripId: string
  let otherTripId: string

  /** An expense paid in `from` on a trip kept in `to`, with the rate frozen on the row. */
  async function expenseAt(
    trip: string,
    spentOn: string,
    rate: number,
    { from = 'GBP', to = 'EUR' }: { from?: string; to?: string } = {},
  ): Promise<void> {
    await createExpense(tenant.scope, {
      tripId: trip,
      title: `Receipt in ${from}`,
      amountMinor: 10_000,
      currency: to,
      originalAmountMinor: 8000,
      originalCurrency: from,
      exchangeRate: rate,
      spentOn,
    })
  }

  /**
   * A payment made in `from` on a trip kept in `to`. A payment's rate is derived from its amount
   * pair (#843), so the paid figure is the source figure times `rate`.
   */
  async function paymentAt(
    trip: string,
    settledOn: string,
    rate: number,
    { from = 'GBP', to = 'EUR' }: { from?: string; to?: string } = {},
  ): Promise<void> {
    await createSettlement(tenant.scope, {
      tripId: trip,
      fromUserId: friendId,
      toUserId: ownerId,
      // A payment cannot be handed a rate: it derives the rate from the two amounts, so the
      // converted amount is the one that makes `rate` the implied one (#843).
      amountMinor: Math.round(4000 * rate),
      currency: to,
      originalAmountMinor: 4000,
      originalCurrency: from,
      settledOn,
    })
  }

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('rates')
    await subscribeTenant(tenant.scope, 'crew')
    ownerId = tenant.ownerUserId
    friendId = await tenant.addUser('A friend')
    const trip = await createTrip(tenant.scope, {
      title: 'Lisbon in spring',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
      currency: 'EUR',
    })
    const other = await createTrip(tenant.scope, {
      title: 'Porto in summer',
      startDate: '2026-07-10',
      endDate: '2026-07-13',
      currency: 'EUR',
    })
    tripId = trip.id
    otherTripId = other.id
    for (const id of [tripId, otherTripId]) {
      await addTripMember(tenant.scope, {
        tripId: id,
        userId: friendId,
        role: 'viewer',
      })
    }
  })

  describe('findLatestFrozenRate', () => {
    const pair = { from: 'GBP', to: 'EUR' } as const

    it('is null when the trip has frozen nothing for the pair', async () => {
      expect(
        await findLatestFrozenRate(tenant.scope, { tripId, ...pair }),
      ).toBeNull()
    })

    it('answers the most recent rate, with the day it was observed', async () => {
      await expenseAt(tripId, '2026-04-10', 1.15)
      await expenseAt(tripId, '2026-04-12', 1.17)
      await expenseAt(tripId, '2026-04-11', 1.16)

      expect(
        await findLatestFrozenRate(tenant.scope, { tripId, ...pair }),
      ).toEqual({ rate: 1.17, source: 'recent', observedOn: '2026-04-12' })
    })

    it('reads a payment as well as an expense, and the later of the two wins', async () => {
      await expenseAt(tripId, '2026-04-10', 1.15)
      await paymentAt(tripId, '2026-04-13', 1.2)

      expect(
        await findLatestFrozenRate(tenant.scope, { tripId, ...pair }),
      ).toEqual({ rate: 1.2, source: 'recent', observedOn: '2026-04-13' })

      await expenseAt(tripId, '2026-04-13', 1.21)
      // Same day: the row written last is the more recent observation.
      expect(
        (await findLatestFrozenRate(tenant.scope, { tripId, ...pair }))?.rate,
      ).toBe(1.21)
    })

    it('reads the ordered pair only: receipt currency to the row’s own, never inverted', async () => {
      await expenseAt(tripId, '2026-04-10', 1.15)

      expect(
        await findLatestFrozenRate(tenant.scope, {
          tripId,
          from: 'EUR',
          to: 'GBP',
        }),
      ).toBeNull()
      expect(
        await findLatestFrozenRate(tenant.scope, {
          tripId,
          from: 'GBP',
          to: 'USD',
        }),
      ).toBeNull()
    })

    it('ignores the rows of another trip', async () => {
      await expenseAt(tripId, '2026-04-10', 1.15)
      await expenseAt(otherTripId, '2026-07-12', 1.3)

      expect(
        (await findLatestFrozenRate(tenant.scope, { tripId, ...pair }))?.rate,
      ).toBe(1.15)
      expect(
        (
          await findLatestFrozenRate(tenant.scope, {
            tripId: otherTripId,
            ...pair,
          })
        )?.rate,
      ).toBe(1.3)
    })

    it('never takes a row with no source figures for an observation', async () => {
      // Paid in the accounting currency: all three source columns are null.
      await createExpense(tenant.scope, {
        tripId,
        title: 'Paid in euros',
        amountMinor: 4000,
        currency: 'EUR',
        spentOn: '2026-04-12',
      })
      await createSettlement(tenant.scope, {
        tripId,
        fromUserId: friendId,
        toUserId: ownerId,
        amountMinor: 1000,
        currency: 'EUR',
        settledOn: '2026-04-12',
      })

      expect(
        await findLatestFrozenRate(tenant.scope, { tripId, ...pair }),
      ).toBeNull()
      expect(
        await findLatestFrozenRate(tenant.scope, {
          tripId,
          from: 'EUR',
          to: 'EUR',
        }),
      ).toBeNull()
    })

    it('refuses a trip that does not exist as not found, and reads nothing', async () => {
      harness.statements.length = 0

      const refusal = await captureError(() =>
        findLatestFrozenRate(tenant.scope, { tripId: 'missing', ...pair }),
      )

      expect(refusal).toBeInstanceOf(NotFoundError)
      expect(
        harness.statements.some((sql) =>
          /from "(expenses|settlements)"/i.test(sql),
        ),
      ).toBe(false)
    })

    it('refuses a private trip the caller is not on, exactly as a trip that is not there', async () => {
      const stranger = tenant.scopeFor(await tenant.addUser('Not on the trip'))
      await expenseAt(tripId, '2026-04-10', 1.15)

      const refusal = await captureError(() =>
        findLatestFrozenRate(stranger, { tripId, ...pair }),
      )

      expect(refusal).toBeInstanceOf(NotFoundError)
    })

    it('refuses a malformed currency code', async () => {
      await expect(
        findLatestFrozenRate(tenant.scope, { tripId, from: 'gbp', to: 'EUR' }),
      ).rejects.toThrow()
    })
  })

  describe('resolveRate', () => {
    const query = { from: 'GBP', to: 'EUR', on: '2026-04-20' } as const

    function port(answer: number | null, source = 'provider'): RateSource {
      return {
        lookup: vi.fn(async () =>
          answer === null ? null : { rate: answer, source },
        ),
      }
    }

    it('answers null rather than a guess when nothing answers', async () => {
      expect(await resolveRate(tenant.scope, query)).toBeNull()
    })

    it('answers a manual rate first, over a recent one and over the port', async () => {
      await expenseAt(tripId, '2026-04-10', 1.15)
      const injected = port(1.4)

      expect(
        await resolveRate(tenant.scope, { ...query, manual: 1.25 }, injected),
      ).toEqual({ rate: 1.25, source: 'manual' })
      expect(injected.lookup).not.toHaveBeenCalled()
    })

    it('answers the most recent frozen rate over the port', async () => {
      await expenseAt(tripId, '2026-04-10', 1.15)
      const injected = port(1.4)

      expect(await resolveRate(tenant.scope, query, injected)).toEqual({
        rate: 1.15,
        source: 'recent',
      })
      expect(injected.lookup).not.toHaveBeenCalled()
    })

    it('answers from the port, under the port’s own source, when nothing was frozen', async () => {
      const injected = port(1.4, 'provider-x')

      expect(await resolveRate(tenant.scope, query, injected)).toEqual({
        rate: 1.4,
        source: 'provider-x',
      })
      expect(injected.lookup).toHaveBeenCalledWith(query)
    })

    it('treats a port answer that is not a finite positive rate as a miss', async () => {
      for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(await resolveRate(tenant.scope, query, port(bad))).toBeNull()
      }
    })

    it('answers null when the port has nothing either', async () => {
      expect(await resolveRate(tenant.scope, query, port(null))).toBeNull()
    })

    it('has no port unless one is injected', async () => {
      // No default implementation: with none injected the answer comes from the first two sources.
      await expenseAt(tripId, '2026-04-10', 1.15)
      expect(await resolveRate(tenant.scope, query)).toEqual({
        rate: 1.15,
        source: 'recent',
      })
    })

    it('does not invert a rate frozen for the opposite pair', async () => {
      await expenseAt(tripId, '2026-04-10', 1.15)

      expect(
        await resolveRate(tenant.scope, {
          from: 'EUR',
          to: 'GBP',
          on: '2026-04-20',
        }),
      ).toBeNull()
    })

    it.each([
      ['zero', 0],
      ['negative', -2],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
    ])('refuses a manual rate that is %s', async (_name, manual) => {
      await expenseAt(tripId, '2026-04-10', 1.15)

      await expect(
        resolveRate(tenant.scope, { ...query, manual }),
      ).rejects.toThrow()
    })

    it('reads the whole workspace’s frozen rates, not one trip’s', async () => {
      await expenseAt(otherTripId, '2026-07-12', 1.3)

      expect((await resolveRate(tenant.scope, query))?.rate).toBe(1.3)
    })

    it('draws only from trips the caller can read', async () => {
      const stranger = tenant.scopeFor(await tenant.addUser('Not on any trip'))
      await expenseAt(tripId, '2026-04-10', 1.15)

      // Both of the owner's trips are private and the stranger is on neither.
      expect(await resolveRate(stranger, query)).toBeNull()

      // A workspace-visible trip is readable by every member, so its rate answers.
      await updateTrip(tenant.scope, tripId, { visibility: 'organization' })
      expect(await resolveRate(stranger, query)).toEqual({
        rate: 1.15,
        source: 'recent',
      })
    })

    it('answers a member of a private trip with that trip’s rate, and not another private trip’s', async () => {
      const friend = tenant.scopeFor(friendId)
      const solo = await createTrip(tenant.scope, {
        title: 'Owner only',
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        currency: 'EUR',
      })
      await expenseAt(tripId, '2026-04-10', 1.15)
      await expenseAt(solo.id, '2026-09-02', 1.5)

      expect((await resolveRate(friend, query))?.rate).toBe(1.15)
    })
  })

  describe('who can reach it', () => {
    // The stored rate of a single expense or payment is derived from its amount pair and never taken
    // from a lookup (`impliedRate`, `toRepoInput`), so nothing a per-row writer imports may lead to
    // this module. Read off the shipped sources because the absence of a call has no behavioural
    // trace: a reflex `resolveRate()` added to a writer would pass every other test.
    const IMPORT = /(?:from|import\()\s*['"]([^'"]+)['"]/g

    function resolveSource(from: string, specifier: string): string | null {
      const base = specifier.startsWith('#/')
        ? resolve(HERE, '../../..', specifier.slice(2))
        : specifier.startsWith('.')
          ? resolve(dirname(from), specifier)
          : null
      if (base === null) {
        return null
      }
      for (const candidate of [
        `${base}.ts`,
        `${base}.tsx`,
        resolve(base, 'index.ts'),
      ]) {
        try {
          readFileSync(candidate)
          return candidate
        } catch {
          // Not this candidate.
        }
      }
      return null
    }

    function reachableFrom(entry: string): Set<string> {
      const seen = new Set<string>()
      const queue = [entry]
      while (queue.length > 0) {
        const file = queue.pop()
        if (file === undefined || seen.has(file)) {
          continue
        }
        seen.add(file)
        const source = readFileSync(file, 'utf8')
        for (const match of source.matchAll(IMPORT)) {
          const next = resolveSource(file, match[1] ?? '')
          if (next !== null) {
            queue.push(next)
          }
        }
      }
      return seen
    }

    it('is not imported, directly or through anything they import, by createExpense, updateExpense or createSettlement', () => {
      // All three are declared in `expenses.ts`, so its import closure is theirs.
      const reachable = reachableFrom(resolve(HERE, '../expenses.ts'))

      expect(reachable.has(resolve(HERE, '../expenses.ts'))).toBe(true)
      expect(reachable.has(resolve(HERE, '../rates.ts'))).toBe(false)
      // The barrel re-exports every repository, this one included.
      expect(reachable.has(resolve(HERE, '../index.ts'))).toBe(false)
    })

    it('is not named by the server functions that feed those writers', () => {
      // `toRepoInput` in `fns/costs.ts` derives the stored rate and reaches the repositories through
      // the barrel, which re-exports this module, so an import closure cannot tell: read the names.
      const source = readFileSync(resolve(HERE, '../../fns/costs.ts'), 'utf8')

      expect(source).not.toMatch(
        /\b(?:resolveRate|findLatestFrozenRate|RateSource)\b/,
      )
    })
  })
})
