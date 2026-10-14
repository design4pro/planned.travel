import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

import { totalsFor } from '#/components/costs'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import De from '#/lib/i18n/messages/de/costs'
import En from '#/lib/i18n/messages/en/costs'
import { StatTiles } from '../stat-tiles'

import type { Catalogue, Locale } from '#/lib/i18n'
import type { CostsSnapshot } from '#/components/costs'
import type { CostsExpense, CostsPerson } from '#/server/fns/costs'

afterEach(cleanup)

const PEOPLE: ReadonlyArray<CostsPerson> = [
  {
    userId: 'u-me',
    name: 'Rafal',
    email: 'r@example.test',
    image: null,
    role: 'owner',
  },
  {
    userId: 'u-mika',
    name: 'Mika',
    email: 'm@example.test',
    image: null,
    role: 'member',
  },
]

function expense(
  shares: ReadonlyArray<[string, number]>,
  amountMinor: number,
): CostsExpense {
  return {
    id: `e-${amountMinor}`,
    title: 'Dinner',
    category: 'food',
    amountMinor,
    currency: 'EUR',
    originalAmountMinor: null,
    originalCurrency: null,
    exchangeRate: null,
    convertedMinor: amountMinor,
    spentOn: '2026-07-04',
    paidBy: 'u-me',
    splitMethod: 'equal',
    notes: null,
    shares: shares.map(([userId, shareMinor]) => ({
      userId,
      shareMinor,
      weight: 1,
      isSettled: false,
    })),
  }
}

function snapshotOf(expenses: ReadonlyArray<CostsExpense>): CostsSnapshot {
  return {
    expenses,
    settlements: [],
    balances: [],
    byCategory: [],
    suggestions: [],
    spentMinor: expenses.reduce((sum, row) => sum + row.amountMinor, 0),
    expenseCount: expenses.length,
    busyExpenseIds: new Set(),
    busy: false,
  }
}

function mount(locale: Locale, messages: Catalogue, snapshot: CostsSnapshot) {
  return render(
    <I18nProvider locale={locale} messages={messages}>
      <StatTiles
        snapshot={snapshot}
        totals={totalsFor(snapshot, 'u-me')}
        people={PEOPLE}
        viewerUserId="u-me"
        currency="EUR"
        budgetTargetMinor={null}
        plannedMinor={50_000}
      />
    </I18nProvider>,
  )
}

describe('the "Total trip spend" tile', () => {
  const snapshot = snapshotOf([
    expense(
      [
        ['u-me', 4_000],
        ['u-mika', 4_000],
        ['u-gone', 2_000],
      ],
      10_000,
    ),
  ])

  it('names who the spend was divided between, with the viewer as "You"', () => {
    mount('en', namespaceCatalogue('costs', En), snapshot)

    const list = screen.getByRole('list', { name: 'Who it was spent on' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['You, 40%', 'Mika, 40%', 'Removed traveller, 20%'])
  })

  it('renders its label, caption and figures from the catalogue', () => {
    mount('de', namespaceCatalogue('costs', De), snapshot)

    expect(screen.getByText('Gesamtausgaben der Reise')).toBeDefined()
    expect(screen.getByText(/geplant für alle Reisenden/)).toBeDefined()
    expect(screen.getByText('Dein Anteil')).toBeDefined()
    expect(screen.getByText('Du hast gezahlt')).toBeDefined()
    expect(screen.queryByText('Total trip spend')).toBeNull()
    expect(screen.queryByText('Your share')).toBeNull()
    expect(screen.queryByText('You paid')).toBeNull()
  })

  it('wraps the footer labels instead of cutting a long translation off', () => {
    mount('de', namespaceCatalogue('costs', De), snapshot)

    for (const label of ['Dein Anteil', 'Du hast gezahlt']) {
      const term = screen.getByText(label)
      expect(term.className).not.toContain('truncate')
      expect(term.className).toContain('[overflow-wrap:anywhere]')
    }
  })

  it('draws no bar, label or list for a trip split between one person', () => {
    mount(
      'en',
      namespaceCatalogue('costs', En),
      snapshotOf([expense([['u-me', 10_000]], 10_000)]),
    )

    expect(screen.queryByText('Who it was spent on')).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
  })
})
