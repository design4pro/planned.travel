// @vitest-environment jsdom
// The panel mounts the Radix-backed tab strip and the list's order control, both
// of which need the pointer-capture and scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { cn } from '#/lib/cn'
import { AtlasPanel, AtlasPanelSkeleton } from '../atlas-panel'

import type { AtlasPanelProps } from '../atlas-panel'
import type { CountriesListCountry } from '../countries-list'

/**
 * The country pane now carries the two atlas writes, so the panel pulls in the
 * server-function module and the router hook behind `useAction`. Both are stood
 * in for here: the real module reaches `cloudflare:workers` through the request
 * scope, which has no meaning in jsdom, and the real `useRouter` needs a router
 * above it. What the writes *do* is `country-actions.test.tsx`'s subject; this
 * file only cares that the pane offers them.
 */
const atlas = vi.hoisted(() => ({
  mark: vi.fn(),
  unmark: vi.fn(),
  add: vi.fn(),
  drop: vi.fn(),
}))
const router = vi.hoisted(() => ({ invalidate: vi.fn() }))

vi.mock('#/server/fns/atlas', () => ({
  markCountryVisitedFn: atlas.mark,
  unmarkCountryVisitedFn: atlas.unmark,
  addCountryToBucketListFn: atlas.add,
  removeCountryFromBucketListFn: atlas.drop,
}))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => router }))

/** The id the stood-in `addCountryToBucketListFn` reports for a new entry. */
const CREATED_GOAL_ID = 'goal-created-nz'

/**
 * The shape every atlas write answers with. Only the bucket-list half is read
 * by the pane's action block — it is the id an entry created here is removed
 * by, and the props have none until the loader commits.
 */
function answer(
  bucketGoal: {
    readonly id: string
    readonly targetYear: number | null
    readonly isAchieved: boolean
  } | null,
) {
  return {
    countryCode: 'NZ',
    continent: 'Oceania',
    visit: null,
    bucketGoal:
      bucketGoal === null
        ? null
        : {
            id: bucketGoal.id,
            name: 'New Zealand',
            targetYear: bucketGoal.targetYear,
            note: null,
            isAchieved: bucketGoal.isAchieved,
            achievedOn: null,
          },
  }
}

beforeEach(() => {
  // `restoreMocks` reaches spies, not the plain `vi.fn()`s held above.
  vi.clearAllMocks()
  router.invalidate.mockResolvedValue(undefined)
  atlas.mark.mockResolvedValue(answer(null))
  atlas.unmark.mockResolvedValue(answer(null))
  atlas.add.mockResolvedValue(
    answer({ id: CREATED_GOAL_ID, targetYear: null, isAchieved: false }),
  )
  atlas.drop.mockResolvedValue(answer(null))
})

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
  placeCount: 15,
  cityCount: 6,
  dayCount: 45,
  distanceMetres: 82_400_000,
}

/**
 * Split out from {@link panel} so a test that has to re-render the panel with a
 * changed loader answer can build the second set of props from the first.
 */
function props(overrides: Partial<AtlasPanelProps> = {}): AtlasPanelProps {
  return {
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
}

function panel(overrides: Partial<AtlasPanelProps> = {}) {
  return render(<AtlasPanel {...props(overrides)} />)
}

/**
 * Answers the panel's `(min-width: 1024px)` query with a stated verdict.
 *
 * jsdom has one viewport and no `lg`, so the breakpoint has to be told rather
 * than resized into. `restoreMocks` puts the real one back after each test.
 */
function matchWidth(wide: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('min-width: 1024px') ? wide : false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  )
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
   * The body below `lg` is `display: none` until the reader opens it, and the
   * toggle used to announce the desktop default regardless — `aria-expanded`
   * true over a hidden target, and a first press that "closed" what was already
   * closed. A phone reader had to press it twice to reach the stats, the record
   * and the list.
   */
  it('reports the drawer shut on a narrow viewport, and opens it in one press', async () => {
    matchWidth(false)
    const user = userEvent.setup()
    const onExpandedChange = vi.fn()
    panel({ expanded: null, onExpandedChange })

    const toggle = screen.getByRole('button', { name: 'Show atlas details' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    await user.click(toggle)
    expect(onExpandedChange).toHaveBeenCalledWith(true)
  })

  it('reports the shelf open from lg, where the stylesheet shows it', async () => {
    matchWidth(true)
    const user = userEvent.setup()
    const onExpandedChange = vi.fn()
    panel({ expanded: null, onExpandedChange })

    const toggle = screen.getByRole('button', { name: 'Hide atlas details' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    await user.click(toggle)
    expect(onExpandedChange).toHaveBeenCalledWith(false)
  })

  /**
   * The glyph is the visible half of the same state, and it is the half that
   * must not move after hydration — so it asks CSS, not the measurement, while
   * the reader has no opinion.
   */
  it('points the chevron with a variant while the breakpoint decides', () => {
    matchWidth(false)
    panel({ expanded: null })
    const glyph = screen
      .getByRole('button', { name: 'Show atlas details' })
      .querySelector('svg')

    expect(glyph?.getAttribute('class')).toContain('rotate-180')
    expect(glyph?.getAttribute('class')).toContain('lg:rotate-0')
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

  /**
   * The shelf gives this pane 156px on a phone and a country's facts plus its
   * two writes are 264px, so the fold is permanent. Fading the last grid step
   * of the viewport is what makes the fold read as a scroll rather than as a
   * severed card — and it is on the viewport, not on the scroll root, so the
   * bar down the right keeps its contrast where it matters most.
   */
  it('says the country pane continues past its fold', () => {
    const { container } = panel({ tab: 'country', selectedCode: 'FR' })
    const viewport = container.querySelector<HTMLElement>(
      '[data-radix-scroll-area-viewport]',
    )

    expect(viewport?.className).toContain('mask-image')
    expect(viewport?.className).toContain('var(--space-4)')
  })

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
    expect(screen.queryByText('Pick a country')).toBeNull()
  })

  /**
   * The card names the country; the block below it states both of its states.
   * A paragraph between them saying the same thing as the row's own title cost
   * the shelf thirty-six of the two hundred and thirty pixels it has, and the
   * second action is what was standing in them.
   */
  it('says nothing between the name and the block that the block says itself', () => {
    panel({ tab: 'country', selectedCode: 'NZ' })

    const card = screen.getByRole('article', { name: 'New Zealand' })
    expect(card.textContent).not.toContain('Nothing is recorded here yet')
    const heading = within(card).getByRole('heading', { name: 'New Zealand' })
    // The country's own label, and then straight into the record block.
    expect(within(card).getByText('Your record')).toBeTruthy()
    expect(heading.textContent).toBe('New Zealand')
  })

  /**
   * The map's hover and click surfaces are pointer-only by construction. The
   * shelf is the route a keyboard and a phone take to the same two writes, so
   * the pane carries them in both of its states.
   */
  it('carries both writes inside the card for a country off the record', async () => {
    const user = userEvent.setup()
    panel({ tab: 'country', selectedCode: 'NZ' })

    const card = screen.getByRole('article', { name: 'New Zealand' })
    expect(card.textContent).toContain('Not visited')
    expect(card.textContent).toContain('Not on the list')

    // Named for the country it acts on, so the two additive controls in the
    // pane are told apart by a screen reader without their surrounding prose.
    const mark = within(card).getByRole('button', {
      name: 'Mark visited, New Zealand',
    })
    expect(
      within(card).getByRole('button', {
        name: 'Add to list, New Zealand',
      }),
    ).toBeTruthy()
    await user.click(mark)
    expect(atlas.mark).toHaveBeenCalledWith({ data: { countryCode: 'NZ' } })
  })

  /**
   * The pane is the keyboard and touch route to both writes, so the undo the
   * block promises under them has to be reachable from here too — including in
   * the window between a successful add and the loader's answer, where the
   * entry exists on the server and the panel's props do not carry it yet.
   */
  it('undoes an add made from the pane, before the loader carries it', async () => {
    const user = userEvent.setup()
    panel({ tab: 'country', selectedCode: 'NZ' })

    const card = screen.getByRole('article', { name: 'New Zealand' })
    await user.click(
      within(card).getByRole('button', { name: 'Add to list, New Zealand' }),
    )

    const undo = await within(card).findByRole('button', {
      name: 'Remove New Zealand from your bucket list',
    })
    expect((undo as HTMLButtonElement).disabled).toBe(false)

    await user.click(undo)
    expect(atlas.drop).toHaveBeenCalledWith({
      data: { itemId: CREATED_GOAL_ID },
    })
    expect(atlas.add).toHaveBeenCalledTimes(1)
  })

  it('offers the inverse of both writes beside a country on the record', () => {
    panel({
      tab: 'country',
      selectedCode: 'FR',
      bucketList: [
        {
          id: 'goal-fr',
          name: 'France',
          kind: 'country',
          countryCode: 'FR',
          targetYear: 2027,
          isAchieved: false,
        },
      ],
    })

    const block = document.querySelector<HTMLElement>(
      '[data-part="country-actions"][data-country="FR"]',
    )
    expect(block?.textContent).toContain('Visited')
    expect(block?.textContent).toContain('On the bucket list')
    expect(
      screen.getByRole('button', { name: 'Remove France from your atlas' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: 'Remove France from your bucket list',
      }),
    ).toBeTruthy()
  })

  /**
   * One country is one card and one announcement, in both of the pane's states.
   * The record used to sit in its own article with the block outside it, which
   * gave a screen reader two regions for one country and gave React two places
   * to put the block — see the mid-write test below.
   */
  it('carries the record and both writes in one card, not two', () => {
    panel({ tab: 'country', selectedCode: 'FR' })

    expect(screen.getAllByRole('article', { name: 'France' })).toHaveLength(1)
    const card = screen.getByRole('article', { name: 'France' })
    expect(card.textContent).toContain('14 Jul 2011')
    expect(within(card).getByText('Your record')).toBeTruthy()
    expect(
      within(card).getByRole('button', {
        name: 'Remove France from your atlas',
      }),
    ).toBeTruthy()
    expect(
      within(card).getByRole('button', { name: 'Add to list, France' }),
    ).toBeTruthy()
  })

  /**
   * The write's answer arrives before the write reports itself finished:
   * `useAction` awaits `router.invalidate()` inside `run`, so the loader's new
   * country lands while the pressed control is still disabled and focus is
   * still parked on `<body>`. When the pane answered that with a different
   * branch, React threw the whole block away at exactly that moment, the
   * effect that hands focus back never ran, and a keyboard reader was left at
   * the top of the document with no way back to the row or to the reason.
   */
  it('holds the reader on the control when the record lands mid-write', async () => {
    const user = userEvent.setup()
    const NEW_ZEALAND: CountriesListCountry = {
      countryCode: 'NZ',
      continent: 'Oceania',
      firstVisitedOn: null,
      lastVisitedOn: null,
      visitCount: 1,
      note: null,
      hasOutline: true,
    }
    const before = props({ tab: 'country', selectedCode: 'NZ' })
    const view = render(<AtlasPanel {...before} />)

    // What a successful mark actually does: re-run the loaders, and hand the
    // panel a record where a moment ago there was none.
    router.invalidate.mockImplementation(async () => {
      view.rerender(
        <AtlasPanel {...before} countries={[FRANCE, JAPAN, NEW_ZEALAND]} />,
      )
    })

    const mark = screen.getByRole('button', {
      name: 'Mark visited, New Zealand',
    })
    mark.focus()
    await user.click(mark)

    const inverse = await screen.findByRole('button', {
      name: 'Remove New Zealand from your atlas',
    })
    // The very same control, turned round — not a fresh one in a fresh block.
    expect(inverse).toBe(mark)
    expect(document.activeElement).toBe(inverse)
    // And the facts the write produced are in the same card as the actions.
    const card = screen.getByRole('article', { name: 'New Zealand' })
    expect(within(card).getByText('Your record')).toBeTruthy()
    expect(card.textContent).toContain('Oceania')
  })

  /**
   * The other order, which is the one a browser actually runs: the loader
   * fetches, `router.invalidate()` resolves, and the new `loaderData` is
   * committed a render later inside a transition. The row must not fall back
   * through "Not visited" in that gap — the success toast is already on screen
   * saying the opposite of what it would read.
   */
  it('does not flash the pre-write row while the loader commits', async () => {
    const user = userEvent.setup()
    const NEW_ZEALAND: CountriesListCountry = {
      countryCode: 'NZ',
      continent: 'Oceania',
      firstVisitedOn: null,
      lastVisitedOn: null,
      visitCount: 1,
      note: null,
      hasOutline: true,
    }
    const before = props({ tab: 'country', selectedCode: 'NZ' })
    const view = render(<AtlasPanel {...before} />)

    await user.click(
      screen.getByRole('button', { name: 'Mark visited, New Zealand' }),
    )

    // The write has returned and the loader has been re-run; nothing has
    // re-rendered the panel yet.
    const card = screen.getByRole('article', { name: 'New Zealand' })
    expect(card.textContent).toContain('Visited')
    expect(card.textContent).not.toContain('Not visited')

    view.rerender(
      <AtlasPanel {...before} countries={[FRANCE, JAPAN, NEW_ZEALAND]} />,
    )
    const settled = screen.getByRole('article', { name: 'New Zealand' })
    expect(settled.textContent).toContain('Visited')
    expect(settled.textContent).not.toContain('Not visited')
  })

  /**
   * The displayed rows are a bounded slice. A country past the cut used to read
   * as "not on the list" and offer an add that the server answers with the row
   * it already had — a success toast for a write that changed nothing, and the
   * dead button the block exists to avoid.
   */
  it('reads the whole list, not the slice, when asked whether a country is on it', () => {
    panel({
      tab: 'country',
      selectedCode: 'NZ',
      bucketList: [],
      bucketCountries: [
        { countryCode: 'NZ', itemId: 'goal-nz', isAchieved: false },
      ],
    })

    const card = screen.getByRole('article', { name: 'New Zealand' })
    expect(card.textContent).toContain('On the bucket list')
    expect(
      within(card).getByRole('button', {
        name: 'Remove New Zealand from your bucket list',
      }),
    ).toBeTruthy()
  })

  it('keeps the richer displayed row when the country is in both', () => {
    panel({
      tab: 'country',
      selectedCode: 'FR',
      bucketList: [
        {
          id: 'goal-fr',
          name: 'France',
          kind: 'country',
          countryCode: 'FR',
          targetYear: 2027,
          isAchieved: false,
        },
      ],
      bucketCountries: [
        { countryCode: 'FR', itemId: 'goal-fr', isAchieved: false },
      ],
    })

    // Only the displayed row carries the year, so the slice has to win.
    expect(screen.getByText('Aiming for 2027.')).toBeTruthy()
  })

  it('falls back to the slice when no uncapped list is handed over', () => {
    panel({
      tab: 'country',
      selectedCode: 'NZ',
      bucketList: [
        {
          id: 'goal-nz',
          name: 'New Zealand',
          kind: 'country',
          countryCode: 'NZ',
          targetYear: null,
          isAchieved: false,
        },
      ],
    })

    const card = screen.getByRole('article', { name: 'New Zealand' })
    expect(card.textContent).toContain('On the bucket list')
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
      'Places',
      'Regions',
      'Visits',
      'Your trips',
      'Cities',
      'Days away',
    ]) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(screen.getByText('45')).toBeTruthy()
    expect(screen.getByText('82,400 km')).toBeTruthy()
  })

  /**
   * The count of countries and its share of the world are the panel's headline,
   * in the display face directly above this row. A tile repeating both of them
   * was a smaller copy of the thing above it; the tile carries the saved stops
   * behind those countries instead, which no other surface states.
   */
  it('does not repeat the headline count in the tile row', () => {
    panel()

    // Once each, in the header — not a second time twelve tiles later.
    expect(screen.getAllByText('of 195')).toHaveLength(1)
    expect(screen.getAllByText(/6% of the world/)).toHaveLength(1)
    expect(screen.getByText('Sights, stays and stops saved')).toBeTruthy()
  })

  it('prints a zero rather than a blank when no roll-up row exists', () => {
    panel({
      stats: {
        ...STATS,
        tripCount: null,
        placeCount: null,
        cityCount: null,
        dayCount: null,
        distanceMetres: null,
      },
    })
    expect(screen.getByText('Finished trips you are on')).toBeTruthy()
    expect(screen.getByText('Nothing pinned on a trip yet')).toBeTruthy()
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

  /**
   * The loader ships a bounded slice of this list, because it is neither
   * virtualised nor paginated and every row is dehydrated into the streamed
   * document. Counting the rows that arrived would then tell a traveller with a
   * hundred entries that they have forty.
   */
  it('counts the whole list even when it was handed the head of it', () => {
    panel({
      tab: 'bucket',
      bucketList: ITEMS,
      bucketTotal: 61,
      bucketAchieved: 9,
    })
    expect(screen.getByText('9 of 61 done')).toBeTruthy()
  })

  it('says in words that the rest of the list is not on screen', () => {
    panel({
      tab: 'bucket',
      bucketList: ITEMS,
      bucketTotal: 61,
      bucketAchieved: 9,
    })
    expect(
      screen.getByText(/59 more entries on your list, not shown here\./),
    ).toBeTruthy()
  })

  it('says nothing at all when the whole list is on screen', () => {
    panel({ tab: 'bucket', bucketList: ITEMS, bucketTotal: 2 })
    expect(screen.queryByText(/not shown here/)).toBeNull()
  })

  it('uses the singular for a single hidden entry', () => {
    panel({ tab: 'bucket', bucketList: ITEMS, bucketTotal: 3 })
    expect(
      screen.getByText(/1 more entry on your list, not shown here\./),
    ).toBeTruthy()
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

/**
 * The map paints one hue and lets lightness carry recency, so the key is the
 * only thing on the screen that says what a shade means. It has been taken out
 * of the narrow layout once, to buy the country pane the height its two writes
 * wanted, and that trade is not available: a legend a reader cannot reach on a
 * phone is WCAG 1.4.1 unmet on the surface where colour is doing the most work.
 * The height came out of the action block's own composition instead.
 */
describe('the map key', () => {
  it('stays in the panel at every width, whichever section is open', () => {
    for (const wide of [true, false]) {
      matchWidth(wide)
      for (const tab of ['country', 'stats', 'bucket'] as const) {
        const { container, unmount } = panel({ tab })
        const legend = container.querySelector('[data-part="legend"]')

        expect(legend).toBeTruthy()
        // Present in the tree is not the same as on the screen: the footer that
        // holds it must not be display-none at any width either.
        expect(legend?.parentElement?.className).not.toContain('hidden')
        unmount()
      }
    }
  })

  it('names every step in words, so no reader is left decoding a shade', () => {
    matchWidth(false)
    const { container } = panel({ tab: 'country' })
    const steps = [
      ...container.querySelectorAll('[data-part="legend"] [data-step]'),
    ]

    expect(steps).toHaveLength(4)
    for (const step of steps) {
      expect(step.textContent.trim().length).toBeGreaterThan(0)
    }
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

  /**
   * The header row from `lg` is headline, progress, tabs, toggle. Leaving the
   * progress column out of the loading shape let the tab strip sit against the
   * headline and jump right when the read landed — the flexible element is the
   * one a skeleton cannot afford to skip.
   */
  it('reserves the progress column the loaded header spends', () => {
    const loading = render(<AtlasPanelSkeleton />).container.firstElementChild
    const header = loading?.querySelector('[data-part="panel-header"]')

    const progress = [...(header?.children ?? [])].filter((child) =>
      child.className.includes('lg:block'),
    )
    expect(progress).toHaveLength(1)
    expect(progress[0]?.className).toContain('flex-1')
  })
})

describe('holding still', () => {
  /**
   * The shelf is a fixed box anchored to the foot of the map, so everything in
   * it is measured down from the header. Left to its own text the header landed
   * a fraction under 100px in the fallback face and a fraction over it in ours,
   * which rounded to a one-pixel step and moved the whole body a quarter of a
   * second after paint.
   */
  it('states the header height at the breakpoint the shelf is fixed at', () => {
    const { container } = panel()
    const header = container.querySelector('[data-part="panel-header"]')
    expect(header?.className).toContain('lg:h-25')
  })

  /**
   * The far end of the progress row is anchored to the inline end, so a box
   * that shrinks to its text moves its own leading edge when the webfont
   * arrives — a layout shift for a value that never changed.
   */
  it('gives the progress value a stated width rather than its text width', () => {
    const { container } = panel()
    const value = within(container).getByText(/to go/)
    expect(value.className).toContain('w-16')
    expect(value.className).toContain('text-end')
    expect(value.className).toContain('tabular-nums')
  })
})
