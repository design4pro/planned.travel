// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Checkbox, CheckboxField } from '../checkbox'

afterEach(cleanup)

describe('Checkbox', () => {
  it('toggles itself when uncontrolled', async () => {
    const user = userEvent.setup()
    render(<Checkbox aria-label="Bring passport" />)
    const box = screen.getByRole('checkbox', { name: 'Bring passport' })
    expect(box.getAttribute('aria-checked')).toBe('false')
    await user.click(box)
    expect(box.getAttribute('aria-checked')).toBe('true')
  })

  it('stays put when controlled and only reports the change', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(
      <Checkbox
        aria-label="Bring passport"
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    )
    const box = screen.getByRole('checkbox', { name: 'Bring passport' })
    await user.click(box)
    expect(onCheckedChange).toHaveBeenCalledWith(true)
    expect(box.getAttribute('aria-checked')).toBe('false')
  })

  it('reports the mixed state for a partially packed list', () => {
    render(<Checkbox aria-label="Clothes" checked="indeterminate" />)
    expect(
      screen
        .getByRole('checkbox', { name: 'Clothes' })
        .getAttribute('aria-checked'),
    ).toBe('mixed')
  })

  it('toggles on Space from the keyboard', async () => {
    const user = userEvent.setup()
    render(<Checkbox aria-label="Bring passport" />)
    const box = screen.getByRole('checkbox', { name: 'Bring passport' })
    box.focus()
    await user.keyboard(' ')
    expect(box.getAttribute('aria-checked')).toBe('true')
  })

  it('does not toggle while disabled', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(
      <Checkbox
        aria-label="Bring passport"
        disabled
        onCheckedChange={onCheckedChange}
      />,
    )
    await user.click(screen.getByRole('checkbox', { name: 'Bring passport' }))
    expect(onCheckedChange).not.toHaveBeenCalled()
  })
})

describe('CheckboxField', () => {
  it('takes its accessible name from the visible label and toggles from a label click', async () => {
    const user = userEvent.setup()
    render(
      <CheckboxField
        label="Share with travellers"
        description="Everyone on the trip"
      />,
    )
    const box = screen.getByRole('checkbox', { name: 'Share with travellers' })
    await user.click(screen.getByText('Share with travellers'))
    expect(box.getAttribute('aria-checked')).toBe('true')
  })

  it('describes itself with the second line', () => {
    render(<CheckboxField label="Share" description="Everyone on the trip" />)
    const box = screen.getByRole('checkbox', { name: 'Share' })
    const describedBy = box.getAttribute('aria-describedby')
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe(
      'Everyone on the trip',
    )
  })
})
