import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import Ui from '#/lib/i18n/messages/en/ui'
import { ExpenseList } from '../expense-list'

import type { Catalogue } from '#/lib/i18n'
import type { CostsExpense } from '#/server/fns/costs'

/**
 * A cost line whose stored shares miss its total is marked in the list (#883), for every role: a
 * reader cannot open the editor, but they see the ledger and should know it is off. The mark is
 * words and an icon, never a colour alone.
 */
const EN: Catalogue = {
  ...namespaceCatalogue('costs', Costs),
  ...namespaceCatalogue('ui', Ui),
}

afterEach(cleanup)

function line(overrides: Partial<CostsExpense>): CostsExpense {
  return {
    id: 'e1',
    title: 'Dinner',
    category: 'food',
    amountMinor: 6_000,
    currency: 'EUR',
    originalAmountMinor: null,
    originalCurrency: null,
    exchangeRate: null,
    convertedMinor: 6_000,
    spentOn: '2026-05-10',
    paidBy: 'u1',
    splitMethod: 'exact',
    notes: null,
    shares: [
      { userId: 'u1', shareMinor: 3_000, weight: 1, isSettled: false },
      { userId: 'u2', shareMinor: 3_000, weight: 1, isSettled: false },
    ],
    ...overrides,
  }
}

function show(rows: ReadonlyArray<CostsExpense>, canWrite = true): void {
  render(
    <I18nProvider locale="en" messages={EN}>
      <ExpenseList
        rows={rows}
        people={[]}
        viewerUserId="u1"
        currency="EUR"
        display={{ mode: 'per-trip', code: 'EUR' }}
        busyExpenseIds={new Set()}
        canWrite={canWrite}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    </I18nProvider>,
  )
}

const FLAG = 'Shares don’t add up'

describe('the expense list - a split that does not add up', () => {
  it('flags a line whose shares miss its total, in words', () => {
    show([
      line({
        shares: [
          { userId: 'u1', shareMinor: 3_000, weight: 1, isSettled: false },
          { userId: 'u2', shareMinor: 2_000, weight: 1, isSettled: false },
        ],
      }),
    ])
    expect(screen.getByText(FLAG)).toBeTruthy()
  })

  it('flags it for a reader who has no editor to open', () => {
    show(
      [
        line({
          shares: [
            { userId: 'u1', shareMinor: 7_000, weight: 1, isSettled: false },
          ],
        }),
      ],
      false,
    )
    expect(screen.getByText(FLAG)).toBeTruthy()
  })

  it('leaves a line whose shares add up alone', () => {
    show([line({})])
    expect(screen.queryByText(FLAG)).toBeNull()
  })

  it('leaves a line with no shares alone', () => {
    show([line({ shares: [] })])
    expect(screen.queryByText(FLAG)).toBeNull()
  })

  it('flags only the line that is off', () => {
    show([
      line({ id: 'ok', title: 'Lunch' }),
      line({
        id: 'off',
        title: 'Taxi',
        shares: [
          { userId: 'u1', shareMinor: 1_000, weight: 1, isSettled: false },
        ],
      }),
    ])
    expect(screen.getAllByText(FLAG)).toHaveLength(1)
  })
})
