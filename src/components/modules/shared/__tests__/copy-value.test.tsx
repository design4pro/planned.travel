/**
 * `CopyValue` with and without a mask. Masked and revealed are two states of one
 * button, so each test that reveals also checks the node was never replaced —
 * a replaced node is where a keyboard reader loses the focus.
 *
 * `fireEvent` rather than `user-event`: `fireEvent.click` moves no focus by
 * itself, which is how Safari treats a click on a button, so a focused button
 * after it proves the reveal took the focus on purpose.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

import { CopyValue } from '../controls'

const VALUE = 'HG-8842190'
const LABEL = 'the confirmation number for Hotel Gracery'
const MASK = { glyphs: '••••••••••', revealLabel: `Show ${LABEL}` }

const writeText = vi.fn<(value: string) => Promise<void>>()

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard')
})

function masked() {
  render(<CopyValue value={VALUE} label={LABEL} mask={MASK} />)
  return screen.getByRole('button', { name: `Show ${LABEL}` })
}

describe('CopyValue', () => {
  it('shows and copies the value when no mask is given', async () => {
    const { container } = render(<CopyValue value={VALUE} label={LABEL} />)
    const button = screen.getByRole('button', { name: `Copy ${LABEL}` })

    expect(container.textContent).toContain(VALUE)
    expect(button.hasAttribute('data-state')).toBe(false)

    await act(async () => {
      fireEvent.click(button)
    })
    expect(writeText).toHaveBeenCalledWith(VALUE)
  })

  it('keeps the value out of the document while masked', () => {
    const button = masked()

    expect(document.body.textContent).not.toContain(VALUE)
    expect(button.dataset.state).toBe('masked')
  })

  it('reveals in place on a click, takes the focus, and copies nothing yet', () => {
    const button = masked()

    fireEvent.click(button)

    expect(screen.getByRole('button', { name: `Copy ${LABEL}` })).toBe(button)
    expect(button.dataset.state).toBe('revealed')
    expect(button.textContent).toContain(VALUE)
    expect(document.activeElement).toBe(button)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('copies on the activation after the reveal', async () => {
    const button = masked()

    fireEvent.click(button)
    await act(async () => {
      fireEvent.click(button)
    })

    expect(writeText).toHaveBeenCalledWith(VALUE)
    expect(button.getAttribute('aria-label')).toBe(`${LABEL} copied`)
  })

  it('masks again, and forgets the copy, when the focus moves on', async () => {
    const button = masked()
    fireEvent.click(button)
    await act(async () => {
      fireEvent.click(button)
    })

    fireEvent.blur(button)

    expect(button.dataset.state).toBe('masked')
    expect(button.getAttribute('aria-label')).toBe(`Show ${LABEL}`)
    expect(document.body.textContent).not.toContain(VALUE)

    fireEvent.click(button)
    expect(button.getAttribute('aria-label')).toBe(`Copy ${LABEL}`)
  })

  it('reveals nothing on a hover', () => {
    const button = masked()

    fireEvent.pointerEnter(button)
    fireEvent.mouseEnter(button)
    fireEvent.mouseOver(button)

    expect(button.dataset.state).toBe('masked')
  })

  it('reveals nothing when it only receives the focus', () => {
    const button = masked()

    button.focus()

    expect(document.activeElement).toBe(button)
    expect(button.dataset.state).toBe('masked')
  })

  it('moves no focus on mousedown while masked or revealed', () => {
    const button = masked()

    expect(fireEvent.mouseDown(button)).toBe(false)
    fireEvent.click(button)
    expect(fireEvent.mouseDown(button)).toBe(false)
  })
})
