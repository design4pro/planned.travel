// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CountryRecord, CountryRecordSkeleton } from '../country-record'

const FRANCE = {
  countryCode: 'FR',
  continent: 'Europe',
  firstVisitedOn: '2011-07-14',
  lastVisitedOn: '2024-09-06',
  visitCount: 3,
  note: 'Paris twice, then the Verdon gorge with the climbing club.',
  hasOutline: true,
} as const

const AUSTRIA = {
  countryCode: 'AT',
  continent: 'Europe',
  firstVisitedOn: '2023-12-28',
  lastVisitedOn: '2023-12-28',
  visitCount: 1,
  note: null,
  hasOutline: true,
} as const

describe('CountryRecord', () => {
  it('carries the whole payload as one unit', () => {
    render(<CountryRecord {...FRANCE} />)

    const record = screen.getByRole('article', { name: 'France' })
    expect(record.textContent).toContain('France')
    expect(record.textContent).toContain('FR')
    expect(record.textContent).toContain('Europe')
    expect(record.textContent).toContain('14 Jul 2011')
    expect(record.textContent).toContain('6 Sept 2024')
    expect(record.textContent).toContain('3 visits')
    expect(record.textContent).toContain('climbing club')
  })

  it('names the record with a real heading', () => {
    render(<CountryRecord {...FRANCE} headingLevel={2} />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'France' }),
    ).toBeTruthy()
  })

  it('labels a multi-year span as a first and a last visit', () => {
    render(<CountryRecord {...FRANCE} />)

    expect(screen.getByText('First visit')).toBeTruthy()
    expect(screen.getByText('Last visit')).toBeTruthy()
    expect(screen.getByText('13 years apart')).toBeTruthy()
  })

  it('exposes each date as a machine-readable day', () => {
    const { container } = render(<CountryRecord {...FRANCE} />)
    const days = [...container.querySelectorAll('time')].map((node) =>
      node.getAttribute('dateTime'),
    )
    expect(days).toEqual(['2011-07-14', '2024-09-06'])
  })

  it('prints one date, once, for a country visited once', () => {
    render(<CountryRecord {...AUSTRIA} />)

    expect(screen.getByText('Visited')).toBeTruthy()
    expect(screen.getAllByText('28 Dec 2023')).toHaveLength(1)
    expect(screen.queryByText('First visit')).toBeNull()
    expect(screen.queryByText('Last visit')).toBeNull()
    expect(screen.getByText('1 visit')).toBeTruthy()
  })

  it('says in words when no date was ever recorded', () => {
    render(
      <CountryRecord
        {...AUSTRIA}
        firstVisitedOn={null}
        lastVisitedOn={null}
        visitCount={2}
      />,
    )

    expect(screen.getByText('Visit dates')).toBeTruthy()
    expect(screen.getByText('Dates not recorded')).toBeTruthy()
    // The country is still fully readable without its dates.
    expect(screen.getByRole('heading', { name: 'Austria' })).toBeTruthy()
    expect(screen.getByText('2 visits')).toBeTruthy()
  })

  it('keeps the recorded half of a half-recorded pair', () => {
    render(<CountryRecord {...AUSTRIA} lastVisitedOn={null} />)

    expect(screen.getByText('First visit')).toBeTruthy()
    expect(screen.getByText('28 Dec 2023')).toBeTruthy()
    expect(screen.getByText('Not recorded')).toBeTruthy()
  })

  it('designs the gap where a note would be', () => {
    render(<CountryRecord {...AUSTRIA} />)
    expect(screen.getByText('No note yet')).toBeTruthy()
  })

  it('treats a whitespace-only note as no note', () => {
    render(<CountryRecord {...AUSTRIA} note="   " />)
    expect(screen.getByText('No note yet')).toBeTruthy()
  })

  it('shows a note when there is one, and no placeholder', () => {
    render(<CountryRecord {...FRANCE} />)
    expect(screen.queryByText('No note yet')).toBeNull()
  })

  it('breaks an unbroken run in a note instead of widening the card', () => {
    // A pasted link is the realistic version of this: one token with no space
    // in it, long enough to push a 360px viewport into horizontal scroll if the
    // paragraph is allowed to size itself to it.
    const pasted = `https://maps.example.test/${'route'.repeat(48)}`
    const { container } = render(<CountryRecord {...FRANCE} note={pasted} />)

    const note = container.querySelector('[data-part="note"]')
    expect(note?.textContent).toBe(pasted)
    expect(note?.className.split(' ')).toContain('wrap-anywhere')
  })

  it('survives a country with no continent on the row', () => {
    render(<CountryRecord {...FRANCE} continent={null} />)
    expect(screen.queryByText('Europe')).toBeNull()
    expect(screen.getByRole('heading', { name: 'France' })).toBeTruthy()
  })

  describe('a country the bundled geometry cannot draw', () => {
    it('is still listed and still says what is missing', () => {
      render(
        <CountryRecord
          countryCode="SG"
          continent="Asia"
          firstVisitedOn="2017-11-08"
          lastVisitedOn="2017-11-08"
          visitCount={1}
          note={null}
          hasOutline={false}
        />,
      )

      const record = screen.getByRole('article', { name: 'Singapore' })
      expect(record.textContent).toContain('8 Nov 2017')
      expect(record.textContent).toContain('nothing to frame on the map')
      expect(record.textContent).toContain('The visit still counts.')
    })

    it('says nothing about the map when the outline exists', () => {
      render(<CountryRecord {...FRANCE} />)
      expect(screen.queryByText(/nothing to frame on the map/)).toBeNull()
    })
  })

  describe('country names', () => {
    it.each([
      ['PS', 'Palestine'],
      ['FK', 'Falkland Islands'],
      ['CD', 'DR Congo'],
      ['HK', 'Hong Kong'],
      ['GB', 'United Kingdom'],
    ])('renders %s deterministically as %s', (code, name) => {
      render(
        <CountryRecord
          {...AUSTRIA}
          countryCode={code}
          continent={null}
          note={null}
        />,
      )
      expect(screen.getByRole('heading', { name })).toBeTruthy()
    })

    it('falls back to the code itself rather than a blank', () => {
      render(<CountryRecord {...AUSTRIA} countryCode="zz" />)
      expect(screen.getByRole('heading', { name: 'ZZ' })).toBeTruthy()
    })
  })
})

describe('CountryRecordSkeleton', () => {
  it('is hidden from assistive technology while it loads', () => {
    const { container } = render(<CountryRecordSkeleton />)
    const root = container.firstElementChild
    expect(root?.getAttribute('aria-busy')).toBe('true')
    expect(root?.getAttribute('aria-hidden')).toBe('true')
  })

  /**
   * jsdom has no layout engine, so height cannot be measured here. What can be
   * locked is the cause: both components are cut from the same `layout` class
   * strings, so if one is edited and the other is not, these comparisons fail
   * before the loading-to-content swap ever gets a chance to move the page.
   */
  describe('parity with the record it stands in for', () => {
    const record = () => render(<CountryRecord {...FRANCE} />).container
    const loading = () => render(<CountryRecordSkeleton />).container
    const part = (root: HTMLElement, name: string) =>
      root.querySelector(`[data-part="${name}"]`)?.className ?? ''

    it.each(['header', 'dates'])('shares the %s layout exactly', (name) => {
      expect(part(loading(), name)).toBe(part(record(), name))
    })

    it('lays out the same two date cells, dividers included', () => {
      const cells = (root: HTMLElement) =>
        [...root.querySelectorAll('[data-part="date-cell"]')].map(
          (cell) => cell.className,
        )

      const real = cells(record())
      expect(real).toHaveLength(2)
      expect(cells(loading())).toEqual(real)
    })

    it('keeps the note block geometry and drops only its colour', () => {
      const real = part(record(), 'note').split(' ')
      const placeholder = part(loading(), 'note').split(' ')

      expect(real).toContain('border-brand/40')
      expect(placeholder).not.toContain('border-brand/40')
      for (const shape of real.filter((name) => name !== 'border-brand/40')) {
        expect(placeholder).toContain(shape)
      }
    })

    it('strikes each bar inside a real line box of the real type style', () => {
      const root = loading()
      const struts = [...root.querySelectorAll('span.relative')]
      expect(struts.length).toBeGreaterThan(0)
      // Every bar is positioned against a strut sitting in a real type style,
      // its own or the one it inherits, so the browser measures the leading
      // instead of the author guessing at a pixel height.
      for (const strut of struts) {
        expect(strut.textContent).toBe('\u00a0')
        const scale = `${strut.className} ${strut.parentElement?.className ?? ''}`
        expect(scale).toMatch(/text-(subtitle|caption|body)/)
      }
    })
  })
})
