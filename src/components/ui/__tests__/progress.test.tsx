// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { Progress, ProgressRing } from '../progress'
import { Skeleton, SkeletonText } from '../skeleton'

afterEach(cleanup)

describe('Progress', () => {
  it('reports its value to assistive tech', () => {
    render(<Progress value={40} aria-label="Packing" />)
    const bar = screen.getByRole('progressbar', { name: 'Packing' })
    expect(bar.getAttribute('aria-valuenow')).toBe('40')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
  })

  it('clamps a value outside the range', () => {
    render(<Progress value={140} aria-label="Packing" />)
    expect(
      screen
        .getByRole('progressbar', { name: 'Packing' })
        .getAttribute('aria-valuenow'),
    ).toBe('100')
  })

  it('moves the fill with a transform, never with width', () => {
    const { container } = render(<Progress value={25} aria-label="Packing" />)
    const indicator = container.querySelector('[data-motion-transform]')
    expect(indicator?.getAttribute('style')).toContain('translateX(-75%)')
    expect(indicator?.className).toContain('size-full')
  })

  it('drops aria-valuenow and sweeps when indeterminate', () => {
    const { container } = render(
      <Progress value={null} aria-label="Importing" />,
    )
    expect(
      screen
        .getByRole('progressbar', { name: 'Importing' })
        .getAttribute('aria-valuenow'),
    ).toBeNull()
    expect(
      container.querySelector('[data-motion-transform]')?.className,
    ).toContain('animate-indeterminate')
  })

  it('shows a percentage beside a label', () => {
    render(<Progress value={30} label="Packed" aria-label="Packing" />)
    expect(screen.getByText('30%')).not.toBeNull()
  })
})

describe('ProgressRing', () => {
  it('is a progressbar with the right bounds', () => {
    render(
      <ProgressRing value={75} max={150} label="Budget used">
        50%
      </ProgressRing>,
    )
    const ring = screen.getByRole('progressbar', { name: 'Budget used' })
    expect(ring.getAttribute('aria-valuenow')).toBe('75')
    expect(ring.getAttribute('aria-valuemax')).toBe('150')
    expect(ring.textContent).toBe('50%')
  })
})

describe('Skeleton', () => {
  it('is hidden from assistive tech', () => {
    const { container } = render(<Skeleton className="h-4 w-20" />)
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe(
      'true',
    )
  })

  it('shortens the last line of a paragraph', () => {
    const { container } = render(<SkeletonText lines={3} lastLineWidth="40%" />)
    const lines = container.querySelectorAll('[aria-hidden="true"]')
    expect(lines).toHaveLength(3)
    expect(lines[2].getAttribute('style')).toContain('40%')
  })

  it('swaps the shimmer for a pulse on request', () => {
    const { container } = render(<Skeleton animation="pulse" />)
    expect(container.firstElementChild?.className).toContain(
      'animate-pulse-soft',
    )
  })
})
