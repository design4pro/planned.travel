// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { BasemapNotice } from '../basemap-notice'

describe('BasemapNotice', () => {
  it('tells the reader what is missing and what still works', () => {
    render(<BasemapNotice />)
    const notice = screen.getByRole('status')
    expect(notice.textContent).toContain('Basemap unavailable')
    expect(notice.textContent).toContain('real position')
  })

  it('announces itself politely, because it appears after first paint', () => {
    render(<BasemapNotice />)
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
  })

  it('offers a retry only when there is something to retry', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const { rerender } = render(<BasemapNotice />)
    expect(screen.queryByRole('button')).toBeNull()

    rerender(<BasemapNotice onRetry={onRetry} />)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('reports that a retry is in flight', () => {
    render(<BasemapNotice onRetry={vi.fn()} retrying />)
    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.hasAttribute('disabled')).toBe(true)
  })
})
