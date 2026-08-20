import * as React from 'react'
import {
  Check,
  Compass,
  MapPinOff,
  PenLine,
  RotateCw,
  TriangleAlert,
} from 'lucide-react'

import {
  Button,
  EmptyState,
  SimpleSelect,
  Skeleton,
  focusRingInset,
  staggerDelay,
  transitionBase,
  useControllableState,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { countryName } from '#/lib/atlas/country-names'
import { UNRECORDED_VISIT_LABEL, visitSpan } from '#/lib/atlas/visit-span'
import {
  countryFlag,
  formatNumber,
  humaniseToken,
} from '#/routes/_app/-lib/format'

import type { VisitSpan } from '#/lib/atlas/visit-span'

/**
 * The visited countries, as a list you can actually operate.
 *
 * The map is the headline of the atlas, but a WebGL canvas exposes no tab stops
 * and no per-country semantics: there is no element for a keyboard user to
 * reach, and nothing for a screen reader to name. This list is the equivalent
 * path. Every country the map can paint is a real `option` here, selecting one
 * is what tells the map to frame and highlight it, and everything the map
 * cannot say — the first arrival, the latest one, the tally, the note — is
 * written out in text rather than encoded in a fill colour.
 *
 * Consequences of taking that seriously:
 *
 * - **Both ends of the span, always.** A row that prints only the last visit
 *   throws away the more interesting half of the record. `visitSpan()` decides
 *   the shape, so a country visited once prints one date under one heading
 *   instead of the same day twice under "first" and "last".
 * - **Options, not divs.** Each row is a `<button role="option">` inside a
 *   `role="listbox"`: Enter and Space select natively, `aria-selected` announces
 *   the state, and a roving tabindex keeps the list to one tab stop with the
 *   arrows, Home, End and typeahead moving inside it. Focus never follows the
 *   arrow keys into a selection, because selection flies a camera and nobody
 *   asked for six flights on the way to the seventh country.
 * - **Nothing reflows on hover or selection.** The selected row is marked by a
 *   left rail that is always in the layout and only changes colour, a tick in a
 *   slot that is always reserved, and a tinted ground. No border grows, no
 *   weight changes, no padding moves.
 * - **Colour is never the only channel.** The tick and the `aria-selected`
 *   state carry selection on their own, and the recency the map encodes as
 *   lightness is spelled out here as dates.
 * - **The 75 countries the map cannot draw are still first-class.** They list,
 *   they select, and they say in the row that there is no outline to frame,
 *   rather than offering a click that quietly does nothing.
 *
 * `hasOutline` arrives per row rather than being resolved here: answering it
 * means reaching into the bundled 1:110m geometry, and a list has no business
 * pulling coastlines into its chunk. Ask `hasCountryOutline()` once where the
 * geometry already lives and hand the answer down.
 */

/** One visited country, exactly as the atlas loader returns it. */
export interface CountriesListCountry {
  /** ISO 3166-1 alpha-2, as stored on the row. */
  readonly countryCode: string
  readonly continent: string | null
  readonly firstVisitedOn: string | null
  readonly lastVisitedOn: string | null
  readonly visitCount: number
  readonly note: string | null
  /** Whether the bundled world geometry can draw — and therefore frame — it. */
  readonly hasOutline: boolean
}

/* --------------------------------------------------------------------- order */

/**
 * Text comparison that cannot disagree with itself across two runtimes.
 *
 * `localeCompare` and `Intl.Collator` are the obvious tools and the wrong ones:
 * the Worker and the browser can order the same two strings differently, and a
 * list whose server order differs from its client order is a hydration error,
 * not a cosmetic one. Diacritics are folded so "Côte d’Ivoire" files under C
 * rather than after Z, and the rest is a plain code-unit comparison, which is
 * identical everywhere by definition.
 */
function collationKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
}

function compareText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

const SORT_VALUES = ['code', 'name', 'recent', 'visits'] as const

/** The orders the list can be read in. `code` is the order the repo returns. */
export type CountriesListSort = (typeof SORT_VALUES)[number]

interface SortDefinition {
  /** What the control shows. */
  readonly label: string
  /** The order written out, so a reader never has to infer it from the rows. */
  readonly statement: string
  readonly compare: (
    left: CountriesListCountry,
    right: CountriesListCountry,
  ) => number
}

const SORTS: Readonly<Record<CountriesListSort, SortDefinition>> = {
  code: {
    label: 'Country code',
    statement: 'Ordered by country code, A to Z.',
    compare: () => 0,
  },
  name: {
    label: 'Country name',
    statement: 'Ordered by country name, A to Z, then country code.',
    compare: (left, right) =>
      compareText(
        collationKey(countryName(left.countryCode)),
        collationKey(countryName(right.countryCode)),
      ),
  },
  recent: {
    label: 'Most recent visit',
    statement: 'Ordered by the most recent visit first, then country code.',
    // An empty string sorts last under a descending comparison, which is where
    // a country with no recorded date belongs: unknown is not "a long time ago".
    compare: (left, right) =>
      compareText(right.lastVisitedOn ?? '', left.lastVisitedOn ?? ''),
  },
  visits: {
    label: 'Most visits',
    statement: 'Ordered by the most visits first, then country code.',
    compare: (left, right) => right.visitCount - left.visitCount,
  },
}

const SORT_OPTIONS = SORT_VALUES.map((value) => ({
  value,
  label: SORTS[value].label,
}))

/**
 * The list in a stated order, deterministically.
 *
 * Every order breaks its ties on the country code, which is unique per row, so
 * there is exactly one correct arrangement of any list under any order — no
 * dependence on the input order, and no two renders that disagree.
 */
export function sortCountries(
  countries: ReadonlyArray<CountriesListCountry>,
  sort: CountriesListSort,
): ReadonlyArray<CountriesListCountry> {
  const { compare } = SORTS[sort]
  return [...countries].sort(
    (left, right) =>
      compare(left, right) ||
      compareText(
        left.countryCode.toUpperCase(),
        right.countryCode.toUpperCase(),
      ),
  )
}

/* --------------------------------------------------------------------- dates */

/** One labelled date on a row, machine-readable where a real day exists. */
interface DateCell {
  readonly label: string
  readonly value: string
  /** `YYYY-MM-DD` for a `<time>`, or `null` when the cell carries words. */
  readonly iso: string | null
}

/**
 * The span's four shapes as row cells.
 *
 * The vocabulary matches `CountryRecord`, so a country reads the same way in
 * the list and in the record the list opens. A single visit is one cell: two
 * cells holding the same day under two headings reads as a bug, and eight of
 * our twelve seeded countries were visited exactly once.
 */
function dateCells(span: VisitSpan): ReadonlyArray<DateCell> {
  switch (span.kind) {
    case 'single':
      return [{ label: 'Visited', value: span.date.label, iso: span.date.iso }]
    case 'range':
      return [
        { label: 'First visit', value: span.first.label, iso: span.first.iso },
        { label: 'Last visit', value: span.last.label, iso: span.last.iso },
      ]
    case 'partial':
      return span.edge === 'first'
        ? [
            {
              label: 'First visit',
              value: span.date.label,
              iso: span.date.iso,
            },
            { label: 'Last visit', value: 'Not recorded', iso: null },
          ]
        : [
            { label: 'First visit', value: 'Not recorded', iso: null },
            {
              label: 'Latest visit',
              value: span.date.label,
              iso: span.date.iso,
            },
          ]
    case 'unrecorded':
      return [
        { label: 'Visit dates', value: UNRECORDED_VISIT_LABEL, iso: null },
      ]
  }
}

/* -------------------------------------------------------------------- layout */

/** Copy for a country the bundled 1:110m geometry is too coarse to draw. */
const NO_OUTLINE_NOTICE =
  'Too small to outline at world scale, so there is nothing to frame on the map.'

/**
 * Held as class strings rather than typed twice, so `CountriesListSkeleton` is
 * cut from the very same padding, type and rhythm as the rows it stands in for.
 * A copied pair of class lists drifts on the first edit, and a drifted skeleton
 * moves the page under the reader exactly when the content lands.
 */
const layout = {
  root: 'flex min-w-0 flex-col',
  toolbar:
    'flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5',
  statement: 'min-w-0 text-caption text-ink-3',
  sort: 'w-auto min-w-40',
  list: 'min-w-0',
  item: 'not-last:border-b not-last:border-edge-faint',
  row: 'relative flex w-full min-w-0 items-start gap-3 px-4 py-3 text-left sm:px-5',
  /** Always in the layout, so selection can only ever repaint it. */
  rail: 'absolute inset-y-0 left-0 w-1',
  flag: 'grid size-10 shrink-0 place-items-center rounded-md border border-edge-faint bg-surface-2 text-subtitle leading-none',
  body: 'flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-start md:gap-4',
  identity: 'flex min-w-0 flex-1 flex-col gap-1',
  nameRow: 'flex min-w-0 items-center gap-1.5',
  /** Weight is fixed at 600 in every state: a bolder selected row reflows. */
  name: 'min-w-0 truncate text-label font-semibold text-ink',
  /** Reserved whether or not the tick is drawn, so nothing moves on select. */
  tick: 'grid size-4 shrink-0 place-items-center text-brand',
  meta: 'flex min-w-0 items-center gap-1.5 text-caption',
  code: 'shrink-0 font-semibold tracking-wide tabular-nums',
  /** A fixed label column, so every date in the list aligns down one edge
      rather than starting wherever its own heading happens to end. 5.25rem
      clears the longest heading ("Latest visit") at 11px with our tracking. */
  dates:
    'grid shrink-0 grid-cols-[5.25rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 md:w-56',
  dateLabel: 'text-micro font-semibold uppercase tracking-label',
  dateValue: 'min-w-0 text-caption font-medium tabular-nums text-ink',
  aside: 'flex min-w-0 items-start gap-1.5 text-caption',
  /** Carries its own ground, so its contrast is the designed `info` pair in
      both themes rather than a function of whatever the row is painted. */
  outline:
    'flex w-fit min-w-0 items-start gap-1.5 rounded-md bg-info-soft px-2 py-1 text-caption text-info',
  count: 'flex w-11 shrink-0 flex-col items-end gap-0.5',
  countValue: 'font-display text-subtitle font-bold tabular-nums text-ink',
  countLabel: 'text-micro font-semibold uppercase tracking-label',
} as const

/* ---------------------------------------------------------------------- list */

const TYPEAHEAD_RESET_MS = 600
const PAGE_STEP = 5

export interface CountriesListProps extends Omit<
  React.ComponentPropsWithoutRef<'div'>,
  'onSelect'
> {
  readonly countries: ReadonlyArray<CountriesListCountry>
  /**
   * The country the map is currently framing. Omit the prop entirely to let the
   * list own the selection; pass `null` to control it and select nothing.
   */
  readonly selectedCode?: string | null
  /** Fired on every activation, including re-selecting the current row, so a
      reader can always ask the map to frame the country again. */
  readonly onSelect?: (countryCode: string) => void
  readonly sort?: CountriesListSort
  readonly defaultSort?: CountriesListSort
  readonly onSortChange?: (sort: CountriesListSort) => void
  /** Accessible name for the listbox. */
  readonly label?: string
  /**
   * Replaces the "nothing visited yet" panel — for a host that has filtered the
   * list down to nothing and owes the reader a different sentence.
   */
  readonly emptyState?: React.ReactNode
}

export const CountriesList = React.forwardRef<
  HTMLDivElement,
  CountriesListProps
>(
  (
    {
      countries,
      selectedCode,
      onSelect,
      sort,
      defaultSort = 'code',
      onSortChange,
      label = 'Visited countries',
      emptyState,
      className,
      ...props
    },
    ref,
  ) => {
    const baseId = React.useId()
    const [order, setOrder] = useControllableState<CountriesListSort>({
      value: sort,
      defaultValue: defaultSort,
      onChange: onSortChange,
    })
    const [selected, setSelected] = useControllableState<string | null>({
      value: selectedCode,
      defaultValue: null,
      onChange: (next) => {
        if (next !== null) onSelect?.(next)
      },
    })

    const rows = React.useMemo(
      () => sortCountries(countries, order),
      [countries, order],
    )
    const selectedIndex = rows.findIndex(
      (row) => row.countryCode.toUpperCase() === (selected ?? '').toUpperCase(),
    )

    /* Roving tabindex. The tab stop follows the selection when the map picks a
       country, so tabbing back into the list lands where the reader left off,
       and otherwise follows whichever row was focused last. */
    const [focusIndex, setFocusIndex] = React.useState(0)
    React.useEffect(() => {
      if (selectedIndex >= 0) setFocusIndex(selectedIndex)
    }, [selectedIndex])
    const activeIndex =
      rows.length === 0 ? 0 : Math.min(focusIndex, rows.length - 1)

    const nodes = React.useRef(new Map<string, HTMLButtonElement>())
    const refs = React.useRef(
      new Map<string, (node: HTMLButtonElement | null) => void>(),
    )
    // Cached per country, so React is not handed a fresh callback ref on every
    // render — which would detach and reattach every row each time.
    const nodeRef = (
      code: string,
    ): ((node: HTMLButtonElement | null) => void) => {
      const existing = refs.current.get(code)
      if (existing !== undefined) return existing
      const next = (node: HTMLButtonElement | null): void => {
        if (node === null) nodes.current.delete(code)
        else nodes.current.set(code, node)
      }
      refs.current.set(code, next)
      return next
    }

    const focusAt = React.useCallback(
      (index: number) => {
        const row = rows.at(index)
        if (row === undefined) return
        setFocusIndex(index)
        nodes.current.get(row.countryCode)?.focus()
      },
      [rows],
    )

    const typed = React.useRef({ buffer: '', at: 0 })

    const onKeyDown = (event: React.KeyboardEvent<HTMLUListElement>): void => {
      if (rows.length === 0) return
      const last = rows.length - 1
      const move = (index: number): void => {
        event.preventDefault()
        focusAt(Math.min(Math.max(index, 0), last))
      }

      switch (event.key) {
        case 'ArrowDown':
          return move(activeIndex + 1)
        case 'ArrowUp':
          return move(activeIndex - 1)
        case 'Home':
          return move(0)
        case 'End':
          return move(last)
        case 'PageDown':
          return move(activeIndex + PAGE_STEP)
        case 'PageUp':
          return move(activeIndex - PAGE_STEP)
        default:
          break
      }

      // Typeahead. Space is never part of it: on a button it is the activation
      // key, and stealing it would break selection to save a keystroke.
      if (
        event.key.length !== 1 ||
        event.key === ' ' ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return
      }

      const now = Date.now()
      const buffer =
        now - typed.current.at > TYPEAHEAD_RESET_MS
          ? event.key
          : typed.current.buffer + event.key
      typed.current = { buffer, at: now }

      const needle = collationKey(buffer)
      // A repeated single letter cycles through the countries beginning with
      // it; a longer run keeps refining the row already reached.
      const from = buffer.length === 1 ? activeIndex + 1 : activeIndex
      for (let step = 0; step < rows.length; step += 1) {
        const index = (from + step + rows.length) % rows.length
        const row = rows.at(index)
        if (row === undefined) continue
        const code = row.countryCode.toUpperCase()
        if (
          collationKey(countryName(code)).startsWith(needle) ||
          code.startsWith(needle)
        ) {
          event.preventDefault()
          focusAt(index)
          return
        }
      }
    }

    if (countries.length === 0) {
      return (
        <div ref={ref} className={cn(layout.root, className)} {...props}>
          {emptyState ?? (
            <EmptyState
              variant="filled"
              tone="brand"
              icon={<Compass />}
              title="No countries on the map yet"
              description="A country lands here the moment a visit is recorded against it, with the first arrival, the latest one and how many times you have been."
              className="m-4 sm:m-5"
            />
          )}
        </div>
      )
    }

    const statementId = `${baseId}-order`
    const statusCountry =
      selectedIndex >= 0 ? rows.at(selectedIndex) : undefined

    return (
      <div ref={ref} className={cn(layout.root, className)} {...props}>
        <div className={layout.toolbar}>
          <p id={statementId} className={layout.statement}>
            {SORTS[order].statement}
          </p>
          <SimpleSelect
            size="sm"
            className={layout.sort}
            ariaLabel="Order countries"
            options={SORT_OPTIONS}
            value={order}
            onValueChange={(value) => {
              const next = SORT_VALUES.find((candidate) => candidate === value)
              if (next !== undefined) setOrder(next)
            }}
          />
        </div>

        <ul
          role="listbox"
          aria-label={label}
          aria-describedby={statementId}
          className={layout.list}
          onKeyDown={onKeyDown}
        >
          {rows.map((row, index) => {
            const code = row.countryCode.trim().toUpperCase()
            const name = countryName(code)
            const cells = dateCells(
              visitSpan(row.firstVisitedOn, row.lastVisitedOn),
            )
            const note =
              row.note !== null && row.note.trim().length > 0 ? row.note : null
            const isSelected = index === selectedIndex
            const quiet = isSelected ? 'text-ink-2' : 'text-ink-3'
            const noteId = note === null ? undefined : `${baseId}-note-${code}`
            const outlineId = row.hasOutline
              ? undefined
              : `${baseId}-outline-${code}`
            const describedBy =
              [noteId, outlineId].filter((id) => id !== undefined).join(' ') ||
              undefined

            return (
              <li key={code} role="presentation" className={layout.item}>
                <button
                  type="button"
                  role="option"
                  ref={nodeRef(row.countryCode)}
                  data-country={code}
                  aria-selected={isSelected}
                  aria-label={[
                    name,
                    row.continent === null
                      ? 'continent not recorded'
                      : humaniseToken(row.continent),
                    ...cells.map((cell) => `${cell.label} ${cell.value}`),
                    `${formatNumber(row.visitCount)} ${row.visitCount === 1 ? 'visit' : 'visits'}`,
                  ].join(', ')}
                  aria-describedby={describedBy}
                  tabIndex={index === activeIndex ? 0 : -1}
                  onFocus={() => setFocusIndex(index)}
                  onClick={() => setSelected(code)}
                  data-motion-transform=""
                  style={{ animationDelay: staggerDelay(index) }}
                  className={cn(
                    layout.row,
                    'animate-rise cursor-pointer',
                    transitionBase,
                    focusRingInset,
                    isSelected
                      ? 'bg-brand-subtle hover:bg-selection active:bg-selection'
                      : 'hover:bg-hover active:bg-active',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      layout.rail,
                      transitionBase,
                      isSelected ? 'bg-brand' : 'bg-transparent',
                    )}
                  />

                  {/* Decoration: the name beside it is the label, and the code
                      below it is the fallback on a platform with no flags. */}
                  <span aria-hidden="true" className={layout.flag}>
                    {countryFlag(code)}
                  </span>

                  <span className={layout.body}>
                    <span className={layout.identity}>
                      <span className={layout.nameRow}>
                        <span className={layout.name}>{name}</span>
                        <span data-part="tick" className={layout.tick}>
                          {isSelected ? (
                            <Check size={14} aria-hidden="true" />
                          ) : null}
                        </span>
                      </span>

                      <span className={cn(layout.meta, quiet)}>
                        <span className={layout.code}>{code}</span>
                        <span aria-hidden="true" className="shrink-0">
                          &middot;
                        </span>
                        <span className="min-w-0 truncate">
                          {row.continent === null
                            ? 'Continent not recorded'
                            : humaniseToken(row.continent)}
                        </span>
                      </span>

                      {note === null ? null : (
                        <span
                          id={noteId}
                          data-part="note"
                          className={cn(layout.aside, quiet)}
                        >
                          <PenLine
                            size={12}
                            aria-hidden="true"
                            className="mt-0.5 shrink-0"
                          />
                          <span className="min-w-0 truncate">{note}</span>
                        </span>
                      )}

                      {row.hasOutline ? null : (
                        <span
                          id={outlineId}
                          data-part="outline"
                          className={layout.outline}
                        >
                          <MapPinOff
                            size={12}
                            aria-hidden="true"
                            className="mt-0.5 shrink-0"
                          />
                          <span className="min-w-0">{NO_OUTLINE_NOTICE}</span>
                        </span>
                      )}
                    </span>

                    <span data-part="dates" className={layout.dates}>
                      {cells.map((cell) => (
                        <React.Fragment key={cell.label}>
                          <span className={cn(layout.dateLabel, quiet)}>
                            {cell.label}
                          </span>
                          <span
                            className={cn(
                              layout.dateValue,
                              cell.iso === null && quiet,
                            )}
                          >
                            {cell.iso === null ? (
                              cell.value
                            ) : (
                              <time dateTime={cell.iso}>{cell.value}</time>
                            )}
                          </span>
                        </React.Fragment>
                      ))}
                    </span>
                  </span>

                  <span data-part="count" className={layout.count}>
                    <span className={layout.countValue}>
                      {formatNumber(row.visitCount)}
                    </span>
                    <span className={cn(layout.countLabel, quiet)}>
                      {row.visitCount === 1 ? 'visit' : 'visits'}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {/* Selection is a map camera move happening somewhere else on the
            screen, so it is also said out loud — including the honest case
            where the map has no outline to fly to. */}
        <p role="status" aria-live="polite" className="sr-only">
          {statusCountry === undefined
            ? ''
            : `${countryName(statusCountry.countryCode.trim().toUpperCase())} selected.${
                statusCountry.hasOutline ? '' : ` ${NO_OUTLINE_NOTICE}`
              }`}
        </p>
      </div>
    )
  },
)
CountriesList.displayName = 'CountriesList'

/* ------------------------------------------------------------------ loading */

/**
 * A bar struck inside a real line box of the type style it is given.
 *
 * The invisible non-breaking space is a strut: it makes the browser measure the
 * same font at the same size the content will use, instead of the author
 * guessing that 13px label copy at 1.4 leading is "about four units tall".
 */
function Bar({
  width,
  className,
  align = 'start',
}: {
  readonly width: string
  readonly className?: string
  /** Which edge the bar is struck from, so a right-aligned column matches. */
  readonly align?: 'start' | 'end'
}) {
  return (
    // `block w-full` trails `className` so it wins the display and width
    // conflicts: the classes handed in are the list's own, and several of them
    // make their element a flex or grid item, which would otherwise shrink the
    // strut to the width of the space inside it.
    <span className={cn('relative', className, 'block w-full')}>
      <span className="invisible">&nbsp;</span>
      <Skeleton
        radius="sm"
        className={cn(
          'absolute inset-y-0.5',
          align === 'end' ? 'right-0' : 'left-0',
          width,
        )}
      />
    </span>
  )
}

export type CountriesListSkeletonProps =
  React.ComponentPropsWithoutRef<'div'> & {
    /** How many placeholder rows to reserve. */
    readonly rows?: number
  }

/**
 * The list's loading shape, assembled from the same `layout` strings as the
 * list itself: the 40px flag tile, the label-sized name line, the caption meta
 * line, the two date cells in their own column and the count block on the
 * right. Every fixed part therefore measures the same at every breakpoint and
 * in both themes, and the tests below fail the moment one is edited alone.
 */
export const CountriesListSkeleton = React.forwardRef<
  HTMLDivElement,
  CountriesListSkeletonProps
>(({ rows = 4, className, ...props }, ref) => (
  <div
    ref={ref}
    aria-busy="true"
    className={cn(layout.root, className)}
    {...props}
  >
    <span className="sr-only">Loading visited countries</span>

    <div aria-hidden="true" className={layout.toolbar}>
      <Bar width="w-full" className={cn(layout.statement, 'max-w-56')} />
      {/* The `sm` field height, so the toolbar does not resize on arrival. */}
      <Skeleton radius="md" className="h-8 w-40 shrink-0" />
    </div>

    <ul aria-hidden="true" className={layout.list}>
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className={layout.item}>
          <div className={layout.row}>
            <Skeleton radius="md" className="size-10 shrink-0" />
            <div className={layout.body}>
              <div className={layout.identity}>
                <div className={layout.nameRow}>
                  <Bar width="w-32 max-w-full" className={layout.name} />
                </div>
                <Bar width="w-24 max-w-full" className={layout.meta} />
              </div>
              <div className={layout.dates}>
                {['first', 'last'].map((cell) => (
                  <React.Fragment key={cell}>
                    <Bar width="w-14" className={layout.dateLabel} />
                    <Bar width="w-20 max-w-full" className={layout.dateValue} />
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div className={layout.count}>
              <Bar width="w-5" align="end" className={layout.countValue} />
              <Bar width="w-8" align="end" className={layout.countLabel} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  </div>
))
CountriesListSkeleton.displayName = 'CountriesListSkeleton'

/* -------------------------------------------------------------------- error */

export type CountriesListErrorProps = React.ComponentPropsWithoutRef<'div'> & {
  /** Omit it and no button is offered — an action that cannot run is worse
      than none. */
  readonly onRetry?: () => void
  /** Keeps the retry button in its pending state while the refetch is in air. */
  readonly retrying?: boolean
}

/**
 * The degraded list. It is deliberately not an empty state: nothing has been
 * lost, the read simply did not answer, and the copy says exactly that instead
 * of implying the reader has never been anywhere.
 */
export const CountriesListError = React.forwardRef<
  HTMLDivElement,
  CountriesListErrorProps
>(({ onRetry, retrying = false, className, ...props }, ref) => (
  <div ref={ref} className={cn(layout.root, className)} {...props}>
    <EmptyState
      variant="filled"
      tone="warning"
      icon={<TriangleAlert />}
      title="Your countries did not load"
      description="The atlas could not read your visited countries just now. Nothing has been lost — they are still recorded."
      className="m-4 sm:m-5"
      action={
        onRetry === undefined ? undefined : (
          <Button
            variant="secondary"
            size="sm"
            icon={<RotateCw />}
            loading={retrying}
            loadingLabel="Loading your countries"
            onClick={onRetry}
          >
            Try again
          </Button>
        )
      }
    />
  </div>
))
CountriesListError.displayName = 'CountriesListError'
