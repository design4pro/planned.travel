// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Alert } from '../alert'
import { EmptyState } from '../empty-state'
import { Button } from '../button'

afterEach(cleanup)

describe('Alert', () => {
  it('interrupts only for the danger tone', () => {
    const { unmount } = render(<Alert tone="danger" title="Payment failed" />)
    const danger = screen.getByRole('alert')
    expect(danger.getAttribute('aria-live')).toBe('assertive')
    unmount()

    render(<Alert tone="info" title="Heads up" />)
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
  })

  it('applies the tone to the surface', () => {
    render(<Alert tone="warning" title="Check your dates" />)
    expect(screen.getByRole('status').className).toContain('bg-warning-soft')
  })

  it('dismisses through a named button', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(
      <Alert
        title="Heads up"
        onDismiss={onDismiss}
        dismissLabel="Hide notice"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Hide notice' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('has no dismiss button unless a handler is given', () => {
    render(<Alert title="Heads up" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders body copy and actions', () => {
    render(
      <Alert
        title="Trip is over budget"
        actions={<Button>Review costs</Button>}
      >
        You are 12% above the planned spend.
      </Alert>,
    )
    expect(
      screen.getByText('You are 12% above the planned spend.'),
    ).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Review costs' })).not.toBeNull()
  })
})

describe('EmptyState', () => {
  it('always names the next action', () => {
    render(
      <EmptyState
        title="No trips yet"
        description="Start with a destination and a rough set of dates."
        action={<Button variant="primary">Plan a trip</Button>}
      />,
    )
    expect(screen.getByText('No trips yet')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Plan a trip' })).not.toBeNull()
  })

  it('offers the dashed invitation variant', () => {
    const { container } = render(
      <EmptyState variant="dashed" title="Nothing here" />,
    )
    expect(container.firstElementChild?.className).toContain('border-dashed')
  })

  it('scales its title with the size', () => {
    render(<EmptyState size="lg" title="Nothing here" />)
    expect(screen.getByText('Nothing here').className).toContain('text-title')
  })

  /**
   * A paragraph is right nearly everywhere: the empty state sits inside a
   * section whose own heading already names it, and a heading there would invent
   * a level in the outline.
   */
  it('titles itself with a paragraph by default', () => {
    render(<EmptyState title="Nothing here" />)
    expect(screen.getByText('Nothing here').tagName).toBe('P')
    expect(screen.queryByRole('heading')).toBeNull()
  })

  /**
   * The exception is the dashboard with no trips yet, where the designed nothing
   * *is* the page's leading element and the hero that would carry the `h1` has
   * no trip to name. Without this the screen renders no `h1` at all.
   */
  it('can carry the page heading when it is the leading element', () => {
    render(<EmptyState titleAs="h1" title="No trips yet" />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'No trips yet' }),
    ).not.toBeNull()
  })
})
