// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format } from 'date-fns'

import { Calendar, RangeCalendar } from '../calendar'

afterEach(cleanup)

/** A fixed month so nothing here depends on the day the suite runs. */
const march = new Date(2026, 2, 1)
const dayLabel = (day: number) =>
  format(new Date(2026, 2, day), 'EEEE d MMMM yyyy')
const isDisabled = (name: string) =>
  screen.getByRole<HTMLButtonElement>('button', { name }).disabled

describe('Calendar', () => {
  it('renders the month it was given, as a grid', () => {
    render(<Calendar defaultMonth={march} />)
    expect(screen.getByText('March 2026')).not.toBeNull()
    expect(screen.getByRole('grid', { name: /March 2026/ })).not.toBeNull()
    expect(screen.getByRole('button', { name: dayLabel(15) })).not.toBeNull()
  })

  it('pages between months', async () => {
    const user = userEvent.setup()
    render(<Calendar defaultMonth={march} />)
    await user.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByText('April 2026')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText('February 2026')).not.toBeNull()
  })

  it('reports the day that was clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Calendar defaultMonth={march} onSelect={onSelect} />)
    await user.click(screen.getByRole('button', { name: dayLabel(12) }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(format(onSelect.mock.calls[0]?.[0] as Date, 'yyyy-MM-dd')).toBe(
      '2026-03-12',
    )
  })

  it('is one tab stop, with the roving day tabbable', () => {
    render(<Calendar defaultMonth={march} selected={new Date(2026, 2, 9)} />)
    expect(
      screen
        .getByRole('button', { name: dayLabel(9) })
        .getAttribute('tabindex'),
    ).toBe('0')
    expect(
      screen
        .getByRole('button', { name: dayLabel(10) })
        .getAttribute('tabindex'),
    ).toBe('-1')
  })

  it('walks days with the arrow keys and weeks with up/down', async () => {
    const user = userEvent.setup()
    render(<Calendar defaultMonth={march} selected={new Date(2026, 2, 9)} />)
    screen.getByRole('button', { name: dayLabel(9) }).focus()

    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: dayLabel(10) }),
    )

    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: dayLabel(17) }),
    )

    await user.keyboard('{ArrowUp}{ArrowLeft}')
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: dayLabel(9) }),
    )
  })

  it('jumps a month with PageDown and follows the visible month', async () => {
    const user = userEvent.setup()
    render(<Calendar defaultMonth={march} selected={new Date(2026, 2, 9)} />)
    screen.getByRole('button', { name: dayLabel(9) }).focus()
    await user.keyboard('{PageDown}')
    expect(screen.getByText('April 2026')).not.toBeNull()
  })

  it('disables days outside the min/max window', () => {
    render(
      <Calendar
        defaultMonth={march}
        minDate={new Date(2026, 2, 10)}
        maxDate={new Date(2026, 2, 20)}
      />,
    )
    expect(isDisabled(dayLabel(9))).toBe(true)
    expect(isDisabled(dayLabel(10))).toBe(false)
    expect(isDisabled(dayLabel(21))).toBe(true)
  })

  it('honours a per-day veto', () => {
    render(
      <Calendar
        defaultMonth={march}
        isDateDisabled={(date) => date.getDate() % 2 === 0}
      />,
    )
    expect(isDisabled(dayLabel(4))).toBe(true)
    expect(isDisabled(dayLabel(5))).toBe(false)
  })

  it('stops paging past the min month', () => {
    render(<Calendar defaultMonth={march} minDate={new Date(2026, 2, 1)} />)
    expect(isDisabled('Previous month')).toBe(true)
  })

  it('marks the selected day and today differently', () => {
    render(<Calendar defaultMonth={march} selected={new Date(2026, 2, 9)} />)
    const selectedCell = screen
      .getByRole('button', { name: dayLabel(9) })
      .closest('td')
    expect(selectedCell?.getAttribute('aria-selected')).toBe('true')
    expect(
      screen
        .getByRole('button', { name: dayLabel(10) })
        .closest('td')
        ?.getAttribute('aria-selected'),
    ).toBe('false')
  })
})

describe('RangeCalendar', () => {
  it('shows two months by default', () => {
    render(<RangeCalendar defaultMonth={march} />)
    expect(screen.getByText('March 2026')).not.toBeNull()
    expect(screen.getByText('April 2026')).not.toBeNull()
  })

  it('builds a range over two clicks', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <RangeCalendar
        defaultMonth={march}
        numberOfMonths={1}
        onSelect={onSelect}
      />,
    )

    await user.click(screen.getByRole('button', { name: dayLabel(10) }))
    expect(onSelect).toHaveBeenLastCalledWith({ from: new Date(2026, 2, 10) })

    await user.click(screen.getByRole('button', { name: dayLabel(14) }))
    expect(onSelect).toHaveBeenLastCalledWith({
      from: new Date(2026, 2, 10),
      to: new Date(2026, 2, 14),
    })
  })

  it('restarts the range when the second click lands earlier', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <RangeCalendar
        defaultMonth={march}
        numberOfMonths={1}
        onSelect={onSelect}
      />,
    )
    await user.click(screen.getByRole('button', { name: dayLabel(14) }))
    await user.click(screen.getByRole('button', { name: dayLabel(10) }))
    expect(onSelect).toHaveBeenLastCalledWith({ from: new Date(2026, 2, 10) })
  })

  it('washes the days between the two ends', async () => {
    const user = userEvent.setup()
    render(<RangeCalendar defaultMonth={march} numberOfMonths={1} />)
    await user.click(screen.getByRole('button', { name: dayLabel(10) }))
    await user.click(screen.getByRole('button', { name: dayLabel(14) }))

    const middle = screen
      .getByRole('button', { name: dayLabel(12) })
      .closest('td')
    expect(middle?.getAttribute('aria-selected')).toBe('true')
    expect(middle?.className).toContain('bg-brand-subtle')
  })

  it('previews the range on hover before the second click', async () => {
    const user = userEvent.setup()
    render(<RangeCalendar defaultMonth={march} numberOfMonths={1} />)
    await user.click(screen.getByRole('button', { name: dayLabel(10) }))
    await user.hover(screen.getByRole('button', { name: dayLabel(13) }))

    expect(
      screen.getByRole('button', { name: dayLabel(12) }).closest('td')
        ?.className,
    ).toContain('bg-brand-subtle')
  })

  it('accepts a controlled range', () => {
    render(
      <RangeCalendar
        defaultMonth={march}
        numberOfMonths={1}
        selected={{ from: new Date(2026, 2, 3), to: new Date(2026, 2, 5) }}
      />,
    )
    expect(
      screen
        .getByRole('button', { name: dayLabel(4) })
        .closest('td')
        ?.getAttribute('aria-selected'),
    ).toBe('true')
  })
})
