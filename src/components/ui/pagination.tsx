import * as React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'

import { cn } from '#/lib/cn'
import { IconButton } from './icon-button'
import { focusRing, transitionBase, useControllableState } from './shared'

/**
 * Page numbers with ellipses, built so the control's width never changes as the
 * reader moves through the pages: the window around the current page is a fixed
 * size, and a gap always stands in for the pages it hides.
 */
export type PaginationItem = number | 'gap-start' | 'gap-end'

function range(from: number, to: number): Array<number> {
  if (to < from) return []
  return Array.from({ length: to - from + 1 }, (_, index) => from + index)
}

export function paginationRange(options: {
  page: number
  pageCount: number
  siblings?: number
  boundaries?: number
}): Array<PaginationItem> {
  const { page, pageCount, siblings = 1, boundaries = 1 } = options
  const slots = siblings * 2 + 3 + boundaries * 2

  if (slots >= pageCount) return range(1, pageCount)

  const leftSibling = Math.max(page - siblings, boundaries + 1)
  const rightSibling = Math.min(page + siblings, pageCount - boundaries)
  const gapLeft = leftSibling > boundaries + 2
  const gapRight = rightSibling < pageCount - (boundaries + 1)

  if (!gapLeft && gapRight) {
    return [
      ...range(1, siblings * 2 + boundaries + 2),
      'gap-end',
      ...range(pageCount - boundaries + 1, pageCount),
    ]
  }

  if (gapLeft && !gapRight) {
    return [
      ...range(1, boundaries),
      'gap-start',
      ...range(pageCount - (boundaries + 1 + siblings * 2), pageCount),
    ]
  }

  return [
    ...range(1, boundaries),
    'gap-start',
    ...range(leftSibling, rightSibling),
    'gap-end',
    ...range(pageCount - boundaries + 1, pageCount),
  ]
}

export type PaginationProps = Omit<
  React.ComponentPropsWithoutRef<'nav'>,
  'onChange'
> & {
  pageCount: number
  page?: number
  defaultPage?: number
  onPageChange?: (page: number) => void
  /** Pages shown either side of the current one. */
  siblings?: number
  /** Pages pinned at each end. */
  boundaries?: number
  /** Adds the jump-to-first and jump-to-last controls. */
  showEdges?: boolean
  /** "Showing 21–40 of 312" — pass the total to render it. */
  totalItems?: number
  pageSize?: number
  size?: 'sm' | 'md'
  /** Compact mode: "Page 3 of 12" with just the arrows. Good on a phone. */
  compact?: boolean
}

const pageButtonSizes = {
  sm: 'size-8 text-caption',
  md: 'size-9 text-label',
} as const

export const Pagination = React.forwardRef<HTMLElement, PaginationProps>(
  (
    {
      className,
      pageCount,
      page,
      defaultPage = 1,
      onPageChange,
      siblings = 1,
      boundaries = 1,
      showEdges = false,
      totalItems,
      pageSize,
      size = 'md',
      compact = false,
      ...props
    },
    ref,
  ) => {
    const [current, setCurrent] = useControllableState<number>({
      value: page,
      defaultValue: defaultPage,
      onChange: onPageChange,
    })

    const safePageCount = Math.max(pageCount, 1)
    const clamped = Math.min(Math.max(current, 1), safePageCount)
    const goTo = (next: number) =>
      setCurrent(Math.min(Math.max(next, 1), safePageCount))

    const summary =
      totalItems !== undefined && pageSize
        ? `Showing ${Math.min((clamped - 1) * pageSize + 1, totalItems)}–${Math.min(clamped * pageSize, totalItems)} of ${totalItems}`
        : null

    const items = compact
      ? []
      : paginationRange({
          page: clamped,
          pageCount: safePageCount,
          siblings,
          boundaries,
        })

    return (
      <nav
        ref={ref}
        aria-label="Pagination"
        className={cn(
          'flex flex-wrap items-center justify-between gap-3',
          className,
        )}
        {...props}
      >
        {summary ? (
          <p
            className="text-caption tabular-nums text-ink-3"
            aria-live="polite"
          >
            {summary}
          </p>
        ) : null}

        <div className="flex items-center gap-1">
          {showEdges ? (
            <IconButton
              icon={<ChevronsLeft />}
              label="First page"
              size={size === 'sm' ? 'sm' : 'md'}
              variant="ghost"
              disabled={clamped === 1}
              onClick={() => goTo(1)}
            />
          ) : null}

          <IconButton
            icon={<ChevronLeft />}
            label="Previous page"
            size={size === 'sm' ? 'sm' : 'md'}
            variant="ghost"
            disabled={clamped === 1}
            onClick={() => goTo(clamped - 1)}
          />

          {compact ? (
            <span className="px-2 text-label tabular-nums text-ink-2">
              Page <span className="font-semibold text-ink">{clamped}</span> of{' '}
              {safePageCount}
            </span>
          ) : (
            <ol className="flex items-center gap-1">
              {items.map((item, index) =>
                typeof item === 'number' ? (
                  <li key={`page-${item}`}>
                    <button
                      type="button"
                      aria-label={`Page ${item}`}
                      aria-current={item === clamped ? 'page' : undefined}
                      onClick={() => goTo(item)}
                      className={cn(
                        'grid place-items-center rounded-md font-medium tabular-nums',
                        transitionBase,
                        focusRing,
                        pageButtonSizes[size],
                        item === clamped
                          ? 'bg-accent font-semibold text-accent-on shadow-card'
                          : 'text-ink-2 hover:bg-hover hover:text-ink active:bg-active',
                      )}
                    >
                      {item}
                    </button>
                  </li>
                ) : (
                  <li
                    key={`${item}-${index}`}
                    aria-hidden="true"
                    className={cn(
                      'grid place-items-center text-ink-4 select-none',
                      pageButtonSizes[size],
                    )}
                  >
                    …
                  </li>
                ),
              )}
            </ol>
          )}

          <IconButton
            icon={<ChevronRight />}
            label="Next page"
            size={size === 'sm' ? 'sm' : 'md'}
            variant="ghost"
            disabled={clamped === safePageCount}
            onClick={() => goTo(clamped + 1)}
          />

          {showEdges ? (
            <IconButton
              icon={<ChevronsRight />}
              label="Last page"
              size={size === 'sm' ? 'sm' : 'md'}
              variant="ghost"
              disabled={clamped === safePageCount}
              onClick={() => goTo(safePageCount)}
            />
          ) : null}
        </div>
      </nav>
    )
  },
)
Pagination.displayName = 'Pagination'
