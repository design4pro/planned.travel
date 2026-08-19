// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Switch, SwitchField } from '../switch'

afterEach(cleanup)

describe('Switch', () => {
  it('is a real switch role with an on/off state', async () => {
    const user = userEvent.setup()
    render(<Switch aria-label="Public trip" />)
    const control = screen.getByRole('switch', { name: 'Public trip' })
    expect(control.getAttribute('aria-checked')).toBe('false')
    await user.click(control)
    expect(control.getAttribute('aria-checked')).toBe('true')
  })

  it('toggles from the keyboard', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(
      <Switch aria-label="Public trip" onCheckedChange={onCheckedChange} />,
    )
    screen.getByRole('switch', { name: 'Public trip' }).focus()
    await user.keyboard('{Enter}')
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('honours the controlled value', async () => {
    const user = userEvent.setup()
    render(
      <Switch aria-label="Public trip" checked onCheckedChange={() => {}} />,
    )
    const control = screen.getByRole('switch', { name: 'Public trip' })
    await user.click(control)
    expect(control.getAttribute('aria-checked')).toBe('true')
  })

  it('ignores interaction while disabled', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(
      <Switch
        aria-label="Public trip"
        disabled
        onCheckedChange={onCheckedChange}
      />,
    )
    await user.click(screen.getByRole('switch', { name: 'Public trip' }))
    expect(onCheckedChange).not.toHaveBeenCalled()
  })

  it('applies the size variant to the track', () => {
    render(<Switch aria-label="Public trip" size="lg" />)
    expect(
      screen.getByRole('switch', { name: 'Public trip' }).className,
    ).toContain('w-11.5')
  })
})

describe('SwitchField', () => {
  it('names itself from the row label', () => {
    render(
      <SwitchField
        label="Email reminders"
        description="Two days before departure"
      />,
    )
    const control = screen.getByRole('switch', { name: 'Email reminders' })
    const describedBy = control.getAttribute('aria-describedby')
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe(
      'Two days before departure',
    )
  })
})
