import '#/components/ui/__tests__/test-env'

import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/ar/costs'
import Modules from '#/lib/i18n/messages/ar/modules'
import Ui from '#/lib/i18n/messages/ar/ui'
import { ExpenseDialog } from '../expense-dialog'
import { PaymentDialog } from '../payment-dialog'
import type { ReactElement } from 'react'
import type { CostsExpense, CostsPerson } from '#/server/fns/costs'

const PEOPLE: ReadonlyArray<CostsPerson> = [
  { userId: 'u1', name: 'Ada', email: '', image: null, role: 'owner' },
  {
    userId: 'u2',
    name: 'Removed traveller',
    email: '',
    image: null,
    role: 'editor',
    leftWorkspace: true,
  },
]
const EXPENSE: CostsExpense = {
  id: 'e1',
  title: 'Dinner',
  category: 'food',
  amountMinor: 6000,
  currency: 'EUR',
  originalAmountMinor: null,
  originalCurrency: null,
  exchangeRate: null,
  convertedMinor: null,
  spentOn: '2026-10-12',
  paidBy: 'u2',
  splitMethod: 'equal',
  notes: null,
  shares: [{ userId: 'u2', shareMinor: 6000, weight: 1, isSettled: false }],
}

afterEach(cleanup)

function mount(dialog: ReactElement): void {
  render(
    <I18nProvider
      locale="ar"
      messages={{
        ...namespaceCatalogue('costs', Costs),
        ...namespaceCatalogue('modules', Modules),
        ...namespaceCatalogue('ui', Ui),
      }}
    >
      {dialog}
    </I18nProvider>,
  )
}

async function expectRemovedPayer(): Promise<void> {
  const user = userEvent.setup({ delay: null })
  const payer = screen.getByRole('combobox', { name: Costs['field.paidBy'] })
  expect(payer.textContent).toContain(Costs['person.removed'])
  expect(screen.queryByText('Removed traveller')).toBeNull()
  await user.click(payer)
  expect(
    await screen.findByRole('option', { name: Costs['person.removed'] }),
  ).toBeTruthy()
}

it('names a carried removed payer and split row in Arabic when editing an expense', async () => {
  mount(
    <ExpenseDialog
      open
      onOpenChange={() => {}}
      expense={EXPENSE}
      people={PEOPLE}
      viewerUserId="u1"
      tripCurrency="EUR"
      categories={[{ value: 'food', label: 'Food', icon: null }]}
      defaultCategory="food"
      today="2026-10-12"
      onSubmit={async () => {}}
    />,
  )
  const name = Costs['split.includeFor'].replace(
    '{name}',
    Costs['person.removed'],
  )
  expect(
    screen.getByRole('checkbox', { name }).getAttribute('aria-checked'),
  ).toBe('true')
  await expectRemovedPayer()
})

it('names a carried removed payer in Arabic when recording a payment', async () => {
  mount(
    <PaymentDialog
      open
      onOpenChange={() => {}}
      seed={{ fromUserId: 'u2', toUserId: 'u1', amountMinor: 6000 }}
      people={PEOPLE}
      viewerUserId="u1"
      currency="EUR"
      today="2026-10-12"
      onSubmit={async () => {}}
    />,
  )
  await expectRemovedPayer()
})
