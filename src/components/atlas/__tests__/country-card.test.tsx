// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import {
  CountryCard,
  CountryCardError,
  CountryCardSkeleton,
} from '../country-card'

const FRANCE = {
  countryCode: 'FR',
  tripCount: 3,
  placeCount: 12,
  firstTripOn: '2019-07-14',
  lastTripOn: '2026-09-06',
} as const

const ALGERIA = {
  countryCode: 'DZ',
  tripCount: 0,
  placeCount: 0,
  firstTripOn: null,
  lastTripOn: null,
} as const

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
  })
})

describe('CountryCardSkeleton', () => {
  it('is announced as loading, once, and not read out box by box', () => {
    const { container } = render(<CountryCardSkeleton />)
    const root = container.firstElementChild
    expect(root?.getAttribute('aria-busy')).toBe('true')
    expect(root?.getAttribute('aria-hidden')).toBe('true')
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

  it('draws the pointer from the card’s own ground and hairline', () => {
    render(<CountryCard {...FRANCE} pointer="top" />)
    const pointer = cardFor('FR').querySelector('[data-part="pointer"]')
    expect(pointer?.className).toContain('bg-map-card')
    expect(pointer?.className).toContain('border-map-card-edge')
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
