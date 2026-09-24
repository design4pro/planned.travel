// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format } from 'date-fns/format'

import { DatePicker } from '../date-picker'
import { DateRangePicker } from '../date-range-picker'

afterEach(cleanup)

const march = new Date(2026, 2, 1)
const dayLabel = (day: number) =>
  format(new Date(2026, 2, day), 'EEEE d MMMM yyyy')

describe('DatePicker', () => {
  it('shows the placeholder while empty', () => {
    render(
      <DatePicker ariaLabel="Departure" placeholder="Pick a departure date" />,
    )
    expect(
      screen.getByRole('button', { name: 'Departure' }).textContent,
    ).toContain('Pick a departure date')
  })

  it('opens the calendar, reports the pick and closes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DatePicker
        ariaLabel="Departure"
        defaultMonth={march}
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Departure' }))
    await user.click(screen.getByRole('button', { name: dayLabel(18) }))

    expect(format(onChange.mock.calls[0]?.[0] as Date, 'yyyy-MM-dd')).toBe(
      '2026-03-18',
    )
    expect(screen.queryByRole('grid')).toBeNull()
  })

  it('formats the chosen date on the trigger', async () => {
    const user = userEvent.setup()
    render(<DatePicker ariaLabel="Departure" defaultMonth={march} />)
    await user.click(screen.getByRole('button', { name: 'Departure' }))
    await user.click(screen.getByRole('button', { name: dayLabel(18) }))
    expect(
      screen.getByRole('button', { name: 'Departure' }).textContent,
    ).toContain('18 Mar 2026')
  })

  it('offers a clear affordance only once a date is set', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DatePicker
        ariaLabel="Departure"
        defaultMonth={march}
        clearable
        onChange={onChange}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Clear date' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Departure' }))
    await user.click(screen.getByRole('button', { name: dayLabel(18) }))
    await user.click(screen.getByRole('button', { name: 'Clear date' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('never opens while disabled', async () => {
    const user = userEvent.setup()
    render(<DatePicker ariaLabel="Departure" disabled />)
    await user.click(screen.getByRole('button', { name: 'Departure' }))
    expect(screen.queryByRole('grid')).toBeNull()
  })

  it('keeps the trigger on the controlled value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DatePicker
        ariaLabel="Departure"
        defaultMonth={march}
        value={new Date(2026, 2, 3)}
        onChange={onChange}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Departure' }).textContent,
    ).toContain('3 Mar 2026')
    await user.click(screen.getByRole('button', { name: 'Departure' }))
    await user.click(screen.getByRole('button', { name: dayLabel(18) }))
    expect(onChange).toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Departure' }).textContent,
    ).toContain('3 Mar 2026')
  })
})

describe('DateRangePicker', () => {
  it('stays open after the first click and closes on the second', async () => {
    const user = userEvent.setup()
    render(
      <DateRangePicker
        ariaLabel="Trip dates"
        defaultMonth={march}
        numberOfMonths={1}
        presets={[]}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Trip dates' }))
    await user.click(screen.getByRole('button', { name: dayLabel(10) }))
    expect(screen.queryByRole('grid')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: dayLabel(17) }))
    expect(screen.queryByRole('grid')).toBeNull()
  })

  it('counts the nights between the two ends', async () => {
    const user = userEvent.setup()
    render(
      <DateRangePicker
        ariaLabel="Trip dates"
        defaultMonth={march}
        numberOfMonths={1}
        presets={[]}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Trip dates' }))
    await user.click(screen.getByRole('button', { name: dayLabel(10) }))
    await user.click(screen.getByRole('button', { name: dayLabel(17) }))
    expect(
      screen.getByRole('button', { name: 'Trip dates' }).textContent,
    ).toContain('7 nights')
  })

  it('says "1 night" in the singular', async () => {
    const user = userEvent.setup()
    render(
      <DateRangePicker
        ariaLabel="Trip dates"
        defaultMonth={march}
        numberOfMonths={1}
        presets={[]}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Trip dates' }))
    await user.click(screen.getByRole('button', { name: dayLabel(10) }))
    await user.click(screen.getByRole('button', { name: dayLabel(11) }))
    expect(
      screen.getByRole('button', { name: 'Trip dates' }).textContent,
    ).toContain('1 night')
  })

  it('applies a preset in one click', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DateRangePicker
        ariaLabel="Trip dates"
        defaultMonth={march}
        numberOfMonths={1}
        presets={[
          {
            label: 'Fixed week',
            build: () => ({ from: march, to: new Date(2026, 2, 8) }),
          },
        ]}
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Trip dates' }))
    await user.click(screen.getByRole('button', { name: 'Fixed week' }))
    expect(onChange).toHaveBeenLastCalledWith({
      from: march,
      to: new Date(2026, 2, 8),
    })
  })

  it('shows a half-open range while the second end is pending', async () => {
    const user = userEvent.setup()
    render(
      <DateRangePicker
        ariaLabel="Trip dates"
        defaultMonth={march}
        numberOfMonths={1}
        presets={[]}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Trip dates' }))
    await user.click(screen.getByRole('button', { name: dayLabel(10) }))
    expect(
      screen.getByRole('button', { name: 'Trip dates' }).textContent,
    ).toContain('10 Mar — …')
  })
})
