// @vitest-environment jsdom
// The Radix-backed order control needs the pointer-capture and scroll stubs
// jsdom does not implement; they live with the primitives they were written for.
import '#/components/ui/__tests__/test-env'

import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  CountriesList,
  CountriesListError,
  CountriesListSkeleton,
  sortCountries,
} from '../countries-list'

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

const AUSTRIA: CountriesListCountry = {
  countryCode: 'AT',
  continent: 'Europe',
  firstVisitedOn: '2023-12-28',
  lastVisitedOn: '2023-12-28',
  visitCount: 1,
  note: null,
  hasOutline: true,
}

const JAPAN: CountriesListCountry = {
  countryCode: 'JP',
  continent: 'Asia',
  firstVisitedOn: '2019-03-30',
  lastVisitedOn: '2026-04-02',
  visitCount: 2,
  note: null,
  hasOutline: true,
}

/** Singapore has no polygon in the bundled 1:110m cut. */
const SINGAPORE: CountriesListCountry = {
  countryCode: 'SG',
  continent: 'Asia',
  firstVisitedOn: '2017-11-08',
  lastVisitedOn: '2017-11-08',
  visitCount: 1,
  note: null,
  hasOutline: false,
}

const ALL = [FRANCE, AUSTRIA, JAPAN, SINGAPORE]

const options = (): Array<HTMLElement> => screen.getAllByRole('option')
const names = (): Array<string | null> =>
  options().map((option) => option.getAttribute('data-country'))

/**
 * Selection is announced through a pair of alternating live regions, so that
 * re-choosing the country already selected is still spoken. Exactly one of them
 * ever holds text, so the sentence is their concatenation.
 */
const announcement = (): string =>
  screen
    .getAllByRole('status')
    .map((region) => region.textContent)
    .join('')

/** Which of the pair is currently carrying the sentence. */
const announcementSlot = (): number =>
  screen.getAllByRole('status').findIndex((region) => region.textContent !== '')

describe('CountriesList rows', () => {
  it('states the whole record: flag, name, continent, both ends and the tally', () => {
    render(<CountriesList countries={[FRANCE]} />)

    const row = screen.getByRole('option', {
      name: 'France, Europe, First visit 14 Jul 2011, Last visit 6 Sept 2024, 3 visits',
    })
    expect(row.textContent).toContain('\u{1F1EB}\u{1F1F7}')
    expect(row.textContent).toContain('France')
    expect(row.textContent).toContain('FR')
    expect(row.textContent).toContain('Europe')
    expect(row.textContent).toContain('First visit')
    expect(row.textContent).toContain('14 Jul 2011')
    expect(row.textContent).toContain('Last visit')
    expect(row.textContent).toContain('6 Sept 2024')
    expect(row.textContent).toContain('3')
    expect(row.textContent).toContain('visits')
  })

  it('exposes both ends as machine-readable days', () => {
    const { container } = render(<CountriesList countries={[FRANCE]} />)
    expect(
      [...container.querySelectorAll('time')].map((node) =>
        node.getAttribute('dateTime'),
      ),
    ).toEqual(['2011-07-14', '2024-09-06'])
  })

  it('prints one date, once, for a country visited once', () => {
    render(<CountriesList countries={[AUSTRIA]} />)

    expect(screen.getByText('Visited')).toBeTruthy()
    expect(screen.getAllByText('28 Dec 2023')).toHaveLength(1)
    expect(screen.queryByText('First visit')).toBeNull()
    expect(screen.queryByText('Last visit')).toBeNull()
    expect(
      screen.getByRole('option', {
        name: 'Austria, Europe, Visited 28 Dec 2023, 1 visit',
      }),
    ).toBeTruthy()
  })

  it('keeps day precision across a multi-year span', () => {
    render(<CountriesList countries={[JAPAN]} />)
    expect(screen.getByText('30 Mar 2019')).toBeTruthy()
    expect(screen.getByText('2 Apr 2026')).toBeTruthy()
  })

  it('says in words when neither end was recorded', () => {
    render(
      <CountriesList
        countries={[
          {
            ...AUSTRIA,
            firstVisitedOn: null,
            lastVisitedOn: null,
            visitCount: 2,
          },
        ]}
      />,
    )

    expect(screen.getByText('Visit dates')).toBeTruthy()
    expect(screen.getByText('Dates not recorded')).toBeTruthy()
    // The country is still fully readable without its dates.
    expect(
      screen.getByRole('option', {
        name: 'Austria, Europe, Visit dates Dates not recorded, 2 visits',
      }),
    ).toBeTruthy()
  })

  it('keeps the recorded half of a half-recorded pair', () => {
    render(<CountriesList countries={[{ ...AUSTRIA, lastVisitedOn: null }]} />)

    expect(screen.getByText('First visit')).toBeTruthy()
    expect(screen.getByText('28 Dec 2023')).toBeTruthy()
    expect(screen.getByText('Not recorded')).toBeTruthy()
  })

  it('leaves no placeholder where a country has no note', () => {
    const { container } = render(<CountriesList countries={[AUSTRIA]} />)
    const row = screen.getByRole('option', { name: /Austria/ })

    expect(row.getAttribute('aria-describedby')).toBeNull()
    expect(container.textContent).not.toContain('No note')
  })

  it('shows a note and hands it to assistive technology as a description', () => {
    render(<CountriesList countries={[FRANCE]} />)
    const row = screen.getByRole('option', { name: /France/ })
    const described = row.getAttribute('aria-describedby')

    expect(described).toBeTruthy()
    expect(document.getElementById(described ?? '')?.textContent).toContain(
      'Verdon gorge',
    )
  })

  it('survives a row with no continent on it', () => {
    render(<CountriesList countries={[{ ...FRANCE, continent: null }]} />)
    expect(screen.getByText('Continent not recorded')).toBeTruthy()
    expect(
      screen.getByRole('option', { name: /France, continent not recorded/ }),
    ).toBeTruthy()
  })

  it('marks every date and every count as tabular', () => {
    const { container } = render(<CountriesList countries={[FRANCE]} />)

    const dates = [...container.querySelectorAll('time')]
    expect(dates).toHaveLength(2)
    for (const date of dates) {
      const scope = `${date.className} ${date.parentElement?.className ?? ''}`
      expect(scope).toContain('tabular-nums')
    }

    const count = container.querySelector('[data-part="count"] > span')
    expect(count?.textContent).toBe('3')
    expect(count?.className).toContain('tabular-nums')

    // The ISO code is a fixed-width token beside a name that is not.
    const code = [...container.querySelectorAll('span')].find(
      (span) => span.textContent === 'FR',
    )
    expect(code?.className).toContain('tabular-nums')
  })

  it('gives a four-figure tally room rather than a fixed column to overflow', () => {
    const { container } = render(
      <CountriesList countries={[{ ...FRANCE, visitCount: 1234 }]} />,
    )
    const count = container.querySelector('[data-part="count"]')

    expect(count?.firstElementChild?.textContent).toBe('1,234')
    expect(count?.className).toContain('min-w-11')
    expect(count?.className.split(' ')).not.toContain('w-11')
    expect(screen.getByRole('option', { name: /1,234 visits/ })).toBeTruthy()
  })
})

describe('a country the bundled geometry cannot draw', () => {
  it('is still listed and says there is nothing to frame', () => {
    render(<CountriesList countries={[SINGAPORE]} />)

    const row = screen.getByRole('option', { name: /Singapore/ })
    expect(row.textContent).toContain('8 Nov 2017')
    expect(row.textContent).toContain('nothing to frame on the map')
    // The reason is the true one: the 1:110m cut folds a dependency into its
    // parent state. It is not a size claim — French Guiana is 83,534 km².
    expect(row.textContent).toContain('parent state')
    expect(row.textContent).not.toContain('Too small')
    const described = row.getAttribute('aria-describedby')
    expect(document.getElementById(described ?? '')?.textContent).toContain(
      'nothing to frame on the map',
    )
  })

  it('repeats it out loud when the row is selected', () => {
    render(<CountriesList countries={ALL} selectedCode="SG" />)
    expect(announcement()).toBe(
      'Singapore selected. Folded into its parent state by the world outlines, so there is nothing to frame on the map.',
    )
  })

  it('says nothing about the map for a country that has an outline', () => {
    render(<CountriesList countries={ALL} selectedCode="FR" />)
    expect(announcement()).toBe('France selected.')
  })
})

describe('selection', () => {
  it('reports the country a click chose', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<CountriesList countries={ALL} onSelect={onSelect} />)

    await user.click(screen.getByRole('option', { name: /Japan/ }))
    expect(onSelect).toHaveBeenCalledWith('JP')
  })

  it('selects on Enter and on Space', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<CountriesList countries={ALL} onSelect={onSelect} />)

    const row = screen.getByRole('option', { name: /Austria/ })
    row.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')

    expect(onSelect.mock.calls).toEqual([['AT'], ['AT']])
  })

  it('re-reports the country already selected, so the map can frame it again', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <CountriesList countries={ALL} selectedCode="FR" onSelect={onSelect} />,
    )

    await user.click(screen.getByRole('option', { name: /France/ }))
    expect(onSelect).toHaveBeenCalledWith('FR')
  })

  it('announces the selected row through option semantics', () => {
    render(<CountriesList countries={ALL} selectedCode="JP" />)

    const selected = options().filter(
      (option) => option.getAttribute('aria-selected') === 'true',
    )
    expect(selected).toHaveLength(1)
    expect(selected[0]?.getAttribute('data-country')).toBe('JP')
  })

  it('keeps its own selection when no host controls it', async () => {
    const user = userEvent.setup()
    render(<CountriesList countries={ALL} />)

    await user.click(screen.getByRole('option', { name: /Japan/ }))
    expect(
      screen
        .getByRole('option', { name: /Japan/ })
        .getAttribute('aria-selected'),
    ).toBe('true')
  })

  it('marks the selection with more than colour', () => {
    render(<CountriesList countries={ALL} selectedCode="JP" />)
    const tick = (option: HTMLElement): Element | null =>
      option.querySelector('[data-part="tick"]')

    // The slot is reserved on every row, so drawing the glyph moves nothing…
    for (const option of options()) {
      expect(tick(option)).toBeTruthy()
    }
    // …and only the selected row carries a glyph in it.
    expect(
      tick(screen.getByRole('option', { name: /Japan/ }))?.querySelector('svg'),
    ).toBeTruthy()
    expect(
      tick(screen.getByRole('option', { name: /France/ }))?.querySelector(
        'svg',
      ),
    ).toBeNull()
  })

  it('changes nothing that can reflow the row', () => {
    render(<CountriesList countries={ALL} selectedCode="JP" />)
    const geometry = (option: HTMLElement): Array<string> =>
      option.className
        .split(' ')
        .filter((name) =>
          /^(flex|w-|min-w|items-|gap-|p|px-|py-|m|border|font-|text-(label|caption|micro|subtitle|body|left)|size-|relative)/.test(
            name,
          ),
        )
        .sort()

    const selected = screen.getByRole('option', { name: /Japan/ })
    const unselected = screen.getByRole('option', { name: /France/ })
    expect(geometry(selected)).toEqual(geometry(unselected))
  })

  it('keeps hover and press apart on a selected row as well as an idle one', () => {
    render(<CountriesList countries={ALL} selectedCode="JP" />)

    const wash = (option: HTMLElement): string =>
      option.firstElementChild?.className ?? ''
    const selected = screen.getByRole('option', { name: /Japan/ })
    const unselected = screen.getByRole('option', { name: /France/ })

    // The ground carries selection; the wash above it carries the pointer, so
    // hover and active never resolve to the same paint in either state.
    expect(selected.className).toContain('bg-brand-subtle')
    expect(unselected.className).not.toContain('bg-brand-subtle')
    for (const option of [selected, unselected]) {
      expect(wash(option)).toContain('group-hover:bg-hover')
      expect(wash(option)).toContain('group-active:bg-active')
    }
  })

  it('renders a padded, lower-case code as the selected row', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <CountriesList
        countries={[{ ...JAPAN, countryCode: ' jp ' }, FRANCE]}
        selectedCode=" Jp "
        onSelect={onSelect}
      />,
    )

    const row = screen.getByRole('option', { name: /Japan/ })
    expect(row.getAttribute('data-country')).toBe('JP')
    expect(row.getAttribute('aria-selected')).toBe('true')
    expect(announcement()).toBe('Japan selected.')

    // …and it reports the one normalised form a map can look up.
    await user.click(row)
    expect(onSelect).toHaveBeenCalledWith('JP')
  })

  /**
   * The announcement is driven by the sentence, not by the click. A host that
   * has not committed the new selection yet — or never will — must not have the
   * previous country announced into the empty region on its behalf.
   */
  it('announces nothing new when the host does not commit the choice', async () => {
    const user = userEvent.setup()
    render(<CountriesList countries={ALL} selectedCode="FR" />)

    const before = announcementSlot()
    await user.click(screen.getByRole('option', { name: /Japan/ }))

    expect(announcement()).toBe('France selected.')
    expect(announcementSlot()).toBe(before)
  })

  it('announces the country the host actually committed', () => {
    const { rerender } = render(
      <CountriesList countries={ALL} selectedCode="FR" />,
    )
    expect(announcement()).toBe('France selected.')

    rerender(<CountriesList countries={ALL} selectedCode="JP" />)
    expect(announcement()).toBe('Japan selected.')
  })

  it('speaks again when the country already selected is chosen again', async () => {
    const user = userEvent.setup()
    render(<CountriesList countries={ALL} selectedCode="FR" />)

    const before = announcementSlot()
    expect(announcement()).toBe('France selected.')

    await user.click(screen.getByRole('option', { name: /France/ }))

    // Same sentence, other region: a live region that is written the same text
    // it already holds says nothing at all.
    expect(announcement()).toBe('France selected.')
    expect(announcementSlot()).not.toBe(before)
  })
})

describe('keyboard operation', () => {
  it('is a single tab stop that starts on the selected country', () => {
    render(<CountriesList countries={ALL} selectedCode="JP" />)
    const tabbable = options().filter(
      (option) => option.getAttribute('tabindex') === '0',
    )
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]?.getAttribute('data-country')).toBe('JP')
  })

  it('moves with the arrows, Home and End without selecting anything', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<CountriesList countries={ALL} onSelect={onSelect} />)

    // Default order is by country code: AT, FR, JP, SG.
    options()[0]?.focus()
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement?.getAttribute('data-country')).toBe('FR')
    await user.keyboard('{ArrowDown}{ArrowUp}')
    expect(document.activeElement?.getAttribute('data-country')).toBe('FR')
    await user.keyboard('{End}')
    expect(document.activeElement?.getAttribute('data-country')).toBe('SG')
    await user.keyboard('{Home}')
    expect(document.activeElement?.getAttribute('data-country')).toBe('AT')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('stops at the ends instead of wrapping past them', async () => {
    const user = userEvent.setup()
    render(<CountriesList countries={ALL} />)

    options()[0]?.focus()
    await user.keyboard('{ArrowUp}')
    expect(document.activeElement?.getAttribute('data-country')).toBe('AT')
    await user.keyboard('{End}{ArrowDown}')
    expect(document.activeElement?.getAttribute('data-country')).toBe('SG')
  })

  it('jumps to a country by typing its name', async () => {
    const user = userEvent.setup()
    render(<CountriesList countries={ALL} />)

    options()[0]?.focus()
    await user.keyboard('jap')
    expect(document.activeElement?.getAttribute('data-country')).toBe('JP')
  })

  /**
   * The tab stop is held as a country code, not a position: an index desyncs
   * from the row it was pointing at the moment the order changes.
   */
  it('keeps the tab stop on the same country across a re-sort', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<CountriesList countries={ALL} sort="code" />)

    // Default order is by country code: AT, FR, JP, SG.
    options()[0]?.focus()
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement?.getAttribute('data-country')).toBe('FR')

    // Most visits puts France first: FR, JP, AT, SG.
    rerender(<CountriesList countries={ALL} sort="visits" />)
    const tabbable = options().filter(
      (option) => option.getAttribute('tabindex') === '0',
    )
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0]?.getAttribute('data-country')).toBe('FR')
  })

  it('never traps focus: Tab leaves the list', async () => {
    const user = userEvent.setup()
    render(
      <>
        <CountriesList countries={ALL} />
        <button type="button">After the list</button>
      </>,
    )

    options()[0]?.focus()
    await user.tab()
    expect(document.activeElement?.textContent).toBe('After the list')
  })
})

describe('order', () => {
  it('defaults to the order the repository returns, whatever it is handed', () => {
    render(<CountriesList countries={[JAPAN, SINGAPORE, FRANCE, AUSTRIA]} />)
    expect(names()).toEqual(['AT', 'FR', 'JP', 'SG'])
    expect(screen.getByText('Ordered by country code, A to Z.')).toBeTruthy()
  })

  it('states the order it is actually in', () => {
    render(<CountriesList countries={ALL} sort="recent" />)
    expect(
      screen.getByText(
        'Ordered by the most recent visit first, then country code.',
      ),
    ).toBeTruthy()
    expect(names()).toEqual(['JP', 'FR', 'AT', 'SG'])
  })

  it('breaks every tie on the country code, so the order is total', () => {
    const tied = [
      { ...AUSTRIA, countryCode: 'ZW', visitCount: 1, lastVisitedOn: null },
      { ...AUSTRIA, countryCode: 'AL', visitCount: 1, lastVisitedOn: null },
      { ...AUSTRIA, countryCode: 'MT', visitCount: 1, lastVisitedOn: null },
    ]
    for (const sort of ['code', 'name', 'recent', 'visits'] as const) {
      expect(sortCountries(tied, sort).map((row) => row.countryCode)).toEqual([
        'AL',
        'MT',
        'ZW',
      ])
    }
  })

  it('files a diacritic under its base letter rather than after Z', () => {
    const rows = [
      { ...AUSTRIA, countryCode: 'DK' },
      { ...AUSTRIA, countryCode: 'CI' },
      { ...AUSTRIA, countryCode: 'BR' },
    ]
    expect(sortCountries(rows, 'name').map((row) => row.countryCode)).toEqual([
      'BR',
      'CI',
      'DK',
    ])
  })

  it('sorts a country with no recorded date last, not oldest', () => {
    const rows = [
      { ...AUSTRIA, countryCode: 'AA', lastVisitedOn: null },
      { ...AUSTRIA, countryCode: 'BB', lastVisitedOn: '1998-01-01' },
    ]
    expect(sortCountries(rows, 'recent').map((row) => row.countryCode)).toEqual(
      ['BB', 'AA'],
    )
  })

  it('re-orders the list from the keyboard', async () => {
    const user = userEvent.setup()
    const onSortChange = vi.fn()
    render(<CountriesList countries={ALL} onSortChange={onSortChange} />)

    const control = screen.getByRole('combobox', { name: 'Order countries' })
    control.focus()
    await user.keyboard('{Enter}')
    // The open popup hides the rest of the document from assistive technology,
    // so the only listbox left in the tree is the one the control opened.
    await user.click(
      within(screen.getByRole('listbox')).getByRole('option', {
        name: /Most visits/,
      }),
    )

    expect(onSortChange).toHaveBeenCalledWith('visits')
    expect(names()).toEqual(['FR', 'JP', 'AT', 'SG'])
  })
})

describe('entrance', () => {
  it('staggers the rows and caps the wait', () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      ...AUSTRIA,
      countryCode: `A${String.fromCharCode(65 + index)}`,
    }))
    render(<CountriesList countries={many} />)

    const delays = options().map((option) => option.style.animationDelay)
    expect(delays[0]).toBe('0ms')
    expect(delays[3]).toBe('72ms')
    expect(delays[8]).toBe('192ms')
    expect(delays[11]).toBe('192ms')
    // Under `prefers-reduced-motion` the base layer neutralises the transform;
    // the hook it needs has to be on the element.
    expect(options()[0]?.hasAttribute('data-motion-transform')).toBe(true)
  })
})

describe('the designed nothing', () => {
  it('offers no listbox and promises no action the app cannot perform', () => {
    render(<CountriesList countries={[]} />)

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByText('No countries on the map yet')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('lets a host that filtered the list to nothing say so instead', () => {
    render(
      <CountriesList countries={[]} emptyState={<p>No country matches.</p>} />,
    )
    expect(screen.getByText('No country matches.')).toBeTruthy()
    expect(screen.queryByText('No countries on the map yet')).toBeNull()
  })
})

describe('CountriesListSkeleton', () => {
  it('says it is loading once, rather than narrating empty boxes', () => {
    const { container } = render(<CountriesListSkeleton rows={3} />)
    const root = container.firstElementChild

    expect(root?.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByText('Loading visited countries')).toBeTruthy()
    expect(container.querySelectorAll('li')).toHaveLength(3)
    expect(screen.queryByRole('option')).toBeNull()
  })

  /**
   * jsdom has no layout engine, so height cannot be measured here. What can be
   * locked is the cause: both components are cut from the same class strings,
   * so if one is edited and the other is not, these comparisons fail before the
   * loading-to-content swap ever gets a chance to move the page.
   */
  it('is cut from the same row geometry as the list it stands in for', () => {
    const loading = render(<CountriesListSkeleton rows={1} />).container
    const loaded = render(<CountriesList countries={[FRANCE]} />).container

    const rowClasses = (root: HTMLElement, selector: string): string =>
      root.querySelector(selector)?.className ?? ''

    expect(rowClasses(loading, 'li > div')).toBe(
      rowClasses(loaded, 'li > button')
        .split(' ')
        .filter(
          (name) =>
            !name.startsWith('animate-') &&
            !name.startsWith('cursor-') &&
            name !== 'group' &&
            !name.startsWith('transition-') &&
            !name.startsWith('duration-') &&
            !name.startsWith('ease-') &&
            !name.startsWith('hover:') &&
            !name.startsWith('active:') &&
            !name.startsWith('focus-visible:'),
        )
        .join(' '),
    )
  })

  it('strikes each bar inside a real line box of the real type style', () => {
    const { container } = render(<CountriesListSkeleton rows={1} />)
    const struts = [...container.querySelectorAll('[data-part="bar"]')]

    expect(struts.length).toBeGreaterThan(0)
    for (const strut of struts) {
      expect(strut.textContent).toBe(' ')
      expect(strut.className).toMatch(/text-(label|caption|micro|subtitle)/)
    }
  })

  it('nests no block element inside a phrasing one', () => {
    const { container } = render(<CountriesListSkeleton rows={2} />)
    expect(container.querySelectorAll('span div')).toHaveLength(0)
    expect(container.querySelectorAll('span p, span ul, span li')).toHaveLength(
      0,
    )
  })

  /**
   * The reserved date block is the one part of a row whose size depends on the
   * data, because eight of our twelve seeded countries were visited once. Both
   * shapes have to occupy the same box, or the majority row drops the page by a
   * line the moment the read lands.
   */
  it('reserves the date block one cell and two cells alike', () => {
    const loading = render(<CountriesListSkeleton rows={1} />).container
    const single = render(<CountriesList countries={[AUSTRIA]} />).container
    const ranged = render(<CountriesList countries={[FRANCE]} />).container

    const dates = (root: HTMLElement): Element | null =>
      root.querySelector('[data-part="dates"]')
    const cellClass = (root: HTMLElement): string | undefined =>
      dates(root)?.firstElementChild?.className

    // Two columns below `md`, so one cell and two cells alike are one line of
    // labels above one line of values…
    expect(dates(single)?.className).toContain('grid-cols-2')
    expect(dates(single)?.className).toBe(dates(ranged)?.className)
    expect(dates(loading)?.className).toBe(dates(single)?.className)

    // …each cell stacking its own pair rather than sharing a row with them…
    expect(cellClass(ranged)).toContain('flex-col')
    expect(cellClass(loading)).toBe(cellClass(ranged))

    // …and the lone cell of a single-visit country taking both columns, so its
    // heading and its date each stay on one line.
    expect(cellClass(single)).toBe(`${cellClass(ranged) ?? ''} col-span-2`)
  })
})

describe('CountriesListError', () => {
  it('says what happened without implying anything was lost', () => {
    render(<CountriesListError />)
    expect(screen.getByText('Your countries did not load')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('offers a retry only when the host can actually retry', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<CountriesListError onRetry={onRetry} />)

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('holds the retry button in its pending state while the read is in air', () => {
    render(<CountriesListError onRetry={() => {}} retrying />)
    const button = screen.getByRole('button', {
      name: /Loading your countries/,
    })
    expect(button.hasAttribute('disabled')).toBe(true)
  })
})
