/**
 * Where the money went, as a ring and the list that explains it.
 *
 * Presentation only: it takes finished rows and a currency, converts nothing and
 * fetches nothing. The caller owns the order - the ring keeps the rows exactly as
 * given, so a segment never moves when a total changes - and the colour, which is an
 * opaque CSS value here so the palette can change without touching this file.
 *
 * The ring is a picture and is hidden from assistive technology; the legend is its
 * text alternative, so no figure exists only in the drawing. A segment answers a mouse
 * hover but takes no focus and no press, and there is no tooltip: a thin arc is not a
 * reliable pointer target, so the legend row is the control.
 *
 * A legend row with spend is a button that pins its segment, and the ring and the
 * legend highlight each other: a mouse over a row or a segment, or keyboard focus on a
 * row, dims every other segment. Touch has no hover, so the press is its path.
 */
import { Fragment, useState } from 'react'

import { cn } from '#/lib/cn'
import { formatMoney } from '#/lib/money'
import { useLocale, useTranslate } from '#/lib/i18n'
import {
  allocatePercents,
  formatSharePercent,
  ringGeometry,
  ringPath,
} from './chart-geometry'

import type { FocusEvent, PointerEvent } from 'react'
import type { Locale } from '#/lib/i18n'

export interface DonutRow {
  /** The category; also what the legend link (highlight and pin) refers to. */
  readonly key: string
  /** The caller's category label. */
  readonly label: string
  /** Integer minor units. */
  readonly spentMinor: number
  /** Integer minor units, 0 when there is no budget line. */
  readonly plannedMinor: number
  /** An opaque CSS colour value, e.g. `var(--color-brand)`. */
  readonly colour: string
}

export interface CategoryDonutProps {
  readonly rows: ReadonlyArray<DonutRow>
  readonly currency: string
}

const CENTRE = 50
const OUTER_RADIUS = 48
const INNER_RADIUS = 31

function hasSpend(row: DonutRow): boolean {
  return Number.isFinite(row.spentMinor) && row.spentMinor > 0
}

function hasPlan(row: DonutRow): boolean {
  return Number.isFinite(row.plannedMinor) && row.plannedMinor > 0
}

/** What links a legend row and its segment; the key is a `DonutRow` key. */
interface LegendLink {
  /** The segment shown, or null when every segment is at rest. */
  readonly highlighted: string | null
  readonly pinned: string | null
  readonly onHover: (key: string | null) => void
  readonly onFocus: (key: string | null) => void
  readonly onPress: (key: string) => void
}

/**
 * A pin, a hover and a focus each name a category; one that no longer has spend is
 * dropped in the same render, so the ring never dims every segment for a segment that
 * is gone and the category does not come back pinned.
 */
function useLegendLink(liveKeys: ReadonlySet<string>): LegendLink {
  const [pinned, setPinned] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)

  const keep = (key: string | null) =>
    key !== null && liveKeys.has(key) ? key : null
  if (keep(pinned) !== pinned) setPinned(null)
  if (keep(hovered) !== hovered) setHovered(null)
  if (keep(focused) !== focused) setFocused(null)

  return {
    // A transient hover or focus shows its own segment while a pin is held.
    highlighted: keep(hovered) ?? keep(focused) ?? keep(pinned),
    pinned: keep(pinned),
    onHover: setHovered,
    onFocus: setFocused,
    onPress: (key) => setPinned((current) => (current === key ? null : key)),
  }
}

export function CategoryDonut({ rows, currency }: CategoryDonutProps) {
  const t = useTranslate()
  const spending = rows.filter(hasSpend)
  const plannedOnly = rows.filter((row) => !hasSpend(row) && hasPlan(row))
  const link = useLegendLink(new Set(spending.map((row) => row.key)))

  if (spending.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-lg bg-surface-2 px-4 py-5 text-caption text-ink-3">
          {t(
            plannedOnly.length === 0
              ? 'costs.categories.empty'
              : 'costs.categories.nothingSpent',
          )}
        </p>
        <Legend
          spending={[]}
          plannedOnly={plannedOnly}
          currency={currency}
          link={link}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Ring rows={spending} link={link} />
      <Legend
        spending={spending}
        plannedOnly={plannedOnly}
        currency={currency}
        link={link}
      />
    </div>
  )
}

/** Only a mouse hovers: touch and pen have no hover, so they leave nothing stuck. */
function onMouse(handler: () => void) {
  return (event: PointerEvent) => {
    if (event.pointerType === 'mouse') {
      handler()
    }
  }
}

function Ring({
  rows,
  link,
}: {
  rows: ReadonlyArray<DonutRow>
  link: LegendLink
}) {
  const geometry = ringGeometry(
    rows.map((row) => ({ key: row.key, spentMinor: row.spentMinor })),
  )
  if (geometry.kind === 'empty') {
    return null
  }
  const colourOf = new Map(rows.map((row) => [row.key, row.colour]))

  return (
    <svg
      aria-hidden="true"
      data-part="donut-ring"
      focusable="false"
      viewBox="0 0 100 100"
      className="mx-auto block size-40 shrink-0"
    >
      {geometry.segments.map((segment) => (
        <path
          key={segment.key}
          data-category={segment.key}
          d={ringPath(segment, CENTRE, CENTRE, OUTER_RADIUS, INNER_RADIUS)}
          fill={colourOf.get(segment.key)}
          fillRule="evenodd"
          onPointerEnter={onMouse(() => link.onHover(segment.key))}
          onPointerLeave={() => link.onHover(null)}
          className={cn(
            'transition-opacity duration-fast ease-out-quint',
            link.highlighted !== null &&
              link.highlighted !== segment.key &&
              'opacity-35',
          )}
          /* The gap between neighbours is a stroke in the card colour, not missing
             degrees, so the sweeps still add up to a closed ring. */
          stroke={segment.full ? 'none' : 'var(--color-surface)'}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

function Legend({
  spending,
  plannedOnly,
  currency,
  link,
}: {
  spending: ReadonlyArray<DonutRow>
  plannedOnly: ReadonlyArray<DonutRow>
  currency: string
  link: LegendLink
}) {
  const locale = useLocale()
  const t = useTranslate()
  if (spending.length === 0 && plannedOnly.length === 0) {
    return null
  }

  const total = spending.reduce((sum, row) => sum + row.spentMinor, 0)
  const percents = allocatePercents(spending.map((row) => row.spentMinor))

  return (
    <ul
      // Safari drops the list role from a list whose items are `display: grid`, and
      // the label with it.
      role="list"
      aria-label={t('costs.categories.legendLabel')}
      className="flex flex-col gap-3"
    >
      {spending.map((row, index) => (
        <li key={row.key}>
          <button
            type="button"
            data-part="donut-legend-row"
            aria-pressed={link.pinned === row.key}
            onClick={() => link.onPress(row.key)}
            onPointerEnter={onMouse(() => link.onHover(row.key))}
            onPointerLeave={() => link.onHover(null)}
            // Focus that a click or a tap leaves is not `:focus-visible`; showing it
            // would leave the segment dimmed after the pin is cleared.
            onFocus={(event: FocusEvent<HTMLButtonElement>) => {
              if (event.currentTarget.matches(':focus-visible')) {
                link.onFocus(row.key)
              }
            }}
            onBlur={() => link.onFocus(null)}
            className={cn(
              // Wider than the list by its own padding, so the row's ground reaches
              // past the text and the inset focus ring stays inside the panel.
              'focus-ring-inset -mx-2 grid w-[calc(100%+1rem)] grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-0.5 rounded-md px-2 py-1 text-start text-caption active:bg-surface-inset',
              // Pinned is a line as well as a ground, and a box-shadow rather than an
              // outline, which is the property the focus ring uses.
              link.pinned === row.key
                ? 'bg-surface-inset ring-1 ring-ink-3 ring-inset'
                : link.highlighted === row.key && 'bg-surface-2',
            )}
          >
            <Dot colour={row.colour} />
            <Name label={row.label} className="col-start-2 row-start-1" />
            <Separator />
            <span className="col-start-2 row-start-2 tabular-nums text-ink-3">
              <SharePercent
                share={row.spentMinor / total}
                allocated={percents[index]}
                locale={locale}
              />
            </span>
            <Separator />
            <span className="col-start-3 row-start-1 text-end font-semibold tabular-nums text-ink">
              {formatMoney(row.spentMinor, currency, locale)}
            </span>
            {row.plannedMinor > 0 ? (
              <Fragment>
                <Separator />
                <span className="col-start-3 row-start-2 text-end tabular-nums text-ink-4">
                  {t('costs.categories.planned', {
                    amount: formatMoney(row.plannedMinor, currency, locale),
                  })}
                </span>
              </Fragment>
            ) : null}
          </button>
        </li>
      ))}
      {plannedOnly.map((row) => (
        <li
          key={row.key}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-2.5 text-caption"
        >
          <Dot colour={row.colour} />
          <Name label={row.label} className="col-start-2 row-start-1" />
          <Separator />
          <span className="col-start-3 row-start-1 text-end tabular-nums text-ink-3">
            {t('costs.categories.planned', {
              amount: formatMoney(row.plannedMinor, currency, locale),
            })}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Dot({ colour }: { colour: string }) {
  return (
    <span
      aria-hidden="true"
      className="col-start-1 row-start-1 size-2.5 self-center rounded-full"
      style={{ backgroundColor: colour }}
    />
  )
}

/** The category name wraps; it is never cut off. */
function Name({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={cn('min-w-0 text-ink-2 [overflow-wrap:anywhere]', className)}
    >
      {label}
    </span>
  )
}

/** Punctuation only a screen reader needs, so a row reads as one phrase. */
function Separator() {
  return <span className="sr-only">, </span>
}

/**
 * A share of a whole as a reader sees it. Below one percent the `<` glyph is drawn
 * and a spoken "less than 1%" is read instead, because some screen readers skip the
 * glyph; a zero share never takes this form.
 */
export function SharePercent({
  share,
  allocated,
  locale,
}: {
  share: number
  allocated: number
  locale: Locale
}) {
  const t = useTranslate()
  const { belowOne, text } = formatSharePercent(share, allocated, locale)
  if (!belowOne) {
    return text
  }
  return (
    <Fragment>
      <span aria-hidden="true">
        {t('costs.percent.belowOne', { percent: text })}
      </span>
      <span className="sr-only">
        {t('costs.percent.belowOneSpoken', { percent: text })}
      </span>
    </Fragment>
  )
}
