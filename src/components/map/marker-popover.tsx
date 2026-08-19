import * as React from 'react'
import { MapPin, Star } from 'lucide-react'

import { cn } from '#/lib/cn'
import { transitionBase } from '#/components/ui'
import { CategoryIcon } from './category-icon'

/** Stars a rating can carry, matching `places.rating`. */
const MAX_RATING = 5

export interface MarkerPopoverProps extends React.ComponentPropsWithoutRef<'div'> {
  readonly name: string
  /** Category name, colour and glyph, when the place has one. */
  readonly category?: {
    readonly name: string
    readonly colour?: string | null
    readonly icon?: string | null
  } | null
  readonly address?: string | null
  /** 1–5. Rendered as stars with a text equivalent for readers. */
  readonly rating?: number | null
  readonly imageUrl?: string | null
  /** Extra line under the title — "Day 2 · 10:00", a price, a duration. */
  readonly meta?: React.ReactNode
  /** Which edge the pointer sits on. `bottom` means the card floats above the pin. */
  readonly side?: 'top' | 'bottom'
  /**
   * `true` when the same information is already on the trigger's accessible name,
   * which is how `PlaceMarker` uses it: the card becomes purely visual and the
   * reader hears the place once instead of twice.
   */
  readonly decorative?: boolean
}

function Rating({ value }: { readonly value: number }) {
  const rounded = Math.max(0, Math.min(MAX_RATING, Math.round(value)))
  return (
    <span className="flex items-center gap-px" aria-hidden="true">
      {Array.from({ length: MAX_RATING }, (_, index) => (
        <Star
          key={index}
          size={11}
          strokeWidth={2}
          className={
            index < rounded ? 'fill-warning text-warning' : 'text-ink-4'
          }
        />
      ))}
    </span>
  )
}

/**
 * The hover card for a marker.
 *
 * An opaque surface rather than glass, deliberately: this card carries a
 * photograph and two tiers of small type, and a translucent ground over an
 * arbitrary map makes both unreadable. It keeps the product's card language —
 * `--radius-lg`, hairline edge, `--shadow-popover` — and adds a pointer so the
 * eye keeps the connection to the pin it belongs to.
 */
export const MarkerPopover = React.forwardRef<
  HTMLDivElement,
  MarkerPopoverProps
>(
  (
    {
      name,
      category,
      address,
      rating,
      imageUrl,
      meta,
      side = 'bottom',
      decorative = false,
      className,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      aria-hidden={decorative ? true : undefined}
      className={cn(
        'w-60 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-edge bg-surface text-left shadow-popover',
        transitionBase,
        className,
      )}
      {...props}
    >
      {typeof imageUrl === 'string' && imageUrl !== '' ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="aspect-[16/10] w-full border-b border-edge-faint object-cover"
        />
      ) : null}

      <div className="p-3">
        <p className="line-clamp-2 text-label font-semibold text-ink">{name}</p>

        {meta ? <p className="mt-0.5 text-caption text-ink-3">{meta}</p> : null}

        {category || typeof rating === 'number' ? (
          <div className="mt-1.5 flex items-center justify-between gap-2">
            {category ? (
              <span className="flex min-w-0 items-center gap-1.5 text-caption text-ink-3">
                <span
                  className="grid size-4 shrink-0 place-items-center rounded-full"
                  style={{ color: category.colour ?? 'var(--color-brand)' }}
                >
                  <CategoryIcon name={category.icon} size={11} />
                </span>
                <span className="truncate">{category.name}</span>
              </span>
            ) : (
              <span />
            )}
            {typeof rating === 'number' ? (
              <span className="flex shrink-0 items-center gap-1">
                <Rating value={rating} />
                <span className="sr-only">
                  Rated {Math.round(rating)} out of {MAX_RATING}
                </span>
              </span>
            ) : null}
          </div>
        ) : null}

        {typeof address === 'string' && address !== '' ? (
          <p className="mt-2 flex items-start gap-1.5 text-caption text-ink-4">
            <MapPin
              size={12}
              strokeWidth={2}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <span className="line-clamp-2">{address}</span>
          </p>
        ) : null}
      </div>

      <span
        aria-hidden="true"
        className={cn(
          'absolute left-1/2 size-2 -translate-x-1/2 rotate-45 border-edge bg-surface',
          side === 'bottom'
            ? '-bottom-1 border-r border-b'
            : '-top-1 border-t border-l',
        )}
      />
    </div>
  ),
)
MarkerPopover.displayName = 'MarkerPopover'

/**
 * The accessible name for a marker.
 *
 * Everything the hover card shows, folded into one string, so the card itself can
 * be marked decorative and a screen-reader user still hears the category, the
 * address and the rating instead of just "Sensō-ji, button".
 */
export function markerLabel(input: {
  readonly name: string
  readonly categoryName?: string | null
  readonly address?: string | null
  readonly rating?: number | null
  readonly dayNumber?: number | null
  readonly visited?: boolean
}): string {
  const parts: Array<string> = [input.name]
  if (input.categoryName) parts.push(input.categoryName)
  if (typeof input.dayNumber === 'number') parts.push(`day ${input.dayNumber}`)
  if (input.address) parts.push(input.address)
  if (typeof input.rating === 'number') {
    parts.push(`rated ${Math.round(input.rating)} out of ${MAX_RATING}`)
  }
  if (input.visited === true) parts.push('visited')
  return parts.join(', ')
}
