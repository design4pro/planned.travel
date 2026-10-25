import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import { formatDayLabel } from '#/components/costs'
import { CostsRail, isolate, paymentArrow } from '../rail'

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

function payment(id: string, settledOn = '2026-04-11'): CostsSettlement {
  return {
    id,
    fromUserId: 'u-1',
    toUserId: 'u-2',
    amountMinor: 1_000,
    currency: 'EUR',
    convertedMinor: 1_000,
    method: 'cash',
    settledOn,
    note: null,
  }
}

function mount(
  settlements: ReadonlyArray<CostsSettlement>,
  canWrite: boolean,
  onDeletePayment: (payment: CostsSettlement) => void = () => undefined,
  paymentsRef = createRef<HTMLDivElement>(),
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
        departedPeople={[]}
        viewerUserId="u-1"
        currency="EUR"
        display={{ mode: 'per-trip', code: 'EUR' }}
        budgetTargetMinor={null}
        canWrite={canWrite}
        onSettle={() => undefined}
        onAddPayment={() => undefined}
        onDeletePayment={onDeletePayment}
        paymentsRef={paymentsRef}
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
    // Names rather than the arrow line's "You", and the day, so two payments of the same amount
    // between the same people have different names.
    expect(first.getAttribute('aria-label')).toBe(
      `Delete the payment from Rafał to Anna, €10.00, ${formatDayLabel('2026-04-11', 'en')}`,
    )

    await user.click(first)

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith(rows[0])
  })

  it('tells two payments of the same amount between the same people apart', () => {
    mount(
      [payment('pay-1', '2026-04-11'), payment('pay-2', '2026-04-12')],
      true,
    )

    const names = deleteButtons().map((button) =>
      button.getAttribute('aria-label'),
    )
    expect(new Set(names).size).toBe(2)
  })

  it('isolates each name of the arrow line, so two Latin-script names cannot turn a mirrored arrow around', () => {
    const { container } = mount([payment('pay-1')], false)

    const row = container.querySelector('li p')
    expect(
      Array.from(row?.querySelectorAll('bdi') ?? []).map((n) => n.textContent),
    ).toEqual(['You', 'Anna'])
  })

  it('points the arrow the way the money goes in both writing directions', () => {
    expect(paymentArrow('en')).toBe('→')
    expect(paymentArrow('ar')).toBe('←')
    expect(isolate('Anna')).toBe('\u2068Anna\u2069')
  })

  it('hands the dialog a focus target that survives the row being deleted', () => {
    const paymentsRef = createRef<HTMLDivElement>()
    mount([payment('pay-1')], true, undefined, paymentsRef)

    const region = paymentsRef.current
    expect(region).not.toBeNull()
    expect(region?.getAttribute('tabindex')).toBe('-1')
    expect(region?.getAttribute('role')).toBe('group')
    expect(region?.getAttribute('aria-label')).toBe(Costs['payments.label'])
    expect(region?.contains(deleteButtons()[0])).toBe(true)
  })

  it('keeps the focus target when the last payment is gone', () => {
    const paymentsRef = createRef<HTMLDivElement>()
    mount([], true, undefined, paymentsRef)

    expect(paymentsRef.current).not.toBeNull()
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
