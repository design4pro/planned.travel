/**
 * Replacing the shares of a cost line is one all-or-nothing batch, at the repository seam (#884).
 *
 * `writeShares` used to delete every share row and then insert the new ones as separate statements,
 * so a failure between the two left the line with no split at all. The failures below are real
 * database errors raised after the delete would have run: a participant named twice trips the
 * `(expense_id, user_id)` unique index on the insert.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { RepositoryError } from '../context'
import {
  createExpense,
  getExpenseWithShares,
  setExpenseShares,
  updateExpense,
} from '../expenses'
import { addTripMember, createTrip } from '../trips'
import { captureError, createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'

describe('replacing the shares of a cost line', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let expenseId: string
  let friend: string

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('atomic-shares')
    const trip = await createTrip(tenant.scope, {
      title: 'Tokyo',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
      currency: 'JPY',
    })
    tripId = trip.id
    friend = await tenant.addUser('A friend')
    await addTripMember(tenant.scope, {
      tripId,
      userId: friend,
      role: 'editor',
    })
    const { expense } = await createExpense(tenant.scope, {
      tripId,
      title: 'Dinner',
      amountMinor: 10_000,
      currency: 'JPY',
      spentOn: '2026-04-11',
      participants: [{ userId: tenant.ownerUserId }, { userId: friend }],
    })
    expenseId = expense.id
  })

  it('keeps the previous split when an insert fails after the delete', async () => {
    const before = await getExpenseWithShares(tenant.scope, expenseId)

    const failure = await captureError(() =>
      setExpenseShares(tenant.scope, tripId, expenseId, [
        { userId: friend },
        { userId: friend },
      ]),
    )

    expect(failure).toBeInstanceOf(Error)
    expect(await getExpenseWithShares(tenant.scope, expenseId)).toEqual(before)
  })

  it('keeps the previous split when an edit of the participants fails', async () => {
    const before = (await getExpenseWithShares(tenant.scope, expenseId)).shares

    await captureError(() =>
      updateExpense(tenant.scope, tripId, expenseId, {
        participants: [{ userId: friend }, { userId: friend }],
      }),
    )

    expect(
      (await getExpenseWithShares(tenant.scope, expenseId)).shares,
    ).toEqual(before)
  })

  it('keeps the previous split when the last of a large split fails', async () => {
    const crowd: Array<string> = []
    for (let index = 0; index < 12; index += 1) {
      const userId = await tenant.addUser(`Guest ${index}`)
      await addTripMember(tenant.scope, { tripId, userId, role: 'viewer' })
      crowd.push(userId)
    }
    const before = await getExpenseWithShares(tenant.scope, expenseId)

    await captureError(() =>
      setExpenseShares(tenant.scope, tripId, expenseId, [
        ...crowd.map((userId) => ({ userId })),
        { userId: crowd[11] ?? friend },
      ]),
    )

    expect(await getExpenseWithShares(tenant.scope, expenseId)).toEqual(before)
  })

  it('keeps the previous split when the new split does not add up', async () => {
    const before = await getExpenseWithShares(tenant.scope, expenseId)

    const failure = await captureError(() =>
      setExpenseShares(
        tenant.scope,
        tripId,
        expenseId,
        [
          { userId: tenant.ownerUserId, shareMinor: 1 },
          { userId: friend, shareMinor: 1 },
        ],
        'exact',
      ),
    )

    expect(failure).toBeInstanceOf(RepositoryError)
    expect(await getExpenseWithShares(tenant.scope, expenseId)).toEqual(before)
  })

  it('returns the shares in participant order, for a split larger than one statement could carry', async () => {
    const crowd: Array<string> = []
    for (let index = 0; index < 12; index += 1) {
      const userId = await tenant.addUser(`Guest ${index}`)
      await addTripMember(tenant.scope, { tripId, userId, role: 'viewer' })
      crowd.push(userId)
    }
    const order = [...crowd].reverse()

    const shares = await setExpenseShares(
      tenant.scope,
      tripId,
      expenseId,
      order.map((userId) => ({ userId })),
    )

    expect(shares.map((share) => share.userId)).toEqual(order)
    expect(shares.reduce((total, share) => total + share.shareMinor, 0)).toBe(
      10_000,
    )
    expect(
      (await getExpenseWithShares(tenant.scope, expenseId)).shares
        .map((share) => share.userId)
        .sort(),
    ).toEqual([...order].sort())
  })

  it('removes the split when the participant list is empty', async () => {
    expect(await setExpenseShares(tenant.scope, tripId, expenseId, [])).toEqual(
      [],
    )
    expect(
      (await getExpenseWithShares(tenant.scope, expenseId)).shares,
    ).toEqual([])
  })

  it('never touches the shares of another workspace', async () => {
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

    await captureError(() =>
      setExpenseShares(tenant.scope, abroad.id, expense.id, [
        { userId: tenant.ownerUserId },
      ]),
    )
    await captureError(() =>
      updateExpense(tenant.scope, abroad.id, expense.id, {
        participants: [{ userId: tenant.ownerUserId }],
      }),
    )

    expect(await getExpenseWithShares(elsewhere.scope, expense.id)).toEqual(
      before,
    )
  })

  it('sends the replacement as one batch whose statements all carry the workspace', async () => {
    harness.statements.length = 0

    await setExpenseShares(tenant.scope, tripId, expenseId, [
      { userId: tenant.ownerUserId },
    ])

    const writes = harness.statements.filter((sql) =>
      /^(delete from|insert into) "expense_shares"/i.test(sql),
    )
    expect(writes).toHaveLength(2)
    expect(writes[0]).toMatch(/"organization_id" = \?/)
    expect(writes[1]).toMatch(/"organization_id"/)
  })
})
