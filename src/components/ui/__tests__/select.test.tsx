// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Field } from '../field'
import { SimpleSelect } from '../select'

afterEach(cleanup)

const options = [
  { value: 'gbp', label: 'British pound', description: 'GBP' },
  { value: 'jpy', label: 'Japanese yen', description: 'JPY' },
  { value: 'eur', label: 'Euro', description: 'EUR', disabled: true },
]

describe('SimpleSelect', () => {
  it('shows the placeholder until a value is set', () => {
    render(
      <SimpleSelect
        options={options}
        ariaLabel="Currency"
        placeholder="Choose a currency"
      />,
    )
    expect(
      screen.getByRole('combobox', { name: 'Currency' }).textContent,
    ).toContain('Choose a currency')
  })

  it('opens a listbox and reports the chosen value', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <SimpleSelect
        options={options}
        ariaLabel="Currency"
        onValueChange={onValueChange}
      />,
    )
    await user.click(screen.getByRole('combobox', { name: 'Currency' }))
    await user.click(screen.getByRole('option', { name: /Japanese yen/ }))
    expect(onValueChange).toHaveBeenCalledWith('jpy')
  })

  it('renders the selected label on the trigger', async () => {
    const user = userEvent.setup()
    render(<SimpleSelect options={options} ariaLabel="Currency" />)
    await user.click(screen.getByRole('combobox', { name: 'Currency' }))
    await user.click(screen.getByRole('option', { name: /British pound/ }))
    expect(
      screen.getByRole('combobox', { name: 'Currency' }).textContent,
    ).toContain('British pound')
  })

  it('marks a disabled option as such', async () => {
    const user = userEvent.setup()
    render(<SimpleSelect options={options} ariaLabel="Currency" />)
    await user.click(screen.getByRole('combobox', { name: 'Currency' }))
    expect(
      screen
        .getByRole('option', { name: /Euro/ })
        .getAttribute('aria-disabled'),
    ).toBe('true')
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<SimpleSelect options={options} ariaLabel="Currency" />)
    await user.click(screen.getByRole('combobox', { name: 'Currency' }))
    expect(screen.queryByRole('listbox')).not.toBeNull()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('picks up the invalid and disabled state from a surrounding Field', () => {
    render(
      <Field label="Currency" error="Pick one" disabled>
        <SimpleSelect options={options} />
      </Field>,
    )
    const trigger = screen.getByRole('combobox')
    expect(trigger.getAttribute('aria-invalid')).toBe('true')
    expect((trigger as HTMLButtonElement).disabled).toBe(true)
    // The Field owns the id, so its label points at the trigger.
    expect(screen.getByText('Currency').getAttribute('for')).toBe(trigger.id)
  })
})
