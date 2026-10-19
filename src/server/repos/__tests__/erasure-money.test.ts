import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { expenses, expenseShares, settlements } from '#/server/db/schema'
import { createErasureScope } from '#/server/erasure/scope'
import { eraseUserMoney } from '../expenses-erasure'
import { createTenantRepository } from '../base'
import { getMemberBalances } from '../expenses'
import { createTrip } from '../trips'
import { createHarness } from './harness'
import type { Harness } from './harness'

const expenseRepo = createTenantRepository(expenses, 'expense')
const shareRepo = createTenantRepository(expenseShares, 'share')
const settlementRepo = createTenantRepository(settlements, 'settlement')

describe('erasing money', () => {
  let harness: Harness
  beforeEach(async () => {
    harness = await createHarness()
  })
  afterEach(() => harness.close())

  it('preserves amounts, distinct shares and settlements across two erasures, including another workspace', async () => {
    const a = await harness.seedTenant('a')
    const b = await harness.seedTenant('b')
    const tripIds: string[] = []
    for (const tenant of [a, b]) {
      const trip = await createTrip(tenant.scope, {
        title: 'Trip',
        slug: 'trip',
      })
      tripIds.push(trip.id)
      for (let i = 0; i < 105; i++) {
        const expense = await expenseRepo.insert(tenant.scope, {
          tripId: trip.id,
          title: 'Food',
          spentOn: '2026-10-19',
          amountMinor: 100,
          currency: 'EUR',
          paidBy: 'person',
          createdBy: 'second',
        })
        await shareRepo.insert(tenant.scope, {
          tripId: trip.id,
          expenseId: expense.id,
          userId: 'person',
          shareMinor: 40,
        })
        await shareRepo.insert(tenant.scope, {
          tripId: trip.id,
          expenseId: expense.id,
          userId: 'second',
          shareMinor: 60,
        })
      }
      await settlementRepo.insert(tenant.scope, {
        tripId: trip.id,
        fromUserId: 'person',
        toUserId: 'second',
        createdBy: 'person',
        settledOn: '2026-10-19',
        amountMinor: 20,
        currency: 'EUR',
      })
    }
    const tripId = tripIds[0]
    if (tripId === undefined) throw new Error('Missing trip')
    const before = await getMemberBalances(a.scope, tripId)
    const scope = createErasureScope(harness.db, a.organizationId)
    await eraseUserMoney(scope, 'person', 'erased_first')
    await eraseUserMoney(scope, 'second', 'erased_second')
    await eraseUserMoney(scope, 'person', 'erased_first')
    const after = await getMemberBalances(a.scope, tripId)
    expect(after).toEqual(
      before.map((row) => ({
        ...row,
        userId: row.userId === 'person' ? 'erased_first' : 'erased_second',
      })),
    )
    const rows = await expenseRepo.findMany(a.scope)
    expect(rows).toHaveLength(105)
    expect(
      rows.every(
        (r) =>
          r.paidBy === 'erased_first' &&
          r.createdBy === 'erased_second' &&
          r.amountMinor === 100,
      ),
    ).toBe(true)
    const shares = await shareRepo.findMany(a.scope)
    expect(
      shares
        .filter((r) => r.userId === 'erased_first')
        .reduce((n, r) => n + r.shareMinor, 0),
    ).toBe(4200)
    expect(
      shares
        .filter((r) => r.userId === 'erased_second')
        .reduce((n, r) => n + r.shareMinor, 0),
    ).toBe(6300)
    expect((await settlementRepo.findMany(a.scope))[0]).toMatchObject({
      fromUserId: 'erased_first',
      toUserId: 'erased_second',
      createdBy: 'erased_first',
      amountMinor: 20,
    })
    expect(
      (await expenseRepo.findMany(b.scope)).every(
        (r) => r.paidBy === 'person' && r.createdBy === 'second',
      ),
    ).toBe(true)
    expect(
      (await shareRepo.findMany(b.scope)).some((r) =>
        r.userId.startsWith('erased_'),
      ),
    ).toBe(false)
    expect((await settlementRepo.findMany(b.scope))[0]).toMatchObject({
      fromUserId: 'person',
      toUserId: 'second',
    })
  })
})
