import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { Wordmark } from '../brand'

afterEach(cleanup)

describe('Wordmark — the suffix', () => {
  it('shows the .travel tail at every width by default', () => {
    render(<Wordmark showSuffix />)
    expect(screen.getByText('.travel').className).not.toContain('hidden')
  })

  it('gives way to the brand dot below sm when asked, so a crowded header keeps its targets', () => {
    const { container } = render(<Wordmark showSuffix suffixFromSm />)
    expect(screen.getByText('.travel').className).toContain('max-sm:hidden')
    const dot = container.querySelector('.text-brand')
    expect(dot?.textContent).toBe('.')
    expect(dot?.className).toContain('sm:hidden')
  })

  it('draws no extra dot without the option', () => {
    const { container } = render(<Wordmark showSuffix />)
    expect(container.querySelector('.text-brand')).toBeNull()
  })
})
