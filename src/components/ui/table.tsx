import * as React from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

import { cn } from '#/lib/cn'
import { focusRing, transitionBase } from './shared'

export type TableProps = React.ComponentPropsWithoutRef<'table'> & {
  /** Class for the scrolling wrapper rather than the `<table>`. */
  containerClassName?: string
  /** Locks column widths so a long cell truncates instead of stretching. */
  fixed?: boolean
  /** Accessible summary, rendered visually hidden unless `TableCaption` is used. */
  label?: string
}

/**
 * The scroll container and the table in one. Horizontal overflow is owned by
 * the wrapper, which is what lets a wide expense table scroll inside a card
 * without the page ever scrolling sideways.
 */
export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, fixed = false, label, ...props }, ref) => (
    <div
      className={cn(
        'relative w-full overflow-x-auto overscroll-x-contain',
        containerClassName,
      )}
    >
      <table
        ref={ref}
        aria-label={label}
        className={cn(
          'w-full border-collapse text-start text-label',
          fixed && 'table-fixed',
          className,
        )}
        {...props}
      />
    </div>
  ),
)
Table.displayName = 'Table'

export type TableHeaderProps = React.ComponentPropsWithoutRef<'thead'> & {
  /** Pins the header while the body scrolls under it. */
  sticky?: boolean
}

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  TableHeaderProps
>(({ className, sticky = false, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      '[&_tr]:border-b [&_tr]:border-edge',
      // The header keeps its own opaque ground so rows never show through it.
      sticky && 'sticky top-0 z-1 bg-surface [&_th]:bg-surface',
      className,
    )}
    {...props}
  />
))
TableHeader.displayName = 'TableHeader'

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentPropsWithoutRef<'tbody'>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn(
      '[&_tr:not(:last-child)]:border-b [&_tr]:border-edge-faint',
      className,
    )}
    {...props}
  />
))
TableBody.displayName = 'TableBody'

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentPropsWithoutRef<'tfoot'>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t border-edge bg-surface-2 font-semibold text-ink',
      className,
    )}
    {...props}
  />
))
TableFooter.displayName = 'TableFooter'

export type TableRowProps = React.ComponentPropsWithoutRef<'tr'> & {
  /** The selected wash. Pair it with a checkbox in the first cell. */
  selected?: boolean
  /** Adds the hover wash and a pointer — for a row that opens something. */
  interactive?: boolean
}

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, selected = false, interactive = false, ...props }, ref) => (
    <tr
      ref={ref}
      data-selected={selected ? '' : undefined}
      aria-selected={selected || undefined}
      className={cn(
        transitionBase,
        selected ? 'bg-brand-subtle' : interactive && 'hover:bg-hover',
        interactive && 'cursor-pointer',
        interactive && focusRing,
        className,
      )}
      {...props}
    />
  ),
)
TableRow.displayName = 'TableRow'

const alignments = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
} as const

export type SortDirection = 'asc' | 'desc' | null

export type TableHeadProps = Omit<
  React.ComponentPropsWithoutRef<'th'>,
  'align'
> & {
  align?: keyof typeof alignments
  /** Numbers get right alignment and tabular figures, always. */
  numeric?: boolean
  /** Turns the label into a sort button and sets `aria-sort` on the cell. */
  sortable?: boolean
  sortDirection?: SortDirection
  onSort?: () => void
}

export const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  (
    {
      className,
      align,
      numeric = false,
      sortable = false,
      sortDirection = null,
      onSort,
      children,
      ...props
    },
    ref,
  ) => {
    const resolvedAlign = align ?? (numeric ? 'end' : 'start')
    const SortIcon =
      sortDirection === 'asc'
        ? ArrowUp
        : sortDirection === 'desc'
          ? ArrowDown
          : ChevronsUpDown

    return (
      <th
        ref={ref}
        scope="col"
        aria-sort={
          sortable
            ? sortDirection === 'asc'
              ? 'ascending'
              : sortDirection === 'desc'
                ? 'descending'
                : 'none'
            : undefined
        }
        className={cn(
          'px-3 py-2.5 text-micro font-semibold uppercase tracking-label whitespace-nowrap text-ink-3',
          alignments[resolvedAlign],
          numeric && 'tabular-nums',
          className,
        )}
        {...props}
      >
        {sortable ? (
          <button
            type="button"
            onClick={onSort}
            className={cn(
              'group inline-flex items-center gap-1 rounded-sm uppercase',
              transitionBase,
              focusRing,
              'hover:text-ink',
              resolvedAlign === 'end' && 'flex-row-reverse',
            )}
          >
            {children}
            <SortIcon
              size={12}
              aria-hidden="true"
              className={cn(
                'shrink-0',
                sortDirection
                  ? 'text-ink'
                  : // Revealed on hover, which is the whole affordance — and a
                    // touch reader has no hover, so on a coarse pointer the
                    // column had no visible sign it could be sorted at all
                    // until someone tapped it and watched the rows move.
                    // `pointer-coarse` shows it at rest there instead; the
                    // pointer query is the honest test, because a laptop with a
                    // touchscreen is both and a width is neither.
                    'text-ink-4 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100',
              )}
            />
          </button>
        ) : (
          children
        )}
      </th>
    )
  },
)
TableHead.displayName = 'TableHead'

export type TableCellProps = Omit<
  React.ComponentPropsWithoutRef<'td'>,
  'align'
> & {
  align?: keyof typeof alignments
  /** Right-aligned, `tabular-nums`, and never wrapping. */
  numeric?: boolean
  /** Quiet secondary text — a timestamp, a category, a note. */
  muted?: boolean
  /** Truncates instead of wrapping. Needs `fixed` on the table to bite. */
  truncate?: boolean
}

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  (
    {
      className,
      align,
      numeric = false,
      muted = false,
      truncate = false,
      ...props
    },
    ref,
  ) => {
    const resolvedAlign = align ?? (numeric ? 'end' : 'start')
    return (
      <td
        ref={ref}
        className={cn(
          'px-3 py-3 align-middle',
          alignments[resolvedAlign],
          numeric
            ? 'font-medium tabular-nums whitespace-nowrap text-ink'
            : 'text-ink-2',
          muted && 'text-ink-3',
          truncate && 'max-w-0 truncate',
          className,
        )}
        {...props}
      />
    )
  },
)
TableCell.displayName = 'TableCell'

export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.ComponentPropsWithoutRef<'caption'>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mb-2 text-caption text-ink-3', className)}
    {...props}
  />
))
TableCaption.displayName = 'TableCaption'

export type TableEmptyProps = React.ComponentPropsWithoutRef<'td'> & {
  /** Must match the table's column count so the message spans the full width. */
  colSpan: number
}

/** A full-width row for "nothing here" — never an empty `<tbody>`. */
export const TableEmpty = React.forwardRef<
  HTMLTableCellElement,
  TableEmptyProps
>(({ className, colSpan, children, ...props }, ref) => (
  <tr>
    <td
      ref={ref}
      colSpan={colSpan}
      className={cn('px-3 py-10 text-center text-label text-ink-3', className)}
      {...props}
    >
      {children}
    </td>
  </tr>
))
TableEmpty.displayName = 'TableEmpty'
