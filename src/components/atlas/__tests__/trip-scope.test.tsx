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

/** The two surfaces the reader has in front of them at once. */
function atlasScreen(): {
  readonly panel: HTMLElement
  readonly card: HTMLElement
} {
  const panel = render(
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
  const card = render(<CountryCard {...PORTUGAL} />).container
  return { panel, card }
}

/**
 * The figure a panel tile prints, found through the label over it.
 *
 * Walks out from the label to the first ancestor that holds a numeral, which is
 * the tile itself — a tile is the only thing on this panel that pairs the two.
 * Reading it this way is what makes the assertion about the *pairing* rather
 * than about two strings that happen to be on the same screen.
 */
function tileFigure(panel: HTMLElement, label: string): string {
  // Bounded by the panel: the card renders beside it in the same document and
  // carries numerals of its own, so a walk let out of the panel could answer
  // this question with the other surface's figure instead of failing.
  let node: HTMLElement | null = within(panel).getByText(label)
  while (node !== null && panel.contains(node)) {
    const numeral = node.querySelector('[data-numeric]')
    if (numeral !== null) {
      return numeral.textContent
    }
    node = node.parentElement
  }
  throw new Error(`no stat tile labelled ${label}`)
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
    const { panel } = atlasScreen()

    expect(tileFigure(panel, 'Your trips')).toBe('0')
    expect(within(panel).getByText('Finished trips you are on')).toBeTruthy()
  })

  it("names the country card's tally as the workspace's", () => {
    const { card } = atlasScreen()

    expect(cardCell(card, 0)).toEqual(['Workspace trips', '2'])
  })

  it('keeps the qualifier when the tally agrees in the singular', () => {
    const { container } = render(<CountryCard {...PORTUGAL} tripCount={1} />)

    expect(cardCell(container, 0)).toEqual(['Workspace trip', '1'])
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
        const panel = messages['panel.stat.trips']
        const card = messages['card.trips']
        if (typeof panel !== 'string' || typeof card !== 'object') {
          throw new Error('the two trip keys have swapped shapes')
        }

        // Every branch, not the one English happens to need: a locale with six
        // of them can carry the qualifier on five and lose it on the sixth.
        const branches = Object.values(card).filter(
          (branch) => branch !== undefined,
        )
        expect(branches.length).toBeGreaterThan(0)
        expect(
          branches.filter((branch) => said(branch) === said(panel)),
        ).toEqual([])
      },
    )
  })
})
