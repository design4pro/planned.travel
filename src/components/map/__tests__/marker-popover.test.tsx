// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { DEFAULT_LOCALE, createTranslator } from '#/lib/i18n'
import source from '#/lib/i18n/messages/en/atlas'
import { MarkerPopover, markerLabel } from '../marker-popover'

/**
 * The source catalogue, bound exactly as `useAtlasI18n()` binds it with no
 * provider above the tree. Building it here rather than reaching into the
 * component's own module also proves every key the label uses exists.
 */
const t = createTranslator(
  DEFAULT_LOCALE,
  Object.fromEntries(
    Object.entries(source).map(([key, message]) => [`atlas.${key}`, message]),
  ),
)
const label = (input: Parameters<typeof markerLabel>[0]): string =>
  markerLabel(input, t, DEFAULT_LOCALE)

describe('MarkerPopover', () => {
  it('shows the place, its category and its address', () => {
    render(
      <MarkerPopover
        name="Fushimi Inari Taisha"
        category={{ name: 'Landmarks', colour: '#256256', icon: 'landmark' }}
        address="68 Fukakusa Yabunouchicho, Fushimi Ward"
      />,
    )
    expect(screen.getByText('Fushimi Inari Taisha')).toBeDefined()
    expect(screen.getByText('Landmarks')).toBeDefined()
    expect(screen.getByText(/Fukakusa Yabunouchicho/)).toBeDefined()
  })

  it('gives a rating a text equivalent, not only stars', () => {
    render(<MarkerPopover name="Kinkaku-ji" rating={4} />)
    expect(screen.getByText('Rated 4 out of 5')).toBeDefined()
  })

  it('renders a thumbnail decoratively', () => {
    const { container } = render(
      <MarkerPopover
        name="Kinkaku-ji"
        imageUrl="https://example.test/kinkakuji.jpg"
      />,
    )
    const image = container.querySelector('img')
    expect(image?.getAttribute('alt')).toBe('')
    expect(image?.getAttribute('loading')).toBe('lazy')
  })

  it('hides itself from the reader when the trigger already says everything', () => {
    const { container } = render(<MarkerPopover name="Kinkaku-ji" decorative />)
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe(
      'true',
    )
  })

  it('stays announced when used on its own', () => {
    const { container } = render(<MarkerPopover name="Kinkaku-ji" />)
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBeNull()
  })

  it('omits the whole meta row when there is nothing to put in it', () => {
    render(<MarkerPopover name="An unrated place" />)
    expect(screen.queryByText(/Rated/)).toBeNull()
  })
})

describe('markerLabel', () => {
  it('folds the whole card into one accessible name', () => {
    expect(
      label({
        name: 'Sensoji',
        categoryName: 'Landmarks',
        address: '2-3-1 Asakusa',
        rating: 5,
        dayNumber: 3,
        visited: true,
      }),
    ).toBe(
      'Sensoji, Landmarks, day 3, 2-3-1 Asakusa, rated 5 out of 5, visited',
    )
  })

  it('says only what is known', () => {
    expect(label({ name: 'A place' })).toBe('A place')
    expect(label({ name: 'A place', address: null, rating: null })).toBe(
      'A place',
    )
  })

  it('keeps day zero-safe and does not claim an unvisited place is visited', () => {
    expect(label({ name: 'A place', dayNumber: 1, visited: false })).toBe(
      'A place, day 1',
    )
  })
})
