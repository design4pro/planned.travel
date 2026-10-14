import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import { expenseTint } from '../../../../-lib/tone'
import { EXPENSE_CATEGORY_ORDER } from '../categories'
import { categoryColour } from '../chart-colours'
import { CostsRail } from '../rail'

import type { Catalogue } from '#/lib/i18n'
import type { CostsSnapshot } from '#/components/costs'
import type { CostsCategoryTotal } from '#/server/fns/costs'

const EN: Catalogue = namespaceCatalogue('costs', Costs)

afterEach(cleanup)

function total(
  category: string,
  spentMinor: number,
  plannedMinor = 0,
): CostsCategoryTotal {
  return { category, spentMinor, plannedMinor, expenseCount: 1 }
}

function snapshot(
  byCategory: ReadonlyArray<CostsCategoryTotal>,
): CostsSnapshot {
  return {
    expenses: [],
    settlements: [],
    balances: [],
    byCategory,
    suggestions: [],
    spentMinor: byCategory.reduce((sum, row) => sum + row.spentMinor, 0),
    expenseCount: 0,
    busyExpenseIds: new Set(),
    busy: false,
  }
}

function mountRail(
  byCategory: ReadonlyArray<CostsCategoryTotal>,
  budgetTargetMinor: number | null = null,
) {
  return render(
    <I18nProvider locale="en" messages={EN}>
      <CostsRail
        snapshot={snapshot(byCategory)}
        people={[]}
        viewerUserId="u-1"
        currency="EUR"
        display={{ mode: 'per-trip', code: 'EUR' }}
        budgetTargetMinor={budgetTargetMinor}
        canWrite={false}
        onSettle={() => undefined}
        onAddPayment={() => undefined}
      />
    </I18nProvider>,
  )
}

function byCategoryPanel(): HTMLElement {
  const heading = screen.getByRole('heading', { name: 'By category' })
  const panel = heading.closest('div.flex-col')?.parentElement
  if (!(panel instanceof HTMLElement)) {
    throw new Error('no By category panel')
  }
  return panel
}

describe('the rail By category panel', () => {
  it('draws the ring in category order, not in spend order', () => {
    const { container } = mountRail([
      total('other', 90_000),
      total('food', 50_000),
      total('accommodation', 10_000),
      total('transport', 30_000),
    ])

    expect(
      [...container.querySelectorAll('[data-part="donut-ring"] path')].map(
        (path) => path.getAttribute('data-category'),
      ),
    ).toEqual(['accommodation', 'transport', 'food', 'other'])
    expect(
      within(
        screen.getByRole('list', { name: 'Spend by category' }),
      ).getAllByRole('listitem'),
    ).toHaveLength(4)
  })

  it('keeps its label, its total-spend count and the budget footer', () => {
    mountRail([total('food', 50_000), total('transport', 30_000)], 200_000)
    const panel = byCategoryPanel()

    expect(within(panel).getByText('€800.00')).toBeDefined()
    expect(within(panel).getByText('Against the trip budget')).toBeDefined()
    expect(
      within(panel).getByRole('progressbar', {
        name: 'Spent against the trip budget',
      }),
    ).toBeDefined()
  })

  it('replaces the bar list: no per-category bars, one ring', () => {
    const { container } = mountRail([total('food', 50_000)])

    expect(container.querySelectorAll('[data-part="donut-ring"]')).toHaveLength(
      1,
    )
    expect(container.querySelector('.rtl\\:-scale-x-100')).toBeNull()
  })

  it('colours a category the same in the ring, the legend and the ledger chip', () => {
    const { container } = mountRail(
      EXPENSE_CATEGORY_ORDER.map((category) => total(category, 10_000)),
    )
    const paths = [
      ...container.querySelectorAll('[data-part="donut-ring"] path'),
    ]

    expect(paths).toHaveLength(8)
    for (const path of paths) {
      const category = path.getAttribute('data-category') ?? ''
      const hue = expenseTint(category).match(/text-([a-z0-9-]+)/)?.[1]

      expect(path.getAttribute('fill')).toBe(categoryColour(category))
      expect(path.getAttribute('fill')).toBe(`var(--color-${hue})`)
    }
  })

  it('is the empty card, without an action, when nothing is spent', () => {
    mountRail([total('food', 0), total('other', 0)])
    const panel = byCategoryPanel()

    expect(
      within(panel).getByText(/Budget lines and expenses both break down here/),
    ).toBeDefined()
    expect(within(panel).queryAllByRole('button')).toHaveLength(0)
  })
})
