import * as React from 'react'
import { CalendarOff, MapPinOff, PenLine } from 'lucide-react'

import { Badge, SectionLabel, Skeleton, cardVariants } from '#/components/ui'
import { cn } from '#/lib/cn'
import { countryName } from '#/lib/atlas/country-names'
import { UNRECORDED_VISIT_LABEL, visitSpan } from '#/lib/atlas/visit-span'
import { countryFlag, pluralise } from '#/lib/format'

import type { VisitSpan } from '#/lib/atlas/visit-span'

/**
 * One visited country, told in full.
 *
 * The tracker's payload is a country's name, its flag, the continent it sits
 * on, when the traveller first arrived, when they were last there, how many
 * times they have been and what they wrote about it. The reference product
 * surfaces two of those and only on hover, so its record is unreachable by
 * keyboard, invisible on a phone and gone the moment the pointer moves. This
 * is the opposite bet: one persistent, readable block that says everything,
 * with no pointer and no colour required to read any of it.
 *
 * Three states earn their own design rather than a blank:
 *
 * - **Visited once.** Eight of our twelve seeded countries were, so the single
 *   date is the common case, not the exception. It prints once, under one
 *   heading. Two cells with the same date under "first" and "last" is what the
 *   reference does and it reads as a bug.
 * - **No note.** Three of twelve have none. A dashed, quiet placeholder holds
 *   the row's height and says so, instead of leaving a hole that looks like a
 *   failed fetch.
 * - **No outline.** Seventy-five ISO codes have no geometry in the bundled
 *   1:110m cut, so the map cannot fill them. Those countries are still counted,
 *   still listed and still fully readable here, and the record says plainly
 *   that there is nothing to frame on the map rather than leaving a click that
 *   quietly does nothing. The reason it gives is the real one: Natural Earth's
 *   1:110m cut folds a dependency or an overseas department into its parent
 *   sovereign state. It is emphatically *not* about size - French Guiana is
 *   83,534 km², larger than Ireland, and Svalbard larger still.
 *
 * `hasOutline` arrives as a prop rather than being looked up here on purpose:
 * `hasCountryOutline()` reaches into the bundled world geometry, and a list of
 * country records has no business dragging sixty kilobytes of coastline into
 * its chunk to answer a boolean.
 *
 * Nothing in this file drops below 12px or fades a label below full opacity.
 * The bar it is written against renders its own micro-labels at 9px and 0.4
 * alpha, which measures at about 2.4:1 against its own panel.
 */

/** Heading levels a host screen might legitimately need. */
const HEADINGS = { 2: 'h2', 3: 'h3', 4: 'h4' } as const

/**
 * The record's layout, held as class strings rather than typed twice.
 *
 * `CountryRecordSkeleton` is only trustworthy if it is built from the very same
 * padding, border and type classes as the record it stands in for — a copied
 * pair of class lists drifts on the first edit, and a skeleton that has drifted
 * is worse than none, because it moves the page under the reader at the moment
 * content lands. Sharing the strings makes that drift impossible.
 */
const layout = {
  /** `min-w-0` is load-bearing, not decoration. As a grid or flex item the
      record would otherwise be sized by its own min-content, and one long name
      ("South Georgia & South Sandwich Islands") widens the whole track and
      pushes a 360px page into horizontal scroll. */
  root: 'min-w-0',
  card: cardVariants({ variant: 'default', padding: 'md' }),
  header: 'flex items-start gap-3',
  flag: 'grid size-11 shrink-0 place-items-center rounded-md border border-edge-faint bg-surface-2 text-title leading-none',
  identity: 'min-w-0 flex-1',
  /** `wrap-anywhere` rather than a plain wrap: an unrecognised code falls back
      to printing itself, and a host that hands us a malformed one must not be
      able to widen the card past its column. */
  name: 'text-balance wrap-anywhere text-subtitle font-semibold text-ink',
  /** One line, never two: the code is fixed width and the continent truncates,
      so a long value shortens itself instead of leaving the separator stranded
      at the end of a wrapped line. */
  meta: 'mt-1 flex items-center gap-2 text-caption text-ink-3',
  /**
   * A container, not a breakpoint.
   *
   * The two-column arrangement is right when this block is wide and wrong when
   * it is narrow, and its width has nothing to do with the viewport's: the
   * record is mounted in a 320px side panel on a 1440px screen as readily as it
   * is in a 520px card. Keyed off `sm:` it kept two columns in that panel and
   * wrapped every value onto two lines of unequal height - the 360px layout,
   * which is the better one there, was unreachable. `@container` asks the only
   * question that matters.
   */
  dates:
    'mt-4 @container overflow-hidden rounded-lg border border-edge-faint bg-surface-2',
  dateCell: 'px-4 py-3',
  /** Dividers are drawn per cell rather than with `divide-*`, so a single-cell
      span carries no orphaned rule. */
  dateDivider:
    'not-last:border-b not-last:border-edge-faint @sm:not-last:border-b-0 @sm:not-last:border-r',
  /** 12px rather than the primitive's 11px: this surface has a hard floor at
      12px, and the label is a value's heading, not panel furniture. */
  dateLabel: 'text-caption',
  dateValue: 'mt-1 text-body tabular-nums',
  gap: 'border-t border-edge-faint px-4 py-2 text-caption tabular-nums text-ink-3',
  /** A traveller's note is the one field on this record with no shape at all.
      `wrap-anywhere` breaks a pasted URL or a 200-character token inside the
      card instead of letting it push a 360px viewport into horizontal scroll,
      and unlike `wrap-break-word` it also shrinks the paragraph's min-content
      contribution, so the record stays narrow even inside a flex track that
      would otherwise size itself to the longest unbroken run. */
  note: 'mt-4 border-l-2 border-brand/40 pl-4 text-body wrap-anywhere text-ink-2',
} as const

export interface CountryRecordProps extends Omit<
  React.ComponentPropsWithoutRef<'article'>,
  'children'
> {
  /** ISO 3166-1 alpha-2, as stored on the row. */
  readonly countryCode: string
  readonly continent: string | null
  readonly firstVisitedOn: string | null
  readonly lastVisitedOn: string | null
  readonly visitCount: number
  readonly note: string | null
  /**
   * Whether the bundled geometry can draw this country. Ask
   * `hasCountryOutline()` from `#/lib/map` once, where the geometry already
   * lives, and hand the answer down.
   */
  readonly hasOutline: boolean
  /** `plain` drops the card chrome, for a host that brings its own surface. */
  readonly variant?: 'card' | 'plain'
  /** The record's name is a heading; the host decides at what depth. */
  readonly headingLevel?: 2 | 3 | 4
}

/** One cell of the dates block: a heading, a value, and a machine date. */
interface DateCell {
  readonly label: string
  readonly value: string
  readonly iso: string | null
  /** True when the cell is saying "we do not know" rather than a date. */
  readonly absent: boolean
}

/**
 * The span's four shapes, laid out as cells.
 *
 * A range gets two cells, a single visit gets one, a half-recorded pair gets
 * two with one of them honest about the gap, and an empty pair gets one cell
 * carrying words. No shape ever prints the same day twice.
 */
function dateCells(span: VisitSpan): ReadonlyArray<DateCell> {
  switch (span.kind) {
    case 'single':
      return [
        {
          label: 'Visited',
          value: span.date.label,
          iso: span.date.iso,
          absent: false,
        },
      ]
    case 'range':
      return [
        {
          label: 'First visit',
          value: span.first.label,
          iso: span.first.iso,
          absent: false,
        },
        {
          label: 'Last visit',
          value: span.last.label,
          iso: span.last.iso,
          absent: false,
        },
      ]
    case 'partial':
      return span.edge === 'first'
        ? [
            {
              label: 'First visit',
              value: span.date.label,
              iso: span.date.iso,
              absent: false,
            },
            {
              label: 'Last visit',
              value: 'Not recorded',
              iso: null,
              absent: true,
            },
          ]
        : [
            {
              label: 'First visit',
              value: 'Not recorded',
              iso: null,
              absent: true,
            },
            {
              label: 'Last visit',
              value: span.date.label,
              iso: span.date.iso,
              absent: false,
            },
          ]
    case 'unrecorded':
      return [
        {
          label: 'Visit dates',
          value: UNRECORDED_VISIT_LABEL,
          iso: null,
          absent: true,
        },
      ]
  }
}

export const CountryRecord = React.forwardRef<HTMLElement, CountryRecordProps>(
  (
    {
      countryCode,
      continent,
      firstVisitedOn,
      lastVisitedOn,
      visitCount,
      note,
      hasOutline,
      variant = 'card',
      headingLevel = 3,
      className,
      ...props
    },
    ref,
  ) => {
    const headingId = React.useId()
    const Heading = HEADINGS[headingLevel]
    const code = countryCode.trim().toUpperCase()
    const name = countryName(code)
    const span = visitSpan(firstVisitedOn, lastVisitedOn)
    const cells = dateCells(span)
    const written = note !== null && note.trim().length > 0
    /**
     * The same trim guard the note already uses, for the same reason.
     *
     * `continent` is validated by `shortTextSchema`, which has no `.min(1)`, so
     * `markCountryVisited({ continent: '' })` stores an empty string. A bare
     * `!== null` check then prints "FR ·" with a stranded middot and nothing
     * after it - a separator with no second operand reads as a rendering
     * failure, not as missing data.
     */
    const region =
      continent === null || continent.trim() === '' ? null : continent.trim()

    return (
      <article
        ref={ref}
        aria-labelledby={headingId}
        // The code the map, the list and an end-to-end test all key on, so a
        // host can find one record without inventing its own id scheme.
        data-country={code}
        className={cn(
          layout.root,
          variant === 'card' ? layout.card : 'text-ink',
          className,
        )}
        {...props}
      >
        <div data-part="header" className={layout.header}>
          {/* The flag is decoration: the name beside it is the real label, and
              a reader whose platform has no flag glyphs sees the two-letter
              code below the name either way. */}
          <span aria-hidden="true" className={layout.flag}>
            {countryFlag(code)}
          </span>

          <div className={layout.identity}>
            <Heading id={headingId} className={layout.name}>
              {name}
            </Heading>
            <p className={layout.meta}>
              <span className="shrink-0 font-semibold tracking-wide tabular-nums">
                {code}
              </span>
              {region === null ? null : (
                <>
                  <span aria-hidden="true" className="shrink-0">
                    &middot;
                  </span>
                  <span className="min-w-0 truncate">{region}</span>
                </>
              )}
            </p>
          </div>

          <Badge tone="brand" className="shrink-0 tabular-nums">
            {pluralise(visitCount, 'visit')}
          </Badge>
        </div>

        <div data-part="dates" className={layout.dates}>
          <dl className={cn('grid', cells.length > 1 && '@sm:grid-cols-2')}>
            {cells.map((cell) => (
              <div
                key={cell.label}
                data-part="date-cell"
                className={cn(
                  layout.dateCell,
                  cells.length > 1 && layout.dateDivider,
                )}
              >
                <dt>
                  <SectionLabel as="span" className={layout.dateLabel}>
                    {cell.label}
                  </SectionLabel>
                </dt>
                <dd
                  className={cn(
                    layout.dateValue,
                    cell.absent
                      ? 'flex items-center gap-2 text-ink-3'
                      : 'font-semibold text-ink',
                  )}
                >
                  {cell.iso === null ? (
                    <>
                      <CalendarOff
                        size={14}
                        aria-hidden="true"
                        className="shrink-0"
                      />
                      <span>{cell.value}</span>
                    </>
                  ) : (
                    <time dateTime={cell.iso}>{cell.value}</time>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {span.kind === 'range' ? (
            <p className={layout.gap}>{span.gap}</p>
          ) : null}
        </div>

        {written ? (
          <p data-part="note" className={layout.note}>
            {note}
          </p>
        ) : (
          <p className="mt-4 flex items-center gap-2 rounded-md border border-dashed border-edge px-4 py-3 text-caption text-ink-3">
            <PenLine size={14} aria-hidden="true" className="shrink-0" />
            No note yet
          </p>
        )}

        {hasOutline ? null : (
          <p className="mt-4 flex items-start gap-2 rounded-md bg-info-soft px-4 py-3 text-caption text-info">
            <span
              aria-hidden="true"
              className="grid size-4 shrink-0 place-items-center"
            >
              <MapPinOff size={14} />
            </span>
            <span>
              The world outlines this map draws are cut at 1:110m, which folds
              this territory into its parent state - so there is nothing to
              frame on the map. The visit still counts.
            </span>
          </p>
        )}
      </article>
    )
  },
)
CountryRecord.displayName = 'CountryRecord'

/**
 * A placeholder bar that occupies exactly one line box of the type style it is
 * given, because the invisible non-breaking space inside it is a real strut.
 *
 * Sizing a skeleton bar with a hand-picked `h-4` is how a loading state ends up
 * shorter than the text it replaces: 15px body copy at our 1.55 leading is a
 * 23.25px line, not 16. Letting the browser measure the same font at the same
 * size removes the guess, and it keeps working when the type scale is retuned.
 */
function LineSkeleton({
  width,
  className,
}: {
  readonly width: string
  readonly className?: string
}) {
  return (
    // `block` trails `className` so it wins the display conflict: the classes
    // handed in are the record's own, and one of them makes its element a flex
    // row, which a strut has no use for.
    <span className={cn('relative', className, 'block')}>
      <span className="invisible">&nbsp;</span>
      <Skeleton
        radius="sm"
        className={cn('absolute inset-y-0.5 left-0', width)}
      />
    </span>
  )
}

export type CountryRecordSkeletonProps =
  React.ComponentPropsWithoutRef<'div'> & {
    readonly variant?: 'card' | 'plain'
  }

/**
 * The record's loading shape.
 *
 * It is assembled from `layout`, the same class strings the record itself is
 * built from, so every fixed part measures the same at every breakpoint and in
 * both themes: the 44px flag tile, the 25px name line and its 16px meta line,
 * the badge's 22px pill, the bordered dates block with its two 16px labels and
 * two 23px values, and the note's left rule and indent. Nothing here is an
 * eyeballed height — each bar is struck inside a real line box of the real type
 * style, so a retuned type scale moves both components together and the
 * `data-part` comparisons in the test file fail the moment one is edited alone.
 *
 * A country record is genuinely variable in height — one date cell or two, a
 * note of any length or none, an extra line for a country the map cannot draw —
 * so no single placeholder can be right for every row, and claiming otherwise
 * is how a skeleton ends up systematically short. This one stands for the
 * middle of the real distribution rather than its floor. Measured against a
 * 520px card: a two-date record with a one-line note is 245px and this is
 * 235px; a single-visit record with no note is 231px. At 360px, where a note
 * wraps further, the third note line below `sm` tracks it: 337px against 327px.
 * The residue is under half a line of body copy either way, and a host that
 * needs the swap to be motionless to the pixel should reserve the list's height
 * rather than ask a placeholder to guess the data.
 */
export const CountryRecordSkeleton = React.forwardRef<
  HTMLDivElement,
  CountryRecordSkeletonProps
>(({ variant = 'card', className, ...props }, ref) => (
  <div
    ref={ref}
    aria-busy="true"
    aria-hidden="true"
    className={cn(
      layout.root,
      variant === 'card' ? layout.card : '',
      className,
    )}
    {...props}
  >
    <div data-part="header" className={layout.header}>
      {/* `size-11` is the flag tile's own box — border-box sizing means the
          record's hairline costs no extra height, so the two agree at 44px. */}
      <Skeleton radius="md" className="size-11 shrink-0" />
      <div className={layout.identity}>
        <LineSkeleton width="w-40 max-w-full" className={layout.name} />
        <LineSkeleton width="w-28 max-w-full" className={layout.meta} />
      </div>
      {/* Matched to the badge's own `md` height rather than to a round number,
          so the header row's baseline does not move when the count lands. */}
      <Skeleton radius="full" className="h-5.5 w-16 shrink-0" />
    </div>

    <div data-part="dates" className={layout.dates}>
      <div className="grid @sm:grid-cols-2">
        {['first', 'last'].map((cell) => (
          <div
            key={cell}
            data-part="date-cell"
            className={cn(layout.dateCell, layout.dateDivider)}
          >
            <LineSkeleton
              width="w-20 max-w-full"
              className={layout.dateLabel}
            />
            <LineSkeleton
              width="w-24 max-w-full"
              className={layout.dateValue}
            />
          </div>
        ))}
      </div>
    </div>

    {/* The note's rule is neutralised: a brand-coloured bar in a loading state
        reads as content that has already arrived. */}
    <div data-part="note" className={cn(layout.note, 'border-edge-faint')}>
      <LineSkeleton width="w-full" />
      <LineSkeleton width="w-full sm:w-3/5" />
      {/* The same sentence wraps to more lines in a narrow card, so the
          placeholder gains a line exactly where the real note gains one. */}
      <LineSkeleton width="w-3/5" className="sm:hidden" />
    </div>
  </div>
))
CountryRecordSkeleton.displayName = 'CountryRecordSkeleton'
