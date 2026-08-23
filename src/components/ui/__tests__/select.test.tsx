// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
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

  /**
   * The regression this file exists to hold shut.
   *
   * Radix fills a select's trigger by portalling the chosen `Select.ItemText`
   * into the value node, and the items live inside `Select.Content`, which
   * builds its offscreen `DocumentFragment` in a layout effect. Layout effects
   * do not run on the server, so the trigger went out over the wire empty and
   * only filled in once React had hydrated: measured here as
   * `renderToStaticMarkup` of a `SimpleSelect` carrying `value="gbp"` and not
   * one occurrence of `British pound`. On a page whose client bundle had not
   * arrived, six settings controls read as blank with a clean console.
   *
   * `SimpleSelect` was handed `options`, so it knows the label and now renders
   * it itself. These three assertions pin the whole contract: the label is in
   * the server HTML, it is on the trigger with the menu shut, and supplying it
   * has not stopped the menu from opening.
   */
  it('carries the selected label in the server HTML, before any hydration', () => {
    const html = renderToStaticMarkup(
      <SimpleSelect options={options} value="gbp" ariaLabel="Currency" />,
    )
    expect(html).toContain('British pound')
  })

  it('shows the selected option label and opens a listbox on click', async () => {
    const user = userEvent.setup()
    render(<SimpleSelect options={options} value="jpy" ariaLabel="Currency" />)
    const trigger = screen.getByRole('combobox', { name: 'Currency' })
    expect(trigger.textContent).toContain('Japanese yen')

    await user.click(trigger)
    expect(screen.queryByRole('listbox')).not.toBeNull()
    expect(screen.getAllByRole('option')).toHaveLength(options.length)
  })

  it('falls back to the placeholder for a value no option carries', () => {
    render(
      <SimpleSelect
        options={options}
        value=""
        ariaLabel="Currency"
        placeholder="Choose a currency"
      />,
    )
    expect(
      screen.getByRole('combobox', { name: 'Currency' }).textContent,
    ).toContain('Choose a currency')
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
