import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import { CostsRail } from '../rail'

import type { Catalogue } from '#/lib/i18n'
import type { CostsSnapshot } from '#/components/costs'
import type { CostsPerson, CostsSettlement } from '#/server/fns/costs'

const EN: Catalogue = namespaceCatalogue('costs', Costs)

afterEach(cleanup)

const PEOPLE: ReadonlyArray<CostsPerson> = [
  {
    userId: 'u-1',
    name: 'Rafał',
    email: 'rafal@example.com',
    image: null,
    role: 'owner',
  },
  {
    userId: 'u-2',
    name: 'Anna',
    email: 'anna@example.com',
    image: null,
    role: 'editor',
  },
]

function payment(id: string): CostsSettlement {
  return {
    id,
    fromUserId: 'u-1',
    toUserId: 'u-2',
    amountMinor: 1_000,
    currency: 'EUR',
    convertedMinor: 1_000,
    method: 'cash',
    settledOn: '2026-04-11',
    note: null,
  }
}

function mount(
  settlements: ReadonlyArray<CostsSettlement>,
  canWrite: boolean,
  onDeletePayment: (payment: CostsSettlement) => void = () => undefined,
) {
  const snapshot: CostsSnapshot = {
    expenses: [],
    settlements,
    balances: [],
    byCategory: [],
    suggestions: [],
    spentMinor: 0,
    expenseCount: 0,
    busyExpenseIds: new Set(),
    busy: false,
  }
  return render(
    <I18nProvider locale="en" messages={EN}>
      <CostsRail
        snapshot={snapshot}
        people={PEOPLE}
        viewerUserId="u-1"
        currency="EUR"
        display={{ mode: 'per-trip', code: 'EUR' }}
        budgetTargetMinor={null}
        canWrite={canWrite}
        onSettle={() => undefined}
        onAddPayment={() => undefined}
        onDeletePayment={onDeletePayment}
      />
    </I18nProvider>,
  )
}

const deleteButtons = () =>
  screen.queryAllByRole('button', { name: /^Delete the payment/ })

describe('the Payments list', () => {
  it('offers a delete action per payment to someone who may write money, named after the payment', async () => {
    const user = userEvent.setup({ delay: null })
    const onDelete = vi.fn()
    const rows = [payment('pay-1'), payment('pay-2')]
    mount(rows, true, onDelete)

    expect(deleteButtons()).toHaveLength(2)
    const first = deleteButtons()[0]
    expect(first.getAttribute('aria-label')).toBe(
      'Delete the payment from You to Anna, €10.00',
    )

    await user.click(first)

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith(rows[0])
  })

  it('offers nothing to delete to someone who may only read', () => {
    mount([payment('pay-1')], false)

    expect(deleteButtons()).toEqual([])
  })

  it('offers nothing on a payment that has not reached the server yet', () => {
    mount([payment('pending-abc123')], true)

    expect(deleteButtons()).toEqual([])
  })
})
