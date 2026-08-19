// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CoverageNotice } from '../coverage-notice'
import { coverageFor } from '#/lib/map/coverage'

import type { MapBounds } from '#/lib/map/bounds'

const REGION: MapBounds = { west: 134.2, south: 33.6, east: 140.9, north: 36.8 }

const TOKYO = [139.6917, 35.6895] as const
const LISBON = [-9.1393, 38.7223] as const

describe('CoverageNotice', () => {
  it('says nothing when the whole trip has street detail', () => {
    const { container } = render(
      <CoverageNotice coverage={coverageFor(REGION, [TOKYO])} />,
    )
    expect(container.childElementCount).toBe(0)
  })

  it('says nothing while the archive has not answered yet', () => {
    const { container } = render(
      <CoverageNotice coverage={coverageFor(null, [LISBON])} />,
    )
    expect(container.childElementCount).toBe(0)
  })

  it('explains a trip that falls outside the published region', () => {
    render(<CoverageNotice coverage={coverageFor(REGION, [LISBON])} />)

    const notice = screen.getByRole('status')
    expect(notice.textContent).toContain('No street detail here')
    // The claim has to be about what is missing, not about what is broken.
    expect(notice.textContent).toContain('coastlines')
    expect(notice.textContent).toContain('routes')
  })

  it('counts the stops that fall outside a partly-covered trip', () => {
    render(
      <CoverageNotice coverage={coverageFor(REGION, [TOKYO, LISBON, LISBON])} />,
    )
    const notice = screen.getByRole('status')
    expect(notice.textContent).toContain('Partial street detail')
    expect(notice.textContent).toContain('2')
    expect(notice.textContent).toContain('places')
  })

  it('uses the singular for one uncovered stop', () => {
    render(<CoverageNotice coverage={coverageFor(REGION, [TOKYO, LISBON])} />)
    expect(screen.getByRole('status').textContent).toContain('place')
    expect(screen.getByRole('status').textContent).not.toContain('places')
  })

  it('is announced politely, because it arrives after first paint', () => {
    render(<CoverageNotice coverage={coverageFor(REGION, [LISBON])} />)
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
  })

  it('can be dismissed, so a note on a map can get out of the way', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(
      <CoverageNotice
        coverage={coverageFor(REGION, [LISBON])}
        onDismiss={onDismiss}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Dismiss the map coverage note' }),
    )
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('has no dismiss control when there is nothing to call', () => {
    render(<CoverageNotice coverage={coverageFor(REGION, [LISBON])} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
