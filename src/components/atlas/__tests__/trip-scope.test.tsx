// @vitest-environment jsdom
// The panel mounts the Radix-backed tab strip, which needs the pointer-capture
// and scroll stubs jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

import { LOCALE_TAGS } from '#/lib/i18n/locales'

import { AtlasPanel } from '../atlas-panel'
import { CountryCard } from '../country-card'

import type { AtlasPanelProps } from '../atlas-panel'
import type { CountryCardProps } from '../country-card'
import type { NamespaceModule } from '#/lib/i18n/catalogue'

/**
 * Two trip counts, one screen, and the words that tell them apart.
 *
 * `recomputeTravelStats` counts the trips the reader is a member of — ADR 0007,
 * and the `00-S4` amendment that put the `EXISTS` on `trip_members`.
 * `countTripsByCountry` deliberately stayed the workspace's, because a tally
 * filtered by membership would not sum to anything a reader could check against
 * the country it is printed on. Both land on `/atlas`: the panel's tile above
 * the map, the country card's leading cell over it. So in any workspace where
 * somebody is not on every trip — the case below, a colleague on neither of the
 * two Portugal trips — the cards sum higher than the tile above them, and under
 * one bare word, `Trips`, that reads as a broken aggregate rather than as two
 * answers to two different questions.
 *
 * Neither query moves; the fix is the copy, and this is where it is held. The
 * panel says whose trips it counts, the card says whose it counts, and neither
 * is allowed back to the bare noun they used to share.
 *
 * The places are the same defect one cell over. The panel's `placeCount` is
 * read over those same member trips; the card's comes from
 * `countVisitedPlacesByCountry`, the workspace's visited places. So the place
 * tile and the card's second cell are held here the same way, and the
 * catalogue check covers both pairs.
 */

// The panel's country pane pulls in the two atlas writes and the router hook
// behind them; neither has any meaning in jsdom, and what they *do* is
// `country-actions.test.tsx`'s subject. This file only mounts the stats tab.
vi.mock('#/server/fns/atlas', () => ({
  markCountryVisitedFn: vi.fn(),
  unmarkCountryVisitedFn: vi.fn(),
  addCountryToBucketListFn: vi.fn(),
  removeCountryFromBucketListFn: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
}))

/** The reader's own row: they are on none of the workspace's trips. */
const STATS: AtlasPanelProps['stats'] = {
  countryCount: 1,
  worldCount: 195,
  regionCount: 4,
  visitCount: 2,
  tripCount: 0,
  placeCount: 7,
  cityCount: 3,
  dayCount: 9,
  distanceMetres: null,
}

/** The same workspace's Portugal: two trips, neither of them the reader's. */
const PORTUGAL = {
  countryCode: 'PT',
  tripCount: 2,
  placeCount: 4,
  firstTripOn: '2026-08-03',
  lastTripOn: '2026-08-28',
  visitCount: 0,
  firstVisitedOn: null,
  lastVisitedOn: null,
} as const

/** The panel above the map, opened on the tab that carries the trip tile. */
function renderPanel(): HTMLElement {
  return render(
    <AtlasPanel
      countries={[]}
      selectedCode={null}
      onSelect={() => {}}
      tab="stats"
      onTabChange={() => {}}
      expanded
      onExpandedChange={() => {}}
      stats={STATS}
      byContinent={[]}
      bucketList={[]}
    />,
  ).container
}

/** One country card, the surface that carries the other trip figure. */
function renderCard(props: CountryCardProps): HTMLElement {
  return render(<CountryCard {...props} />).container
}

/** Both surfaces at once, which is how the reader meets them. */
function renderAtlasScreen(): void {
  renderPanel()
  renderCard(PORTUGAL)
}

/**
 * One panel tile, by the figure it carries.
 *
 * `data-stat` is the panel's own handle on its tiles — the idiom `CountryCard`
 * already sets with `data-country` and `data-record`; `atlas-panel.tsx` holds
 * why the panel offers one.
 *
 * It replaces a walk out from the label to the first ancestor holding a
 * numeral, whose premise — that only a tile pairs a label with a numeral — is
 * false inside a single `StatCard`: the trend badge carries `data-numeric` in
 * the *same* header div as the label. Measured, giving this tile a trend, the
 * walk stops on that header and reads the delta, `+3`, as the tile's figure.
 * The panel passes no trend today, which was the whole of why the walk was
 * right, and none of it was stated.
 */
function tile(panel: HTMLElement, stat: string): HTMLElement {
  const found = panel.querySelector<HTMLElement>(`[data-stat="${stat}"]`)
  if (found === null) {
    throw new Error(`no stat tile for ${stat}`)
  }
  return found
}

/** One label-and-figure pair of the card's fact grid, by position. */
function cardCell(card: HTMLElement, index: number): readonly [string, string] {
  const labels = [...card.querySelectorAll('dt')]
  const values = [...card.querySelectorAll('dd')]
  return [
    labels[index]?.textContent ?? '',
    values[index]?.textContent ?? '',
  ] as const
}

/** The one word both figures used to be printed under, in both its branches. */
const BARE_NOUNS = ['Trip', 'Trips'] as const

/** The same, for the places pair. */
const BARE_PLACE_NOUNS = ['Place', 'Places'] as const

/** A label reduced to what it says, so casing and padding cannot hide a match. */
const said = (label: string): string => label.trim().toLocaleLowerCase()

describe('the two trip figures on one atlas screen', () => {
  it('names the panel tile as the trips the reader is on', () => {
    const trips = tile(renderPanel(), 'trips')

    // Scope both reads to this tile without depending on StatCard's print order.
    expect(within(trips).getByText('Your trips', { exact: true })).toBeTruthy()
    expect(within(trips).getByText('0', { exact: true })).toBeTruthy()
    expect(within(trips).getByText('Every trip you are on')).toBeTruthy()
  })

  /**
   * Membership is the *whole* of what the tile filters by, so the copy may not
   * narrow it further.
   *
   * The caption read "Finished trips only" before this ticket and kept the
   * claim through the rename, as "Finished trips you are on". Measured against
   * the query it labels, the claim is false: `recomputeTravelStats` filters
   * `trips` by `memberTripIds()` and — on a year row — by `start_date`, and
   * by nothing else. Two trips dated 2099, one of them with no end date at all,
   * come back in the all-time row as `tripCount: 2`.
   *
   * That is this file's own defect one word further in. A reader who sees the
   * cards below sum higher than this tile and is told the tile counts finished
   * trips has been handed a reason, and it is the wrong one — the gap is
   * whose trips these are, not whether they are over.
   */
  it('claims no completion the figure does not require', () => {
    const panel = renderPanel()

    expect(said(tile(panel, 'trips').textContent)).not.toMatch(
      /finished|completed|only/,
    )
  })

  it("names the country card's tally as the workspace's", () => {
    const card = renderCard(PORTUGAL)

    expect(cardCell(card, 0)).toEqual(['Workspace trips', '2'])
  })

  it('keeps the qualifier when the tally agrees in the singular', () => {
    const card = renderCard({ ...PORTUGAL, tripCount: 1 })

    expect(cardCell(card, 0)).toEqual(['Workspace trip', '1'])
  })

  it('prints the bare noun over neither figure', () => {
    // Both surfaces are mounted; the query below is over the whole document,
    // so it answers for the screen rather than for either half of it.
    renderAtlasScreen()

    for (const word of BARE_NOUNS) {
      expect(screen.queryAllByText(word)).toEqual([])
    }
  })
})

describe('the two place figures on one atlas screen', () => {
  it('names the panel tile as the places on the trips the reader is on', () => {
    const places = tile(renderPanel(), 'places')

    expect(
      within(places).getByText('Your places', { exact: true }),
    ).toBeTruthy()
    expect(within(places).getByText('7', { exact: true })).toBeTruthy()
  })

  it("names the country card's tally as the workspace's", () => {
    const card = renderCard(PORTUGAL)

    expect(cardCell(card, 1)).toEqual(['Workspace places', '4'])
  })

  it('keeps the qualifier when the tally agrees in the singular', () => {
    const card = renderCard({ ...PORTUGAL, placeCount: 1 })

    expect(cardCell(card, 1)).toEqual(['Workspace place', '1'])
  })

  it('prints the bare noun over neither figure', () => {
    renderAtlasScreen()

    for (const word of BARE_PLACE_NOUNS) {
      expect(screen.queryAllByText(word)).toEqual([])
    }
  })
})

/**
 * The catalogue half of the same rule. A translator handed two keys that both
 * mean "trips", or both "places", will reach for the same noun twice unless
 * the qualifier is part of what they are translating — and the screen is back
 * where it started in that locale alone, which no English-reading assertion
 * would ever see.
 */
describe('every locale keeps them apart', () => {
  const catalogues = import.meta.glob<NamespaceModule>(
    '../../../lib/i18n/messages/*/atlas.ts',
    { eager: true },
  )
  const locales = Object.entries(catalogues).map(
    ([path, module]) =>
      [path.split('/').at(-2) ?? path, module.default] as const,
  )

  // The glob is the gate, exactly as it is in `lib/i18n/__tests__/parity.test`:
  // a pattern that matches nothing leaves every assertion below vacuous. It is
  // held against the shipped set rather than against a count, so a
  // twenty-fourth locale fails this for the honest reason — its catalogue is
  // unread — instead of for arithmetic.
  it('reads the catalogue of every locale the product ships', () => {
    expect(locales.map(([tag]) => tag).sort()).toEqual([...LOCALE_TAGS].sort())
  })

  /** Each tile key beside the card key it is allowed to disagree with. */
  const SCOPED_PAIRS = [
    ['panel.stat.trips', 'card.trips'],
    ['panel.stat.places', 'card.places'],
  ] as const

  it.each(
    locales.flatMap(([locale, messages]) =>
      SCOPED_PAIRS.map(
        ([tileKey, cardKey]) => [locale, tileKey, cardKey, messages] as const,
      ),
    ),
  )(
    '%s says something different over %s and %s',
    (_locale, tileKey, cardKey, messages) => {
      const tileLabel = messages[tileKey]
      const cardLabel = messages[cardKey]
      if (typeof tileLabel !== 'string' || typeof cardLabel !== 'object') {
        throw new Error(`${tileKey} and ${cardKey} have swapped shapes`)
      }

      // Every branch, not the one English happens to need: a locale with six
      // of them can carry the qualifier on five and lose it on the sixth.
      const branches = Object.values(cardLabel).filter(
        (branch) => branch !== undefined,
      )
      expect(branches.length).toBeGreaterThan(0)
      expect(
        branches.filter((branch) => said(branch) === said(tileLabel)),
      ).toEqual([])
    },
  )
})
