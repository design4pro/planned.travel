import * as React from 'react'
import { Check } from 'lucide-react'
import { cva } from 'class-variance-authority'

import { cn } from '#/lib/cn'
import { focusRing, transitionBase } from '#/components/ui'
import { CategoryIcon } from './category-icon'

import type { VariantProps } from 'class-variance-authority'

/**
 * Map pins.
 *
 * The reference product draws flat dark discs. These keep that structural
 * language — a circle on the map, a numeral inside it — and add the three things
 * that make a pin read as part of *this* product: a hairline ring in the page's
 * surface colour so the pin survives being dropped on water, dark green forest or
 * a photograph; a token-driven press and focus state identical to every other
 * control; and a tenant's own category colour carried in as a CSS variable rather
 * than baked into a class.
 */

/** A category colour arrives as data, so it travels as a custom property. */
type PinVars = React.CSSProperties & Record<'--pin-accent', string>

function pinVars(colour: string | null | undefined): PinVars {
  return { '--pin-accent': colour ?? 'var(--color-brand)' }
}

const shell = [
  'relative grid shrink-0 place-items-center rounded-full',
  'shadow-elevated select-none',
  transitionBase,
  focusRing,
  '[&_svg]:pointer-events-none [&_svg]:shrink-0',
]

export type PinSize = 'sm' | 'md' | 'lg'

interface PinShellProps extends Omit<
  React.ComponentPropsWithoutRef<'button'>,
  'children' | 'className' | 'style' | 'type'
> {
  /**
   * `false` renders a labelled `<span role="img">` instead of a button — for a
   * static thumbnail map, where a pin per place would add a tab stop per place.
   * Button-only props are ignored in that mode.
   */
  readonly interactive: boolean
  readonly label: string
  readonly className?: string
  readonly style?: React.CSSProperties
  readonly children: React.ReactNode
}

const PinShell = React.forwardRef<HTMLButtonElement, PinShellProps>(
  ({ interactive, label, className, style, children, ...props }, ref) => {
    if (!interactive) {
      return (
        <span role="img" aria-label={label} className={className} style={style}>
          {children}
        </span>
      )
    }
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className={className}
        style={style}
        {...props}
      >
        {children}
      </button>
    )
  },
)
PinShell.displayName = 'PinShell'

/* -------------------------------------------------------------------------------------------------
 * Day pin
 * ---------------------------------------------------------------------------------------------- */

const dayPinVariants = cva(shell, {
  variants: {
    size: {
      sm: 'size-6 text-micro',
      md: 'size-7 text-caption',
      lg: 'size-8 text-label',
    },
    active: {
      true: 'bg-brand text-brand-on ring-2 ring-surface',
      false:
        'bg-accent text-accent-on ring-2 ring-surface hover:bg-accent-hover',
    },
  },
  defaultVariants: { size: 'md', active: false },
})

export interface DayPinProps
  extends
    Omit<PinShellProps, 'children' | 'label' | 'interactive'>,
    VariantProps<typeof dayPinVariants> {
  /** 1-based itinerary day. */
  readonly day: number
  /** Overrides the default `Day n` accessible name. */
  readonly label?: string
  readonly interactive?: boolean
}

/**
 * The numbered itinerary pin: which day of the trip this stop belongs to.
 *
 * Set in the display face with tabular numerals, so `1` and `11` occupy the same
 * optical weight and a column of pins never looks ragged.
 */
export const DayPin = React.forwardRef<HTMLButtonElement, DayPinProps>(
  (
    { day, size, active, label, interactive = true, className, ...props },
    ref,
  ) => (
    <PinShell
      ref={ref}
      interactive={interactive}
      label={label ?? `Day ${day}`}
      className={cn(
        dayPinVariants({ size, active }),
        'font-display font-bold tabular-nums leading-none',
        interactive && 'hover:scale-105 active:scale-100',
        className,
      )}
      {...props}
    >
      <span aria-hidden="true">{day}</span>
    </PinShell>
  ),
)
DayPin.displayName = 'DayPin'

/* -------------------------------------------------------------------------------------------------
 * Place pin
 * ---------------------------------------------------------------------------------------------- */

const placePinVariants = cva([...shell, 'overflow-visible'], {
  variants: {
    size: {
      sm: 'size-7',
      md: 'size-9',
      lg: 'size-11',
    },
    selected: {
      true: 'scale-110 ring-4 ring-accent',
      false: 'ring-2 ring-(--pin-accent) hover:scale-105 active:scale-100',
    },
  },
  defaultVariants: { size: 'md', selected: false },
})

const glyphSizes: Readonly<Record<PinSize, number>> = { sm: 12, md: 15, lg: 18 }

export interface PlacePinProps
  extends
    Omit<PinShellProps, 'children' | 'label' | 'interactive'>,
    VariantProps<typeof placePinVariants> {
  readonly name: string
  /** Thumbnail. Falls back to the category glyph when absent or broken. */
  readonly imageUrl?: string | null
  /** `categories.icon` — the kebab-case `lucide-react` name. */
  readonly icon?: string | null
  /** `categories.colour`. Drives the ring. */
  readonly colour?: string | null
  /** Adds the day numeral badge. */
  readonly dayNumber?: number | null
  readonly visited?: boolean
  /** Full accessible name. Defaults to the place name. */
  readonly label?: string
  readonly interactive?: boolean
}

/**
 * A place on the map: its photograph if it has one, its category glyph if not,
 * ringed in the category's colour, badged with its itinerary day.
 */
export const PlacePin = React.forwardRef<HTMLButtonElement, PlacePinProps>(
  (
    {
      name,
      imageUrl,
      icon,
      colour,
      dayNumber,
      visited = false,
      selected,
      size = 'md',
      label,
      interactive = true,
      className,
      style,
      ...props
    },
    ref,
  ) => {
    const [imageFailed, setImageFailed] = React.useState(false)
    const showImage =
      typeof imageUrl === 'string' && imageUrl !== '' && !imageFailed
    // `cva` variant props are nullable, so the default parameter is not enough.
    const glyphSize = glyphSizes[size ?? 'md']

    return (
      <PinShell
        ref={ref}
        interactive={interactive}
        label={label ?? name}
        className={cn(placePinVariants({ size, selected }), className)}
        style={{ ...pinVars(colour), ...style }}
        {...props}
      >
        <span className="grid size-full place-items-center overflow-hidden rounded-full bg-surface text-ink-2">
          {showImage ? (
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <CategoryIcon name={icon} size={glyphSize} />
          )}
        </span>

        {typeof dayNumber === 'number' ? (
          <span
            aria-hidden="true"
            className={cn(
              'absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full',
              'bg-accent px-1 text-micro font-bold text-accent-on tabular-nums ring-2 ring-surface',
            )}
          >
            {dayNumber}
          </span>
        ) : null}

        {visited ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-success text-success-on ring-2 ring-surface"
          >
            <Check size={9} strokeWidth={3.5} />
          </span>
        ) : null}
      </PinShell>
    )
  },
)
PlacePin.displayName = 'PlacePin'

/* -------------------------------------------------------------------------------------------------
 * Cluster pin
 * ---------------------------------------------------------------------------------------------- */

const clusterPinVariants = cva(
  [
    ...shell,
    'bg-accent text-accent-on ring-2 ring-surface font-display font-bold tabular-nums',
  ],
  {
    variants: {
      weight: {
        sm: 'size-8 text-caption',
        md: 'size-10 text-label',
        lg: 'size-12 text-subtitle',
      },
    },
    defaultVariants: { weight: 'sm' },
  },
)

export interface ClusterPinProps
  extends
    Omit<PinShellProps, 'children' | 'label' | 'interactive'>,
    VariantProps<typeof clusterPinVariants> {
  readonly count: number
  /** Overrides the default `n places` accessible name. */
  readonly label?: string
  readonly interactive?: boolean
}

/**
 * The merged-marker badge.
 *
 * The soft outer disc is the tell that a cluster is *many* things — it reads as
 * the stack of pins underneath rather than as a thicker border, and it is the one
 * detail that stops a cluster being mistaken for a single very important place.
 */
export const ClusterPin = React.forwardRef<HTMLButtonElement, ClusterPinProps>(
  ({ count, weight, label, interactive = true, className, ...props }, ref) => (
    <PinShell
      ref={ref}
      interactive={interactive}
      label={label ?? `${count} places — zoom in to separate them`}
      className={cn(
        clusterPinVariants({ weight }),
        interactive && 'hover:scale-105 active:scale-100',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-1.5 rounded-full bg-accent/12"
      />
      <span className="relative leading-none" aria-hidden="true">
        {count}
      </span>
    </PinShell>
  ),
)
ClusterPin.displayName = 'ClusterPin'
