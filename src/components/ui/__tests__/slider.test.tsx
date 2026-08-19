// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Slider } from '../slider'

afterEach(cleanup)

describe('Slider', () => {
  it('renders one thumb per value with the right aria range', () => {
    render(
      <Slider defaultValue={[40]} min={0} max={200} thumbLabels={['Budget']} />,
    )
    const thumb = screen.getByRole('slider', { name: 'Budget' })
    expect(thumb.getAttribute('aria-valuenow')).toBe('40')
    expect(thumb.getAttribute('aria-valuemin')).toBe('0')
    expect(thumb.getAttribute('aria-valuemax')).toBe('200')
  })

  it('becomes a range with two thumbs', () => {
    render(
      <Slider defaultValue={[20, 80]} thumbLabels={['Minimum', 'Maximum']} />,
    )
    expect(screen.getAllByRole('slider')).toHaveLength(2)
    expect(
      screen
        .getByRole('slider', { name: 'Maximum' })
        .getAttribute('aria-valuenow'),
    ).toBe('80')
  })

  it('steps with the arrow keys', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Slider
        defaultValue={[40]}
        step={5}
        thumbLabels={['Budget']}
        onValueChange={onValueChange}
      />,
    )
    screen.getByRole('slider', { name: 'Budget' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(onValueChange).toHaveBeenLastCalledWith([45])
  })

  it('jumps to the ends with Home and End', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Slider
        defaultValue={[40]}
        min={10}
        max={90}
        thumbLabels={['Budget']}
        onValueChange={onValueChange}
      />,
    )
    screen.getByRole('slider', { name: 'Budget' }).focus()
    await user.keyboard('{Home}')
    expect(onValueChange).toHaveBeenLastCalledWith([10])
    await user.keyboard('{End}')
    expect(onValueChange).toHaveBeenLastCalledWith([90])
  })

  it('ignores the keyboard while disabled', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Slider
        defaultValue={[40]}
        disabled
        thumbLabels={['Budget']}
        onValueChange={onValueChange}
      />,
    )
    await user.keyboard('{ArrowRight}')
    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('formats the value bubble through the caller formatter', () => {
    render(
      <Slider
        defaultValue={[1200]}
        max={5000}
        showValue
        formatValue={(value) => `£${value}`}
        thumbLabels={['Budget']}
      />,
    )
    expect(screen.getByText('£1200')).not.toBeNull()
  })

  it('draws a tick for every mark', () => {
    const { container } = render(
      <Slider defaultValue={[50]} ticks={[0, 25, 50, 75, 100]} />,
    )
    const ticks = container.querySelectorAll('[aria-hidden="true"] > span')
    expect(ticks).toHaveLength(5)
  })
})
