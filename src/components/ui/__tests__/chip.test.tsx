// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Chip } from '../chip'

afterEach(cleanup)

describe('Chip', () => {
  it('is a real toggle button that reports its pressed state', () => {
    render(<Chip selected>Unplanned</Chip>)
    const chip = screen.getByRole('button', { name: /Unplanned/ })
    expect(chip.getAttribute('aria-pressed')).toBe('true')
  })

  it('reports unpressed when not selected', () => {
    render(<Chip>Unplanned</Chip>)
    expect(
      screen
        .getByRole('button', { name: 'Unplanned' })
        .getAttribute('aria-pressed'),
    ).toBe('false')
  })

  it('swaps to the filled treatment when selected', () => {
    const { rerender } = render(<Chip tone="brand">All</Chip>)
    expect(screen.getByRole('button', { name: 'All' }).className).not.toContain(
      'bg-brand ',
    )
    rerender(
      <Chip tone="brand" selected>
        All
      </Chip>,
    )
    expect(screen.getByRole('button', { name: 'All' }).className).toContain(
      'bg-brand',
    )
  })

  it('shows a tabular count without swallowing the label', () => {
    render(<Chip count={10}>All</Chip>)
    const chip = screen.getByRole('button', { name: /All/ })
    expect(chip.textContent).toBe('All10')
  })

  it('keeps the remove affordance as its own named button', async () => {
    const user = userEvent.setup()
    const onRemove = vi.fn()
    const onClick = vi.fn()
    render(
      <Chip onRemove={onRemove} removeLabel="Remove Kyoto" onClick={onClick}>
        Kyoto
      </Chip>,
    )
    await user.click(screen.getByRole('button', { name: 'Remove Kyoto' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('does not fire while disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Chip disabled onClick={onClick}>
        Kyoto
      </Chip>,
    )
    await user.click(screen.getByRole('button', { name: 'Kyoto' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
