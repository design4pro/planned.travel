import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Costs from '#/lib/i18n/messages/en/costs'
import { CategoryDonut } from '../category-donut'

import type { Catalogue } from '#/lib/i18n'
import type { DonutRow } from '../category-donut'

const EN: Catalogue = namespaceCatalogue('costs', Costs)

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

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

function segments(container: HTMLElement): Array<SVGPathElement> {
  return [...container.querySelectorAll<SVGPathElement>('svg path')]
}

/** The segments drawn at reduced opacity, by category. */
function dimmed(container: HTMLElement): Array<string | null> {
  return segments(container)
    .filter((path) => path.classList.contains('opacity-35'))
    .map((path) => path.getAttribute('data-category'))
}

function legendRow(name: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${name},`) })
}

/** jsdom never matches `:focus-visible`; say what the browser would. */
function stubFocusVisible(visible: boolean) {
  const matches = Element.prototype.matches
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
    this: Element,
    selector: string,
  ) {
    return selector === ':focus-visible'
      ? visible
      : matches.call(this, selector)
  })
}

const ROWS: ReadonlyArray<DonutRow> = [
  donut('accommodation', 40_000, 0, 'Accommodation'),
  donut('food', 32_000, 50_000, 'Food & drink'),
  donut('transport', 28_000, 0, 'Transport'),
]

describe('the ring', () => {
  it('is hidden from assistive technology and has no focusable segment', () => {
    const { container } = renderDonut(ROWS)
    const ring = container.querySelector('[data-part="donut-ring"]')

    expect(ring?.getAttribute('aria-hidden')).toBe('true')
    expect(ring?.getAttribute('focusable')).toBe('false')
    // The legend is the one set of focus stops: a button per category with spend.
    expect(screen.getAllByRole('button')).toHaveLength(ROWS.length)
    expect(ring?.querySelectorAll('[tabindex]')).toHaveLength(0)
    expect(container.querySelectorAll('[tabindex]')).toHaveLength(0)
  })

  it('draws one segment per category with spend, in the order given', () => {
    const { container } = renderDonut([
      donut('food', 32_000),
      donut('shopping', 0, 10_000),
      donut('accommodation', 40_000),
      donut('other', 28_000),
    ])
    const arcs = [...container.querySelectorAll('svg path')]

    expect(arcs.map((path) => path.getAttribute('data-category'))).toEqual([
      'food',
      'accommodation',
      'other',
    ])
    expect(arcs.map((path) => path.getAttribute('fill'))).toEqual([
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
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(within(items[2]).queryByRole('button')).toBeNull()
    expect(within(items[3]).queryByRole('button')).toBeNull()
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

describe('the legend link', () => {
  it('makes every row with spend a button inside its list item, and no other row', () => {
    renderDonut([
      ...ROWS,
      donut('insurance', 0, 20_000, 'Insurance'),
      donut('fees', 0),
    ])
    const items = legendItems()
    const buttons = screen.getAllByRole('button')

    expect(buttons).toHaveLength(3)
    expect(buttons.map((button) => button.parentElement)).toEqual(
      items.slice(0, 3),
    )
    for (const button of buttons) {
      expect(button.getAttribute('aria-pressed')).toBe('false')
      expect(button.getAttribute('type')).toBe('button')
      expect(button.getAttribute('data-part')).toBe('donut-legend-row')
    }
    expect(within(items[3]).queryByRole('button')).toBeNull()
  })

  it('keeps the accessible text of a row the same once it is a button', () => {
    renderDonut(ROWS)

    expect(accessibleText(legendRow('Food & drink'))).toBe(
      'Food & drink, 32%, €320.00, €500.00 planned',
    )
  })

  it('pins a row on press and dims every other segment', async () => {
    const user = userEvent.setup()
    const { container } = renderDonut(ROWS)

    expect(dimmed(container)).toEqual([])
    await user.click(legendRow('Food & drink'))
    // The click also hovers the row; only the pin may be left dimming the ring.
    await user.unhover(legendRow('Food & drink'))

    expect(legendRow('Food & drink').getAttribute('aria-pressed')).toBe('true')
    expect(legendRow('Transport').getAttribute('aria-pressed')).toBe('false')
    expect(dimmed(container)).toEqual(['accommodation', 'transport'])
  })

  it('clears the pin on a second press while the row is still focused', () => {
    stubFocusVisible(false)
    const { container } = renderDonut(ROWS)
    const row = legendRow('Food & drink')

    row.focus()
    fireEvent.click(row)
    expect(dimmed(container)).toEqual(['accommodation', 'transport'])
    fireEvent.click(row)

    expect(document.activeElement).toBe(row)
    expect(row.getAttribute('aria-pressed')).toBe('false')
    expect(dimmed(container)).toEqual([])
  })

  it('moves the pin when another row is pressed', async () => {
    const user = userEvent.setup()
    const { container } = renderDonut(ROWS)

    await user.click(legendRow('Food & drink'))
    await user.click(legendRow('Transport'))
    await user.unhover(legendRow('Transport'))

    expect(legendRow('Food & drink').getAttribute('aria-pressed')).toBe('false')
    expect(legendRow('Transport').getAttribute('aria-pressed')).toBe('true')
    expect(dimmed(container)).toEqual(['accommodation', 'food'])
  })

  it('highlights a row under a mouse and clears when the mouse leaves', () => {
    const { container } = renderDonut(ROWS)
    const row = legendRow('Transport')

    fireEvent.pointerEnter(row, { pointerType: 'mouse' })
    expect(dimmed(container)).toEqual(['accommodation', 'food'])
    fireEvent.pointerLeave(row, { pointerType: 'mouse' })

    expect(dimmed(container)).toEqual([])
  })

  it('highlights nothing for a touch pointer', () => {
    const { container } = renderDonut(ROWS)

    fireEvent.pointerEnter(legendRow('Transport'), { pointerType: 'touch' })
    fireEvent.pointerEnter(segments(container)[0], { pointerType: 'pen' })

    expect(dimmed(container)).toEqual([])
  })

  it('highlights on keyboard focus and clears on blur', () => {
    stubFocusVisible(true)
    const { container } = renderDonut(ROWS)
    const row = legendRow('Food & drink')

    act(() => row.focus())
    expect(dimmed(container)).toEqual(['accommodation', 'transport'])
    act(() => row.blur())

    expect(dimmed(container)).toEqual([])
  })

  it('pins and unpins from the keyboard', async () => {
    stubFocusVisible(true)
    const user = userEvent.setup()
    renderDonut(ROWS)
    const row = legendRow('Accommodation')

    await user.tab()
    expect(document.activeElement).toBe(row)
    await user.keyboard(' ')
    expect(row.getAttribute('aria-pressed')).toBe('true')
    await user.keyboard('{Enter}')

    expect(row.getAttribute('aria-pressed')).toBe('false')
  })

  it('returns to the pin once a keyboard focus elsewhere is blurred', () => {
    stubFocusVisible(true)
    const { container } = renderDonut(ROWS)
    const food = legendRow('Food & drink')
    const transport = legendRow('Transport')

    fireEvent.click(food)
    act(() => transport.focus())
    expect(dimmed(container)).toEqual(['accommodation', 'food'])
    act(() => transport.blur())

    expect(dimmed(container)).toEqual(['accommodation', 'transport'])
  })

  it('highlights nothing for focus that a click or a tap left behind', () => {
    stubFocusVisible(false)
    const { container } = renderDonut(ROWS)

    act(() => legendRow('Food & drink').focus())

    expect(dimmed(container)).toEqual([])
  })

  it('highlights the row of a segment under a mouse', () => {
    const { container } = renderDonut(ROWS)
    const food = segments(container)[1]

    fireEvent.pointerEnter(food, { pointerType: 'mouse' })
    expect(dimmed(container)).toEqual(['accommodation', 'transport'])
    expect(legendRow('Food & drink').className).toContain('bg-surface-2')
    expect(legendRow('Transport').className).not.toContain('bg-surface-2')
    fireEvent.pointerLeave(food, { pointerType: 'mouse' })

    expect(dimmed(container)).toEqual([])
    expect(legendRow('Food & drink').className).not.toContain('bg-surface-2')
  })

  it('shows a transient highlight while a pin is held, then returns to the pin', async () => {
    const user = userEvent.setup()
    const { container } = renderDonut(ROWS)
    await user.click(legendRow('Food & drink'))
    await user.unhover(legendRow('Food & drink'))

    const transport = legendRow('Transport')
    fireEvent.pointerEnter(transport, { pointerType: 'mouse' })
    expect(dimmed(container)).toEqual(['accommodation', 'food'])
    expect(legendRow('Food & drink').getAttribute('aria-pressed')).toBe('true')
    fireEvent.pointerLeave(transport, { pointerType: 'mouse' })

    expect(dimmed(container)).toEqual(['accommodation', 'transport'])
  })

  it('looks different when pinned than when hovered, and not by colour alone', async () => {
    const user = userEvent.setup()
    renderDonut(ROWS)
    const row = legendRow('Food & drink')
    const resting = row.className

    await user.click(row)

    expect(row.className).not.toBe(resting)
    expect(row.className).toContain('ring-1')
    expect(row.className).toContain('ring-inset')
    expect(row.className).not.toMatch(/(^|\s)outline/)
  })

  it('leaves the focus ring to the system and not to the pinned look', () => {
    renderDonut(ROWS)

    expect(legendRow('Food & drink').className).toContain('focus-ring-inset')
  })

  it('moves only opacity, over the fast duration', () => {
    const { container } = renderDonut(ROWS)
    const path = segments(container)[0]

    expect(path.className.baseVal).toContain('transition-opacity')
    expect(path.className.baseVal).toContain('duration-fast')
    expect(path.getAttribute('style')).toBeNull()
  })

  it('clears a pin on a category that loses its spend, in the same render', async () => {
    const user = userEvent.setup()
    const { container, rerender } = renderDonut(ROWS)
    await user.click(legendRow('Food & drink'))

    rerender(
      <I18nProvider locale="en" messages={EN}>
        <CategoryDonut
          currency="EUR"
          rows={[
            donut('accommodation', 40_000, 0, 'Accommodation'),
            donut('food', 0, 50_000, 'Food & drink'),
            donut('transport', 28_000, 0, 'Transport'),
          ]}
        />
      </I18nProvider>,
    )

    expect(dimmed(container)).toEqual([])
    expect(screen.queryAllByRole('button')).toHaveLength(2)
    for (const button of screen.getAllByRole('button')) {
      expect(button.getAttribute('aria-pressed')).toBe('false')
    }

    // The pin is gone for good: the category does not come back pinned.
    rerender(
      <I18nProvider locale="en" messages={EN}>
        <CategoryDonut currency="EUR" rows={ROWS} />
      </I18nProvider>,
    )

    expect(dimmed(container)).toEqual([])
    expect(legendRow('Food & drink').getAttribute('aria-pressed')).toBe('false')
  })

  it('has no button in an empty card', () => {
    renderDonut([donut('food', 0, 50_000, 'Food & drink')])

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
