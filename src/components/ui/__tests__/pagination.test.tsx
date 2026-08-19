// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Pagination, paginationRange } from '../pagination'

afterEach(cleanup)

const isDisabled = (name: string) =>
  screen.getByRole<HTMLButtonElement>('button', { name }).disabled

describe('paginationRange', () => {
  it('lists every page while they all fit', () => {
    expect(paginationRange({ page: 1, pageCount: 5 })).toEqual([1, 2, 3, 4, 5])
  })

  it('keeps a constant number of slots as the page moves', () => {
    const widths = [1, 2, 5, 8, 10].map(
      (page) => paginationRange({ page, pageCount: 10 }).length,
    )
    expect(new Set(widths).size).toBe(1)
  })

  it('gaps only on the right near the start', () => {
    expect(paginationRange({ page: 1, pageCount: 10 })).toEqual([
      1,
      2,
      3,
      4,
      5,
      'gap-end',
      10,
    ])
  })

  it('gaps on both sides in the middle', () => {
    expect(paginationRange({ page: 5, pageCount: 10 })).toEqual([
      1,
      'gap-start',
      4,
      5,
      6,
      'gap-end',
      10,
    ])
  })

  it('gaps only on the left near the end', () => {
    expect(paginationRange({ page: 10, pageCount: 10 })).toEqual([
      1,
      'gap-start',
      6,
      7,
      8,
      9,
      10,
    ])
  })
})

describe('Pagination', () => {
  it('marks the current page and disables the backward controls on page one', () => {
    render(<Pagination pageCount={10} defaultPage={1} showEdges />)
    expect(
      screen
        .getByRole('button', { name: 'Page 1' })
        .getAttribute('aria-current'),
    ).toBe('page')
    expect(isDisabled('Previous page')).toBe(true)
    expect(isDisabled('First page')).toBe(true)
  })

  it('moves itself when uncontrolled', async () => {
    const user = userEvent.setup()
    render(<Pagination pageCount={10} defaultPage={1} />)
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(
      screen
        .getByRole('button', { name: 'Page 2' })
        .getAttribute('aria-current'),
    ).toBe('page')
  })

  it('only reports when controlled', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<Pagination pageCount={10} page={3} onPageChange={onPageChange} />)
    await user.click(screen.getByRole('button', { name: 'Page 4' }))
    expect(onPageChange).toHaveBeenCalledWith(4)
    expect(
      screen
        .getByRole('button', { name: 'Page 3' })
        .getAttribute('aria-current'),
    ).toBe('page')
  })

  it('never walks past the last page', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <Pagination pageCount={3} defaultPage={3} onPageChange={onPageChange} />,
    )
    expect(isDisabled('Next page')).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('spells out the visible slice', () => {
    render(
      <Pagination
        pageCount={16}
        defaultPage={2}
        totalItems={312}
        pageSize={20}
      />,
    )
    expect(screen.getByText('Showing 21–40 of 312')).not.toBeNull()
  })

  it('collapses to a page counter in compact mode', () => {
    render(<Pagination pageCount={12} defaultPage={3} compact />)
    expect(screen.queryByRole('button', { name: 'Page 3' })).toBeNull()
    expect(screen.getByText(/of 12/)).not.toBeNull()
  })
})
