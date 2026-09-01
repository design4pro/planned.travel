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

/** The two surfaces the reader has in front of them at once. */
function atlasScreen(): {
  readonly panel: HTMLElement
  readonly card: HTMLElement
} {
  return { panel: renderPanel(), card: renderCard(PORTUGAL) }
}

/**
 * One panel tile, found through the label printed over it.
 *
 * Walks out from the label to the first ancestor that holds a numeral, which is
 * the tile itself — a tile is the only thing on this panel that pairs the two.
 * Reading it this way is what makes the assertions about the *pairing* rather
 * than about strings that happen to be on the same screen.
 */
function tile(panel: HTMLElement, label: string): HTMLElement {
  // Bounded by the panel: the card renders beside it in the same document and
  // carries numerals of its own, so a walk let out of the panel could answer
  // this question with the other surface's figure instead of failing.
  let node: HTMLElement | null = within(panel).getByText(label)
  while (node !== null && panel.contains(node)) {
    if (node.querySelector('[data-numeric]') !== null) {
      return node
    }
    node = node.parentElement
  }
  throw new Error(`no stat tile labelled ${label}`)
}

/** The figure that tile prints. */
function tileFigure(panel: HTMLElement, label: string): string {
  return tile(panel, label).querySelector('[data-numeric]')?.textContent ?? ''
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

/** A label reduced to what it says, so casing and padding cannot hide a match. */
const said = (label: string): string => label.trim().toLocaleLowerCase()

describe('the two trip figures on one atlas screen', () => {
  it('names the panel tile as the trips the reader is on', () => {
    const panel = renderPanel()

    expect(tileFigure(panel, 'Your trips')).toBe('0')
    expect(within(panel).getByText('Every trip you are on')).toBeTruthy()
  })

  /**
   * Membership is the *whole* of what the tile filters by, so the copy may not
   * narrow it further.
   *
   * The caption read "Finished trips only" before this ticket and kept the
   * claim through the rename, as "Finished trips you are on". Measured against
   * the query it labels, the claim is false: `recomputeTravelStats` filters
   * `trips` by `memberOfTrip()` and — on a year row — by `start_date`, and
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

    expect(said(tile(panel, 'Your trips').textContent)).not.toMatch(
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
    atlasScreen()

    for (const word of BARE_NOUNS) {
      expect(screen.queryAllByText(word)).toEqual([])
    }
  })

  /**
   * The catalogue half of the same rule. A translator handed two keys that both
   * mean "trips" will reach for the same noun twice unless the qualifier is
   * part of what they are translating — and the screen is back where it started
   * in that locale alone, which no English-reading assertion would ever see.
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
      expect([...locales.map(([tag]) => tag)].sort()).toEqual(
        [...LOCALE_TAGS].sort(),
      )
    })

    it.each(locales)(
      '%s says something different over each',
      (_locale, messages) => {
        const tileLabel = messages['panel.stat.trips']
        const cardLabel = messages['card.trips']
        if (typeof tileLabel !== 'string' || typeof cardLabel !== 'object') {
          throw new Error('the two trip keys have swapped shapes')
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
})
