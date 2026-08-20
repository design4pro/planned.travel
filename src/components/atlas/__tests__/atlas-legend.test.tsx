// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import {
  DISTANT_AFTER_YEARS,
  RECENT_WITHIN_YEARS,
} from '#/lib/map/visit-recency'
import { AtlasLegend, AtlasLegendSkeleton } from '../atlas-legend'

const swatches = (root: HTMLElement): Array<HTMLElement> => [
  ...root.querySelectorAll<HTMLElement>('[data-step]'),
]

describe('AtlasLegend', () => {
  it('is a named group, so the key is reachable as one thing', () => {
    render(<AtlasLegend />)
    const group = screen.getByRole('group', { name: 'Last visit' })
    expect(group).toBeTruthy()
  })

  /**
   * The whole point of the component: the ramp's three stops cannot be decoded
   * from colour, so the boundaries are written out — and written from the very
   * constants `visitRecency()` cuts the ramp at, so retuning the ramp retunes
   * the key rather than leaving it lying.
   */
  it('states the boundaries the ramp is actually cut at', () => {
    render(<AtlasLegend />)

    expect(screen.getByText(`Within ${RECENT_WITHIN_YEARS} years`)).toBeTruthy()
    expect(
      screen.getByText(
        `${RECENT_WITHIN_YEARS}–${DISTANT_AFTER_YEARS} years ago`,
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(`Over ${DISTANT_AFTER_YEARS} years ago`),
    ).toBeTruthy()
  })

  it('follows the thresholds when they are retuned', () => {
    render(<AtlasLegend recentWithinYears={3} distantAfterYears={12} />)

    expect(screen.getByText('Within 3 years')).toBeTruthy()
    expect(screen.getByText('3–12 years ago')).toBeTruthy()
    expect(screen.getByText('Over 12 years ago')).toBeTruthy()
  })

  it('uses the singular when the strong end is one year', () => {
    render(<AtlasLegend recentWithinYears={1} />)
    expect(screen.getByText('Within the last year')).toBeTruthy()
  })

  it('names the pale ground as well as the three visited stops', () => {
    const { container } = render(<AtlasLegend />)

    expect(swatches(container).map((step) => step.dataset.step)).toEqual([
      'visitedRecent',
      'visited',
      'visitedDistant',
      'unvisited',
    ])
    expect(screen.getByText('Not visited yet')).toBeTruthy()
  })

  /**
   * WCAG 1.4.1: every step has a text label, and the swatch beside it is
   * decoration. A reader who cannot separate three greens loses nothing.
   */
  it('labels every step in words and hides every swatch', () => {
    const { container } = render(<AtlasLegend />)

    for (const step of swatches(container)) {
      const swatch = step.firstElementChild
      expect(swatch?.getAttribute('aria-hidden')).toBe('true')
      expect(step.textContent.trim().length).toBeGreaterThan(0)
    }
  })

  it('points at the text the map cannot carry', () => {
    render(<AtlasLegend />)
    expect(
      screen.getByText(/every date is written out under Countries/i),
    ).toBeTruthy()
  })

  /** Every fill comes from the country ramp tokens, never a literal colour. */
  it('paints its swatches from tokens only', () => {
    const { container } = render(<AtlasLegend />)
    const classes = swatches(container)
      .map((step) => step.firstElementChild?.className ?? '')
      .join(' ')

    expect(classes).toContain('bg-country-visited-recent')
    expect(classes).toContain('bg-country-visited-distant')
    expect(classes).toContain('bg-country-land')
    expect(classes).not.toMatch(/#[0-9a-f]{3,8}/i)
  })

  /** Values sit at 12px, not the 9px the reference renders its own key at. */
  it('keeps every step label at the panel type floor', () => {
    const { container } = render(<AtlasLegend />)
    for (const step of swatches(container)) {
      expect(step.lastElementChild?.className).toContain('text-caption')
    }
  })
})

describe('AtlasLegendSkeleton', () => {
  it('is hidden from assistive technology and reserves four steps', () => {
    const { container } = render(<AtlasLegendSkeleton />)
    const root = container.firstElementChild

    expect(root?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByRole('group')).toBeNull()
    expect(root?.lastElementChild?.children).toHaveLength(4)
  })

  /**
   * jsdom cannot measure height, but it can prove the cause: both are cut from
   * the same `layout` strings, so an edit to one that is not made to the other
   * fails here rather than moving the panel when the read lands.
   */
  it('shares the key’s own row geometry', () => {
    const real = render(<AtlasLegend />).container.firstElementChild
    const loading = render(<AtlasLegendSkeleton />).container.firstElementChild

    expect(loading?.className).toBe(real?.className)
  })
})
