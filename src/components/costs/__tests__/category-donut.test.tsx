import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import { CategoryDonut } from '../category-donut'

import type { Catalogue } from '#/lib/i18n'
import type { DonutRow } from '../category-donut'

const EN: Catalogue = namespaceCatalogue('costs', Costs)

afterEach(cleanup)

function donut(
  key: string,
  spentMinor: number,
  plannedMinor = 0,
  label = key,
): DonutRow {
  return {
    key,
    label,
    spentMinor,
    plannedMinor,
    colour: `var(--color-${key})`,
  }
}

function renderDonut(rows: ReadonlyArray<DonutRow>) {
  return render(
    <I18nProvider locale="en" messages={EN}>
      <CategoryDonut rows={rows} currency="EUR" />
    </I18nProvider>,
  )
}

/** What a screen reader reads: the text of a node with every `aria-hidden` subtree left out. */
function accessibleText(node: Node): string {
  if (node instanceof Element && node.getAttribute('aria-hidden') === 'true') {
    return ''
  }
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ''
  }
  return [...node.childNodes].map(accessibleText).join('')
}

function legendItems(): Array<HTMLElement> {
  return within(
    screen.getByRole('list', { name: 'Spend by category' }),
  ).getAllByRole('listitem')
}

const ROWS: ReadonlyArray<DonutRow> = [
  donut('accommodation', 40_000, 0, 'Accommodation'),
  donut('food', 32_000, 50_000, 'Food & drink'),
  donut('transport', 28_000, 0, 'Transport'),
]

describe('the ring', () => {
  it('is hidden from assistive technology and has nothing to focus', () => {
    const { container } = renderDonut(ROWS)
    const ring = container.querySelector('[data-part="donut-ring"]')

    expect(ring?.getAttribute('aria-hidden')).toBe('true')
    expect(ring?.getAttribute('focusable')).toBe('false')
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(container.querySelectorAll('[tabindex]')).toHaveLength(0)
  })

  it('draws one segment per category with spend, in the order given', () => {
    const { container } = renderDonut([
      donut('food', 32_000),
      donut('shopping', 0, 10_000),
      donut('accommodation', 40_000),
      donut('other', 28_000),
    ])
    const segments = [...container.querySelectorAll('svg path')]

    expect(segments.map((path) => path.getAttribute('data-category'))).toEqual([
      'food',
      'accommodation',
      'other',
    ])
    expect(segments.map((path) => path.getAttribute('fill'))).toEqual([
      'var(--color-food)',
      'var(--color-accommodation)',
      'var(--color-other)',
    ])
  })

  it('does not reorder when the totals change', () => {
    const { container, rerender } = renderDonut(ROWS)
    const order = () =>
      [...container.querySelectorAll('svg path')].map((path) =>
        path.getAttribute('data-category'),
      )
    const before = order()

    rerender(
      <I18nProvider locale="en" messages={EN}>
        <CategoryDonut
          currency="EUR"
          rows={[
            donut('accommodation', 10, 0, 'Accommodation'),
            donut('food', 99_000, 0, 'Food & drink'),
            donut('transport', 500, 0, 'Transport'),
          ]}
        />
      </I18nProvider>,
    )

    expect(order()).toEqual(before)
  })

  it('draws a single category as a closed ring, never a degenerate arc', () => {
    const { container } = renderDonut([
      donut('food', 0),
      donut('transport', 12_345),
    ])
    const path = container.querySelector('svg path')

    expect(container.querySelectorAll('svg path')).toHaveLength(1)
    expect(path?.getAttribute('d')?.match(/A/g)).toHaveLength(4)
    expect(path?.getAttribute('d')).not.toContain('NaN')
  })
})

describe('the legend', () => {
  it('carries an explicit list role, which Safari drops from a grid list', () => {
    renderDonut(ROWS)

    expect(
      screen
        .getByRole('list', { name: 'Spend by category' })
        .getAttribute('role'),
    ).toBe('list')
  })

  it('is a labelled list with a row per category that has spend or a plan', () => {
    renderDonut([...ROWS, donut('fees', 0, 0, 'Fees & charges')])

    expect(legendItems()).toHaveLength(3)
    expect(screen.queryByText('Fees & charges')).toBeNull()
  })

  it('reads a spending row as name, percent, amount and the planned amount', () => {
    renderDonut(ROWS)
    const [accommodation, food] = legendItems()

    expect(accessibleText(accommodation)).toBe('Accommodation, 40%, €400.00')
    expect(accessibleText(food)).toBe(
      'Food & drink, 32%, €320.00, €500.00 planned',
    )
  })

  it('reads a share under one percent as "less than 1%", and shows the glyph', () => {
    renderDonut([
      donut('food', 99_700, 0, 'Food & drink'),
      donut('fees', 300, 0, 'Fees & charges'),
    ])
    const fees = legendItems()[1]

    expect(accessibleText(fees)).toBe('Fees & charges, less than 1%, €3.00')
    expect(fees.textContent).toContain('<1%')
    expect(legendItems()[0].textContent).not.toContain('<1%')
    // Not "100%": no row claims the whole beside a category that has spend.
    expect(accessibleText(legendItems()[0])).toBe('Food & drink, 99%, €997.00')
  })

  it('never reads a zero share as below one', () => {
    renderDonut([
      donut('food', 100_000, 0, 'Food & drink'),
      donut('fees', 0, 0),
    ])

    expect(screen.queryByText('<1%')).toBeNull()
    expect(accessibleText(legendItems()[0])).toBe(
      'Food & drink, 100%, €1,000.00',
    )
  })

  it('keeps the percents whole and adding up to 100', () => {
    renderDonut(
      Array.from({ length: 8 }, (_, index) =>
        donut(`k${index}`, 10_000, 0, `Category ${index}`),
      ),
    )
    const percents = legendItems().map((item) =>
      Number(accessibleText(item).match(/(\d+)%/)?.[1]),
    )

    expect(percents.reduce((sum, value) => sum + value, 0)).toBe(100)
    for (const percent of percents) {
      expect(Math.abs(percent - 12.5)).toBeLessThan(1)
    }
  })

  it('lists a planned-only category plainly, after the rows with spend', () => {
    renderDonut([
      donut('accommodation', 0, 30_000, 'Accommodation'),
      donut('food', 32_000, 0, 'Food & drink'),
      donut('insurance', 0, 20_000, 'Insurance'),
      donut('transport', 28_000, 0, 'Transport'),
    ])
    const items = legendItems()

    expect(items.map(accessibleText)).toEqual([
      'Food & drink, 53%, €320.00',
      'Transport, 47%, €280.00',
      'Accommodation, €300.00 planned',
      'Insurance, €200.00 planned',
    ])
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('puts the category colour on the legend dot', () => {
    renderDonut(ROWS)
    const dot = legendItems()[1].querySelector('[aria-hidden="true"]')

    expect(dot?.getAttribute('style')).toContain('var(--color-food)')
  })
})

describe('when nothing is spent', () => {
  it('says the existing empty line, with no action, when nothing is planned either', () => {
    const { container } = renderDonut([donut('food', 0), donut('other', 0)])

    expect(
      screen.getByText(
        'Budget lines and expenses both break down here once there is something to break down.',
      ),
    ).toBeDefined()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('list')).toHaveLength(0)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('says "Nothing spent yet" with the planned rows beneath it when budget lines exist', () => {
    const { container } = renderDonut([
      donut('food', 0, 50_000, 'Food & drink'),
      donut('other', 0),
      donut('transport', 0, 12_000, 'Transport'),
    ])

    expect(
      screen.getByText('Nothing spent yet. Here is what you have planned.'),
    ).toBeDefined()
    expect(legendItems().map(accessibleText)).toEqual([
      'Food & drink, €500.00 planned',
      'Transport, €120.00 planned',
    ])
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('treats a non-positive amount as no spend', () => {
    renderDonut([donut('food', -500), donut('other', Number.NaN)])

    expect(screen.queryAllByRole('list')).toHaveLength(0)
    expect(screen.getByText(/Budget lines and expenses/)).toBeDefined()
  })
})
