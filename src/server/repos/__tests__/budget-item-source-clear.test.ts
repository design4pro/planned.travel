/**
 * Editing a planned item and its source triple (#1521).
 *
 * A re-basing leaves a planned item holding the figure the traveller typed beside the converted
 * one. An edit that moves the amount or the currency without a new typed figure must drop all three
 * columns, so no item carries a typed figure that disagrees with its amount; an edit of anything else
 * keeps them.
 */

import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { budgetItems } from '#/server/db/schema'
import { NotFoundError } from '../context'
import { createBudgetItem, updateBudgetItem } from '../expenses'
import { createTrip } from '../trips'
import { captureError, createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'

const TRIPLE = {
  originalAmountMinor: 8000,
  originalCurrency: 'GBP',
  exchangeRate: 1.15,
}
const NO_TRIPLE = {
  originalAmountMinor: null,
  originalCurrency: null,
  exchangeRate: null,
}

describe('updateBudgetItem and the source triple', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let itemId: string

  async function seedItem(scope: SeededTenant['scope'], trip: string) {
    const item = await createBudgetItem(scope, {
      tripId: trip,
      name: 'Hotel',
      plannedAmountMinor: 10_000,
      currency: 'EUR',
      persons: 2,
      days: 3,
      note: 'Baixa',
    })
    await harness.db
      .update(budgetItems)
      .set(TRIPLE)
      .where(eq(budgetItems.id, item.id))
    return item.id
  }

  async function rowOf(id: string) {
    const [row] = await harness.db
      .select()
      .from(budgetItems)
      .where(eq(budgetItems.id, id))
    return row
  }

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('planned-triple')
    const trip = await createTrip(tenant.scope, {
      title: 'Lisbon',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
      currency: 'EUR',
    })
    tripId = trip.id
    itemId = await seedItem(tenant.scope, tripId)
  })

  it.each([
    ['amount', { plannedAmountMinor: 20_000 }],
    ['currency', { currency: 'USD' }],
  ])('clears the triple when the %s changes', async (_, change) => {
    const item = await updateBudgetItem(tenant.scope, tripId, itemId, change)

    expect(item).toMatchObject({ ...change, ...NO_TRIPLE })
    expect(await rowOf(itemId)).toMatchObject(NO_TRIPLE)
  })

  it.each([
    ['name', { name: 'Hotel Baixa' }],
    ['note', { note: 'Breakfast included' }],
    ['persons', { persons: 3 }],
    ['days', { days: 4 }],
  ])('keeps the triple when only the %s changes', async (_, change) => {
    const item = await updateBudgetItem(tenant.scope, tripId, itemId, change)

    expect(item).toMatchObject({
      ...change,
      plannedAmountMinor: 10_000,
      ...TRIPLE,
    })
  })

  it('keeps the triple when the amount and currency are sent back unchanged', async () => {
    const item = await updateBudgetItem(tenant.scope, tripId, itemId, {
      name: 'Hotel Baixa',
      plannedAmountMinor: 10_000,
      currency: 'EUR',
    })

    expect(item).toMatchObject(TRIPLE)
  })

  it('leaves an item of another workspace and its triple alone', async () => {
    const elsewhere = await harness.seedTenant('elsewhere-planned')
    const abroad = await createTrip(elsewhere.scope, {
      title: 'Porto',
      startDate: '2026-05-01',
      endDate: '2026-05-03',
      currency: 'EUR',
    })
    const foreignId = await seedItem(elsewhere.scope, abroad.id)

    expect(
      await captureError(() =>
        updateBudgetItem(tenant.scope, abroad.id, foreignId, {
          plannedAmountMinor: 20_000,
        }),
      ),
    ).toBeInstanceOf(NotFoundError)
    expect(await rowOf(foreignId)).toMatchObject({
      plannedAmountMinor: 10_000,
      ...TRIPLE,
    })
  })
})
