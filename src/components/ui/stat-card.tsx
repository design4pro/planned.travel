import * as React from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

import { cn } from '#/lib/cn'
import { Card } from './card'
import { Sparkline } from './sparkline'
import { SectionLabel } from './section-label'

import type { CardProps } from './card'

export type StatTrend = {
  direction: 'up' | 'down' | 'flat'
  /** Already-formatted delta, e.g. `+12%` or `3 days`. */
  value: string
  /** Set when "up" is the bad outcome — spend, delays, cancellations. */
  inverted?: boolean
}

/**
 * The delta glyph, and which of the three mirrors.
 *
 * Both diagonals point the way the series runs, which is the way the reader
 * reads: a rise in Arabic climbs towards the left. `src/styles/styles.css` keeps
 * the whole mirror contract in one place and names `ArrowUpRight` in it for
 * exactly this reason, and flipping only the x axis leaves the up/down meaning —
 * the part that is physical rather than textual — untouched. `Minus` is
 * symmetrical, so it is left out: mirroring it would flip it into itself.
 */
const trendIcon = {
  up: { icon: ArrowUpRight, handed: true },
  down: { icon: ArrowDownRight, handed: true },
  flat: { icon: Minus, handed: false },
} as const

/**
 * A figure and its unit abbreviation, split apart.
 *
 * The display face is drawn for figures and names. Its geometric capitals make a
 * unit abbreviation set at 48px genuinely hard to read — `MB` and `kg` come out
 * as ornament — so a trailing abbreviation is peeled off the value and set in the
 * UI face at the unit's own size instead. Only a short alphabetic run counts, so
 * a currency symbol, a percent sign or a grouped figure is left alone.
 */
const UNIT_SUFFIX = /^(.*?[\d–—\-.,]) ?([A-Za-z]{1,3})$/

function splitUnit(value: React.ReactNode): {
  figure: React.ReactNode
  suffix: string | null
} {
  if (typeof value !== 'string') return { figure: value, suffix: null }
  const match = UNIT_SUFFIX.exec(value.trim())
  if (match === null) return { figure: value, suffix: null }
  return { figure: match[1], suffix: match[2] }
}

export type StatCardProps = Omit<
  CardProps,
  'children' | 'variant' | 'padding'
> & {
  /** The tiny uppercase tracked label above the numeral. */
  label: string
  /** The oversized display numeral. Numbers get `tabular-nums` automatically. */
  value: React.ReactNode
  /** Sits on the numeral's baseline at body size — `days`, `km`, `of 195`. */
  unit?: React.ReactNode
  /** One quiet line under the numeral. */
  caption?: React.ReactNode
  /** Series for the inline trend curve, bottom-right. */
  sparkline?: Array<number>
  /** Directional delta chip, shown beside the label. */
  trend?: StatTrend
  /** Leading glyph in the label row. */
  icon?: React.ReactNode
  /** Anything extra below the caption — flag chips, an avatar stack, a link. */
  footer?: React.ReactNode
  /** `inverse` is the near-black hero tile. One per screen, at most. */
  tone?: 'default' | 'inverse' | 'brand'
  /**
   * Paints the numeral alone in a semantic hue, leaving the card neutral.
   *
   * For a figure whose *sign* is the headline — money you owe against money owed
   * to you — so a reader can tell the two apart before reading either label.
   * Ignored on an `inverse` card, where the semantic hues have no contrast.
   */
  valueTone?: 'default' | 'success' | 'warning' | 'danger'
  /** Rendered instead of the value while the number is still in flight. */
  loading?: boolean
}

const tones = {
  default: {
    card: 'default',
    label: 'text-ink-3',
    value: 'text-ink',
    unit: 'text-ink-3',
    caption: 'text-ink-3',
    spark: 'text-ink-4',
    skeleton: 'bg-surface-inset',
  },
  inverse: {
    card: 'inverse',
    label: 'text-inverse-muted',
    value: 'text-inverse-on',
    unit: 'text-inverse-muted',
    caption: 'text-inverse-muted',
    spark: 'text-inverse-muted',
    skeleton: 'bg-inverse-surface',
  },
  brand: {
    card: 'brand',
    label: 'text-brand',
    value: 'text-ink',
    unit: 'text-ink-3',
    caption: 'text-ink-3',
    spark: 'text-brand',
    skeleton: 'bg-brand/10',
  },
} as const

const valueTones = {
  default: 'text-ink',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
} as const

/**
 * The signature tile: a whisper-quiet tracked label over an oversized display
 * numeral, with an optional inline sparkline and an inverse near-black variant.
 *
 * The numeral is `tabular-nums` and the sparkline is absolutely positioned, so
 * a value ticking from `9` to `10` moves nothing else on the screen.
 */
export const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      className,
      label,
      value,
      unit,
      caption,
      sparkline,
      trend,
      icon,
      footer,
      tone = 'default',
      valueTone = 'default',
      loading = false,
      ...props
    },
    ref,
  ) => {
    const t = tones[tone]
    const valueColour =
      tone === 'inverse' || valueTone === 'default'
        ? t.value
        : valueTones[valueTone]
    const { figure, suffix } = splitUnit(value)
    const trendGlyph = trend ? trendIcon[trend.direction] : null
    const TrendIcon = trendGlyph?.icon ?? null
    const good = trend
      ? trend.direction === 'flat'
        ? 'flat'
        : (trend.direction === 'up') !== (trend.inverted ?? false)
          ? 'good'
          : 'bad'
      : null

    return (
      <Card
        ref={ref}
        variant={t.card}
        padding="none"
        // The floor exists so a lone tile still reads as a tile next to a
        // stretched one. On a phone the tiles stack, each sizes itself, and the
        // desktop floor was buying nothing but a 50px hole under every numeral.
        className={cn(
          'flex min-h-28 flex-col gap-2.5 p-5 sm:min-h-36',
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-3">
          <SectionLabel icon={icon} className={t.label}>
            {label}
          </SectionLabel>
          {trend && TrendIcon ? (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-caption font-semibold tabular-nums',
                good === 'good' && 'bg-success-soft text-success',
                good === 'bad' && 'bg-danger-soft text-danger',
                good === 'flat' && 'bg-surface-2 text-ink-3',
                tone === 'inverse' && 'bg-inverse-surface text-inverse-on',
              )}
            >
              <TrendIcon
                size={12}
                aria-hidden="true"
                data-mirror-rtl={trendGlyph?.handed ? '' : undefined}
              />
              <span data-numeric="">{trend.value}</span>
            </span>
          ) : null}
        </div>

        <div>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            {loading ? (
              <span
                className={cn(
                  'h-11 w-24 animate-pulse-soft rounded-md',
                  t.skeleton,
                )}
                aria-hidden="true"
              />
            ) : (
              <span
                className={cn(
                  'min-w-0 font-display text-display tabular-nums tracking-tighter',
                  valueColour,
                )}
                data-numeric=""
              >
                {figure}
              </span>
            )}
            {suffix !== null && !loading ? (
              <span className={cn('text-subtitle font-medium', t.unit)}>
                {suffix}
              </span>
            ) : null}
            {unit && !loading ? (
              <span
                className={cn('text-subtitle font-medium tabular-nums', t.unit)}
              >
                {unit}
              </span>
            ) : null}
          </div>
        </div>

        {/* Label and numeral read as one block; the quiet lines sit on the
            card's floor. Distributing the slack evenly instead left a 44px
            hole under the numeral and made the tile read timid.

            The curve shares that floor rather than the numeral's line. Beside
            the numeral it had to be given a fixed 80px gutter, and a money
            figure that filled the remaining width — `¥2,221,470` at the display
            size does — then ran straight into the curve with no gap at all. On
            the floor the numeral keeps the whole card width, the curve keeps its
            full length, and neither can ever reach the other. */}
        {caption || (sparkline && sparkline.length > 1 && !loading) ? (
          <div className="mt-auto flex items-end justify-between gap-3 pt-2">
            <p className={cn('min-w-0 text-caption', t.caption)}>{caption}</p>
            {sparkline && sparkline.length > 1 && !loading ? (
              <Sparkline
                data={sparkline}
                width={80}
                height={26}
                area
                showEndDot
                className={cn('shrink-0', t.spark)}
              />
            ) : null}
          </div>
        ) : null}
        {footer ? (
          <div className={cn('flex items-center gap-2', !caption && 'mt-auto')}>
            {footer}
          </div>
        ) : null}
      </Card>
    )
  },
)
StatCard.displayName = 'StatCard'
