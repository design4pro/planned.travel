// @vitest-environment jsdom
import './test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '../table'

afterEach(cleanup)

describe('Table', () => {
  it('pins the header only when asked', () => {
    const { container, unmount } = render(
      <Table label="Expenses">
        <TableHeader sticky>
          <TableRow>
            <TableHead>Item</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ryokan</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    expect(container.querySelector('thead')?.className).toContain('sticky')
    unmount()

    const second = render(
      <Table label="Expenses">
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    )
    expect(second.container.querySelector('thead')?.className).not.toContain(
      'sticky',
    )
  })

  it('scrolls sideways inside its own wrapper, never the page', () => {
    const { container } = render(
      <Table label="Expenses">
        <TableBody>
          <TableRow>
            <TableCell>Ryokan</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('overflow-x-auto')
  })

  it('gives numeric cells tabular figures and right alignment', () => {
    render(
      <Table label="Expenses">
        <TableBody>
          <TableRow>
            <TableCell numeric data-testid="amount">
              27,052
            </TableCell>
            <TableCell data-testid="label">Ryokan</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    const amount = screen.getByTestId('amount')
    expect(amount.className).toContain('tabular-nums')
    expect(amount.className).toContain('text-right')
    expect(screen.getByTestId('label').className).toContain('text-left')
  })

  it('reports the sort state through aria-sort and fires on click', async () => {
    const user = userEvent.setup()
    const onSort = vi.fn()
    render(
      <Table label="Expenses">
        <TableHeader>
          <TableRow>
            <TableHead
              sortable
              sortDirection="desc"
              onSort={onSort}
              data-testid="head"
            >
              Amount
            </TableHead>
            <TableHead data-testid="plain">Item</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    )
    expect(screen.getByTestId('head').getAttribute('aria-sort')).toBe(
      'descending',
    )
    expect(screen.getByTestId('plain').getAttribute('aria-sort')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Amount' }))
    expect(onSort).toHaveBeenCalledTimes(1)
  })

  it('says none when a sortable column is unsorted', () => {
    render(
      <Table label="Expenses">
        <TableHeader>
          <TableRow>
            <TableHead sortable data-testid="head">
              Amount
            </TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    )
    expect(screen.getByTestId('head').getAttribute('aria-sort')).toBe('none')
  })

  it('marks a selected row for assistive tech', () => {
    render(
      <Table label="Expenses">
        <TableBody>
          <TableRow selected data-testid="row">
            <TableCell>Ryokan</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    const row = screen.getByTestId('row')
    expect(row.getAttribute('aria-selected')).toBe('true')
    expect(row.className).toContain('bg-brand-subtle')
  })

  it('spans the whole table for an empty message', () => {
    render(
      <Table label="Expenses">
        <TableBody>
          <TableEmpty colSpan={4}>No expenses yet</TableEmpty>
        </TableBody>
      </Table>,
    )
    expect(screen.getByText('No expenses yet').getAttribute('colspan')).toBe(
      '4',
    )
  })
})
