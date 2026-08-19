// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Input } from '../input'

afterEach(cleanup)

describe('Input', () => {
  it('applies the size variant', () => {
    render(<Input size="lg" aria-label="Search" />)
    expect(screen.getByLabelText('Search').className).toContain('h-12')
  })

  it('reserves room for a leading affix', () => {
    render(<Input leading={<span>@</span>} aria-label="Handle" />)
    expect(screen.getByLabelText('Handle').className).toContain('pl-9')
  })

  it('shows the clear button only once there is a value, uncontrolled', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(
      <Input aria-label="Search" onClear={onClear} clearLabel="Clear search" />,
    )

    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
    await user.type(screen.getByLabelText('Search'), 'kyoto')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('tracks emptiness from the value prop when controlled', () => {
    const { rerender } = render(
      <Input aria-label="Search" value="kyoto" onClear={() => {}} />,
    )
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeNull()
    rerender(<Input aria-label="Search" value="" onClear={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('marks itself busy while loading and hides the clear affordance', () => {
    render(
      <Input aria-label="Search" loading value="kyoto" onClear={() => {}} />,
    )
    expect(screen.getByLabelText('Search').getAttribute('aria-busy')).toBe(
      'true',
    )
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('never offers a clear button while disabled', () => {
    render(
      <Input aria-label="Search" disabled value="kyoto" onClear={() => {}} />,
    )
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('still calls the caller onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Input aria-label="Search" onChange={onChange} />)
    await user.type(screen.getByLabelText('Search'), 'ab')
    expect(onChange).toHaveBeenCalledTimes(2)
  })
})
