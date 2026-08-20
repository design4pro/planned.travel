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
import { countryFlag, formatNumber, humaniseToken } from '#/lib/format'

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
 * - **Selection and the pointer are separate channels.** Selection paints the
 *   row's ground; hover and press paint a wash stacked above it. Four states
 *   stay four distinct paints, whether or not the row is the selected one.
 * - **Colour is never the only channel.** The tick and the `aria-selected`
 *   state carry selection on their own, and the recency the map encodes as
 *   lightness is spelled out here as dates.
 * - **Choosing the same country twice still speaks.** Re-selecting is a
 *   supported gesture — it re-frames the map — so the announcement alternates
 *   between two live regions rather than rewriting one with the same sentence,
 *   which a screen reader would pass over in silence.
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

/* ------------------------------------------------------------------ identity */

/**
 * The one form of a country code this component compares, keys and reports.
 *
 * A code arrives from a database column, so it can carry whitespace or the
 * wrong case, and it arrives twice: once on the row and once on the
 * `selectedCode` a host hands back. Normalising in one place is what keeps
 * those two agreeing — comparing a padded row code against a trimmed selection
 * is how a row reports itself selected to the map and then renders unselected.
 */
function normaliseCode(code: string): string {
  return code.trim().toUpperCase()
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
        normaliseCode(left.countryCode),
        normaliseCode(right.countryCode),
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
              label: 'Last visit',
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

/**
 * Copy for a country the bundled geometry has no separate polygon for.
 *
 * The reason is stated as the true one. Natural Earth's 1:110m cut folds a
 * dependency or an overseas department into its parent sovereign state, which is
 * why GF, SJ, HK and MO are missing - not size. French Guiana is 83,534 km²,
 * larger than Austria, and telling a reader it is "too small to outline" is a
 * factual untruth in a product about places.
 */
const NO_OUTLINE_NOTICE =
  'Folded into its parent state by the world outlines, so there is nothing to frame on the map.'

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
  row: 'relative isolate flex w-full min-w-0 items-start gap-3 px-4 py-3 text-left sm:px-5',
  /**
   * The interaction wash, painted over the row's ground and under its text.
   *
   * A row has two independent things to say: whether it is the country the map
   * is framing (an opaque ground) and whether the pointer is over or pressing
   * it (a neutral wash). Stacking them keeps four distinct paints — rest,
   * hover, active, and each of those again while selected — instead of
   * collapsing hover and active onto the one background a single element can
   * hold. `-z-10` inside the row's own stacking context puts it above the
   * ground and below every glyph, so nothing it does touches text contrast.
   */
  wash: 'absolute inset-0 -z-10',
  /** Always in the layout, so selection can only ever repaint it. */
  rail: 'absolute inset-y-0 left-0 w-1',
  flag: 'grid size-10 shrink-0 place-items-center rounded-md border border-edge-faint bg-surface-2 text-subtitle leading-none',
  /**
   * One grid, two arrangements, and the dates ahead of the prose in both.
   *
   * Narrow: name, then the visit dates, then whatever else the row has to say.
   * The dates are the payload — a note that pushed them below the fold would
   * bury the one thing this list exists to state.
   *
   * From `md`: a fixed 14rem date column on the right, with the name in the
   * first row of the left column and the note underneath it. Placing all three
   * in one grid rather than nesting the note inside the name block is what lets
   * the same source order read correctly at both widths.
   */
  body: 'grid min-w-0 flex-1 grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_14rem] md:gap-x-4',
  identity: 'flex min-w-0 flex-col gap-1 md:col-start-1 md:row-start-1',
  nameRow: 'flex min-w-0 items-center gap-1.5',
  /** Weight is fixed at 600 in every state: a bolder selected row reflows. */
  name: 'min-w-0 truncate text-label font-semibold text-ink',
  /** Reserved whether or not the tick is drawn, so nothing moves on select. */
  tick: 'grid size-4 shrink-0 place-items-center text-brand',
  meta: 'flex min-w-0 items-center gap-1.5 text-caption',
  code: 'shrink-0 font-semibold tracking-wide tabular-nums',
  /**
   * Two shapes, one grid, and the same height either way.
   *
   * Narrow: each cell is its own stacked block in one of two columns, so one
   * cell and two cells alike come to one line of headings above one line of
   * dates. That is what lets the skeleton reserve the block honestly — the
   * majority of rows are single-visit, and a loading shape that reserved two
   * stacked cells for them would drop the page by a line the moment the real
   * row arrived.
   *
   * From `md`: the cells dissolve (`contents`) into a fixed label column, so
   * every date in the list aligns down one edge rather than starting wherever
   * its own heading happens to end. 5.25rem clears the longest heading
   * ("Visit dates") at 11px with our tracking.
   */
  dates:
    'grid min-w-0 grid-cols-2 items-baseline gap-x-4 gap-y-1 md:col-start-2 md:row-start-1 md:grid-cols-[5.25rem_minmax(0,1fr)] md:gap-x-3',
  dateCell: 'flex min-w-0 flex-col gap-0.5 md:contents',
  /** One cell has both narrow columns to itself, so "Dates not recorded" is a
      sentence on one line rather than a word per line. */
  dateCellWide: 'col-span-2',
  dateLabel: 'text-micro font-semibold uppercase tracking-label',
  dateValue: 'min-w-0 text-caption font-medium tabular-nums text-ink',
  /** Everything the row says beyond its identity and its dates. */
  asides: 'flex min-w-0 flex-col gap-1 md:col-start-1 md:row-start-2',
  aside: 'flex min-w-0 items-start gap-1.5 text-caption',
  /** Carries its own ground, so its contrast is the designed `info` pair in
      both themes rather than a function of whatever the row is painted. */
  outline:
    'flex w-fit min-w-0 items-start gap-1.5 rounded-md bg-info-soft px-2 py-1 text-caption text-info',
  /** A floor rather than a fixed width: four digits are unlikely and still
      have to fit, and a clipped tally is worse than a slightly wider column. */
  count: 'flex min-w-11 shrink-0 flex-col items-end gap-0.5',
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

    /**
     * Bumped only when a row that is *already* selected is chosen again.
     *
     * Re-choosing is a supported gesture — it asks the map to frame the country
     * again — and a live region only speaks when its text changes, so writing the
     * same sentence back into the same node is silent. Flipping which of two
     * regions carries it makes the repeat land somewhere empty and be read out.
     *
     * It is deliberately *not* bumped by every click. A host that commits
     * `selectedCode` asynchronously has not changed the selection yet at the
     * moment of the click, so flipping the parity there moved the *previous*
     * country's sentence into the empty region and announced it — the reader
     * picked Japan and heard "France selected". The announcement below is driven
     * by the sentence it announces: a new selection changes the text, which is
     * what speaks, and this counter exists solely for the case where the text
     * cannot change because it is already correct.
     */
    const [repeats, setRepeats] = React.useState(0)

    const rows = React.useMemo(
      () => sortCountries(countries, order),
      [countries, order],
    )
    const selectedKey = selected === null ? '' : normaliseCode(selected)
    const selectedIndex =
      selectedKey === ''
        ? -1
        : rows.findIndex(
            (row) => normaliseCode(row.countryCode) === selectedKey,
          )

    /**
     * Roving tabindex, held as a country code rather than a position.
     *
     * A position desyncs from the row it was pointing at the moment the order
     * changes: focus stays on Japan while the tab stop slides to whatever row
     * now occupies index 2. The code survives a re-sort, a filtered list and a
     * country arriving or leaving, and it is the same normalised form the rows,
     * the map and `selectedCode` all speak.
     */
    const [focusCode, setFocusCode] = React.useState<string | null>(null)
    React.useEffect(() => {
      if (selectedKey !== '') setFocusCode(selectedKey)
    }, [selectedKey])

    const focusIndex =
      focusCode === null
        ? -1
        : rows.findIndex((row) => normaliseCode(row.countryCode) === focusCode)
    /* The tab stop follows the selection when the map picks a country, so tabbing
       back into the list lands where the reader left off; otherwise it follows
       whichever row was focused last, and falls back to the first row. */
    const activeIndex =
      focusIndex >= 0 ? focusIndex : selectedIndex >= 0 ? selectedIndex : 0

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
        const code = normaliseCode(row.countryCode)
        setFocusCode(code)
        nodes.current.get(code)?.focus()
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
        const code = normaliseCode(row.countryCode)
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
    const announcement =
      statusCountry === undefined
        ? ''
        : `${countryName(statusCountry.countryCode)} selected.${
            statusCountry.hasOutline ? '' : ` ${NO_OUTLINE_NOTICE}`
          }`

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
            const code = normaliseCode(row.countryCode)
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
                  ref={nodeRef(code)}
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
                  onFocus={() => setFocusCode(code)}
                  onClick={() => {
                    // Only a genuine repeat needs the parity flip; a new
                    // country announces itself by changing the sentence.
                    if (code === selectedKey) setRepeats((count) => count + 1)
                    setSelected(code)
                  }}
                  data-motion-transform=""
                  style={{ animationDelay: staggerDelay(index) }}
                  className={cn(
                    layout.row,
                    'group animate-rise cursor-pointer',
                    transitionBase,
                    focusRingInset,
                    // The ground says "this is the country the map is framing".
                    // Hover and press are the wash below, so both channels stay
                    // legible at once and neither ever moves the row.
                    isSelected && 'bg-brand-subtle',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      layout.wash,
                      transitionBase,
                      'bg-transparent group-hover:bg-hover group-active:bg-active',
                    )}
                  />

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
                    </span>

                    <span data-part="dates" className={layout.dates}>
                      {cells.map((cell) => (
                        <span
                          key={cell.label}
                          className={cn(
                            layout.dateCell,
                            cells.length === 1 && layout.dateCellWide,
                          )}
                        >
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
                        </span>
                      ))}
                    </span>

                    {note === null && row.hasOutline ? null : (
                      <span className={layout.asides}>
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
                    )}
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
            where the map has no outline to fly to.

            Two regions, and which one carries the sentence is decided by the
            sentence, never by the click: a new selection changes the text, and
            changed text is what a live region speaks. `repeats` moves it to the
            other region only when the text cannot change because the reader
            re-chose the country already selected. Flipping on the click instead
            announced the previous country to anyone whose host commits the
            selection a tick later. */}
        {[0, 1].map((slot) => (
          <p
            key={slot}
            role="status"
            aria-live="polite"
            data-part="announcement"
            className="sr-only"
          >
            {repeats % 2 === slot ? announcement : ''}
          </p>
        ))}
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
    // A `div`, because `Skeleton` is one: a block element inside a `span` is
    // invalid nesting, and an invalid tree is the browser's parse to repair
    // rather than ours to reason about.
    //
    // `block w-full` trails `className` so it wins the display and width
    // conflicts: the classes handed in are the list's own, and several of them
    // make their element a flex or grid item, which would otherwise shrink the
    // strut to the width of the space inside it.
    <div data-part="bar" className={cn('relative', className, 'block w-full')}>
      <span className="invisible">&nbsp;</span>
      <Skeleton
        radius="sm"
        className={cn(
          'absolute inset-y-0.5',
          align === 'end' ? 'right-0' : 'left-0',
          width,
        )}
      />
    </div>
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
              {/* Two cells, which at every width reserve exactly what one
                  cell reserves: side by side below `md`, and the two rows of
                  the label column from `md` up. A single-visit country — most
                  of them — therefore lands in the space already held for it. */}
              <div data-part="dates" className={layout.dates}>
                {['first', 'last'].map((cell) => (
                  <div key={cell} className={layout.dateCell}>
                    <Bar width="w-14" className={layout.dateLabel} />
                    <Bar width="w-20 max-w-full" className={layout.dateValue} />
                  </div>
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
