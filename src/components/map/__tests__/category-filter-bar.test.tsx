// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CategoryFilterBar } from '../category-filter-bar'

import type { MapCategory } from '../types'

const CATEGORIES: ReadonlyArray<MapCategory> = [
  {
    id: 'c1',
    name: 'Landmarks',
    slug: 'landmarks',
    colour: '#256256',
    icon: 'landmark',
  },
  {
    id: 'c2',
    name: 'Food and drink',
    slug: 'food',
    colour: '#8a5305',
    icon: 'utensils',
  },
  {
    id: 'c3',
    name: 'Stays',
    slug: 'stays',
    colour: '#1d4fd8',
    icon: 'bed-double',
  },
]

describe('CategoryFilterBar', () => {
  it('is a toolbar of real toggle buttons', () => {
    render(
      <CategoryFilterBar
        categories={CATEGORIES}
        selected={[]}
        onChange={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('toolbar', { name: 'Filter places by category' }),
    ).toBeDefined()
    for (const category of CATEGORIES) {
      const button = screen.getByRole('button', { name: category.name })
      expect(button.getAttribute('aria-pressed')).toBe('false')
    }
  })

  it('treats an empty selection as "everything"', () => {
    render(
      <CategoryFilterBar
        categories={CATEGORIES}
        selected={[]}
        onChange={vi.fn()}
        total={10}
      />,
    )
    const all = screen.getByRole('button', { name: /All/ })
    expect(all.getAttribute('aria-pressed')).toBe('true')
    expect(all.textContent).toContain('10')
  })

  it('adds a category to the selection', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <CategoryFilterBar
        categories={CATEGORIES}
        selected={[]}
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Stays' }))
    expect(onChange).toHaveBeenCalledWith(['c3'])
  })

  it('removes a category that was already selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <CategoryFilterBar
        categories={CATEGORIES}
        selected={['c1', 'c2']}
        onChange={onChange}
      />,
    )
    const selected = screen.getByRole('button', { name: 'Landmarks' })
    expect(selected.getAttribute('aria-pressed')).toBe('true')
    await user.click(selected)
    expect(onChange).toHaveBeenCalledWith(['c2'])
  })

  it('clears the filter from the All chip', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <CategoryFilterBar
        categories={CATEGORIES}
        selected={['c1']}
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: /All/ }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('is a single tab stop, as a toolbar must be', () => {
    render(
      <CategoryFilterBar
        categories={CATEGORIES}
        selected={[]}
        onChange={vi.fn()}
      />,
    )
    const tabbable = screen
      .getAllByRole('button')
      .filter((button) => button.getAttribute('tabindex') !== '-1')
    expect(tabbable).toHaveLength(1)
  })

  it('moves focus between categories with the arrow keys', () => {
    render(
      <CategoryFilterBar
        categories={CATEGORIES}
        selected={[]}
        onChange={vi.fn()}
      />,
    )
    const toolbar = screen.getByRole('toolbar')

    fireEvent.keyDown(toolbar, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Landmarks' }),
    )

    fireEvent.keyDown(toolbar, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Food and drink' }),
    )

    fireEvent.keyDown(toolbar, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Landmarks' }),
    )
  })

  it('jumps to the ends with Home and End', () => {
    render(
      <CategoryFilterBar
        categories={CATEGORIES}
        selected={[]}
        onChange={vi.fn()}
      />,
    )
    const toolbar = screen.getByRole('toolbar')

    fireEvent.keyDown(toolbar, { key: 'End' })
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Stays' }),
    )

    fireEvent.keyDown(toolbar, { key: 'Home' })
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /All/ }),
    )
  })

  it('wraps around from the last item', () => {
    render(
      <CategoryFilterBar
        categories={CATEGORIES}
        selected={[]}
        onChange={vi.fn()}
      />,
    )
    const toolbar = screen.getByRole('toolbar')
    fireEvent.keyDown(toolbar, { key: 'End' })
    fireEvent.keyDown(toolbar, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /All/ }),
    )
  })

  it('renders nothing at all when the workspace has no taxonomy yet', () => {
    const { container } = render(
      <CategoryFilterBar categories={[]} selected={[]} onChange={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })
})
