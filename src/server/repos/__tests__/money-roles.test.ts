/**
 * Who may write a trip's money, at the repository seam (#837).
 *
 * An owner and an editor write expenses, shares, payments and planned budget lines; a viewer, and a
 * workspace member who only reads an organization-visible trip, read. The guard sits in the
 * repository so it holds for every caller - the costs server functions, the booking ledger sync and
 * whatever route comes next - and each writer is asked in the order the boundary needs: the trip is
 * visible (`NotFoundError` if not), then the role (`TripRoleError` if not), then the write.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError } from '../context'
import {
  MONEY_WRITE_ROLES,
  canWriteMoney,
  createBudgetItem,
  createExpense,
  createSettlement,
  deleteBudgetItem,
  deleteExpense,
  deleteSettlement,
  getExpenseWithShares,
  getMemberBalances,
  listBudgetItems,
  listSettlements,
  markShareSettled,
  setExpenseShares,
  updateBudgetItem,
  updateExpense,
} from '../expenses'
import {
  createReservation,
  getReservation,
  linkReservationExpense,
} from '../reservations'
import { TripRoleError, addTripMember, createTrip, updateTrip } from '../trips'
import { captureError, createHarness } from './harness'
import type { TenantScope } from '../base'
import type { Harness, SeededTenant } from './harness'

interface Ledger {
  readonly tripId: string
  readonly expenseId: string
  readonly shareId: string
  readonly budgetItemId: string
  readonly settlementId: string
  readonly reservationId: string
}

describe('who writes a trip’s money', () => {
  let harness: Harness
  let tenant: SeededTenant
  let ledger: Ledger
  let ownerId: string
  let payerId: string
  let viewer: TenantScope
  let editor: TenantScope
  let reader: TenantScope

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('money-roles')
    ownerId = tenant.ownerUserId
    payerId = await tenant.addUser('The payer')
    const viewerId = await tenant.addUser('A viewer')
    const editorId = await tenant.addUser('An editor')
    const readerId = await tenant.addUser('A reader who is not on the trip')

    const trip = await createTrip(tenant.scope, {
      title: 'Lisbon, together',
      slug: 'lisbon-together',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
    })
    await addTripMember(tenant.scope, {
      tripId: trip.id,
      userId: payerId,
      role: 'viewer',
    })
    await addTripMember(tenant.scope, {
      tripId: trip.id,
      userId: viewerId,
      role: 'viewer',
    })
    await addTripMember(tenant.scope, {
      tripId: trip.id,
      userId: editorId,
      role: 'editor',
    })
    await updateTrip(tenant.scope, trip.id, { visibility: 'organization' })

    viewer = tenant.scopeFor(viewerId)
    editor = tenant.scopeFor(editorId)
    reader = tenant.scopeFor(readerId)

    const { expense, shares } = await createExpense(tenant.scope, {
      tripId: trip.id,
      title: 'Dinner',
      amountMinor: 6_000,
      spentOn: '2026-04-10',
      paidBy: ownerId,
      participants: [{ userId: ownerId }, { userId: payerId }],
    })
    const share = shares.at(0)
    if (share === undefined) {
      throw new Error('A split expense must have share rows.')
    }
    const budgetItem = await createBudgetItem(tenant.scope, {
      tripId: trip.id,
      name: 'Food',
      plannedAmountMinor: 20_000,
    })
    const settlement = await createSettlement(tenant.scope, {
      tripId: trip.id,
      fromUserId: payerId,
      toUserId: ownerId,
      amountMinor: 1_000,
      settledOn: '2026-04-11',
    })
    const booking = await createReservation(tenant.scope, {
      tripId: trip.id,
      title: 'Table for four',
    })
    await linkReservationExpense(tenant.scope, booking.id, expense.id)
    ledger = {
      tripId: trip.id,
      expenseId: expense.id,
      shareId: share.id,
      budgetItemId: budgetItem.id,
      settlementId: settlement.id,
      reservationId: booking.id,
    }
  })

  /** Everything a refused write could have changed, read back as the owner. */
  async function snapshot(): Promise<unknown> {
    return {
      expense: await getExpenseWithShares(tenant.scope, ledger.expenseId),
      budgetItems: await listBudgetItems(tenant.scope, ledger.tripId),
      settlements: await listSettlements(tenant.scope, ledger.tripId),
      balances: await getMemberBalances(tenant.scope, ledger.tripId),
      bookingLink: (await getReservation(tenant.scope, ledger.reservationId))
        ?.expenseId,
    }
  }

  /**
   * One entry per writer in the expenses repository, each aimed at the seeded ledger. The order is
   * one a caller who is allowed can run straight through: `markShareSettled` before the resplit
   * replaces the share row, and `deleteExpense` last.
   */
  function writers(
    scope: TenantScope,
  ): ReadonlyArray<readonly [string, () => Promise<unknown>]> {
    const { tripId } = ledger
    return [
      [
        'createExpense',
        () =>
          createExpense(scope, {
            tripId,
            title: 'Taxi',
            amountMinor: 900,
            spentOn: '2026-04-12',
          }),
      ],
      [
        'updateExpense',
        () =>
          updateExpense(scope, tripId, ledger.expenseId, {
            title: 'Rewritten',
            amountMinor: 1,
          }),
      ],
      [
        'markShareSettled',
        () => markShareSettled(scope, tripId, ledger.shareId, true),
      ],
      [
        'setExpenseShares',
        () =>
          setExpenseShares(scope, tripId, ledger.expenseId, [
            { userId: ownerId },
          ]),
      ],
      [
        'createSettlement',
        () =>
          createSettlement(scope, {
            tripId,
            fromUserId: payerId,
            toUserId: ownerId,
            amountMinor: 500,
            settledOn: '2026-04-12',
          }),
      ],
      [
        'deleteSettlement',
        () => deleteSettlement(scope, tripId, ledger.settlementId),
      ],
      [
        'createBudgetItem',
        () => createBudgetItem(scope, { tripId, name: 'Museums' }),
      ],
      [
        'updateBudgetItem',
        () =>
          updateBudgetItem(scope, tripId, ledger.budgetItemId, {
            name: 'Rewritten',
          }),
      ],
      [
        'deleteBudgetItem',
        () => deleteBudgetItem(scope, tripId, ledger.budgetItemId),
      ],
      ['deleteExpense', () => deleteExpense(scope, tripId, ledger.expenseId)],
    ]
  }

  const WRITER_COUNT = 10

  it('names every writer the repository has', () => {
    expect(writers(tenant.scope)).toHaveLength(WRITER_COUNT)
  })

  describe.each([
    ['a viewer', () => viewer],
    [
      'a workspace member who only reads the organization-visible trip',
      () => reader,
    ],
  ])('%s', (_label, scopeOf) => {
    it('is refused every writer with TripRoleError, and nothing changes', async () => {
      const before = await snapshot()

      for (const [name, write] of writers(scopeOf())) {
        const error = await captureError(write)
        expect(error, name).toBeInstanceOf(TripRoleError)
      }

      expect(await snapshot()).toEqual(before)
    })
  })

  it('keeps the booking link when a viewer tries to delete the expense it points at', async () => {
    await captureError(() =>
      deleteExpense(viewer, ledger.tripId, ledger.expenseId),
    )
    expect(
      (await getReservation(tenant.scope, ledger.reservationId))?.expenseId,
    ).toBe(ledger.expenseId)
  })

  it('refuses a viewer before it looks the row up, so a missing id is a role refusal too', async () => {
    const error = await captureError(() =>
      deleteExpense(viewer, ledger.tripId, 'no-such-expense'),
    )
    expect(error).toBeInstanceOf(TripRoleError)
  })

  it('still lets a viewer read everything the costs screen loads', async () => {
    expect(await listBudgetItems(viewer, ledger.tripId)).toHaveLength(1)
    expect(await listSettlements(viewer, ledger.tripId)).toHaveLength(1)
    expect(await getMemberBalances(viewer, ledger.tripId)).not.toHaveLength(0)
    expect(
      (await getExpenseWithShares(viewer, ledger.expenseId)).expense.title,
    ).toBe('Dinner')
  })

  describe.each([
    ['an editor', () => editor],
    ['the owner', () => tenant.scope],
  ])('%s', (_label, scopeOf) => {
    it('writes every writer', async () => {
      for (const [name, write] of writers(scopeOf())) {
        await expect(write(), name).resolves.not.toBeInstanceOf(Error)
      }
    })
  })

  describe('a caller who cannot see the trip', () => {
    it('gets NotFoundError, never TripRoleError, from every writer of a private trip', async () => {
      await updateTrip(tenant.scope, ledger.tripId, { visibility: 'private' })
      const before = await snapshot()

      for (const [name, write] of writers(reader)) {
        const error = await captureError(write)
        expect(error, name).toBeInstanceOf(NotFoundError)
      }

      expect(await snapshot()).toEqual(before)
    })

    it('gets NotFoundError from every writer when the trip is another workspace’s', async () => {
      const other = await harness.seedTenant('money-roles-other')
      const before = await snapshot()

      for (const [name, write] of writers(other.scope)) {
        const error = await captureError(write)
        expect(error, name).toBeInstanceOf(NotFoundError)
      }

      expect(await snapshot()).toEqual(before)
    })
  })
})

describe('canWriteMoney', () => {
  it('admits an owner and an editor, and nobody else', () => {
    expect(canWriteMoney('owner')).toBe(true)
    expect(canWriteMoney('editor')).toBe(true)
    expect(canWriteMoney('viewer')).toBe(false)
    expect(canWriteMoney(null)).toBe(false)
  })

  it('is the list the guard enforces', () => {
    expect([...MONEY_WRITE_ROLES].sort()).toEqual(['editor', 'owner'])
  })
})
