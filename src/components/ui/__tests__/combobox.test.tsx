// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Combobox, MultiCombobox } from '../combobox'

import type { ComboboxOption } from '../combobox'

afterEach(cleanup)

const options: Array<ComboboxOption> = [
  { value: 'kyoto', label: 'Kyoto', description: 'Japan', group: 'Asia' },
  { value: 'osaka', label: 'Osaka', description: 'Japan', group: 'Asia' },
  { value: 'porto', label: 'Porto', description: 'Portugal', group: 'Europe' },
  {
    value: 'oslo',
    label: 'Oslo',
    description: 'Norway',
    group: 'Europe',
    disabled: true,
  },
]

describe('Combobox', () => {
  it('shows the placeholder until something is chosen', () => {
    render(
      <Combobox
        options={options}
        placeholder="Where to?"
        ariaLabel="Destination"
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Destination' }).textContent,
    ).toContain('Where to?')
  })

  it('opens a listbox and moves focus into the search box', async () => {
    const user = userEvent.setup()
    render(<Combobox options={options} ariaLabel="Destination" />)
    await user.click(screen.getByRole('button', { name: 'Destination' }))

    const search = screen.getByRole('combobox')
    expect(document.activeElement).toBe(search)
    expect(screen.getByRole('listbox')).not.toBeNull()
    expect(screen.getAllByRole('option')).toHaveLength(4)
  })

  it('filters on label and description', async () => {
    const user = userEvent.setup()
    render(<Combobox options={options} ariaLabel="Destination" />)
    await user.click(screen.getByRole('button', { name: 'Destination' }))

    await user.type(screen.getByRole('combobox'), 'portug')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(screen.getByRole('option').textContent).toContain('Porto')
  })

  it('selects with the arrow keys and Enter, then closes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Combobox
        options={options}
        ariaLabel="Destination"
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Destination' }))

    await user.keyboard('{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenCalledWith('osaka')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Destination' }).textContent,
    ).toContain('Osaka')
  })

  it('points aria-activedescendant at the highlighted row', async () => {
    const user = userEvent.setup()
    render(<Combobox options={options} ariaLabel="Destination" />)
    await user.click(screen.getByRole('button', { name: 'Destination' }))

    const search = screen.getByRole('combobox')
    const first = search.getAttribute('aria-activedescendant')
    expect(first).toBeTruthy()
    expect(document.getElementById(first ?? '')?.textContent).toContain('Kyoto')

    await user.keyboard('{ArrowDown}')
    const second = search.getAttribute('aria-activedescendant')
    expect(second).not.toBe(first)
    expect(document.getElementById(second ?? '')?.textContent).toContain(
      'Osaka',
    )
  })

  it('wraps the highlight around the ends of the list', async () => {
    const user = userEvent.setup()
    render(<Combobox options={options} ariaLabel="Destination" />)
    await user.click(screen.getByRole('button', { name: 'Destination' }))
    await user.keyboard('{ArrowUp}')
    const active = screen
      .getByRole('combobox')
      .getAttribute('aria-activedescendant')
    expect(document.getElementById(active ?? '')?.textContent).toContain('Oslo')
  })

  it('refuses a disabled row', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Combobox
        options={options}
        ariaLabel="Destination"
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Destination' }))
    await user.keyboard('{End}{Enter}')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows the empty message when nothing matches', async () => {
    const user = userEvent.setup()
    render(
      <Combobox
        options={options}
        ariaLabel="Destination"
        emptyMessage="No places found"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Destination' }))
    await user.type(screen.getByRole('combobox'), 'zzz')
    expect(screen.getByText('No places found')).not.toBeNull()
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('respects a controlled value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Combobox
        options={options}
        ariaLabel="Destination"
        value="porto"
        onChange={onChange}
      />,
    )
    const trigger = screen.getByRole('button', { name: 'Destination' })
    expect(trigger.textContent).toContain('Porto')
    await user.click(trigger)
    await user.click(screen.getByRole('option', { name: /Kyoto/ }))
    expect(onChange).toHaveBeenCalledWith('kyoto')
    expect(
      screen.getByRole('button', { name: 'Destination' }).textContent,
    ).toContain('Porto')
  })

  it('skips local filtering when the caller owns the query', async () => {
    const user = userEvent.setup()
    const onSearchChange = vi.fn()
    render(
      <Combobox
        options={options}
        ariaLabel="Destination"
        manualFiltering
        onSearchChange={onSearchChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Destination' }))
    await user.type(screen.getByRole('combobox'), 'zzz')
    expect(onSearchChange).toHaveBeenCalled()
    expect(screen.getAllByRole('option')).toHaveLength(4)
  })

  it('groups rows under their headings', async () => {
    const user = userEvent.setup()
    render(<Combobox options={options} ariaLabel="Destination" />)
    await user.click(screen.getByRole('button', { name: 'Destination' }))
    expect(screen.getByRole('group', { name: 'Asia' })).not.toBeNull()
    expect(screen.getByRole('group', { name: 'Europe' })).not.toBeNull()
  })
})

describe('MultiCombobox', () => {
  it('accumulates selections without closing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <MultiCombobox
        options={options}
        ariaLabel="Interests"
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Interests' }))
    await user.click(screen.getByRole('option', { name: /Kyoto/ }))
    await user.click(screen.getByRole('option', { name: /Porto/ }))

    expect(onChange).toHaveBeenLastCalledWith(['kyoto', 'porto'])
    expect(screen.queryByRole('listbox')).not.toBeNull()
  })

  it('marks its listbox multiselectable and the single one not', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <MultiCombobox options={options} ariaLabel="Interests" />,
    )
    await user.click(screen.getByRole('button', { name: 'Interests' }))
    expect(
      screen.getByRole('listbox').getAttribute('aria-multiselectable'),
    ).toBe('true')
    unmount()

    render(<Combobox options={options} ariaLabel="Destination" />)
    await user.click(screen.getByRole('button', { name: 'Destination' }))
    expect(
      screen.getByRole('listbox').getAttribute('aria-multiselectable'),
    ).toBeNull()
  })

  it('deselects a row that is already chosen', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <MultiCombobox
        options={options}
        ariaLabel="Interests"
        defaultValue={['kyoto']}
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Interests' }))
    await user.click(screen.getByRole('option', { name: /Kyoto/ }))
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('removes the last tag on Backspace in an empty search box', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <MultiCombobox
        options={options}
        ariaLabel="Interests"
        defaultValue={['kyoto', 'porto']}
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Interests' }))
    await user.keyboard('{Backspace}')
    expect(onChange).toHaveBeenLastCalledWith(['kyoto'])
  })

  it('collapses to a count past the visible tag limit', () => {
    render(
      <MultiCombobox
        options={options}
        ariaLabel="Interests"
        defaultValue={['kyoto', 'osaka', 'porto']}
        maxVisibleTags={2}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Interests' }).textContent,
    ).toContain('+1')
  })
})
