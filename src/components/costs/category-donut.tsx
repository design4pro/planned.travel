/**
 * Where the money went, as a ring and the list that explains it.
 *
 * Presentation only: it takes finished rows and a currency, converts nothing and
 * fetches nothing. The caller owns the order - the ring keeps the rows exactly as
 * given, so a segment never moves when a total changes - and the colour, which is an
 * opaque CSS value here so the palette can change without touching this file.
 *
 * The ring is a picture and is hidden from assistive technology; the legend is its
 * text alternative, so no figure exists only in the drawing. There is no focusable
 * segment and no tooltip: a hand-drawn arc half a degree wide is not a pointer target.
 */
import { Fragment } from 'react'

import { cn } from '#/lib/cn'
import { formatMoney } from '#/lib/money'
import { useLocale, useTranslate } from '#/lib/i18n'
import {
  allocatePercents,
  formatSharePercent,
  ringGeometry,
  ringPath,
} from './chart-geometry'

import type { Locale } from '#/lib/i18n'

export interface DonutRow {
  /** The category; also what a later highlight refers to. */
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

export function CategoryDonut({ rows, currency }: CategoryDonutProps) {
  const t = useTranslate()
  const spending = rows.filter(hasSpend)
  const plannedOnly = rows.filter((row) => !hasSpend(row) && hasPlan(row))

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
        <Legend spending={[]} plannedOnly={plannedOnly} currency={currency} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Ring rows={spending} />
      <Legend
        spending={spending}
        plannedOnly={plannedOnly}
        currency={currency}
      />
    </div>
  )
}

function Ring({ rows }: { rows: ReadonlyArray<DonutRow> }) {
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
}: {
  spending: ReadonlyArray<DonutRow>
  plannedOnly: ReadonlyArray<DonutRow>
  currency: string
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
      aria-label={t('costs.categories.legendLabel')}
      className="flex flex-col gap-3"
    >
      {spending.map((row, index) => (
        <li
          key={row.key}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-0.5 text-caption"
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
