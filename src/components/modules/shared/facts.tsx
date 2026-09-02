/**
 * Stored values, set as data.
 *
 * A booking's date and a leg's booking reference are *facts*, not form state. The
 * obvious way to lay them out — a tiny label over a filled, rounded, grey
 * rectangle — is exactly what a disabled text input looks like, so a card built
 * that way reads as a form nobody is allowed to fill in. Every fact here is
 * typeset instead: a whisper-quiet tracked label with the value in the card's own
 * ink on the card's own ground, separated from its neighbours by a hairline
 * rather than by a box.
 *
 * A `<dl>`, so a screen reader hears the pairing.
 */
import * as React from 'react'

import { cn } from '#/lib/cn'

export interface FactItem {
  readonly label: string
  readonly value: React.ReactNode
  /**
   * Booking references, seat numbers and confirmation codes are read back at a
   * desk one character at a time, so they get the mono face and wide tracking.
   */
  readonly mono?: boolean
  /** Pins the value to the far end of the row in the inline layout. */
  readonly wide?: boolean
}

export interface FactListProps {
  readonly items: ReadonlyArray<FactItem>
  /**
   * `columns` typesets label-over-value in a grid — the layout a card with four
   * or more facts wants. `rows` puts them on hairline-separated lines with the
   * label on the left, which reads better for two or three.
   */
  readonly layout?: 'columns' | 'rows'
  readonly columns?: 2 | 3 | 4
  readonly className?: string
}

function FactValue({ item }: { item: FactItem }) {
  return (
    <span
      className={cn(
        'text-ink',
        item.mono
          ? 'font-mono text-caption tracking-wide tabular-nums uppercase'
          : 'text-label font-medium tabular-nums',
      )}
    >
      {item.value}
    </span>
  )
}

export function FactList({
  items,
  layout = 'columns',
  columns = 3,
  className,
}: FactListProps) {
  const visible = items.filter((item) => item.value !== null)
  if (visible.length === 0) {
    return null
  }

  if (layout === 'rows') {
    return (
      <dl className={cn('flex flex-col', className)}>
        {visible.map((item) => (
          <div
            key={item.label}
            className="flex min-w-0 items-baseline justify-between gap-4 py-2 not-last:border-b not-last:border-edge-faint"
          >
            <dt className="shrink-0 text-micro font-semibold tracking-label text-ink-4 uppercase">
              {item.label}
            </dt>
            <dd className="min-w-0 truncate text-end">
              <FactValue item={item} />
            </dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-4',
        columns === 2 && 'grid-cols-2',
        columns === 3 && 'grid-cols-2 sm:grid-cols-3',
        columns === 4 && 'grid-cols-2 sm:grid-cols-4',
        className,
      )}
    >
      {visible.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="mb-1 truncate text-micro font-semibold tracking-label text-ink-4 uppercase">
            {item.label}
          </dt>
          <dd className="min-w-0 truncate">
            <FactValue item={item} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * A longer piece of prose stored against a row — a note, a description.
 *
 * Set as a quotation with a brand rule rather than in a filled box, for the same
 * reason: a paragraph in a grey rectangle looks like a textarea.
 */
export function FactNote({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0 border-s-2 border-brand/30 ps-3', className)}>
      <p className="mb-0.5 text-micro font-semibold tracking-label text-ink-4 uppercase">
        {label}
      </p>
      <p className="text-caption leading-relaxed text-ink-2">{children}</p>
    </div>
  )
}
