// @vitest-environment jsdom
// The Radix popover behind the combobox needs the pointer-capture and
// scroll-into-view stubs jsdom does not implement; they live with the primitives
// they were written for.
import '#/components/ui/__tests__/test-env'

import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MapProvider } from '#/components/map/map-context'
import { VISITED_COUNTRY_ZOOM } from '#/components/map/visited-countries'
import { countryBounds } from '#/lib/map/countries'
import { COUNTRY_FRAME_DURATION, CountrySearch } from '../country-search'

import type { MapContextValue, MapLibreMap } from '#/components/map/map-context'
import type { CountrySearchVisit } from '#/lib/atlas/country-search'
import type { CountrySearchProps } from '../country-search'

/* ------------------------------------------------------------------ fixtures */

function visit(
  countryCode: string,
  overrides: Partial<CountrySearchVisit> = {},
): CountrySearchVisit {
  return {
    countryCode,
    continent: 'Europe',
    firstVisitedOn: '2011-07-14',
    lastVisitedOn: '2024-09-06',
    visitCount: 3,
    ...overrides,
  }
}

/** France draws, Malta does not, and Japan is on the other side of the line. */
const RECORD: ReadonlyArray<CountrySearchVisit> = [
  visit('FR'),
  visit('MT', { visitCount: 1 }),
  visit('JP', { continent: 'Asia', visitCount: 2 }),
]

/**
 * The record the product actually ships with: twelve countries, two more than a
 * typed query hands back. The pair the ten-row cap used to swallow — the United
 * Kingdom and the United States, last in name order — are why this fixture
 * exists rather than a shorter one.
 */
const TWELVE: ReadonlyArray<CountrySearchVisit> = [
  'GB',
  'FR',
  'IT',
  'ES',
  'PT',
  'IS',
  'AT',
  'JP',
  'TH',
  'MA',
  'US',
  'AR',
].map((code) => visit(code))

interface FitCall {
  readonly bounds: unknown
  readonly options: Record<string, unknown>
}

/**
 * Enough of a MapLibre map to record a camera move.
 *
 * The container is an object rather than a real element because jsdom has no
 * layout: `clientWidth` on a detached div is 0, which is exactly the "nothing to
 * draw in" case the component refuses to fit into.
 */
class FakeMap {
  readonly fits: Array<FitCall> = []

  constructor(
    private readonly width = 1200,
    private readonly height = 800,
  ) {}

  getContainer(): HTMLElement {
    return {
      clientWidth: this.width,
      clientHeight: this.height,
    } as unknown as HTMLElement
  }

  fitBounds(bounds: unknown, options: Record<string, unknown>): void {
    this.fits.push({ bounds, options })
  }
}

function context(map: FakeMap | null): MapContextValue {
  return {
    map: map === null ? null : (map as unknown as MapLibreMap),
    gl: null,
    ready: true,
    basemap: 'available',
    engine: 'running',
    archive: null,
    theme: 'light',
    styleEpoch: 0,
    retryBasemap: () => {},
  }
}

function tree(
  props: Partial<CountrySearchProps> = {},
  map: FakeMap | null = null,
): React.ReactElement {
  return (
    <MapProvider value={context(map)}>
      <CountrySearch countries={RECORD} {...props} />
    </MapProvider>
  )
}

/* -------------------------------------------------------------------- helpers */

const field = (): HTMLElement =>
  screen.getByRole('button', { name: 'Find a country' })

const open = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> => {
  await user.click(field())
  return screen.getByRole('combobox')
}

const rows = (): Array<string> =>
  screen.getAllByRole('option').map((option) => option.textContent)

/** Exactly one of the alternating regions holds text, so this is the sentence. */
const announcement = (): string =>
  screen
    .getAllByRole('status')
    .map((region) => region.textContent)
    .join('')

const activeRow = (search: HTMLElement): string => {
  const id = search.getAttribute('aria-activedescendant')
  return document.getElementById(id ?? '')?.textContent ?? ''
}

/* ----------------------------------------------------------------------- rest */

describe('CountrySearch', () => {
  it('is one tab stop away from the page, and names itself', async () => {
    const user = userEvent.setup()
    render(tree())
    await user.tab()
    expect(document.activeElement).toBe(field())
    expect(field().textContent).toContain('Find a country')
  })

  it('waits, disabled, while the record is still being read', () => {
    render(tree({ loading: true }))
    expect(field().hasAttribute('disabled')).toBe(true)
    expect(field().textContent).toContain('Loading your countries')
    // The spinner carries the pending state out loud as well as on screen.
    expect(
      screen
        .getAllByRole('status')
        .some((region) => region.textContent === 'Loading your countries'),
    ).toBe(true)
  })

  it('can be disabled outright', () => {
    render(tree({ disabled: true }))
    expect(field().hasAttribute('disabled')).toBe(true)
  })
})

/* --------------------------------------------------------------- combobox aria */

describe('CountrySearch semantics', () => {
  it('opens a real listbox wired to the search box', async () => {
    const user = userEvent.setup()
    render(tree())
    const search = await open(user)

    expect(search.getAttribute('aria-expanded')).toBe('true')
    expect(search.getAttribute('aria-autocomplete')).toBe('list')
    const listId = search.getAttribute('aria-controls')
    expect(listId).toBeTruthy()
    expect(screen.getByRole('listbox').id).toBe(listId)
    expect(document.activeElement).toBe(search)
    expect(activeRow(search)).toContain('France')
  })

  it('answers an unasked question with the record, in name order', async () => {
    const user = userEvent.setup()
    render(tree())
    await open(user)
    expect(rows()[0]).toContain('France')
    expect(rows()[1]).toContain('Japan')
    expect(rows()[2]).toContain('Malta')
    expect(rows()).toHaveLength(3)
  })

  it('lists a record longer than the typed cap in full', async () => {
    const user = userEvent.setup()
    render(tree({ countries: TWELVE }))
    const search = await open(user)

    // Twelve rows for twelve countries. The two the ten-row cap used to drop are
    // last in name order, so the tail is what proves the list is complete.
    expect(rows()).toHaveLength(12)
    expect(rows()[10]).toContain('United Kingdom')
    expect(rows()[11]).toContain('United States')

    // And the count out loud matches the count on screen, which is the whole
    // point: a reader who cannot see the list is told twelve and given twelve.
    await user.type(search, 'a')
    await user.clear(search)
    expect(announcement()).toBe('12 countries on your record.')
    expect(rows()).toHaveLength(12)
  })

  it('reaches every row of a long record from the keyboard', async () => {
    const user = userEvent.setup()
    render(tree({ countries: TWELVE }))
    const search = await open(user)

    await user.keyboard('{End}')
    expect(activeRow(search)).toContain('United States')
    await user.keyboard('{ArrowUp}')
    expect(activeRow(search)).toContain('United Kingdom')
    await user.keyboard('{Home}')
    expect(activeRow(search)).toContain('Argentina')
  })

  it('names the selection it pins above a record that lacks it', async () => {
    const user = userEvent.setup()
    render(tree({ countries: TWELVE, selectedCode: 'PE' }))
    const search = await open(user)

    // Peru is not on the record, so it is pinned on top to keep the combobox's
    // own value in its own list — thirteen rows for twelve countries, and the
    // sentence accounts for the difference rather than leaving it unexplained.
    expect(rows()).toHaveLength(13)
    expect(rows()[0]).toContain('Peru')

    await user.type(search, 'a')
    await user.clear(search)
    expect(announcement()).toBe(
      '12 countries on your record. Peru is selected and listed first.',
    )
  })

  it('explains a lone pinned row when the record is empty', async () => {
    const user = userEvent.setup()
    render(tree({ countries: [], selectedCode: 'PE' }))
    const search = await open(user)

    expect(rows()).toHaveLength(1)
    await user.type(search, 'a')
    await user.clear(search)
    expect(announcement()).toBe(
      'Peru is selected. No countries on your record yet — type to search every country in the world.',
    )
  })

  it('moves the highlight with the arrows, Home and End', async () => {
    const user = userEvent.setup()
    render(tree())
    const search = await open(user)

    await user.keyboard('{ArrowDown}')
    expect(activeRow(search)).toContain('Japan')
    await user.keyboard('{ArrowDown}')
    expect(activeRow(search)).toContain('Malta')
    await user.keyboard('{ArrowUp}')
    expect(activeRow(search)).toContain('Japan')
    await user.keyboard('{End}')
    expect(activeRow(search)).toContain('Malta')
    await user.keyboard('{Home}')
    expect(activeRow(search)).toContain('France')
  })

  it('marks the chosen row selected, and only that row', async () => {
    const user = userEvent.setup()
    render(tree({ selectedCode: 'JP' }))
    await open(user)
    const selected = screen
      .getAllByRole('option')
      .filter((option) => option.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(1)
    expect(selected[0]?.textContent).toContain('Japan')
  })

  it('gives Escape back to the field rather than to the map', async () => {
    const user = userEvent.setup()
    render(tree())
    await open(user)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(field())
  })

  it('stays open when the pointer leaves the list', async () => {
    const user = userEvent.setup()
    render(tree())
    const search = await open(user)

    const list = screen.getByRole('listbox')
    await user.hover(screen.getAllByRole('option')[1] ?? list)
    await user.unhover(list)
    await user.pointer({ target: document.body, coords: { x: 0, y: 0 } })

    // A keyboard reader is still in here, and a pointer that wandered off is not
    // a decision. The list closes on Escape, on a choice, or on a real press
    // outside — never on a mouseleave.
    expect(screen.getByRole('listbox')).not.toBeNull()
    expect(document.activeElement).toBe(search)
  })
})

/* -------------------------------------------------------------------- matching */

describe('CountrySearch matching', () => {
  it('finds an accented country from unaccented typing', async () => {
    const user = userEvent.setup()
    render(tree())
    const search = await open(user)

    await user.type(search, 'cote')
    expect(rows()[0]).toContain('Côte d’Ivoire')

    await user.clear(search)
    await user.type(search, 'côte')
    expect(rows()[0]).toContain('Côte d’Ivoire')
  })

  it('takes a two-letter code as the answer it is', async () => {
    const user = userEvent.setup()
    render(tree())
    const search = await open(user)
    await user.type(search, 'us')
    expect(rows()[0]).toContain('United States')
  })

  it('searches the whole world, not only the record', async () => {
    const user = userEvent.setup()
    render(tree())
    const search = await open(user)
    await user.type(search, 'peru')
    expect(rows()[0]).toContain('Peru')
    expect(rows()[0]).toContain('Not visited yet')
  })

  it('says how many countries a row stands for', async () => {
    const user = userEvent.setup()
    render(tree())
    await open(user)
    expect(rows()[0]).toContain('3 visits')
    expect(rows()[2]).toContain('1 visit')
    // Malta has no polygon in the bundled cut, and the row says so.
    expect(rows()[2]).toContain('no map outline')
  })

  it('shows a designed nothing rather than an empty panel', async () => {
    const user = userEvent.setup()
    render(tree())
    const search = await open(user)
    await user.type(search, 'qqzz')

    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText('No country matches “qqzz”')).not.toBeNull()
    expect(screen.getByText(/PT finds Portugal/)).not.toBeNull()
  })

  it('announces the result count politely', async () => {
    const user = userEvent.setup()
    render(tree())
    const search = await open(user)

    for (const region of screen.getAllByRole('status')) {
      expect(region.getAttribute('aria-live')).toBe('polite')
    }

    await user.type(search, 'malt')
    expect(announcement()).toBe('1 country matches “malt”.')

    await user.clear(search)
    await user.type(search, 'qqzz')
    expect(announcement()).toBe('No country matches “qqzz”.')

    await user.clear(search)
    await user.type(search, 'a')
    // Ten rows of many: the count that did not fit is stated, not dropped.
    expect(announcement()).toMatch(
      /^\d+ countries match “a”\. Showing the first 10\.$/,
    )
  })
})

/* ---------------------------------------------------------------------- camera */

describe('CountrySearch camera', () => {
  it('selects the country and frames it in one gesture', async () => {
    const user = userEvent.setup()
    const map = new FakeMap()
    const onSelect = vi.fn()
    render(tree({ onSelect }, map))

    const search = await open(user)
    await user.type(search, 'japan')
    await user.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledWith('JP')
    expect(map.fits).toHaveLength(1)
    const [fit] = map.fits
    expect(fit.bounds).toEqual([
      [129.41, 31.03],
      [145.54, 45.55],
    ])
    expect(field().textContent).toContain('Japan')
    expect(announcement()).toBe('Japan selected. The map is framing it.')
  })

  it('keeps an antimeridian crosser on the short way round', async () => {
    const user = userEvent.setup()
    const map = new FakeMap()
    render(tree({}, map))

    const search = await open(user)
    await user.type(search, 'russia')
    await user.keyboard('{Enter}')

    // The eastern edge is deliberately past 180: that is how MapLibre is told a
    // rectangle crosses the line. Wrapping it flies the camera to the Atlantic.
    expect(map.fits[0]?.bounds).toEqual([
      [19.66, 41.15],
      [190.1, 81.25],
    ])
    expect(countryBounds('RU')?.east).toBeGreaterThan(180)
  })

  it('moves inside the motion envelope, on the quintic curve', async () => {
    const user = userEvent.setup()
    const map = new FakeMap()
    render(tree({}, map))

    const search = await open(user)
    await user.type(search, 'japan')
    await user.keyboard('{Enter}')

    const options = map.fits[0]?.options ?? {}
    expect(options.animate).toBe(true)
    expect(options.duration).toBe(COUNTRY_FRAME_DURATION)
    expect(COUNTRY_FRAME_DURATION).toBeGreaterThanOrEqual(150)
    expect(COUNTRY_FRAME_DURATION).toBeLessThanOrEqual(260)

    const easing = options.easing
    expect(typeof easing).toBe('function')
    if (typeof easing !== 'function') return
    // Exact at both ends, and past three-quarters of the way at the midpoint —
    // the shape of an ease-out, not a linear ramp.
    expect(easing(0)).toBe(0)
    expect(easing(1)).toBe(1)
    expect(easing(0.5)).toBeGreaterThan(0.75)
  })

  it('jumps in one frame when the reader has asked for less motion', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    )

    const user = userEvent.setup()
    const map = new FakeMap()
    render(tree({}, map))

    const search = await open(user)
    await user.type(search, 'japan')
    await user.keyboard('{Enter}')

    // Still framed — the reader asked for less movement, not for less map.
    expect(map.fits).toHaveLength(1)
    expect(map.fits[0]?.options.animate).toBe(false)
    expect(map.fits[0]?.options.duration).toBe(0)
  })

  it('lands where the country fills are still drawn and still hit-testable', async () => {
    const user = userEvent.setup()
    const map = new FakeMap()
    render(tree({}, map))

    const search = await open(user)
    await user.type(search, 'luxembourg')
    await user.keyboard('{Enter}')

    // Above this zoom the fill layer is not drawn, so it answers no pointer at
    // all: a click would report nothing, and a selection driven from here has to
    // outlive that. Framing inside the range is what keeps the two agreeing.
    expect(map.fits[0]?.options.maxZoom).toBe(
      VISITED_COUNTRY_ZOOM.interactiveMax,
    )
  })

  it('keeps the floating panels clear of the frame', async () => {
    const user = userEvent.setup()
    const map = new FakeMap()
    render(tree({ padding: { left: 360, bottom: 220 } }, map))

    const search = await open(user)
    await user.type(search, 'japan')
    await user.keyboard('{Enter}')

    expect(map.fits[0]?.options.padding).toEqual({
      top: 48,
      right: 48,
      bottom: 220,
      left: 360,
    })
  })

  it('does not fit into a container with no area', async () => {
    const user = userEvent.setup()
    const map = new FakeMap(0, 0)
    render(tree({}, map))

    const search = await open(user)
    await user.type(search, 'japan')
    await user.keyboard('{Enter}')

    expect(map.fits).toHaveLength(0)
    expect(announcement()).toBe('Japan selected.')
  })

  it('still selects when there is no map to move', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(tree({ onSelect }, null))

    const search = await open(user)
    await user.type(search, 'japan')
    await user.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledWith('JP')
  })
})

/* ----------------------------------------------------------------- no outline */

describe('CountrySearch without geometry to frame', () => {
  it('explains itself instead of quietly doing nothing', async () => {
    const user = userEvent.setup()
    const map = new FakeMap()
    const onSelect = vi.fn()
    render(tree({ onSelect }, map))

    const search = await open(user)
    await user.type(search, 'malta')
    await user.keyboard('{Enter}')

    // The record still gains the country: only the camera has nothing to do.
    expect(onSelect).toHaveBeenCalledWith('MT')
    expect(map.fits).toHaveLength(0)

    // Once in the field's own hint, once out loud.
    expect(
      screen.getAllByText(/Malta has no outline at world scale/),
    ).toHaveLength(2)
    expect(announcement()).toContain('Malta selected.')
    expect(announcement()).toContain('has no outline at world scale')
  })

  it('wires the notice to the field, so focus reads it', async () => {
    const user = userEvent.setup()
    render(tree({}, new FakeMap()))

    const search = await open(user)
    await user.type(search, 'malta')
    await user.keyboard('{Enter}')

    const describedBy = field().getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy ?? '')?.textContent).toContain(
      'nothing to frame',
    )
  })

  it('drops the notice once the selection moves on', async () => {
    const user = userEvent.setup()
    render(tree({}, new FakeMap()))

    const search = await open(user)
    await user.type(search, 'malta')
    await user.keyboard('{Enter}')
    expect(
      screen.queryAllByText(/Malta has no outline/).length,
    ).toBeGreaterThan(0)

    // Reopening keeps the query that made the choice, so it is cleared the way
    // a reader would before asking a second question.
    await user.click(field())
    const again = screen.getByRole('combobox')
    await user.clear(again)
    await user.type(again, 'japan')
    await user.keyboard('{Enter}')
    expect(screen.queryAllByText(/Malta has no outline/)).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------- clearing */

describe('CountrySearch clearing', () => {
  it('offers a reset once something is chosen, and moves no camera for it', async () => {
    const user = userEvent.setup()
    const map = new FakeMap()
    const onSelect = vi.fn()
    render(tree({ onSelect }, map))

    const search = await open(user)
    await user.type(search, 'japan')
    await user.keyboard('{Enter}')
    expect(map.fits).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(onSelect).toHaveBeenLastCalledWith(null)
    expect(map.fits).toHaveLength(1)
    expect(announcement()).toBe('Selection cleared.')
    expect(field().textContent).toContain('Find a country')
  })

  it('lets the host drive the selection from somewhere else entirely', () => {
    // Padded and lower-cased, the way a database column can arrive.
    const view = render(tree({ selectedCode: ' fr ' }))
    expect(field().textContent).toContain('France')

    view.rerender(tree({ selectedCode: null }))
    expect(field().textContent).toContain('Find a country')
  })
})
