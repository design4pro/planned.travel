import '#/components/ui/__tests__/test-env'

import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import Modules from '#/lib/i18n/messages/en/modules'
import Ui from '#/lib/i18n/messages/en/ui'
import Shell from '#/lib/i18n/messages/en/shell'
import { ExpenseDialog } from '../expense-dialog'
import type { CostsExpense } from '#/server/fns/costs'

const messages = {
  ...namespaceCatalogue('shell', Shell),
  ...namespaceCatalogue('costs', Costs),
  ...namespaceCatalogue('modules', Modules),
  ...namespaceCatalogue('ui', Ui),
}

const inconsistentExpense: CostsExpense = {
  id: 'expense',
  title: 'Dinner',
  category: 'food',
  amountMinor: 6_000,
  currency: 'EUR',
  originalAmountMinor: null,
  originalCurrency: null,
  exchangeRate: null,
  convertedMinor: null,
  spentOn: '2026-05-10',
  paidBy: 'person',
  splitMethod: 'exact',
  notes: null,
  shares: [
    { userId: 'person', shareMinor: 4_000, weight: 1, isSettled: false },
  ],
}

afterEach(cleanup)

it.each([
  { state: 'new expense', expense: null },
  { state: 'inconsistent stored split', expense: inconsistentExpense },
])(
  'resolves every accessible name and description for $state',
  ({ expense }) => {
    render(
      <I18nProvider locale="en" messages={messages}>
        <ExpenseDialog
          open
          onOpenChange={() => {}}
          expense={expense}
          people={[
            {
              userId: 'person',
              name: 'Ada',
              email: '',
              image: null,
              role: 'owner',
            },
          ]}
          viewerUserId="person"
          tripCurrency="EUR"
          categories={[{ value: 'food', label: 'Food', icon: null }]}
          defaultCategory="food"
          today="2026-10-12"
          onSubmit={async () => {}}
        />
      </I18nProvider>,
    )
    const dialog = screen.getByRole('dialog')
    for (const attribute of ['aria-labelledby', 'aria-describedby']) {
      const references = dialog.getAttribute(attribute)?.trim().split(/\s+/)
      expect(references?.length).toBeGreaterThan(0)
      for (const id of references ?? []) {
        const target = document.getElementById(id)
        expect(target).not.toBeNull()
        expect(target?.textContent?.trim().length).toBeGreaterThan(0)
      }
    }
  },
)
