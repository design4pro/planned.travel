// @vitest-environment jsdom
// The panel mounts the Radix-backed tab strip and the list's order control, both
// of which need the pointer-capture and scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { cn } from '#/lib/cn'
import { AtlasPanel, AtlasPanelSkeleton } from '../atlas-panel'

import type { AtlasPanelProps } from '../atlas-panel'
import type { CountriesListCountry } from '../countries-list'

const FRANCE: CountriesListCountry = {
  countryCode: 'FR',
  continent: 'Europe',
  firstVisitedOn: '2011-07-14',
  lastVisitedOn: '2024-09-06',
  visitCount: 3,
  note: 'Paris twice, then the Verdon gorge with the climbing club.',
  hasOutline: true,
}

const JAPAN: CountriesListCountry = {
  countryCode: 'JP',
  continent: 'Asia',
  firstVisitedOn: '2019-04-02',
  lastVisitedOn: '2019-04-02',
  visitCount: 1,
  note: null,
  hasOutline: true,
}

const STATS: AtlasPanelProps['stats'] = {
  countryCount: 12,
  worldCount: 195,
  regionCount: 4,
  visitCount: 18,
  tripCount: 5,
  cityCount: 6,
  dayCount: 45,
  distanceMetres: 82_400_000,
}

function panel(overrides: Partial<AtlasPanelProps> = {}) {
  const props: AtlasPanelProps = {
    countries: [FRANCE, JAPAN],
    selectedCode: null,
    onSelect: () => {},
    tab: 'stats',
    onTabChange: () => {},
    expanded: true,
    onExpandedChange: () => {},
    stats: STATS,
    byContinent: [
      { continent: 'Europe', countryCount: 7 },
      { continent: 'Asia', countryCount: 2 },
    ],
    bucketList: [],
    ...overrides,
  }
  return render(<AtlasPanel {...props} />)
}

const coverage = (root: HTMLElement): string =>
  root.querySelector('[data-part="coverage"]')?.textContent ?? ''
const coverageCaption = (root: HTMLElement): string =>
  root.querySelector('[data-part="coverage-caption"]')?.textContent ?? ''

describe('the headline', () => {
  it('states the count, the world total and the share without a tab', () => {
    const { container } = panel({ tab: 'bucket' })

    expect(coverage(container)).toBe('12')
    expect(screen.getByText('of 195')).toBeTruthy()
    expect(coverageCaption(container)).toContain('6% of the world')
    expect(coverageCaption(container)).toContain('18 visits')
  })

  it('marks the count as tabular, so a change cannot jitter the row', () => {
    const { container } = panel()
    expect(
      container.querySelector('[data-part="coverage"]')?.className,
    ).toContain('tabular-nums')
  })

  it('survives a world total of zero rather than dividing by it', () => {
    const { container } = panel({
      stats: { ...STATS, countryCount: 0, worldCount: 0 },
    })
    expect(coverage(container)).toBe('0')
    expect(coverageCaption(container)).toContain('0% of the world')
  })
})

describe('sections', () => {
  it('is a real tab set, one tab stop, reachable by keyboard', async () => {
    const user = userEvent.setup()
    const onTabChange = vi.fn()
    panel({ onTabChange })

    const tabs = screen.getByRole('tablist', { name: 'Atlas sections' })
    const selected = within(tabs).getByRole('tab', { selected: true })
    expect(selected.textContent).toBe('Stats')

    selected.focus()
    await user.keyboard('{ArrowRight}')
    expect(onTabChange).toHaveBeenCalledWith('bucket')
  })

  it('follows the breakpoint until the reader has an opinion', () => {
    const { container } = panel({ expanded: null })
    const body = container.querySelector('[role=tabpanel]')?.parentElement
    expect(body?.className).toContain('hidden')
    expect(body?.className).toContain('lg:flex')
  })

  it('opens the drawer when a collapsed panel has a tab chosen', async () => {
    const user = userEvent.setup()
    const onExpandedChange = vi.fn()
    panel({ expanded: false, onExpandedChange })

    await user.click(screen.getByRole('tab', { name: 'Country' }))
    expect(onExpandedChange).toHaveBeenCalledWith(true)
  })

  it('offers the drawer toggle with its state on it', async () => {
    const user = userEvent.setup()
    const onExpandedChange = vi.fn()
    panel({ expanded: false, onExpandedChange })

    const toggle = screen.getByRole('button', { name: 'Show atlas details' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.getAttribute('aria-controls')).toBeTruthy()

    await user.click(toggle)
    expect(onExpandedChange).toHaveBeenCalledWith(true)
  })

  /**
   * The header is a two-column grid below `lg` so the tab strip gets a row to
   * itself. Beside the toggle it had 272px at 360 for three labelled tabs that
   * want 330, and "Bucket list" overflowed its own trigger to within a pixel of
   * the toggle. jsdom cannot measure that, but it can hold the arrangement that
   * fixed it: the toggle on the first row's second column, the strip spanning
   * both columns on the second.
   */
  it('gives the tab strip its own row on a phone', () => {
    const { container } = panel({})
    const header = container.querySelector('[data-part="panel-header"]')
    const toggle = screen.getByRole('button', { name: 'Hide atlas details' })
    const list = screen.getByRole('tablist')

    expect(header?.className).toContain('grid-cols-[minmax(0,1fr)_auto]')
    expect(toggle.className).toContain('col-start-2')
    expect(toggle.className).toContain('row-start-1')
    // …and back to the end of one row from `lg`, where there was never a
    // shortage of width.
    expect(toggle.className).toContain('lg:order-last')
    expect(list.className).toContain('col-span-2')
    expect(list.className).toContain('row-start-2')
  })

  it('spends padding rather than type to fit the labels at 360', () => {
    panel({})
    for (const name of ['Country', 'Stats', 'Bucket list']) {
      const trigger = screen.getByRole('tab', { name })
      expect(trigger.className).toContain('px-2')
      expect(trigger.className).toContain('sm:px-3')
      // The type scale is a fixed contract: no trigger may shrink its label.
      expect(trigger.className).toContain('text-caption')
    }
  })
})

describe('the country section', () => {
  it('invites a choice rather than showing an empty card', () => {
    panel({ tab: 'country' })
    expect(screen.getByText('Pick a country')).toBeTruthy()
  })

  it('says something different when nothing has ever been marked', () => {
    panel({ tab: 'country', countries: [] })
    expect(screen.getByText('Your map is still blank')).toBeTruthy()
  })

  it('opens the whole record on a persistent surface, not a tooltip', () => {
    panel({ tab: 'country', selectedCode: 'FR' })

    const record = screen.getByRole('article', { name: 'France' })
    expect(record.textContent).toContain('14 Jul 2011')
    expect(record.textContent).toContain('6 Sept 2024')
    expect(record.textContent).toContain('3 visits')
    expect(record.textContent).toContain('climbing club')
  })

  it('matches a padded, lower-case selection against the record', () => {
    panel({ tab: 'country', selectedCode: ' fr ' })
    expect(screen.getByRole('article', { name: 'France' })).toBeTruthy()
  })

  /**
   * A phone shows one pane at a time; a desktop shows both. The hidden one is
   * hidden by class rather than unmounted, so a resize needs no re-render and
   * neither pane loses its scroll position.
   */
  it('shows the list until a country is chosen, then the record', () => {
    const tokens = (root: HTMLElement): Array<string> =>
      (
        root.querySelector('[role=tabpanel] > div > div')?.className ?? ''
      ).split(' ')

    // Nothing chosen: the record pane stands down below `lg` and the list shows.
    const listOnly = tokens(panel({ tab: 'country' }).container)
    expect(listOnly).toContain('hidden')
    expect(listOnly).toContain('lg:flex')

    // Chosen: the record pane takes the phone's single slot.
    const withRecord = tokens(
      panel({ tab: 'country', selectedCode: 'FR' }).container,
    )
    expect(withRecord).not.toContain('hidden')
    expect(withRecord).toContain('flex')
  })

  it.each([
    ['a country on the record', 'FR'],
    ['a country that is not', 'NZ'],
  ])(
    'offers a way back to the list from %s, when the host can clear',
    async (_label, code) => {
      const user = userEvent.setup()
      const onClearSelection = vi.fn()
      panel({ tab: 'country', selectedCode: code, onClearSelection })

      await user.click(screen.getByRole('button', { name: 'All countries' }))
      expect(onClearSelection).toHaveBeenCalledTimes(1)
    },
  )

  it('draws no back button when the host cannot clear the selection', () => {
    panel({ tab: 'country', selectedCode: 'FR' })
    expect(screen.queryByRole('button', { name: 'All countries' })).toBeNull()
  })

  /**
   * The map paints unvisited land too, so a click can land on a country the
   * record does not hold. "Pick a country" there reads as the app having ignored
   * the click.
   */
  it('answers a country that is not on the record, rather than the prompt', () => {
    panel({ tab: 'country', selectedCode: 'NZ' })

    const card = screen.getByRole('article', { name: 'New Zealand' })
    expect(card.textContent).toContain('NZ')
    expect(card.textContent).toContain('Not visited')
    expect(card.textContent).toContain('Nothing is recorded here yet')
    expect(screen.queryByText('Pick a country')).toBeNull()
  })

  it('lists every country beside the record and reports a choice', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    panel({ tab: 'country', onSelect })

    await user.click(screen.getByRole('option', { name: /Japan/ }))
    expect(onSelect).toHaveBeenCalledWith('JP')
  })
})

describe('the stats section', () => {
  it('carries the counters as stat tiles with real labels', () => {
    panel()

    for (const label of [
      'Countries',
      'Regions',
      'Visits',
      'Trips',
      'Cities',
      'Days away',
    ]) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(screen.getByText('45')).toBeTruthy()
    expect(screen.getByText('82,400 km')).toBeTruthy()
  })

  it('prints a zero rather than a blank when no roll-up row exists', () => {
    panel({
      stats: {
        ...STATS,
        tripCount: null,
        cityCount: null,
        dayCount: null,
        distanceMetres: null,
      },
    })
    expect(screen.getByText('Finished trips only')).toBeTruthy()
  })

  /**
   * The roll-up query groups by the column, so it only ever returns continents
   * the traveller has been to. A key that silently omits Oceania answers a
   * different question from the one it appears to answer.
   */
  it('names all six continents, visited or not', () => {
    const { container } = panel()
    const cells = [
      ...container.querySelectorAll<HTMLElement>('[data-continent]'),
    ]

    expect(cells.map((cell) => cell.dataset.continent)).toEqual([
      'africa',
      'asia',
      'europe',
      'north america',
      'oceania',
      'south america',
    ])
    expect(screen.getByText('Oceania')).toBeTruthy()
  })

  /**
   * The single most visible defect in the product we are measured against: its
   * zero continents land at roughly 1.5:1. Ours differ from a live count by one
   * step of ink and nothing else — never a fade, never a smaller size.
   */
  it('renders a zero continent as legibly as a live one', () => {
    const { container } = panel()
    const value = (key: string): HTMLElement | null =>
      container.querySelector<HTMLElement>(`[data-continent="${key}"] > dd`)

    const zero = value('oceania')
    const live = value('europe')
    expect(zero?.textContent).toBe('0')
    expect(live?.textContent).toBe('7')

    const shape = (node: HTMLElement | null): Array<string> =>
      (node?.className ?? '')
        .split(' ')
        .filter((name) => !name.startsWith('text-ink'))
        .sort()
    expect(shape(zero)).toEqual(shape(live))

    for (const node of [zero, live]) {
      expect(node?.className).not.toMatch(/opacity-|text-ink-4/)
    }
    expect(zero?.className).toContain('text-ink-2')
  })

  it('folds a differently-cased continent into its canonical cell', () => {
    const { container } = panel({
      byContinent: [
        { continent: 'europe', countryCount: 3 },
        { continent: 'Europe', countryCount: 4 },
      ],
    })
    expect(
      container.querySelector('[data-continent="europe"] > dd')?.textContent,
    ).toBe('7')
  })

  it('keeps a continent the six do not cover rather than dropping it', () => {
    const { container } = panel({
      byContinent: [{ continent: 'Antarctica', countryCount: 1 }],
    })
    expect(
      container.querySelector('[data-continent="antarctica"]'),
    ).toBeTruthy()
  })

  it('ignores an empty continent column instead of drawing a blank cell', () => {
    const { container } = panel({
      byContinent: [
        { continent: '  ', countryCount: 2 },
        { continent: 'Asia', countryCount: 2 },
      ],
    })
    expect(container.querySelectorAll('[data-continent]')).toHaveLength(6)
  })
})

describe('the bucket list', () => {
  const ITEMS = [
    {
      id: 'a',
      name: 'Ride the Trans-Siberian',
      kind: 'route',
      countryCode: null,
      targetYear: 2030,
      isAchieved: false,
    },
    {
      id: 'b',
      name: 'See the northern lights',
      kind: 'experience',
      countryCode: 'IS',
      targetYear: null,
      isAchieved: true,
    },
  ]

  it('designs the nothing rather than leaving a hole', () => {
    panel({ tab: 'bucket' })
    expect(screen.getByText('Nothing on the list')).toBeTruthy()
  })

  it('counts what is done without making the reader tally it', () => {
    panel({ tab: 'bucket', bucketList: ITEMS })
    expect(screen.getByText('1 of 2 done')).toBeTruthy()
  })

  /**
   * The one text pair on the old screen that failed AA: a struck-out line at a
   * muted grey on a white card. The signal moved to the chip, which says it in
   * words, and the line kept its contrast.
   */
  it('carries "done" on the chip rather than on faded, struck-out text', () => {
    panel({ tab: 'bucket', bucketList: ITEMS })

    const done = screen.getByText('See the northern lights')
    expect(done.className).not.toContain('line-through')
    expect(done.className).toContain('text-ink-2')
    expect(done.className).not.toMatch(/text-ink-4|opacity-/)
    expect(screen.getByText('Done')).toBeTruthy()
    expect(screen.getByText('To go')).toBeTruthy()
  })

  it('names a bucket-list country from the frozen table', () => {
    panel({ tab: 'bucket', bucketList: ITEMS })
    expect(screen.getByText(/Iceland/)).toBeTruthy()
  })
})

describe('the map key', () => {
  it('stays put whichever section is open', () => {
    for (const tab of ['country', 'stats', 'bucket'] as const) {
      const view = panel({ tab })
      expect(
        within(view.container).getByRole('group', { name: 'Last visit' }),
      ).toBeTruthy()
      view.unmount()
    }
  })
})

describe('stacking', () => {
  /**
   * Map chrome passes *under* the app nav. `GlassPanel`'s floating default is
   * `z-dropdown` (50), above `--z-nav` (40), so the variant is stood down and the
   * tier named outright.
   */
  it('sits on the map-overlay tier, never the dropdown one', () => {
    const { container } = panel()
    const root = container.firstElementChild

    expect(root?.className).toContain('z-map-overlay')
    expect(root?.className).not.toContain('z-dropdown')
  })

  /**
   * The same override has to be available by class, because the search pill over
   * the map does not expose the variant. Registering `map-overlay` in `cn()`'s
   * `z` group is what makes the caller's tier win instead of leaving both classes
   * for stylesheet order to settle.
   */
  it('lets a caller override the tier through cn()', () => {
    expect(cn('z-dropdown', 'z-map-overlay')).toBe('z-map-overlay')
    expect(cn('z-map-overlay', 'z-nav')).toBe('z-nav')
  })
})

describe('AtlasPanelSkeleton', () => {
  it('says it is loading once, rather than narrating empty boxes', () => {
    const { container } = render(<AtlasPanelSkeleton />)
    const root = container.firstElementChild

    expect(root?.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByText('Loading your atlas')).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('option')).toBeNull()
  })

  /**
   * jsdom has no layout engine, so height cannot be measured. What can be locked
   * is the cause: both are cut from the same `layout` strings, so an edit to one
   * that is not made to the other fails here rather than moving the panel at the
   * moment the read lands.
   */
  it('is cut from the same header geometry as the panel it stands in for', () => {
    const real = panel().container.firstElementChild
    const loading = render(<AtlasPanelSkeleton />).container.firstElementChild

    expect(loading?.className).toBe(real?.className)

    const header = (root: Element | null): string =>
      root?.querySelector('[data-part="panel-header"]')?.className ?? ''
    expect(header(loading)).toBe(header(real))
    expect(header(real).length).toBeGreaterThan(0)
  })
})
