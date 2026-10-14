/**
 * Repricing a cost line for a booking, at the repository seam (#881).
 *
 * `repriceExpense` rewrites an expense and its shares in one batch, with statements it builds
 * itself, so the claim worth a test of its own is the one `reservations.test.ts` cannot make from
 * the booking side: whoever the caller is, rows of another workspace, of another trip and of a trip
 * they may only read are refused and untouched.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError } from '../context'
import {
  createExpense,
  getExpenseWithShares,
  repriceExpense,
  updateExpense,
} from '../expenses'
import { TripRoleError, addTripMember, createTrip } from '../trips'
import { captureError, createHarness } from './harness'
import type { TenantScope } from '../base'
import type { Harness, SeededTenant } from './harness'

const REPRICE = { title: 'Dinner at Den', amountMinor: 12_001, currency: 'JPY' }

describe('repriceExpense', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let expenseId: string
  let viewer: TenantScope

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('reprice')
    const trip = await createTrip(tenant.scope, {
      title: 'Tokyo',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
      currency: 'JPY',
    })
    tripId = trip.id
    const friend = await tenant.addUser('A friend')
    await addTripMember(tenant.scope, {
      tripId,
      userId: friend,
      role: 'viewer',
    })
    viewer = tenant.scopeFor(friend)
    const { expense } = await createExpense(tenant.scope, {
      tripId,
      title: 'Dinner',
      amountMinor: 10_000,
      currency: 'JPY',
      spentOn: '2026-04-11',
    })
    expenseId = expense.id
    await updateExpense(tenant.scope, tripId, expenseId, {
      splitMethod: 'equal',
      participants: [{ userId: tenant.ownerUserId }, { userId: friend }],
    })
  })

  it('re-divides the shares of an expense of the trip it is asked about', async () => {
    const result = await repriceExpense(
      tenant.scope,
      tripId,
      expenseId,
      REPRICE,
    )

    expect(result.splitStale).toBe(false)
    expect(result.expense.amountMinor).toBe(12_001)
    expect(result.shares.map((share) => share.shareMinor)).toEqual([
      6_001, 6_000,
    ])
  })

  it('refuses an expense of another workspace and leaves it as it was', async () => {
    const elsewhere = await harness.seedTenant('elsewhere')
    const abroad = await createTrip(elsewhere.scope, {
      title: 'Lisbon',
      startDate: '2026-05-01',
      endDate: '2026-05-03',
      currency: 'JPY',
    })
    const { expense } = await createExpense(elsewhere.scope, {
      tripId: abroad.id,
      title: 'Elsewhere',
      amountMinor: 10_000,
      currency: 'JPY',
      spentOn: '2026-05-01',
      participants: [{ userId: elsewhere.ownerUserId }],
    })
    const before = await getExpenseWithShares(elsewhere.scope, expense.id)

    expect(
      await captureError(() =>
        repriceExpense(tenant.scope, abroad.id, expense.id, REPRICE),
      ),
    ).toBeInstanceOf(NotFoundError)
    expect(await getExpenseWithShares(elsewhere.scope, expense.id)).toEqual(
      before,
    )
  })

  it('refuses an expense that belongs to another trip of the workspace', async () => {
    const other = await createTrip(tenant.scope, {
      title: 'Osaka later',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      currency: 'JPY',
    })
    const before = await getExpenseWithShares(tenant.scope, expenseId)

    expect(
      await captureError(() =>
        repriceExpense(tenant.scope, other.id, expenseId, REPRICE),
      ),
    ).toBeInstanceOf(NotFoundError)
    expect(await getExpenseWithShares(tenant.scope, expenseId)).toEqual(before)
  })

  it('refuses a viewer of the trip and leaves the split as it was', async () => {
    const before = await getExpenseWithShares(tenant.scope, expenseId)

    expect(
      await captureError(() =>
        repriceExpense(viewer, tripId, expenseId, REPRICE),
      ),
    ).toBeInstanceOf(TripRoleError)
    expect(await getExpenseWithShares(tenant.scope, expenseId)).toEqual(before)
  })
})
