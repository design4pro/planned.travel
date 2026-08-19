// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { Badge, CountBadge } from '../badge'

afterEach(cleanup)

describe('Badge', () => {
  it('applies the tone and size variants', () => {
    render(
      <Badge tone="success" size="lg" data-testid="badge">
        Confirmed
      </Badge>,
    )
    const badge = screen.getByTestId('badge')
    expect(badge.className).toContain('bg-success-soft')
    expect(badge.className).toContain('text-success')
    expect(badge.className).toContain('h-7')
  })

  it('lets a caller override a variant class through className', () => {
    render(
      <Badge tone="danger" className="bg-brand-subtle" data-testid="badge">
        Overridden
      </Badge>,
    )
    const badge = screen.getByTestId('badge')
    expect(badge.className).toContain('bg-brand-subtle')
    expect(badge.className).not.toContain('bg-danger-soft')
  })

  it('caps the count and keeps tabular numerals', () => {
    render(<CountBadge count={140} max={99} data-testid="count" />)
    const badge = screen.getByTestId('count')
    expect(badge.textContent).toBe('99+')
    expect(badge.className).toContain('tabular-nums')
  })
})
