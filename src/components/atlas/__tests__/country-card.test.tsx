// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import {
  CountryCard,
  CountryCardError,
  CountryCardSkeleton,
} from '../country-card'
import { countryFactColumns } from '#/lib/atlas/country-facts'

/**
 * A country with an itinerary and no separate visit record behind it.
 *
 * The visit columns are stated rather than omitted because the card requires
 * all eight: a host that can only supply four of them is the host that printed
 * four dashes over every hand-marked country, and the type now refuses it.
 */
const FRANCE = {
  countryCode: 'FR',
  tripCount: 3,
  placeCount: 12,
  firstTripOn: '2019-07-14',
  lastTripOn: '2026-09-06',
  visitCount: 0,
  firstVisitedOn: null,
  lastVisitedOn: null,
} as const

const ALGERIA = {
  countryCode: 'DZ',
  tripCount: 0,
  placeCount: 0,
  firstTripOn: null,
  lastTripOn: null,
  visitCount: 0,
  firstVisitedOn: null,
  lastVisitedOn: null,
} as const

/**
 * A country marked by hand, with no trip behind it — the state most of a real
 * record is in, and the one the card used to print four dashes for.
 */
const THAILAND = {
  countryCode: 'TH',
  tripCount: 0,
  placeCount: 0,
  firstTripOn: null,
  lastTripOn: null,
  visitCount: 3,
  firstVisitedOn: '2011-07-14',
  lastVisitedOn: '2024-09-06',
} as const

/** Every label and every value of one card, in document order. */
function cellsOf(code: string): ReadonlyArray<readonly [string, string]> {
  const card = cardFor(code)
  const labels = [...card.querySelectorAll('dt')]
  const values = [...card.querySelectorAll('dd')]
  return labels.map((label, index) => [
    label.textContent,
    values[index]?.textContent ?? '',
  ])
}

/** The card's root, found the way a host would find it. */
function cardFor(code: string): HTMLElement {
  const root = document.querySelector(`[data-country="${code}"]`)
  if (!(root instanceof HTMLElement)) {
    throw new Error(`no country card for ${code}`)
  }
  return root
}

describe('CountryCard', () => {
  it('carries the whole payload as one unit', () => {
    render(<CountryCard {...FRANCE} />)

    const card = screen.getByRole('article', { name: 'France' })
    expect(card.textContent).toContain('France')
    expect(card.textContent).toContain('3')
    expect(card.textContent).toContain('12')
    expect(card.textContent).toContain('July 2019')
    expect(card.textContent).toContain('September 2026')
  })

  /**
   * The regression the whole formatting rule exists for: workerd renders
   * `Sept` where WebKit renders `Sep`, and a text node that differs between the
   * two passes is a hydration error on /atlas in Safari. The card must print
   * the frozen long form.
   */
  it('prints a September date the same way on every runtime', () => {
    render(<CountryCard {...FRANCE} />)
    const printed = screen.getByText('September 2026')
    expect(printed.tagName).toBe('TIME')
    expect(printed.getAttribute('dateTime')).toBe('2026-09')
  })

  it('names the country with a real heading at the depth asked for', () => {
    render(<CountryCard {...FRANCE} headingLevel={2} />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'France' }),
    ).toBeTruthy()
  })

  it('heads every figure with a unit label that agrees with it', () => {
    render(<CountryCard {...FRANCE} tripCount={1} placeCount={1} />)
    expect(screen.getByText('Trip')).toBeTruthy()
    expect(screen.getByText('Place')).toBeTruthy()

    render(<CountryCard {...FRANCE} countryCode="IT" />)
    const italy = cardFor('IT')
    expect(within(italy).getByText('Trips')).toBeTruthy()
    expect(within(italy).getByText('Places')).toBeTruthy()
  })

  it('sets tabular numerals on every value that can change', () => {
    render(<CountryCard {...FRANCE} />)
    const card = cardFor('FR')
    for (const value of card.querySelectorAll('dd')) {
      expect(value.className).toContain('tabular-nums')
    }
  })

  it('sets the figures in the display face', () => {
    render(<CountryCard {...FRANCE} />)
    const figures = [...cardFor('FR').querySelectorAll('dd')].slice(0, 2)
    expect(figures).toHaveLength(2)
    for (const figure of figures) {
      expect(figure.className).toContain('font-display')
    }
  })

  it('keeps every label at the 11px SectionLabel step', () => {
    render(<CountryCard {...FRANCE} />)
    const labels = cardFor('FR').querySelectorAll('dt > *')
    expect(labels).toHaveLength(4)
    for (const label of labels) {
      expect(label.className).toContain('text-micro')
      expect(label.className).toContain('uppercase')
      expect(label.className).toContain('tracking-label')
    }
  })

  it('reports whether anything has been recorded', () => {
    render(<CountryCard {...FRANCE} />)
    expect(cardFor('FR').dataset.visited).toBe('true')
  })

  it('goes quiet for a host whose trigger already says all this', () => {
    render(<CountryCard {...FRANCE} decorative />)
    expect(cardFor('FR').getAttribute('aria-hidden')).toBe('true')
  })

  it('takes a cn()-mergeable className', () => {
    render(<CountryCard {...FRANCE} className="rounded-xl" />)
    const card = cardFor('FR')
    expect(card.className).toContain('rounded-xl')
    expect(card.className).not.toContain('rounded-lg')
  })

  describe('a country with nothing recorded', () => {
    it('prints zero for both figures rather than a blank', () => {
      render(<CountryCard {...ALGERIA} />)
      const figures = [...cardFor('DZ').querySelectorAll('dd')].slice(0, 2)
      expect(figures.map((cell) => cell.textContent)).toEqual(['0', '0'])
    })

    it('marks both dates with a dash the eye can read', () => {
      render(<CountryCard {...ALGERIA} />)
      const dashes = [...cardFor('DZ').querySelectorAll('dd')]
        .slice(2)
        .map((cell) => cell.querySelector('[aria-hidden="true"]'))
      expect(dashes.map((node) => node?.textContent)).toEqual(['—', '—'])
    })

    it('gives the ear words instead of the dash', () => {
      render(<CountryCard {...ALGERIA} />)
      const spoken = within(cardFor('DZ')).getAllByText('Not recorded')
      expect(spoken).toHaveLength(2)
      for (const node of spoken) {
        expect(node.className).toContain('sr-only')
      }
    })

    it('reports that nothing has been recorded', () => {
      render(<CountryCard {...ALGERIA} />)
      expect(cardFor('DZ').dataset.visited).toBe('false')
    })

    it('still heads both date columns', () => {
      render(<CountryCard {...ALGERIA} />)
      const card = cardFor('DZ')
      expect(within(card).getByText('First trip')).toBeTruthy()
      expect(within(card).getByText('Last trip')).toBeTruthy()
    })

    it('names the state it is in', () => {
      render(<CountryCard {...ALGERIA} />)
      expect(cardFor('DZ').dataset.record).toBe('none')
    })

    it('sets both noughts back a tier, so the emptiness reads first', () => {
      render(<CountryCard {...ALGERIA} />)
      const figures = [...cardFor('DZ').querySelectorAll('dd')].slice(0, 2)
      for (const figure of figures) {
        expect(figure.className).toContain('text-ink-3')
        expect(figure.className).not.toContain('text-ink ')
      }
    })
  })

  /**
   * The defect the card was widened for. The map fills these countries, the
   * shelf prints their visit tally, and the card used to answer with two zeros
   * and two em dashes — about most of a real record.
   */
  describe('a country visited with no trip behind it', () => {
    it('prints its visits and both visit months', () => {
      render(<CountryCard {...THAILAND} />)
      expect(cellsOf('TH')).toEqual([
        ['Visits', '3'],
        ['Places', '0'],
        ['First visit', 'July 2011'],
        ['Last visit', 'September 2024'],
      ])
    })

    it('prints no dash at all where a date is known', () => {
      render(<CountryCard {...THAILAND} />)
      expect(cardFor('TH').textContent).not.toContain('—')
      expect(within(cardFor('TH')).queryByText('Not recorded')).toBeNull()
    })

    it('dates both months as machine-readable months', () => {
      render(<CountryCard {...THAILAND} />)
      const times = [...cardFor('TH').querySelectorAll('time')]
      expect(times.map((node) => node.getAttribute('dateTime'))).toEqual([
        '2011-07',
        '2024-09',
      ])
    })

    it('reports itself as visited, which is what the map is painting', () => {
      render(<CountryCard {...THAILAND} />)
      expect(cardFor('TH').dataset.visited).toBe('true')
      expect(cardFor('TH').dataset.record).toBe('visits')
    })

    it('keeps its tally at full ink, because it is a fact and not an absence', () => {
      render(<CountryCard {...THAILAND} />)
      const [tally] = [...cardFor('TH').querySelectorAll('dd')]
      expect(tally.className).toContain('text-ink')
      expect(tally.className).not.toContain('text-ink-3')
    })

    /**
     * The regression a critic caught: greyed per cell, a country with three
     * visits and no saved place had its `0` set back exactly as far as the
     * empty card's, so the surface that exists to say "you have been here"
     * read as "nothing recorded" all over again. The tier answers one question
     * per card, not one per cell.
     */
    it('leaves a nought at full ink when the card carries a record', () => {
      render(<CountryCard {...THAILAND} />)
      const [tally, places] = [...cardFor('TH').querySelectorAll('dd')]
      expect(places.textContent).toBe('0')
      expect(places.className).toBe(tally.className)
      expect(places.className).not.toContain('text-ink-3')
    })

    it('sets a nought back only on the card with nothing behind it', () => {
      render(<CountryCard {...THAILAND} />)
      render(<CountryCard {...ALGERIA} />)
      const figuresOf = (code: string) =>
        [...cardFor(code).querySelectorAll('dd')]
          .slice(0, 2)
          .map((value) => value.className)

      expect(new Set(figuresOf('TH')).size).toBe(1)
      expect(new Set(figuresOf('DZ')).size).toBe(1)
      expect(figuresOf('TH')).not.toEqual(figuresOf('DZ'))
    })

    it('agrees the unit with a single visit', () => {
      render(<CountryCard {...THAILAND} visitCount={1} />)
      expect(within(cardFor('TH')).getByText('Visit')).toBeTruthy()
    })

    it('still dashes a visit whose dates were never written down', () => {
      render(
        <CountryCard
          {...THAILAND}
          firstVisitedOn={null}
          lastVisitedOn={null}
        />,
      )
      expect(cellsOf('TH').map(([label]) => label)).toEqual([
        'Visits',
        'Places',
        'First visit',
        'Last visit',
      ])
      expect(within(cardFor('TH')).getAllByText('Not recorded')).toHaveLength(2)
    })
  })

  describe('a country with a trip on record', () => {
    it('keeps the trip reading, whatever the visit tally says', () => {
      render(
        <CountryCard
          {...FRANCE}
          countryCode="PT"
          tripCount={1}
          placeCount={4}
          firstTripOn="2026-08-03"
          lastTripOn="2026-08-28"
          visitCount={2}
          firstVisitedOn="2019-09-21"
          lastVisitedOn="2026-08-17"
        />,
      )
      expect(cellsOf('PT')).toEqual([
        ['Trip', '1'],
        ['Places', '4'],
        ['First trip', 'August 2026'],
        ['Last trip', 'August 2026'],
      ])
      expect(cardFor('PT').dataset.record).toBe('trips')
    })
  })

  /**
   * The props a host actually has.
   *
   * Every one of these cards is fed from one row of the atlas record, and the
   * defect this file exists around came from a host picking four of that row's
   * ten columns by hand. `countryFactColumns()` is the projection written down
   * once, so the assertion here is on the shape a screen spreads rather than on
   * a literal invented for the test — and the two demo countries below are the
   * two readings the fixture actually contains.
   */
  describe('spread straight from an atlas record', () => {
    /** France as the demo workspace seeds it: three visits, no itinerary. */
    const FRANCE_RECORD = {
      countryCode: 'FR',
      tripCount: 0,
      visitedPlaceCount: 0,
      firstTripOn: null,
      lastTripOn: null,
      visitCount: 3,
      firstVisitedOn: '2011-07-14',
      lastVisitedOn: '2024-09-06',
    } as const

    /** Portugal: two visits and a trip that has already begun. */
    const PORTUGAL_RECORD = {
      countryCode: 'PT',
      tripCount: 1,
      visitedPlaceCount: 4,
      firstTripOn: '2026-08-17',
      lastTripOn: '2026-08-17',
      visitCount: 2,
      firstVisitedOn: '2019-09-21',
      lastVisitedOn: '2026-08-17',
    } as const

    it('reads a visit-only record as visits and visit months', () => {
      render(<CountryCard {...countryFactColumns(FRANCE_RECORD)} />)
      expect(cellsOf('FR')).toEqual([
        ['Visits', '3'],
        ['Places', '0'],
        ['First visit', 'July 2011'],
        ['Last visit', 'September 2024'],
      ])
      expect(cardFor('FR').dataset.visited).toBe('true')
    })

    it('reads a record with an itinerary as trips and trip months', () => {
      render(<CountryCard {...countryFactColumns(PORTUGAL_RECORD)} />)
      expect(cellsOf('PT')).toEqual([
        ['Trip', '1'],
        ['Places', '4'],
        ['First trip', 'August 2026'],
        ['Last trip', 'August 2026'],
      ])
    })

    /**
     * A country the traveller has never recorded is not in the record at all,
     * so a host holding no row hands over zeros — and that, and only that, is
     * the card that goes quiet.
     */
    it('prints the zero state for a country with no row behind it', () => {
      render(
        <CountryCard
          {...countryFactColumns({
            countryCode: 'DZ',
            tripCount: 0,
            visitedPlaceCount: 0,
            firstTripOn: null,
            lastTripOn: null,
            visitCount: 0,
            firstVisitedOn: null,
            lastVisitedOn: null,
          })}
        />,
      )
      expect(cardFor('DZ').dataset.record).toBe('none')
      expect(cellsOf('DZ')).toEqual([
        ['Trips', '0'],
        ['Places', '0'],
        ['First trip', '—Not recorded'],
        ['Last trip', '—Not recorded'],
      ])
    })
  })

  /** The glyph at the end of one card's name line. */
  const markOf = (code: string): Element => {
    const node = cardFor(code).querySelector('[data-part="record"]')
    if (node === null) throw new Error(`no record mark for ${code}`)
    return node
  }

  /**
   * The card is anchored to a country and the pointer crosses borders, so the
   * three states have to measure the same or the surface twitches under the
   * reader. They are struck from one `layout`, and this is the assertion that
   * keeps them there: same root, same cells, same type on every line box.
   */
  describe('the three states measure the same', () => {
    it('shares a root, a cell count and a cell geometry', () => {
      render(<CountryCard {...FRANCE} />)
      render(<CountryCard {...THAILAND} />)
      render(<CountryCard {...ALGERIA} />)

      const roots = ['FR', 'TH', 'DZ'].map((code) => cardFor(code))
      expect(roots[1]?.className).toBe(roots[0]?.className)
      expect(roots[2]?.className).toBe(roots[0]?.className)

      const geometry = (code: string) =>
        [...cardFor(code).querySelectorAll('[data-part="cell"]')].map(
          (cell) => cell.className,
        )
      expect(geometry('FR')).toHaveLength(4)
      expect(geometry('TH')).toEqual(geometry('FR'))
      expect(geometry('DZ')).toEqual(geometry('FR'))
    })

    /**
     * The header is where the three states differ most — one glyph out of
     * three — so it is the line most likely to start moving the card. One mark
     * per card, at one size, on one class, is what keeps that line still while
     * the pointer crosses a border.
     */
    it('gives every state the same header, carrying one mark of one size', () => {
      render(<CountryCard {...FRANCE} />)
      render(<CountryCard {...THAILAND} />)
      render(<CountryCard {...ALGERIA} />)

      const header = (code: string) => {
        const node = cardFor(code).querySelector('[data-part="header"]')
        if (!(node instanceof HTMLElement)) throw new Error(`no header ${code}`)
        return node
      }
      expect(header('TH').className).toBe(header('FR').className)
      expect(header('DZ').className).toBe(header('FR').className)

      for (const code of ['FR', 'TH', 'DZ']) {
        expect(
          header(code).querySelectorAll('[data-part="record"]'),
        ).toHaveLength(1)
        const mark = markOf(code)
        expect(mark.getAttribute('width')).toBe('16')
        expect(mark.getAttribute('height')).toBe('16')
        expect(mark.getAttribute('class')).toContain('shrink-0')
      }
    })
  })

  /**
   * The card is read in a glance and replaced by the next country a second
   * later, so which of the three records it is speaking from has to be legible
   * before a caption is. The glyph is that answer; the tone separates a card
   * with a record from a card without one.
   */
  describe('the record mark', () => {
    it('gives the three states three different shapes', () => {
      render(<CountryCard {...FRANCE} />)
      render(<CountryCard {...THAILAND} />)
      render(<CountryCard {...ALGERIA} />)

      const shape = (code: string) => markOf(code).innerHTML
      expect(shape('TH')).not.toBe(shape('FR'))
      expect(shape('DZ')).not.toBe(shape('FR'))
      expect(shape('DZ')).not.toBe(shape('TH'))
    })

    it('separates a card with a record from a card with none by tone', () => {
      render(<CountryCard {...FRANCE} />)
      render(<CountryCard {...THAILAND} />)
      render(<CountryCard {...ALGERIA} />)

      expect(markOf('FR').getAttribute('class')).toContain('text-brand')
      expect(markOf('TH').getAttribute('class')).toContain('text-brand')
      expect(markOf('DZ').getAttribute('class')).toContain('text-ink-3')
    })

    /**
     * It repeats the captions, so announcing it would make a reader hear the
     * state twice — once as a shape they cannot see and once in words.
     */
    it('says nothing a reader has not already been told', () => {
      render(<CountryCard {...THAILAND} />)
      expect(markOf('TH').getAttribute('aria-hidden')).toBe('true')
      expect(markOf('TH').textContent).toBe('')
    })

    it('keeps every label and every value on one line box', () => {
      render(<CountryCard {...FRANCE} />)
      render(<CountryCard {...THAILAND} />)
      render(<CountryCard {...ALGERIA} />)

      for (const code of ['FR', 'TH', 'DZ']) {
        const card = cardFor(code)
        for (const label of card.querySelectorAll('dt > *')) {
          expect(label.className).toContain('text-micro')
        }
        for (const value of card.querySelectorAll('dd')) {
          expect(value.className).toContain('truncate')
          expect(value.className).toContain('tabular-nums')
        }
      }
    })
  })

  describe('width', () => {
    it('does not depend on the numerals it prints', () => {
      render(<CountryCard {...ALGERIA} />)
      render(
        <CountryCard
          {...FRANCE}
          countryCode="JP"
          tripCount={1_204_000}
          placeCount={98_765}
        />,
      )
      expect(cardFor('JP').className).toBe(cardFor('DZ').className)
    })

    it('truncates a long name rather than reflowing the card', () => {
      // South Georgia & South Sandwich Islands — the longest name in the table.
      render(<CountryCard {...FRANCE} countryCode="GS" />)
      const heading = within(cardFor('GS')).getByRole('heading', { level: 3 })
      expect(heading.className).toContain('truncate')
    })
  })

  describe('the pointer', () => {
    it('is absent unless the card is anchored to something', () => {
      render(<CountryCard {...FRANCE} />)
      expect(cardFor('FR').querySelector('[data-part="pointer"]')).toBeNull()
    })

    it('sits on the edge it was told to', () => {
      render(<CountryCard {...FRANCE} pointer="bottom" />)
      const pointer = cardFor('FR').querySelector('[data-part="pointer"]')
      expect(pointer?.className).toContain('-bottom-1')
      expect(pointer?.getAttribute('aria-hidden')).toBe('true')
    })
  })

  describe('compact', () => {
    it('carries the country name and nothing else', () => {
      render(<CountryCard variant="compact" countryCode="MR" />)
      const pill = cardFor('MR')
      expect(pill.textContent).toBe('Mauritania')
      expect(pill.querySelector('dl')).toBeNull()
    })

    it('normalises the code it was handed', () => {
      render(<CountryCard variant="compact" countryCode=" mr " />)
      expect(cardFor('MR').textContent).toBe('Mauritania')
    })

    it('can be pointed at the country it names', () => {
      render(
        <CountryCard variant="compact" countryCode="MR" pointer="bottom" />,
      )
      expect(
        cardFor('MR').querySelector('[data-part="pointer"]'),
      ).not.toBeNull()
    })

    it('goes quiet when its trigger already names the country', () => {
      render(<CountryCard variant="compact" countryCode="MR" decorative />)
      expect(cardFor('MR').getAttribute('aria-hidden')).toBe('true')
    })

    /**
     * A pill prints exactly one thing, and a ceiling narrower than the card's
     * clipped it. Held to the card's own measure — and stepped with it at the
     * widest breakpoint — the two atlas surfaces read as one object at two
     * sizes, and the one name in the table that overran the old 224px stops
     * arriving already shortened on a surface with no second line to shorten
     * into.
     */
    it('is never allowed to be narrower than the card it belongs to', () => {
      render(
        <>
          <CountryCard variant="compact" countryCode="IO" />
          <CountryCard {...FRANCE} />
        </>,
      )
      const pill = cardFor('IO')
      expect(pill.className).toContain('max-w-72')
      expect(pill.className).toContain('2xl:max-w-80')
      // The same two steps the card takes, so neither can move without the
      // other.
      expect(cardFor('FR').className).toContain('w-72')
      expect(cardFor('FR').className).toContain('2xl:w-80')
    })
  })
})

describe('CountryCardSkeleton', () => {
  it('is announced as loading, once, and not read out box by box', () => {
    const { container } = render(<CountryCardSkeleton />)
    const root = container.firstElementChild
    expect(root?.getAttribute('aria-busy')).toBe('true')
    // The busy state must be on a node a reader can still reach: hiding the
    // subtree it was declared on makes the whole announcement inert.
    expect(root?.getAttribute('aria-hidden')).toBeNull()
    expect(screen.getByText('Loading this country').className).toContain(
      'sr-only',
    )
  })

  it('hides only the drawing, so no reader counts empty boxes', () => {
    const { container } = render(<CountryCardSkeleton />)
    const header = container.querySelector('[data-part="header"]')
    expect(header?.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('names the country whose figures are still in the air', () => {
    render(<CountryCardSkeleton countryCode=" fr " />)
    expect(screen.getByText('Loading France')).toBeTruthy()
    expect(cardFor('FR').getAttribute('aria-busy')).toBe('true')
  })

  it('stands on exactly the card the facts will arrive into', () => {
    render(<CountryCard {...FRANCE} />)
    const { container } = render(<CountryCardSkeleton />)
    const skeleton = container.firstElementChild
    expect(skeleton?.className).toBe(cardFor('FR').className)
  })

  it('reserves the same header and the same four cells', () => {
    const { container } = render(<CountryCardSkeleton />)
    expect(container.querySelectorAll('[data-part="header"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-part="cell"]')).toHaveLength(4)
  })

  it('gives every cell the type step of the value it replaces', () => {
    const { container } = render(<CountryCardSkeleton />)
    const cells = [...container.querySelectorAll('[data-part="cell"]')]
    expect(
      cells.slice(0, 2).every((cell) => cell.innerHTML.includes('text-title')),
    ).toBe(true)
    expect(
      cells.slice(2).every((cell) => cell.innerHTML.includes('text-label')),
    ).toBe(true)
  })

  it('can carry the same pointer as the card it stands for', () => {
    const { container } = render(<CountryCardSkeleton pointer="top" />)
    expect(container.querySelector('[data-part="pointer"]')).not.toBeNull()
  })
})

describe('CountryCardError', () => {
  it('still names the country whose figures went missing', () => {
    render(<CountryCardError countryCode="FR" />)
    expect(cardFor('FR').textContent).toContain('France')
  })

  it('tells the reader politely rather than interrupting them', () => {
    render(<CountryCardError countryCode="FR" />)
    const card = cardFor('FR')
    expect(card.getAttribute('role')).toBe('status')
    expect(card.getAttribute('aria-live')).toBe('polite')
  })

  it('says what happened without claiming the country is empty', () => {
    render(<CountryCardError countryCode="FR" />)
    const card = cardFor('FR')
    expect(card.textContent).toContain('These figures did not load')
    expect(card.textContent).not.toContain('Trips')
  })

  it('occupies exactly the card the retry will land in', () => {
    render(<CountryCard {...FRANCE} />)
    render(<CountryCardError countryCode="IT" />)
    expect(cardFor('IT').className).toBe(cardFor('FR').className)
  })

  it('holds the rest card’s height with an invisible strut', () => {
    render(<CountryCardError countryCode="FR" />)
    const strut = cardFor('FR').querySelector('[data-part="strut"]')
    expect(strut?.className).toContain('invisible')
    expect(strut?.getAttribute('aria-hidden')).toBe('true')
  })

  it('offers no action when there is none to run', () => {
    render(<CountryCardError countryCode="FR" />)
    expect(within(cardFor('FR')).queryByRole('button')).toBeNull()
  })

  it('runs the retry it was given', () => {
    const onRetry = vi.fn()
    render(<CountryCardError countryCode="FR" onRetry={onRetry} />)
    fireEvent.click(
      within(cardFor('FR')).getByRole('button', { name: 'Try again' }),
    )
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('holds the retry in its pending state while the read is in air', () => {
    const onRetry = vi.fn()
    render(<CountryCardError countryCode="FR" onRetry={onRetry} retrying />)
    const button = within(cardFor('FR')).getByRole('button')
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.textContent).toContain('Loading this country')
  })
})

/**
 * The card lands on whatever country the reader pointed at, so its ground, its
 * hairline, its elevation and its stacking layer are the four things that
 * decide whether it is legible at all — and each of them is a token whose value
 * and whose measured ratios live in `tokens.css`.
 *
 * A drift to a page surface is the regression worth guarding: `bg-surface`
 * still looks correct over paper-coloured land, and only fails over a pine
 * fill, which is a state no screenshot of the atlas at rest ever contains.
 */
describe('the surface every variant stands on', () => {
  const SURFACE = [
    'bg-map-card',
    'border-map-card-edge',
    'shadow-popover',
    'z-map-surface',
  ] as const

  it('draws the full card from the over-map tokens', () => {
    render(<CountryCard {...FRANCE} />)
    for (const token of SURFACE) {
      expect(cardFor('FR').className).toContain(token)
    }
  })

  it('gives the compact pill that same ground rather than a second one', () => {
    render(<CountryCard variant="compact" countryCode="MR" />)
    for (const token of SURFACE) {
      expect(cardFor('MR').className).toContain(token)
    }
  })

  it('gives the loading and degraded states that same ground', () => {
    const { container } = render(<CountryCardSkeleton />)
    render(<CountryCardError countryCode="FR" />)
    for (const token of SURFACE) {
      expect(container.firstElementChild?.className).toContain(token)
      expect(cardFor('FR').className).toContain(token)
    }
  })

  /**
   * The placeholder is the last thing on this card that used to borrow a page
   * token. `Skeleton`'s default inset is tuned against `--color-surface`, and
   * on the darker over-map face it reads a third quieter than the same bar does
   * on a page — so the card supplies its own ground, measured against its own
   * face, and lands both themes within two thousandths of the 1.19:1 every
   * other skeleton in the product gives.
   */
  it('draws its placeholder bars on the card’s own inset, not the page’s', () => {
    const { container } = render(<CountryCardSkeleton countryCode="FR" />)
    const bars = container.querySelectorAll('[aria-hidden="true"].rounded-sm')
    expect(bars.length).toBeGreaterThan(0)
    for (const bar of bars) {
      expect(bar.className).toContain('bg-map-card-inset')
      expect(bar.className).not.toContain('bg-surface-inset')
    }
  })

  it('draws the pointer from the card’s own ground and hairline', () => {
    render(<CountryCard {...FRANCE} pointer="top" />)
    const pointer = cardFor('FR').querySelector('[data-part="pointer"]')
    expect(pointer?.className).toContain('bg-map-card')
    expect(pointer?.className).toContain('border-map-card-edge')
  })

  /**
   * A card pinned by a click is focused by its host when it opens, and a map
   * that hands focus to the selected country lands the reader here. Without a
   * ring on the card itself that reader is somewhere with nothing drawn round
   * it. `:focus-visible` cannot match an element with no tab stop, so this is
   * inert on the hover card rather than decoration for an impossible state.
   */
  it('draws the product’s focus ring on every variant', () => {
    const { container } = render(
      <>
        <CountryCard {...FRANCE} />
        <CountryCard variant="compact" countryCode="MR" />
        <CountryCardSkeleton />
        <CountryCardError countryCode="IT" />
      </>,
    )
    const roots = [...container.children]
    expect(roots).toHaveLength(4)
    for (const root of roots) {
      expect(root.className).toContain('focus-visible:outline-ring')
      expect(root.className).toContain('focus-visible:outline-2')
    }
  })

  /**
   * Past 1536px the whole product is set looser, and a card frozen at a phone's
   * measure reads as a sticker left on the map. The step has to reach every
   * variant or the placeholder stops standing on the card it stands in for.
   */
  it('steps its measure once at the widest breakpoint, on every variant', () => {
    const { container } = render(
      <>
        <CountryCard {...FRANCE} />
        <CountryCardSkeleton />
        <CountryCardError countryCode="IT" />
      </>,
    )
    for (const root of container.children) {
      expect(root.className).toContain('w-72')
      expect(root.className).toContain('2xl:w-80')
    }
    for (const cell of container.querySelectorAll('[data-part="cell"]')) {
      expect(cell.className).toContain('2xl:px-5')
      expect(cell.className).toContain('2xl:py-4')
    }
  })

  it('moves on the product’s own easing, inside the motion band', () => {
    render(<CountryCard {...FRANCE} />)
    const card = cardFor('FR')
    expect(card.className).toContain('duration-fast')
    expect(card.className).toContain('ease-out-quint')
  })

  /**
   * The runtime half of the repo's no-hardcoded-values rule, run over every
   * variant at once: whatever reaches the DOM must be a token utility, never a
   * literal colour, shadow, radius or stacking index.
   */
  it('lets no literal colour, shadow, radius or z-index reach the DOM', () => {
    const { container } = render(
      <>
        <CountryCard {...FRANCE} pointer="bottom" />
        <CountryCard {...ALGERIA} />
        <CountryCard variant="compact" countryCode="MR" pointer="top" />
        <CountryCardSkeleton pointer="left" />
        <CountryCardError countryCode="IT" onRetry={() => undefined} />
      </>,
    )
    expect(container.innerHTML).not.toMatch(
      /#[0-9a-fA-F]{3,8}|rgba?\(|shadow-\[|z-\[|rounded-\[/,
    )
  })
})

/**
 * The card's contrast, measured from the token file rather than asserted from
 * memory.
 *
 * Every figure this card prints is a token pair, and every one of those pairs
 * is quoted as a ratio in a comment — in `country-card.tsx` for the type ladder
 * and in `tokens.css` for the ground. A quoted ratio is documentation until
 * something recomputes it, and three of them had already drifted a full point
 * behind their tokens by the time anybody checked: the brand tone the record
 * mark is drawn in had moved, and two rows of the light boundary table were
 * measured against an older hairline. Nothing failed, because nothing was
 * looking.
 *
 * So this block does the looking. It reads `tokens.css` as text — the same way
 * `src/lib/map/__tests__/palette.test.ts` does, because vitest stubs CSS
 * modules out to nothing and the point is the source the browser is handed —
 * resolves each token in each of the three places a themed value is allowed to
 * be declared, and recomputes the ratio from the hex. A token that moves now
 * fails here rather than shipping under a comment that says otherwise.
 */
describe('the card’s colours, measured from the tokens themselves', () => {
  /** The relative luminance of a `#rrggbb` value, per WCAG 2.x. */
  function luminance(value: string): number {
    const channels = [1, 3, 5].map((at) => {
      const c = Number.parseInt(value.slice(at, at + 2), 16) / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return (
      0.2126 * (channels[0] ?? 0) +
      0.7152 * (channels[1] ?? 0) +
      0.0722 * (channels[2] ?? 0)
    )
  }

  /** The WCAG contrast ratio between two `#rrggbb` values. */
  function contrast(a: string, b: string): number {
    const first = luminance(a)
    const second = luminance(b)
    const light = Math.max(first, second)
    const dark = Math.min(first, second)
    return (light + 0.05) / (dark + 0.05)
  }

  /**
   * `tokens.css`, cut into the three places DESIGN.md allows a themed value to
   * be declared: the bare `:root` that carries light, the guarded
   * `prefers-color-scheme` block, and the explicit `[data-theme='dark']` block.
   */
  function contexts(): {
    readonly light: string
    readonly media: string
    readonly attribute: string
  } {
    const here = dirname(fileURLToPath(import.meta.url))
    const css = readFileSync(
      join(here, '..', '..', '..', 'styles', 'tokens.css'),
      'utf8',
    )
    const media = css.indexOf('@media (prefers-color-scheme: dark) {')
    const attribute = css.indexOf(":root[data-theme='dark'] {")
    if (media <= 0 || attribute <= media) {
      throw new Error('tokens.css is missing one of the two dark blocks')
    }
    return {
      light: css.slice(0, media),
      media: css.slice(media, attribute),
      attribute: css.slice(attribute),
    }
  }

  const SLICES = contexts()

  /** The declared value of one custom property inside one slice. */
  function declared(slice: string, token: string): string {
    const match = new RegExp(`^\\s*${token}:\\s*([^;]+);`, 'm').exec(slice)
    if (match === null) {
      throw new Error(`${token} is not declared in this theme context`)
    }
    return match[1].trim()
  }

  /** Every colour the card draws with, resolved for one theme. */
  function palette(theme: 'light' | 'dark'): Record<string, string> {
    const slice = theme === 'light' ? SLICES.light : SLICES.attribute
    const names = [
      '--color-map-card',
      '--color-map-card-edge',
      '--color-map-card-inset',
      '--color-ink',
      '--color-ink-2',
      '--color-ink-3',
      '--color-brand',
      '--color-warning',
      '--color-country-land',
      '--color-country-land-hover',
      '--color-country-visited',
      '--color-country-visited-recent',
      '--color-country-visited-distant',
      '--color-country-visited-hover',
      '--color-country-visited-selected',
    ]
    return Object.fromEntries(
      names.map((name) => [name, declared(slice, name)]),
    )
  }

  it('declares the card’s own tokens in all three theme contexts', () => {
    for (const token of [
      '--color-map-card',
      '--color-map-card-edge',
      '--color-map-card-inset',
    ]) {
      const light = declared(SLICES.light, token)
      const media = declared(SLICES.media, token)
      const attribute = declared(SLICES.attribute, token)
      expect(light, token).toMatch(/^#[0-9a-f]{6}$/)
      // A system-preference reader and a reader who pressed the toggle must
      // land on the same card. The one that only exists in the media query is
      // the bug that survives every screenshot and appears on first use.
      expect(media, token).toBe(attribute)
      expect(media, token).not.toBe(light)
    }
  })

  /**
   * Every text tier this card sets, against the one ground it ever sets them
   * on. The card face is opaque, so these are true wherever it lands — which is
   * the whole argument for the face being opaque.
   */
  it('clears AA for every text tier it prints, in both themes', () => {
    const TEXT = [
      ['--color-ink', 'the name and the figures'],
      ['--color-ink-2', 'the months and the error sentence'],
      ['--color-ink-3', 'the unit labels, the dash and a set-back nought'],
    ] as const
    for (const theme of ['light', 'dark'] as const) {
      const tokens = palette(theme)
      const face = tokens['--color-map-card'] ?? ''
      for (const [token, what] of TEXT) {
        const ratio = contrast(tokens[token] ?? '', face)
        expect(ratio, `${theme}: ${what}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  /**
   * The record mark and the error icon are non-text graphics, which owe 3:1
   * under WCAG 2.2 1.4.11 rather than 4.5:1 — and both clear the text bar
   * anyway, which is why the mark can be read at a glance at 16px.
   */
  it('clears the graphic bar for the record mark and the error icon', () => {
    for (const theme of ['light', 'dark'] as const) {
      const tokens = palette(theme)
      const face = tokens['--color-map-card'] ?? ''
      for (const token of ['--color-brand', '--color-warning']) {
        expect(
          contrast(tokens[token] ?? '', face),
          `${theme}: ${token}`,
        ).toBeGreaterThanOrEqual(3)
      }
    }
  })

  /**
   * The boundary between the card and the map. It is drawn by whichever of the
   * opaque face or the hairline wins on the ground underneath, so the test is
   * on the better of the two — that is what a reader actually sees.
   */
  it('holds 3:1 against every country fill the card can land on', () => {
    const FILLS = [
      '--color-country-land',
      '--color-country-land-hover',
      '--color-country-visited',
      '--color-country-visited-recent',
      '--color-country-visited-distant',
      '--color-country-visited-hover',
      '--color-country-visited-selected',
    ]
    // The worst case in each theme, quoted to four places in the module comment
    // of `country-card.tsx`. Both are checked: the standard's 3:1, so a token
    // that moves is a failure rather than a footnote, and the quoted figure, so
    // a token that moves *within* the standard still fails the comment that
    // claims to have measured it.
    const QUOTED = { light: 3.1987, dark: 3.4754 } as const
    for (const theme of ['light', 'dark'] as const) {
      const tokens = palette(theme)
      const face = tokens['--color-map-card'] ?? ''
      const edge = tokens['--color-map-card-edge'] ?? ''
      let worst = Number.POSITIVE_INFINITY
      for (const fill of FILLS) {
        const ground = tokens[fill] ?? ''
        const boundary = Math.max(
          contrast(face, ground),
          contrast(edge, ground),
        )
        expect(boundary, `${theme}: ${fill}`).toBeGreaterThanOrEqual(3)
        worst = Math.min(worst, boundary)
      }
      expect(worst, `${theme}: worst boundary`).toBeCloseTo(QUOTED[theme], 3)
    }
  })

  /**
   * The placeholder bar is the one non-text figure the card owns. It is not
   * held to a contrast minimum — it is held to *parity*: a card waiting over
   * the map must read exactly as loud as a card waiting on a page, or the
   * loading state tells the reader something about geography.
   */
  it('gives its placeholder the same weight a page skeleton has', () => {
    for (const theme of ['light', 'dark'] as const) {
      const slice = theme === 'light' ? SLICES.light : SLICES.attribute
      const onCard = contrast(
        declared(slice, '--color-map-card-inset'),
        declared(slice, '--color-map-card'),
      )
      const onPage = contrast(
        declared(slice, '--color-surface-inset'),
        declared(slice, '--color-surface'),
      )
      expect(Math.abs(onCard - onPage), theme).toBeLessThan(0.002)
    }
  })
})
