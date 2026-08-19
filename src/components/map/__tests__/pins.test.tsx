// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ClusterPin, DayPin, PlacePin } from '../pins'

describe('DayPin', () => {
  it('is a named button showing its day numeral', () => {
    render(<DayPin day={3} />)
    const pin = screen.getByRole('button', { name: 'Day 3' })
    expect(pin.textContent).toBe('3')
  })

  it('uses tabular numerals so a column of pins never looks ragged', () => {
    render(<DayPin day={11} />)
    expect(screen.getByRole('button', { name: 'Day 11' }).className).toContain(
      'tabular-nums',
    )
  })

  it('marks the active day with the brand rather than the accent', () => {
    const { rerender } = render(<DayPin day={1} />)
    expect(screen.getByRole('button', { name: 'Day 1' }).className).toContain(
      'bg-accent',
    )
    rerender(<DayPin day={1} active />)
    expect(screen.getByRole('button', { name: 'Day 1' }).className).toContain(
      'bg-brand',
    )
  })

  it('drops out of the tab order when the map is not interactive', () => {
    render(<DayPin day={4} interactive={false} />)
    expect(screen.getByRole('img', { name: 'Day 4' })).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('PlacePin', () => {
  it('shows the place thumbnail when there is one', () => {
    const { container } = render(
      <PlacePin name="Sensoji" imageUrl="https://example.test/sensoji.jpg" />,
    )
    const image = container.querySelector('img')
    expect(image?.getAttribute('src')).toBe('https://example.test/sensoji.jpg')
    // Decorative: the button already carries the name.
    expect(image?.getAttribute('alt')).toBe('')
  })

  it('falls back to the category glyph with no image', () => {
    const { container } = render(<PlacePin name="Sensoji" icon="landmark" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('falls back to the glyph when the thumbnail fails to load', () => {
    const { container } = render(
      <PlacePin name="Sensoji" imageUrl="https://example.test/gone.jpg" />,
    )
    const image = container.querySelector('img')
    expect(image).not.toBeNull()
    if (image !== null) fireEvent.error(image)
    expect(container.querySelector('img')).toBeNull()
  })

  it('carries the category colour as a custom property, never as a class', () => {
    render(<PlacePin name="Sensoji" colour="#256256" />)
    const pin = screen.getByRole('button', { name: 'Sensoji' })
    expect(pin.style.getPropertyValue('--pin-accent')).toBe('#256256')
    expect(pin.className).toContain('ring-(--pin-accent)')
  })

  it('badges its itinerary day and its visited state', () => {
    render(<PlacePin name="Sensoji" dayNumber={2} visited />)
    const pin = screen.getByRole('button', { name: 'Sensoji' })
    expect(pin.textContent).toContain('2')
    // The check is a glyph, not text, so it is counted structurally.
    expect(pin.querySelectorAll('svg')).toHaveLength(2)
  })

  it('takes a fuller accessible name than the visible label', () => {
    render(<PlacePin name="Sensoji" label="Sensoji, Landmarks, day 2" />)
    expect(
      screen.getByRole('button', { name: 'Sensoji, Landmarks, day 2' }),
    ).toBeDefined()
  })

  it('reports clicks', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<PlacePin name="Sensoji" onClick={onClick} />)
    await user.click(screen.getByRole('button', { name: 'Sensoji' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('ClusterPin', () => {
  it('says how many places it hides and what to do about it', () => {
    render(<ClusterPin count={6} />)
    const pin = screen.getByRole('button', {
      name: '6 places — zoom in to separate them',
    })
    expect(pin.textContent).toBe('6')
  })

  it('grows with the number of places', () => {
    const { rerender } = render(<ClusterPin count={3} weight="sm" />)
    const small = screen.getByRole('button').className
    rerender(<ClusterPin count={30} weight="lg" />)
    expect(screen.getByRole('button').className).not.toBe(small)
  })
})
