// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { Progress, ProgressRing } from '../progress'
import { Skeleton, SkeletonText } from '../skeleton'

afterEach(cleanup)

/** The bar's fill: the only child of the track Radix renders. */
function fill(container: HTMLElement): HTMLElement {
  const indicator = container.querySelector<HTMLElement>(
    '[role="progressbar"] > *',
  )
  if (!indicator) throw new Error('Progress rendered no fill')
  return indicator
}

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

  it('moves the fill with translate, never with width', () => {
    const { container } = render(<Progress value={25} aria-label="Packing" />)
    const indicator = fill(container)
    expect(indicator.style.translate).toBe('-75% 0')
    expect(indicator.className).toContain('size-full')
    expect(indicator.className).not.toContain('w-[')
  })

  /**
   * The reduced-motion defect this assertion exists to hold shut.
   *
   * `src/styles/styles.css` resets `transform` to `none !important` on
   * `[data-motion-transform]` for a reader who asked for less motion. A fill
   * *positioned* with `transform: translateX(-75%)` was caught by that reset, so
   * every determinate bar painted a full track — a quarter-packed bag reading as
   * packed, silently, for exactly the readers least able to tell. Two things
   * keep it fixed, and jsdom can see both: the offset lives on the `translate`
   * property, which that rule does not touch, and the element carrying it is not
   * marked as motion at all.
   */
  it('keeps a determinate offset out of reach of the reduced-motion reset', () => {
    const { container } = render(<Progress value={40} aria-label="Packing" />)
    const indicator = fill(container)
    expect(indicator.style.transform).toBe('')
    expect(indicator.hasAttribute('data-motion-transform')).toBe(false)
    expect(indicator.hasAttribute('data-motion-loop')).toBe(false)
    expect(indicator.style.translate).toBe('-60% 0')
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
    const indicator = fill(container)
    expect(indicator.className).toContain('animate-indeterminate')
    // The sweep *is* motion: the reset must reach it, and the pulse replaces it
    // rather than leaving a frozen full track that reads as "finished".
    expect(indicator.hasAttribute('data-motion-transform')).toBe(true)
    expect(indicator.hasAttribute('data-motion-loop')).toBe(true)
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

  /**
   * The reduced-motion reset kills every animation it is not told to keep, so
   * the marker is what separates "still loading" from a slab of dead grey. Both
   * animated variants have to carry it — `pulse` is opacity-only and was being
   * silenced for nothing — and `none` must not, having asked for stillness.
   */
  it('keeps signalling under reduced motion, unless it opted out', () => {
    for (const animation of ['shimmer', 'pulse'] as const) {
      const { container, unmount } = render(<Skeleton animation={animation} />)
      expect(
        container.firstElementChild?.hasAttribute('data-motion-loop'),
      ).toBe(true)
      unmount()
    }

    const { container } = render(<Skeleton animation="none" />)
    expect(container.firstElementChild?.hasAttribute('data-motion-loop')).toBe(
      false,
    )
  })
})
