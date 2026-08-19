// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MapLegend } from '../map-legend'

import type { MapCategory } from '../types'

const CATEGORIES: ReadonlyArray<MapCategory> = [
  {
    id: 'c1',
    name: 'Landmarks',
    slug: 'landmarks',
    colour: '#256256',
    icon: 'landmark',
  },
  {
    id: 'c2',
    name: 'Food and drink',
    slug: 'food',
    colour: '#8a5305',
    icon: 'utensils',
  },
]

describe('MapLegend', () => {
  it('lists the taxonomy with its counts', () => {
    render(<MapLegend categories={CATEGORIES} counts={{ c1: 4, c2: 11 }} />)
    expect(screen.getByRole('heading', { name: 'Legend' })).toBeDefined()
    expect(screen.getByText('Landmarks')).toBeDefined()
    expect(screen.getByText('11')).toBeDefined()
  })

  it('explains the numbered pin and the cluster badge', () => {
    render(<MapLegend categories={CATEGORIES} />)
    expect(screen.getByText('Itinerary day')).toBeDefined()
    expect(screen.getByText('Grouped places')).toBeDefined()
    // The example pins must not be tab stops.
    expect(screen.getByRole('img', { name: 'Example day pin' })).toBeDefined()
    expect(
      screen.getByRole('img', { name: 'Example grouped pin' }),
    ).toBeDefined()
  })

  it('collapses out of the way and says so', async () => {
    const user = userEvent.setup()
    render(<MapLegend categories={CATEGORIES} />)

    const toggle = screen.getByRole('button', { name: 'Collapse legend' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    await user.click(toggle)
    const expand = screen.getByRole('button', { name: 'Expand legend' })
    expect(expand.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Landmarks')).toBeNull()
  })

  it('can start collapsed, which is the mobile default a screen chooses', () => {
    render(<MapLegend categories={CATEGORIES} defaultOpen={false} />)
    expect(screen.queryByText('Landmarks')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Legend' })).toBeDefined()
  })

  it('drops the pin key on request', () => {
    render(<MapLegend categories={CATEGORIES} showPinKey={false} />)
    expect(screen.queryByText('Itinerary day')).toBeNull()
  })

  it('renders nothing when there is nothing to explain', () => {
    const { container } = render(
      <MapLegend categories={[]} showPinKey={false} />,
    )
    expect(container.firstChild).toBeNull()
  })
})
